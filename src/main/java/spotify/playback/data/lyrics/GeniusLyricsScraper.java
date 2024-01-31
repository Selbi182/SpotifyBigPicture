package spotify.playback.data.lyrics;

import java.io.IOException;
import java.util.Arrays;
import java.util.StringJoiner;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.commons.logging.Log;
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


// TODO: redo implementation based on fmbot https://github.com/fmbot-discord/fmbot/blob/dev/src/FMBot.Bot/Services/ThirdParty/GeniusService.cs#L22
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
    // Preprocess artistName and songName to remove brackets
    String processedArtistName = preprocessString(artistName);
    String processedSongName = preprocessString(songName);

    String searchUrl = "https://genius.com/api/search?q=" + processedArtistName + " " + processedSongName;

    Connection.Response response = Jsoup.connect(searchUrl)
            .userAgent(USER_AGENT)
            .ignoreContentType(true)
            .execute();
    String json = response.body();

    String matchingPath = findMatchingPath(json, processedArtistName, processedSongName);

    if (matchingPath != null) {
      return "https://genius.com" + matchingPath;
    }
    return null;
  }

  private String preprocessString(String input) {
    // Remove all occurrences of problematic symbols
    input = input.replaceAll("[#@_]", "");

    // Check if the string contains only non-language characters outside the brackets
    String outsideBrackets = input.replaceAll("\\(.*?\\)", "").trim();
    if (outsideBrackets.isEmpty() || outsideBrackets.matches("[^\\p{L}\\p{N}]+")) {
      // If so, keep the content inside the brackets
      Pattern pattern = Pattern.compile("\\((.*?)\\)");
      Matcher matcher = pattern.matcher(input);
      if (matcher.find()) {
        return matcher.group(1).trim();
      }
    }

    // Remove content inside brackets
    input = input.replaceAll("\\(.*?\\)", "").trim();

    // Remove any trailing text after an unpaired opening bracket
    if (input.contains("(") && !input.contains(")")) {
      input = input.substring(0, input.indexOf('(')).trim();
    }

    return input;
  }

  private String findMatchingPath(String json, String artistName, String songName) {
    JsonObject jsonObject = gson.fromJson(json, JsonObject.class);
    JsonArray hits = jsonObject.getAsJsonObject("response").getAsJsonArray("hits");

    // Normalize the search strings
    String normalizedArtistName = normalizeString(artistName);
    String normalizedSongName = normalizeString(songName);
    String[] artistNameParts = normalizedArtistName.split("\\s+");

    for (JsonElement hit : hits) {
      JsonObject result = hit.getAsJsonObject().getAsJsonObject("result");
      String artistNames = result.get("artist_names").getAsString();
      String title = result.get("title").getAsString();

      // Normalize the JSON strings
      String normalizedArtistNames = normalizeString(artistNames);
      String normalizedTitle = normalizeString(title);

      // Check for partial matches in artist names
      boolean artistMatch = Arrays.stream(artistNameParts)
              .allMatch(normalizedArtistNames::contains);
      // Match title
      boolean titleMatch = normalizedTitle.contains(normalizedSongName);

      if (artistMatch && titleMatch) {
        return result.get("path").getAsString();
      }
    }

    return null;
  }

  private String normalizeString(String input) {
    return input.toLowerCase().replaceAll("[^a-zA-Z0-9\\s]", "").trim();
  }

  private String scrapeLyrics(String url) throws IOException {
    Connection.Response response = Jsoup.connect(url)
      .userAgent(USER_AGENT)
      .ignoreContentType(true)
      .execute();

    Document document = response.parse();
    Elements lyricsElements = document.select("div[class^=Lyrics__Container]");

    StringJoiner lyricsBlocks = new StringJoiner("\n");
    for (Element element : lyricsElements) {
      StringBuilder lyricsBuilder = new StringBuilder();
      recursivelyGetDeepestLyricsNodeText(element, lyricsBuilder);
      lyricsBlocks.add(lyricsBuilder);
    }
    return lyricsBlocks.toString();
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
