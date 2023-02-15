package spotify.playback.data.visual.artwork.service;

import java.util.Optional;

import spotify.playback.data.visual.artwork.util.ArtworkUtil;
import se.michaelthelin.spotify.model_objects.IPlaylistItem;
import se.michaelthelin.spotify.model_objects.specification.Episode;
import se.michaelthelin.spotify.model_objects.specification.Image;
import se.michaelthelin.spotify.model_objects.specification.Track;

public class SpotifyArtworkUrlProvider {
  public static Optional<String> getDefaultSpotifyImage(IPlaylistItem track) {
    Image[] images = null;
    if (track instanceof Track) {
      images = ((Track) track).getAlbum().getImages();
    } else if (track instanceof Episode) {
      images = ((Episode) track).getImages();
    }
    return Optional.ofNullable(ArtworkUtil.findLargestImage(images));
  }
}
