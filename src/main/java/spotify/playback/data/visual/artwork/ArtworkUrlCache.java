package spotify.playback.data.visual.artwork;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutionException;

import org.springframework.stereotype.Component;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;

import se.michaelthelin.spotify.model_objects.IPlaylistItem;
import spotify.playback.data.help.BigPictureUtils;
import spotify.playback.data.visual.artwork.service.ArtworkUrlProvider;
import spotify.playback.data.visual.artwork.service.DictionaryArtworkUrlProvider;
import spotify.playback.data.visual.artwork.service.LastFmArtworkUrlProvider;
import spotify.playback.data.visual.artwork.service.SpotifyArtworkUrlProvider;

@Component
public class ArtworkUrlCache {

  private final LoadingCache<IPlaylistItem, String> artworkUrlCache;

  public ArtworkUrlCache(DictionaryArtworkUrlProvider dictionaryArtworkUrlProvider, SpotifyArtworkUrlProvider spotifyArtworkUrlProvider, LastFmArtworkUrlProvider lastFmArtworkUrlProvider) {
    final CacheLoader<IPlaylistItem, String> cacheLoader = CacheLoader.from((item) -> {
      for (ArtworkUrlProvider artworkUrlProvider : List.of(dictionaryArtworkUrlProvider, spotifyArtworkUrlProvider, lastFmArtworkUrlProvider)) {
        Optional<String> imageUrlFromItem = artworkUrlProvider.getImageUrlFromItem(item);
        if (imageUrlFromItem.isPresent()) {
          return imageUrlFromItem.get();
        }
      }
      return BigPictureUtils.BLANK;
    });
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
      return artworkUrlCache.get(item);
    } catch (ExecutionException e) {
      e.printStackTrace();
      return BigPictureUtils.BLANK;
    }
  }
}
