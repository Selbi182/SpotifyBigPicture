package spotify.sketchpads.pads;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.RestController;

import com.google.common.base.Supplier;
import com.wrapper.spotify.model_objects.specification.PlaylistTrack;
import com.wrapper.spotify.model_objects.specification.SavedTrack;
import com.wrapper.spotify.model_objects.specification.Track;

import spotify.sketchpads.Sketchpad;
import spotify.sketchpads.util.SketchCommons;
import spotify.sketchpads.util.SketchConst;

/**
 * Picks out all the songs marked as "saved track" and then matches them against
 * all the songs in The Euphonic Mess. Any saved track that does not appear in
 * that playlist is considered a "good but not good enough" song that should get
 * put into an extra playlist called "The Lesser Mess". Tries to remove to
 * duplicates and remastered version.
 */
@Component
@RestController
public class TheLesserMess implements Sketchpad {

	@Autowired
	private SketchCommons utils;

	@Override
	public int order() {
		return Integer.MIN_VALUE; // Basically the whole reason this exists, so naturally it goes first
	}

	@Override
	public boolean sketch() throws Exception {
		List<PlaylistTrack> euphonicMessPlaylistTracks = utils.getPlaylistTracks(SketchConst.THE_EUPHONIC_MESS);		
		
		List<SavedTrack> savedTracks = utils.getSavedSongs();
		List<PlaylistTrack> lesserMessPlaylistTracks = utils.getPlaylistTracks(SketchConst.THE_LESSER_MESS);

		// Find Lesser Mess songs
		Set<String> uniqueSongIdentifiesFromTheEuphonicMess = new HashSet<>();
		for (PlaylistTrack pt : euphonicMessPlaylistTracks) {
			String uniqueSongIdentifier = utils.uniquePlaylistIdentifier(pt.getTrack());
			uniqueSongIdentifiesFromTheEuphonicMess.add(uniqueSongIdentifier);
		}
		Map<String, SavedTrack> filteredSongs = new HashMap<>();

		savedTracks.forEach(s -> {
			if (!s.getTrack().getName().toLowerCase().contains("remaster")) {
				String uniqueSongIdentifier = utils.uniquePlaylistIdentifier(s.getTrack());
				if (!uniqueSongIdentifiesFromTheEuphonicMess.contains(uniqueSongIdentifier)) {
					filteredSongs.put(uniqueSongIdentifier, s);
				}
			}
		});
		List<SavedTrack> savedSongs = new ArrayList<SavedTrack>(filteredSongs.values());

		// Abort if nothing new was found (with short circuit)
		if (lesserMessPlaylistTracks.size() == savedSongs.size()) {
			Supplier<Stream<String>> savedIdsSupplier = () -> savedSongs.stream()
				.map(SavedTrack::getTrack)
				.map(Track::getId);

			Set<String> previousLesserMess = savedIdsSupplier.get().collect(Collectors.toSet());

			boolean isIdentical = savedIdsSupplier.get().allMatch(s -> previousLesserMess.contains(s));
			if (isIdentical) {
				return false;
			}
		}

		// Order the songs by inverted addition date
		savedSongs.sort(Comparator.comparing(SavedTrack::getAddedAt).reversed());

		// Clear previous playlist
		utils.clearPlaylist(SketchConst.THE_LESSER_MESS, lesserMessPlaylistTracks);

		// Add the songs to playlist
		List<String> allUris = savedSongs.stream()
			.map(SavedTrack::getTrack)
			.map(Track::getUri)
			.collect(Collectors.toList());
		utils.addToPlaylist(SketchConst.THE_LESSER_MESS, allUris);

		return true;
	}
}
