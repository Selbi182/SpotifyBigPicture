package spotify.sketchpads.pads;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.wrapper.spotify.model_objects.specification.PlaylistTrack;
import com.wrapper.spotify.model_objects.specification.Track;

import spotify.sketchpads.Sketchpad;
import spotify.sketchpads.util.SketchCommons;
import spotify.sketchpads.util.SketchConst;

/**
 * Creates an inverted playlist of The Euphonic Mess, basically ordering the
 * songs by the time they were historically added to my life. This was necessary
 * because Spotify doesn't have a feature to sort playlists by manual position.
 */
@Component
public class AscendingEuphonicMess implements Sketchpad {

	@Autowired
	private SketchCommons utils;

	@Override
	public int order() {
		return Integer.MAX_VALUE; // Needs to get built last for obvious reasons
	}

	@Override
	public boolean sketch() throws Exception {
		List<PlaylistTrack> euphonicMessPlaylistTracks = utils.getPlaylistTracks(SketchConst.THE_EUPHONIC_MESS);
		List<PlaylistTrack> euphonicMessAscendingPlaylistTracks = utils.getPlaylistTracks(SketchConst.THE_EUPHONIC_MESS_ASCENDING);
		return createInvertedEuphonicMess(euphonicMessPlaylistTracks, euphonicMessAscendingPlaylistTracks);
	}

	private boolean createInvertedEuphonicMess(List<PlaylistTrack> euphonicMessPlaylistTracks, List<PlaylistTrack> euphonicMessAscendingPlaylistTracks) {
		List<String> invertedSongs = getSpotifyUris(euphonicMessPlaylistTracks);
		Collections.reverse(invertedSongs);

		// Technically speaking, we also need to check for differences when the number
		// of songs remained unchanged (e.g. one song added, one removed), but since
		// that happens so rarely and this sketchpad is rather niche, this'll do.
		if (euphonicMessAscendingPlaylistTracks.size() != invertedSongs.size()) {
			utils.clearPlaylist(SketchConst.THE_EUPHONIC_MESS_ASCENDING, euphonicMessAscendingPlaylistTracks);
			utils.addToPlaylist(SketchConst.THE_EUPHONIC_MESS_ASCENDING, invertedSongs);
			return true;
		}
		return false;
	}

	private List<String> getSpotifyUris(List<PlaylistTrack> playlistTracks) {
		return playlistTracks.stream()
			.filter(pt -> !pt.getIsLocal())
			.map(PlaylistTrack::getTrack)
			.map(Track::getUri)
			.collect(Collectors.toList());
	}
}
