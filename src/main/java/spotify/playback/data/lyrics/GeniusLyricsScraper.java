package spotify.playback.data.lyrics;

import java.io.IOException;
import java.util.StringJoiner;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

@Service
public class GeniusLyricsScraper {

  /**
   * Try to find the lyrics for the given artist and song name on the lyrics website genius.com.
   * This method works by first searching for the track URL, then scraping the lyrics from the actual
   * web page recursively.
   *
   * @param artistName the artist name to search for
   * @param songName the song name to search for
   * @return the lyrics as single, compiled string (empty string if the lyrics couldn't be found)
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

  private static String findLyricsUrl(String artistName, String songName) throws IOException {
    String searchUrl = "https://genius.com/api/search?q=" + artistName + " " + songName;
    Document searchDoc = Jsoup.connect(searchUrl)
      .userAgent("") // needs to be unset or Genius freaks out
      .ignoreContentType(true)
      .get();

    String body = searchDoc.body().text();
    Pattern compile = Pattern.compile("\"path\":\"(.+?)\"");
    Matcher matcher = compile.matcher(body);

    if (matcher.find()) {
      return "https://genius.com" + matcher.group(1);
    }
    return null;
  }

  private static String scrapeLyrics(String url) throws IOException {
    Document document = Jsoup.connect(url)
      .userAgent("") // needs to be unset or Genius freaks out
      .ignoreContentType(true)
      .get();

    Elements lyricsElements = document.select("div[class^=Lyrics__Container]");

    StringJoiner lyricsBuilder = new StringJoiner("\n");
    for (Element element : lyricsElements) {
      StringBuilder lyricsSegment = new StringBuilder();
      recursivelyGetDeepestLyricsNodeText(element, lyricsSegment);
      lyricsBuilder.add(lyricsSegment.toString());
    }
    return lyricsBuilder.toString();
  }

  private static void recursivelyGetDeepestLyricsNodeText(Node node, StringBuilder stringBuilder) {
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