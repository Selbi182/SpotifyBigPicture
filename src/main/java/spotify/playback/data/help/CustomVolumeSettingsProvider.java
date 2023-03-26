package spotify.playback.data.help;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import org.springframework.stereotype.Component;

import spotify.playback.data.dto.PlaybackInfo;

@Component
public class CustomVolumeSettingsProvider {
  private static final String CUSTOM_VOLUME_SETTINGS_FILE = "custom_volume_settings.txt";
  private static final String SPLIT_CHAR = " -> ";
  private static final String COMMENT_CHAR = "//";

  private final List<PlaybackInfo.CustomVolumeSettings> customVolumeSettings;

  CustomVolumeSettingsProvider() {
    this.customVolumeSettings = new ArrayList<>();
    try {
      File customImagesFiles = new File(CUSTOM_VOLUME_SETTINGS_FILE);
      if (customImagesFiles.canRead()) {
        try (Stream<String> customVolumeSettingLines = Files.lines(Path.of(CUSTOM_VOLUME_SETTINGS_FILE))) {
          customVolumeSettingLines
            .filter(line -> !line.startsWith(COMMENT_CHAR) && !line.isBlank())
            .map(line -> line.split(SPLIT_CHAR))
            .forEach(entry -> {
              String deviceName = entry[0].trim();
              int baseDb = Integer.parseInt(entry[1].trim());
              this.customVolumeSettings.add(new PlaybackInfo.CustomVolumeSettings(deviceName, baseDb));
            });
        }
      }
    } catch (IOException | NumberFormatException e) {
      System.out.println("Failed to read " + CUSTOM_VOLUME_SETTINGS_FILE);
    }
  }

  public List<PlaybackInfo.CustomVolumeSettings> getCustomVolumeSettings() {
    return customVolumeSettings;
  }
}
