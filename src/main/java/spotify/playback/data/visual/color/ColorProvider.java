package spotify.playback.data.visual.color;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.jsoup.Jsoup;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class ColorProvider {

  @Value("${colorfetch.url}")
  private String colorFetchUrl;

  private final ObjectMapper objectMapper;
  private final Map<String, ColorFetchResult> cache;

  ColorProvider() {
    this.objectMapper = new ObjectMapper();
    this.cache = new ConcurrentHashMap<>();
  }

  public ColorFetchResult getDominantColorFromImageUrl(String artworkUrl) {
    if (cache.containsKey(artworkUrl)) {
      return cache.get(artworkUrl);
    } else {
      ColorFetchResult fromWebService = getFromWebService(artworkUrl);
      cache.put(artworkUrl, fromWebService);
      return fromWebService;
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
}
