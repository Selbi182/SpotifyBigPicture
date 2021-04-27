package spotify.playback.data.visual.artwork;

import com.wrapper.spotify.model_objects.IPlaylistItem;
import com.wrapper.spotify.model_objects.specification.Episode;
import com.wrapper.spotify.model_objects.specification.Image;
import com.wrapper.spotify.model_objects.specification.Track;

public class SpotifyArtworkUrlProvider {
	public static String getDefaultSpotifyImage(IPlaylistItem track) {
		Image[] images = null;
		if (track instanceof Track) {
			images = ((Track) track).getAlbum().getImages();
		} else if (track instanceof Episode) {
			images = ((Episode) track).getShow().getImages();
		}
		return ArtworkUtil.findLargestImage(images);
	}
}
