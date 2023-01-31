package spotify.playback.data.visual.color;

import javax.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import de.selbi.colorfetch.data.ColorFetchResult;
import spotify.util.BotLogger;

@Component
public class ColorProviderSetup {

  @Value("${colorfetch.url:#{null}}")
  private String colorFetchServiceUrl;

  private final BotLogger botLogger;

  private ColorProvider colorProvider;

  ColorProviderSetup(BotLogger botLogger) {
    this.botLogger = botLogger;
  }

  @PostConstruct
  void printColorLibraryState() {
    if (useExternalWebservice()) {
      botLogger.info("Using external color fetch service: " + colorFetchServiceUrl);
      this.colorProvider = new ExternalColorProvider(colorFetchServiceUrl);
    } else {
      botLogger.info("'colorfetch.url' not set in application.properties - using internal color fetch service");
      this.colorProvider = new InternalColorProvider();
    }
  }

  public ColorFetchResult getDominantColorFromImageUrl(String artworkUrl) {
    return colorProvider.getDominantColorFromImageUrl(artworkUrl);
  }

  private boolean useExternalWebservice() {
    return colorFetchServiceUrl != null;
  }
}
