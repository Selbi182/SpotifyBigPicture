package spotify.playback.data.lyrics;

import java.io.IOException;

import org.jsoup.Jsoup;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonParser;

import spotify.playback.data.help.BigPictureUtils;

@Service
public class GeniusLyrics {
  private static final String GENIUS_API_BASE_URL = "https://api.genius.com";

  @Value("${genius.api.token:#{null}}")
  private String geniusApiToken;

  @Value("${genius.user.credentials:#{null}}")
  private String geniusUserCredentials;

  public String getSongLyrics(String artistName, String songName) {
    try {
      if (geniusApiToken != null && geniusUserCredentials != null) {
        try {
          String id = searchForSongIdOnGenius(artistName, songName);
          if (id != null) {
            return getLyricsBySongIdOnGenius(id);
          }
        } catch (Exception e) {
          e.printStackTrace();
        }
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
    return "";
  }

  private String searchForSongIdOnGenius(String artistName, String songName) throws IOException {
    String requestUri = UriComponentsBuilder.fromUriString(GENIUS_API_BASE_URL)
      .path("search")
      .queryParam("q", songName + " " + artistName)
      .build().toUriString();

    String rawJson = Jsoup
      .connect(requestUri)
      .userAgent("") // must be forcibly overridden or else genius.com thinks we're coming from a real browser and freaks out
      .ignoreContentType(true)
      .header("Authorization", "Bearer " + geniusApiToken)
      .execute()
      .body();

    JsonElement json = JsonParser.parseString(rawJson);
    JsonArray asJsonArray = json.getAsJsonObject().get("response").getAsJsonObject().get("hits").getAsJsonArray();
    for (JsonElement jsonElement : asJsonArray) {
      String artistNames = BigPictureUtils.getDeepJsonString(jsonElement, "result.artist_names").strip();
      String title = BigPictureUtils.getDeepJsonString(jsonElement, "result.title").strip();
      if (title.equalsIgnoreCase(songName) && artistNames.contains(artistName)) {
        return BigPictureUtils.getDeepJsonString(jsonElement, "result.id");
      }
    }
    return null;
  }

  private String getLyricsBySongIdOnGenius(String id) throws IOException {
    String lyricsUrl = String.format("https://genius.com/api/songs/%s/lyrics_for_edit_proposal", id);
    String rawJson = Jsoup
      .connect(lyricsUrl)
      .cookie("user_credentials", geniusUserCredentials)
      .userAgent("") // must be forcibly overridden or else genius.com thinks we're coming from a real browser and freaks out
      .ignoreContentType(true)
      .ignoreHttpErrors(true)
      .execute()
      .body();

    JsonElement jsonElement = JsonParser.parseString(rawJson);
    String lyricsRaw = BigPictureUtils.getDeepJsonString(jsonElement, "response.lyrics_for_edit_proposal.body.plain");
    return lyricsRaw.replaceAll("\\n", "\n");
  }

}