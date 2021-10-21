package spotify.playback.data.visual.artwork.service;

import com.wrapper.spotify.model_objects.IPlaylistItem;
import com.wrapper.spotify.model_objects.specification.Episode;
import com.wrapper.spotify.model_objects.specification.Image;
import com.wrapper.spotify.model_objects.specification.Track;
import spotify.playback.data.visual.artwork.util.ArtworkUtil;

import java.util.Optional;

public class SpotifyArtworkUrlProvider {
	public static Optional<String> getDefaultSpotifyImage(IPlaylistItem track) {
		Image[] images = null;
		if (track instanceof Track) {
			images = ((Track) track).getAlbum().getImages();
		} else if (track instanceof Episode) {
			images = ((Episode) track).getShow().getImages();
		}
		return Optional.ofNullable(ArtworkUtil.findLargestImage(images));
	}
}
