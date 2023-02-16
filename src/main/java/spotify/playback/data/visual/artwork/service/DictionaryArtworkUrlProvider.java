package spotify.playback.data.visual.artwork.service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Component;

import se.michaelthelin.spotify.model_objects.IPlaylistItem;

/**
 * Used to have custom images be used instead of the ones provided by spotify (defined in a separate text file).
 * This is mainly used for local songs, but may also be used when the Spotify image is of low quality or wrong and wants to be replaced.
 */
@Component
public class DictionaryArtworkUrlProvider implements ArtworkUrlProvider {

  private static final String CUSTOM_IMAGES_FILE = "custom_images.txt";
  private static final String SPLIT_CHAR = " -> ";
  private static final String COMMENT_CHAR = "//";
  private static Map<String, String> dictionaryImgMap;

  DictionaryArtworkUrlProvider() {
    dictionaryImgMap = new HashMap<>();
    try {
      File customImagesFiles = new File(CUSTOM_IMAGES_FILE);
      if (customImagesFiles.canRead()) {
        Files.lines(Path.of(CUSTOM_IMAGES_FILE))
          .filter(line -> !line.startsWith(COMMENT_CHAR))
          .map(line -> line.split(SPLIT_CHAR))
          .forEach(entry -> dictionaryImgMap.put(entry[0].trim(), entry[1].trim()));
      }
    } catch (IOException e) {
      System.out.println("Failed to read " + CUSTOM_IMAGES_FILE);
    }

  }

  @Override
  public Optional<String> getImageUrlFromItem(IPlaylistItem item) {
    return Optional.ofNullable(dictionaryImgMap.get(item.getUri()));
  }
}
