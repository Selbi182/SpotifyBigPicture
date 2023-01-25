package spotify.playback.data.visual.artwork.service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import se.michaelthelin.spotify.model_objects.IPlaylistItem;

/**
 * Used to have custom images be used instead of the ones provided by spotify (defined in a separate text file).
 * This is mainly used for local songs, but may also be used when the Spotify image is of low quality or wrong and wants to be replaced.
 */
public class DictionaryArtworkUrlProvider {

  private static final String CUSTOM_IMAGES_FILE = "custom_images.txt";
  private static final String SPLIT_CHARS = ";;;";
  private static Map<String, String> URLS;

  public static Optional<String> getUrlFromList(IPlaylistItem item) {
    return Optional.ofNullable(getUrlsMap().get(item.getUri()));
  }

  private static Map<String, String> getUrlsMap() {
    if (URLS != null) {
      return URLS;
    }
    try {
      URLS = new HashMap<>();
      File customImagesFiles = new File(CUSTOM_IMAGES_FILE);
      if (customImagesFiles.canRead()) {
        Files.lines(Path.of(CUSTOM_IMAGES_FILE))
            .map(line -> line.split(SPLIT_CHARS))
            .forEach(entry -> URLS.put(entry[0], entry[1]));
      }
      return URLS;
    } catch (IOException e) {
      return Map.of();
    }
  }
}
