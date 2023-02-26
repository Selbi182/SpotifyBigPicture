package spotify.playback.data.visual.artwork;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import se.michaelthelin.spotify.model_objects.IPlaylistItem;
import spotify.playback.data.help.BigPictureUtils;
import spotify.playback.data.visual.artwork.service.ArtworkUrlProvider;
import spotify.playback.data.visual.artwork.service.DictionaryArtworkUrlProvider;
import spotify.playback.data.visual.artwork.service.LastFmArtworkUrlProvider;
import spotify.playback.data.visual.artwork.service.SpotifyArtworkUrlProvider;

@Component
public class ArtworkUrlCache {

  private final DictionaryArtworkUrlProvider dictionaryArtworkUrlProvider;
  private final SpotifyArtworkUrlProvider spotifyArtworkUrlProvider;
  private final LastFmArtworkUrlProvider lastFmArtworkUrlProvider;

  private final Map<IPlaylistItem, String> artworkUrlCache;

  public ArtworkUrlCache(DictionaryArtworkUrlProvider dictionaryArtworkUrlProvider, SpotifyArtworkUrlProvider spotifyArtworkUrlProvider, LastFmArtworkUrlProvider lastFmArtworkUrlProvider) {
    this.dictionaryArtworkUrlProvider = dictionaryArtworkUrlProvider;
    this.spotifyArtworkUrlProvider = spotifyArtworkUrlProvider;
    this.lastFmArtworkUrlProvider = lastFmArtworkUrlProvider;

    this.artworkUrlCache = new ConcurrentHashMap<>();
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
    if (!artworkUrlCache.containsKey(item)) {
      artworkUrlCache.put(item, getUrlForPlaylistItem(item));
    }
    return artworkUrlCache.get(item);
  }

  private String getUrlForPlaylistItem(IPlaylistItem item) {
    for (ArtworkUrlProvider artworkUrlProvider : List.of(dictionaryArtworkUrlProvider, spotifyArtworkUrlProvider, lastFmArtworkUrlProvider)) {
      Optional<String> imageUrlFromItem = artworkUrlProvider.getImageUrlFromItem(item);
      if (imageUrlFromItem.isPresent()) {
        return imageUrlFromItem.get();
      }
    }
    return BigPictureUtils.BLANK;
  }
}
