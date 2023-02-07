package spotify.playback.data.visual.color;

import java.io.IOException;

import org.jsoup.Jsoup;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.databind.ObjectMapper;

import de.selbi.colorfetch.data.ColorFetchResult;

public class ExternalColorProvider implements ColorProvider {
  private final static String STRATEGY = "color_thief";

  private final String colorFetchServiceUrl;
  private final ObjectMapper objectMapper;

  ExternalColorProvider(String colorFetchServiceUrl) {
    this.colorFetchServiceUrl = colorFetchServiceUrl;
    this.objectMapper = new ObjectMapper();
  }

  @Override
  public ColorFetchResult getDominantColorFromImageUrl(String artworkUrl) {
    try {
      String requestUri = UriComponentsBuilder.fromUriString(colorFetchServiceUrl)
          .queryParam("url", artworkUrl)
          .queryParam("strategy", STRATEGY)
          .queryParam("normalize", String.valueOf(NORMALIZE))
          .build().toUriString();
      String rawJson = Jsoup.connect(requestUri).ignoreContentType(true).execute().body();
      return objectMapper.readValue(rawJson, ColorFetchResult.class);
    } catch (IOException e) {
      e.printStackTrace();
      return ColorFetchResult.FALLBACK;
    }
  }
}
