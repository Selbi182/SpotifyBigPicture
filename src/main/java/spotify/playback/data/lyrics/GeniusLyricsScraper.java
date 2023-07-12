package spotify.playback.data.lyrics;

import java.io.IOException;

import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

@Service
public class GeniusLyricsScraper {
  private static final String USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
  private static final Gson gson = new Gson();

  /**
   * Try to find the lyrics for the given artist and song name on the lyrics website genius.com.
   * This method works by first searching for the track URL, then scraping the lyrics from the actual
   * web page recursively.
   *
   * @param artistName the artist name to search for
   * @param songName   the song name to search for
   * @return the lyrics as a single, compiled string (empty string if the lyrics couldn't be found)
   */
  public String getSongLyrics(String artistName, String songName) {
    try {
      String url = findLyricsUrl(artistName, songName);
      if (url != null) {
        return scrapeLyrics(url);
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
    return "";
  }

  private String findLyricsUrl(String artistName, String songName) throws IOException {
    String searchUrl = "https://genius.com/api/search?q=" + artistName + " " + songName;
    Connection.Response response = Jsoup.connect(searchUrl)
      .userAgent(USER_AGENT)
      .ignoreContentType(true)
      .execute();
    String json = response.body();

    String matchingPath = findMatchingPath(json, artistName, songName);
    if (matchingPath != null) {
      return "https://genius.com" + matchingPath;
    }
    return null;
  }

  private String findMatchingPath(String json, String artistName, String songName) {
    JsonObject jsonObject = gson.fromJson(json, JsonObject.class);
    JsonArray hits = jsonObject.getAsJsonObject("response").getAsJsonArray("hits");

    for (JsonElement hit : hits) {
      JsonObject result = hit.getAsJsonObject().getAsJsonObject("result");
      String artistNames = result.get("artist_names").getAsString();
      String title = result.get("title").getAsString();

      if (StringUtils.startsWithIgnoreCase(artistNames, artistName) && StringUtils.startsWithIgnoreCase(title, songName)) {
        return result.get("path").getAsString();
      }
    }

    return null;
  }

  private String scrapeLyrics(String url) throws IOException {
    Connection.Response response = Jsoup.connect(url)
      .userAgent(USER_AGENT)
      .ignoreContentType(true)
      .execute();

    Document document = response.parse();
    Elements lyricsElements = document.select("div[class^=Lyrics__Container]");

    StringBuilder lyricsBuilder = new StringBuilder();
    for (Element element : lyricsElements) {
      recursivelyGetDeepestLyricsNodeText(element, lyricsBuilder);
    }
    return lyricsBuilder.toString();
  }

  private void recursivelyGetDeepestLyricsNodeText(Node node, StringBuilder stringBuilder) {
    if (node instanceof TextNode) {
      // Get the raw lyrics text for this verse
      TextNode textNode = (TextNode) node;
      String text = textNode.text();
      stringBuilder.append(text);
    } else if (node instanceof Element) {
      Element element = (Element) node;
      if ("br".equals(element.tagName())) {
        // Special case: if it's a <br> node, make sure the line breaks are preserved
        stringBuilder.append("\n");
      } else {
        for (Node childNode : element.childNodes()) {
          recursivelyGetDeepestLyricsNodeText(childNode, stringBuilder);
        }
      }
    }
  }
}
