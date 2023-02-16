package spotify.playback.data.visual.artwork.service;

import java.util.Optional;

import org.springframework.stereotype.Component;

import se.michaelthelin.spotify.model_objects.IPlaylistItem;
import se.michaelthelin.spotify.model_objects.specification.Episode;
import se.michaelthelin.spotify.model_objects.specification.Image;
import se.michaelthelin.spotify.model_objects.specification.Track;
import spotify.util.BotUtils;

@Component
public class SpotifyArtworkUrlProvider implements ArtworkUrlProvider {
  @Override
  public Optional<String> getImageUrlFromItem(IPlaylistItem item) {
    if (item instanceof Track) {
      return getImageFromTrack((Track) item);
    } else if (item instanceof Episode) {
      return getImageFromEpisode((Episode) item);
    }
    return Optional.empty();
  }

  private Optional<String> getImageFromTrack(Track track) {
    Image[] images = track.getAlbum().getImages();
    return Optional.ofNullable(BotUtils.findLargestImage(images));
  }

  private Optional<String> getImageFromEpisode(Episode episode) {
    Image[] images = episode.getImages();
    return Optional.ofNullable(BotUtils.findLargestImage(images));
  }
}
