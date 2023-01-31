package spotify.playback.data.visual.color;

import java.io.IOException;
import java.util.concurrent.ExecutionException;

import javax.annotation.PostConstruct;

import org.jsoup.Jsoup;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.databind.ObjectMapper;

import de.selbi.colorfetch.cache.ColorCacheKey;
import de.selbi.colorfetch.cache.ColorResultCache;
import de.selbi.colorfetch.data.ColorFetchResult;
import spotify.util.BotLogger;

@Component
public class ColorProvider {

  private final BotLogger botLogger;

  // Using internal library
  private final ColorResultCache colorResultCache;

  // Using external web service
  @Value("${colorfetch.url:#{null}}")
  private String colorFetchUrl;
  private final ObjectMapper objectMapper;

  ColorProvider(BotLogger botLogger, ColorResultCache colorResultCache) {
    this.botLogger = botLogger;
    this.colorResultCache = colorResultCache;
    this.objectMapper = new ObjectMapper();
  }

  @PostConstruct
  void printColorLibraryState() {
    if (useExternalWebservice()) {
      botLogger.info("Using external color fetch service: " + colorFetchUrl);
    } else {
      botLogger.info("'colorfetch.url' not set in application.properties - using internal color fetch service");
    }
  }

  public ColorFetchResult getDominantColorFromImageUrl(String artworkUrl) {
    if (useExternalWebservice()) {
      return getFromWebService(artworkUrl);
    } else {
      ColorCacheKey colorCacheKey = ColorCacheKey.of(artworkUrl, ColorCacheKey.Strategy.COLOR_THIEF, true);
      try {
        return colorResultCache.getColor(colorCacheKey);
      } catch (ExecutionException e) {
        e.printStackTrace();
        return ColorFetchResult.FALLBACK;
      }
    }
  }

  private ColorFetchResult getFromWebService(String artworkUrl) {
    try {
      String requestUri = UriComponentsBuilder.fromUriString(colorFetchUrl)
          .queryParam("url", artworkUrl)
          .queryParam("strategy", "color_thief").build().toUriString();
      String rawJson = Jsoup.connect(requestUri).ignoreContentType(true).execute().body();
      return objectMapper.readValue(rawJson, ColorFetchResult.class);
    } catch (IOException e) {
      e.printStackTrace();
      return ColorFetchResult.FALLBACK;
    }
  }

  private boolean useExternalWebservice() {
    return colorFetchUrl != null;
  }
}
