package spotify.sketchpads.pads;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

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
public class TheLesserMess implements Sketchpad {

	@Autowired
	private SketchCommons utils;

	@Override
	public RuntimeState runtimeState() {
		return RuntimeState.ENABLED;
	}

	@Override
	public int order() {
		return Integer.MIN_VALUE; // Basically the whole reason this project exists, so naturally it goes first
	}

	@Override
	public boolean sketch() throws Exception {
		List<PlaylistTrack> euphonicMess = utils.getPlaylistTracks(SketchConst.THE_EUPHONIC_MESS);
		List<SavedTrack> savedTracks = utils.getSavedSongs();
		List<PlaylistTrack> lesserMessOld = utils.getPlaylistTracks(SketchConst.THE_LESSER_MESS);

		// Find Lesser Mess songs
		Set<String> uniqueSongsIdsFromTheEuphonicMess = new HashSet<>();
		for (PlaylistTrack pt : euphonicMess) {
			String uniqueSongIdentifier = utils.uniquePlaylistIdentifier((Track) pt.getTrack());
			uniqueSongsIdsFromTheEuphonicMess.add(uniqueSongIdentifier);
		}

		Map<String, SavedTrack> filteredSongs = new HashMap<>();
		for (SavedTrack s : savedTracks) {
			String uniqueSongIdentifier = utils.uniquePlaylistIdentifier(s.getTrack());
			if (!uniqueSongsIdsFromTheEuphonicMess.contains(uniqueSongIdentifier)) {
				filteredSongs.put(uniqueSongIdentifier, s);
			}
		}
		List<SavedTrack> lesserMessNew = new ArrayList<>(filteredSongs.values());

		// Order the songs by inverted addition date
		lesserMessNew.sort(Comparator.comparing(SavedTrack::getAddedAt).reversed());

		// Remove any song that's already in the playlist
		Set<String> lesserMessOldIds = lesserMessOld.stream()
			.map(s -> s.getTrack().getId())
			.collect(Collectors.toSet());
		lesserMessNew.removeIf(s -> lesserMessOldIds.contains(s.getTrack().getId()));

		// Add new songs if anything is left
		if (!lesserMessNew.isEmpty()) {
			// Add to playlist
			List<String> newUris = lesserMessNew.stream()
				.map(SavedTrack::getTrack)
				.map(Track::getUri)
				.collect(Collectors.toList());
			utils.addToPlaylist(SketchConst.THE_LESSER_MESS, newUris);

			// Due to API limitations, playlist additions can only be made to the bottom,
			// reorder these new tracks to be on the top now
			utils.reorderPlaylistTracksToTop(SketchConst.THE_LESSER_MESS, lesserMessOld.size(), newUris.size());

			return true;
		}
		return false;
	}
}
