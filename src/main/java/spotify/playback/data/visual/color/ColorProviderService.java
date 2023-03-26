package spotify.playback.data.visual.color;

import java.util.Optional;
import java.util.logging.Logger;

import javax.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import de.selbi.colorfetch.data.ColorFetchResult;
import spotify.playback.data.dto.sub.ImageData;
import spotify.playback.data.help.BigPictureConstants;

@Service
public class ColorProviderService {
  @Value("${colorfetch.url:#{null}}")
  private String colorFetchServiceUrl;

  private ColorProvider colorProvider;

  private final Logger logger = Logger.getLogger(ColorProviderService.class.getName());

  @PostConstruct
  void printColorLibraryState() {
    if (useExternalWebservice()) {
      logger.info("Using external color fetch service: " + colorFetchServiceUrl);
      this.colorProvider = new ExternalColorProvider(colorFetchServiceUrl);
    } else {
      logger.info("'colorfetch.url' not set in application.properties - using internal color fetch service");
      this.colorProvider = new InternalColorProvider();
    }
  }

  public ColorFetchResult getDominantColorFromImageUrl(String artworkUrl, ImageData previousImageData) {
    if (BigPictureConstants.BLANK.equals(artworkUrl)) {
      return ColorFetchResult.FALLBACK;
    }

    boolean sameUrlAsInPrevious = Optional.ofNullable(previousImageData)
      .map(ImageData::getImageUrl)
      .map(artworkUrl::equals)
      .orElse(false);
    if (sameUrlAsInPrevious) {
      return previousImageData.getImageColors();
    }

    return colorProvider.getDominantColorFromImageUrl(artworkUrl);
  }

  private boolean useExternalWebservice() {
    return colorFetchServiceUrl != null;
  }
}
