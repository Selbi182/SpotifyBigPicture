package spotify.playback.data.visual.artwork.service;

import java.util.Optional;

import org.springframework.stereotype.Component;

import se.michaelthelin.spotify.model_objects.IPlaylistItem;
import se.michaelthelin.spotify.model_objects.specification.Episode;
import se.michaelthelin.spotify.model_objects.specification.Image;
import se.michaelthelin.spotify.model_objects.specification.Track;
import spotify.util.SpotifyUtils;

@Component
public class SpotifyArtworkUrlProvider implements ArtworkUrlProvider {

  @Override
  public Optional<String> getImageUrlFromItem(IPlaylistItem item) {
    Image[] images;
    if (item instanceof Track) {
      images = ((Track) item).getAlbum().getImages();
    } else if (item instanceof Episode) {
      images = ((Episode) item).getImages();
    } else {
      return Optional.empty();
    }
    return Optional.ofNullable(SpotifyUtils.findLargestImage(images));
  }
}
