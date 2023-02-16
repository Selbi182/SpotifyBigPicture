package spotify.playback.data.visual.artwork.service;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

import javax.annotation.PostConstruct;

import org.jsoup.Jsoup;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.util.UriUtils;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import se.michaelthelin.spotify.model_objects.IPlaylistItem;
import se.michaelthelin.spotify.model_objects.specification.Track;
import spotify.util.BotUtils;

@Component
public class LastFmArtworkUrlProvider implements ArtworkUrlProvider {
  private static final String TARGET_IMAGE_SIZE = "extralarge";

  @Value("${lastfm.api.token:#{null}}")
  private String lastFmApiToken;

  private UriComponentsBuilder lastFmApiUrl;

  @PostConstruct
  private void init() {
    if (lastFmApiToken != null) {
      this.lastFmApiUrl = UriComponentsBuilder.newInstance()
          .scheme("http")
          .host("ws.audioscrobbler.com")
          .path("/2.0")
          .queryParam("api_key", lastFmApiToken)
          .queryParam("format", "json")
          .queryParam("method", "track.getInfo");
    }
  }

  @Override
  public Optional<String> getImageUrlFromItem(IPlaylistItem item) {
    if (lastFmApiUrl != null && item instanceof Track) {
      Track track = (Track) item;
      String url = lastFmApiUrl.cloneBuilder()
          .queryParam("artist", escape(BotUtils.getFirstArtistName(track)))
          .queryParam("track", escape(track.getName()))
          .build().toUriString();
      JsonElement json = executeRequest(url);
      if (json != null && json.isJsonArray()) {
        for (JsonElement elem : json.getAsJsonArray()) {
          JsonObject imageEntry = elem.getAsJsonObject();
          String size = imageEntry.get("size").getAsString();
          if (TARGET_IMAGE_SIZE.equals(size)) {
            String imageUrl = imageEntry.get("#text").getAsString();
            if (!imageUrl.isBlank()) {
              return Optional.of(imageUrl);
            }
          }
        }
      }
    }
    return Optional.empty();
  }

  private String escape(String lfmUserName) {
    return UriUtils.encode(lfmUserName, StandardCharsets.UTF_8);
  }

  private JsonElement executeRequest(String url) {
    try {
      String rawJson = Jsoup.connect(url).ignoreContentType(true).execute().body();
      JsonObject json = JsonParser.parseString(rawJson).getAsJsonObject();
      if (!json.has("error")) {
        JsonObject currentObjectInJsonTree = json;
        for (String key : "track.album.image".split("\\.")) {
          if (!currentObjectInJsonTree.has(key)) {
            return null;
          }
          JsonElement jsonElement = currentObjectInJsonTree.get(key);
          if (jsonElement.isJsonArray()) {
            return jsonElement;
          }
          currentObjectInJsonTree = jsonElement.getAsJsonObject();
        }
        return currentObjectInJsonTree;
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
    return null;
  }
}