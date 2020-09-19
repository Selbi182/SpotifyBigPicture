package spotify.sketchpads.pads;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.wrapper.spotify.model_objects.specification.PlaylistTrack;

import spotify.sketchpads.Sketchpad;
import spotify.sketchpads.util.SketchCommons;
import spotify.sketchpads.util.SketchConst;

/**
 * Reorders tracks below "Auf Gute Freunde" to be at the very top of the
 * playlist. The reordering happens as a single chunk, so the "oldest" newest
 * songs will now be at the very top of the playlist.
 * 
 * @param euphonicMessPlaylistTracks
 * @return
 */
@Component
public class MoveNewEuphonicMessSongsToTop implements Sketchpad {

	@Autowired
	private SketchCommons utils;

	@Override
	public boolean sketch() throws Exception {
		List<PlaylistTrack> euphonicMessPlaylistTracks = utils.getPlaylistTracks(SketchConst.THE_EUPHONIC_MESS);
		return moveNewEuphonicMessSongsToTop(euphonicMessPlaylistTracks);
	}

	private boolean moveNewEuphonicMessSongsToTop(List<PlaylistTrack> euphonicMessPlaylistTracks) {
		int count = 0;
		int bottom = -1;
		for (int i = euphonicMessPlaylistTracks.size() - 1; i > 0; i--) {
			if (euphonicMessPlaylistTracks.get(i).getTrack().getId().equals(SketchConst.AUF_GUTE_FREUNDE)) {
				bottom = i + 1;
				break;
			}
			count++;
		}

		if (count > 0) {
			utils.reorderPlaylistTracks(SketchConst.THE_EUPHONIC_MESS, count, bottom);
			return true;
		}
		return false;
	}

}
