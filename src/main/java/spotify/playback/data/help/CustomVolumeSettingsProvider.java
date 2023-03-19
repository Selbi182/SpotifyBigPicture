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
  private static List<PlaybackInfo.CustomVolumeSettings> customVolumeSettings;

  CustomVolumeSettingsProvider() {
    customVolumeSettings = new ArrayList<>();
    try {
      File customImagesFiles = new File(CUSTOM_VOLUME_SETTINGS_FILE);
      if (customImagesFiles.canRead()) {
        try (Stream<String> customVolumeSettingLines = Files.lines(Path.of(CUSTOM_VOLUME_SETTINGS_FILE))) {
          customVolumeSettingLines
            .filter(line -> !line.startsWith(COMMENT_CHAR) && !line.isBlank())
            .map(line -> line.split(SPLIT_CHAR))
            .forEach(entry -> {
              PlaybackInfo.CustomVolumeSettings customVolumeSettings = new PlaybackInfo.CustomVolumeSettings(entry[0].trim(), Integer.parseInt(entry[1].trim()));
              CustomVolumeSettingsProvider.customVolumeSettings.add(customVolumeSettings);
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
