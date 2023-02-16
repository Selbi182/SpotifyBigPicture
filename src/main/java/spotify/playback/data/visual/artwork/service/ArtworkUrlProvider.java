package spotify.playback.data.visual.artwork.service;

import java.util.Optional;

import se.michaelthelin.spotify.model_objects.IPlaylistItem;

public interface ArtworkUrlProvider {
  Optional<String> getImageUrlFromItem(IPlaylistItem item);
}
