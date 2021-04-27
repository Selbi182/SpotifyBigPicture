package spotify.playback.data.visual.artwork;

import java.io.IOException;
import java.util.concurrent.ExecutionException;

import org.springframework.stereotype.Component;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.wrapper.spotify.model_objects.IPlaylistItem;
import com.wrapper.spotify.model_objects.specification.Track;

@Component
public class ArtworkUrlProvider {

	private LoadingCache<ComparablePlaybackItem, String> artworkUrlCache;

	public ArtworkUrlProvider() {
		this.artworkUrlCache = CacheBuilder.newBuilder()
			.build(new CacheLoader<ComparablePlaybackItem, String>() {
				@Override
				public String load(ComparablePlaybackItem item) throws IOException {
					String spotifyImage = SpotifyArtworkUrlProvider.getDefaultSpotifyImage(item.getItem());
					if (spotifyImage != null) {
						return spotifyImage;
					}

					if (item.getItem() instanceof Track) { // Podcasts cannot be local files
						Track track = (Track) item.getItem();
						String discogsImage = DiscogsArtworkUrlProvider.getArtworkFromDiscogs(track);
						if (discogsImage != null) {
							return discogsImage;
						}

						String fallbackDictionaryImage = DictionaryArtworkUrlProvider.getUrlFromList(track);
						if (fallbackDictionaryImage != null) {
							return fallbackDictionaryImage;
						}
					}

					return "";
				}
			});
	}

	public String findArtworkUrl(IPlaylistItem track) {
		try {
			ComparablePlaybackItem comparableTrack = new ComparablePlaybackItem(track);
			return artworkUrlCache.get(comparableTrack);
		} catch (ExecutionException e) {
			e.printStackTrace();
			return null;
		}
	}
}
