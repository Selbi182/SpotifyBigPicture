package spotify.playback.data.visual.artwork;

import java.util.Objects;
import java.util.concurrent.ExecutionException;

import org.springframework.stereotype.Component;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.wrapper.spotify.model_objects.IPlaylistItem;

import spotify.playback.data.visual.artwork.service.DictionaryArtworkUrlProvider;
import spotify.playback.data.visual.artwork.service.DiscogsArtworkUrlProvider;
import spotify.playback.data.visual.artwork.service.SpotifyArtworkUrlProvider;
import spotify.playback.data.visual.artwork.util.ComparablePlaybackItem;

@Component
public class ArtworkUrlProvider {

  private final LoadingCache<ComparablePlaybackItem, String> artworkUrlCache;

  public ArtworkUrlProvider() {
    final CacheLoader<ComparablePlaybackItem, String> cacheLoader = CacheLoader.from((item) ->
        DictionaryArtworkUrlProvider.getUrlFromList(Objects.requireNonNull(item).getItem())
            .or(() -> SpotifyArtworkUrlProvider.getDefaultSpotifyImage(item.getItem()))
            .or(() -> DiscogsArtworkUrlProvider.getArtworkFromDiscogs(item.getItem()))
            .orElse(""));
    this.artworkUrlCache = CacheBuilder.newBuilder().build(cacheLoader);
  }

  /**
   * Find the artwork URL of the currently playing track. This will be the one
   * provided by Spotify in 99% of all cases, but for local files some workarounds
   * are put into place.
   *
   * @param item the item (either track or podcast)
   * @return the URL, empty string if none was found
   */
  public String findArtworkUrl(IPlaylistItem item) {
    try {
      ComparablePlaybackItem comparableTrack = new ComparablePlaybackItem(item);
      return artworkUrlCache.get(comparableTrack);
    } catch (ExecutionException e) {
      e.printStackTrace();
      return null;
    }
  }
}
