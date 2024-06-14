package spotify.playback.data.visual.artwork;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import se.michaelthelin.spotify.model_objects.IPlaylistItem;
import spotify.playback.data.help.BigPictureConstants;
import spotify.playback.data.visual.artwork.service.ArtworkUrlProvider;
import spotify.playback.data.visual.artwork.service.DictionaryArtworkUrlProvider;
import spotify.playback.data.visual.artwork.service.ITunesHDArtworkProvider;
import spotify.playback.data.visual.artwork.service.LastFmArtworkUrlProvider;
import spotify.playback.data.visual.artwork.service.SpotifyArtworkUrlProvider;

@Component
public class ArtworkUrlCache {

  private final DictionaryArtworkUrlProvider dictionaryArtworkUrlProvider;
  private final ITunesHDArtworkProvider iTunesHDArtworkProvider;
  private final SpotifyArtworkUrlProvider spotifyArtworkUrlProvider;
  private final LastFmArtworkUrlProvider lastFmArtworkUrlProvider;

  private final Map<IPlaylistItem, String> artworkUrlCache;

  public ArtworkUrlCache(DictionaryArtworkUrlProvider dictionaryArtworkUrlProvider, ITunesHDArtworkProvider iTunesHDArtworkProvider, SpotifyArtworkUrlProvider spotifyArtworkUrlProvider, LastFmArtworkUrlProvider lastFmArtworkUrlProvider) {
    this.dictionaryArtworkUrlProvider = dictionaryArtworkUrlProvider;
    this.iTunesHDArtworkProvider = iTunesHDArtworkProvider;
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
      List<ArtworkUrlProvider> urlProviders = List.of(dictionaryArtworkUrlProvider, iTunesHDArtworkProvider, spotifyArtworkUrlProvider, lastFmArtworkUrlProvider);
      String urlForPlaylistItem = getUrlForPlaylistItem(item, urlProviders);
      artworkUrlCache.put(item, urlForPlaylistItem);
    }
    return artworkUrlCache.get(item);
  }

  public String getSpotifyArtworkUrl(IPlaylistItem item) {
    List<ArtworkUrlProvider> urlProviders = List.of(dictionaryArtworkUrlProvider, spotifyArtworkUrlProvider);
    return getUrlForPlaylistItem(item, urlProviders);
  }

  private String getUrlForPlaylistItem(IPlaylistItem item, List<ArtworkUrlProvider> urlProviders) {
    for (ArtworkUrlProvider artworkUrlProvider : urlProviders) {
      Optional<String> imageUrlFromItem = artworkUrlProvider.getImageUrlFromItem(item);
      if (imageUrlFromItem.isPresent()) {
        return imageUrlFromItem.get();
      }
    }
    return BigPictureConstants.BLANK;
  }
}
