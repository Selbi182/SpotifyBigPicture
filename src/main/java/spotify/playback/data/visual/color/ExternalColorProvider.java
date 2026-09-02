package spotify.playback.data.visual.color;

import java.io.IOException;

import org.jsoup.Jsoup;
import org.springframework.web.util.UriComponentsBuilder;

import com.google.gson.Gson;

import de.selbi.colorfetch.data.ColorFetchResult;
import spotify.util.SpotifyUtils;

public class ExternalColorProvider implements ColorProvider {
  private final static String STRATEGY = "color_thief";

  private final String colorFetchServiceUrl;
  private final Gson gson;

  ExternalColorProvider(String colorFetchServiceUrl) {
    this.colorFetchServiceUrl = colorFetchServiceUrl;
    this.gson = new Gson();
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

      return gson.fromJson(rawJson, ColorFetchResult.class);
    } catch (IOException e) {
      SpotifyUtils.genericException(e);
      return ColorFetchResult.FALLBACK;
    }
  }
}
