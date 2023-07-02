package spotify.playback.data.lyrics;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.jagrosh.jlyrics.Lyrics;
import com.jagrosh.jlyrics.LyricsClient;

@Service
public class GeniusLyricsScraper {
  private final LyricsClient lyricsClient;

  GeniusLyricsScraper() {
    this.lyricsClient = new LyricsClient("Genius");
  }

  public String getSongLyrics(String artistName, String songName) {
    try {
      Lyrics lyrics = lyricsClient.getLyrics(artistName + " " + songName).join();
      if (lyrics != null && lyrics.getContent() != null && !lyrics.getContent().isBlank()) {
        return insertLineBreaksEveryFourLines(lyrics.getContent());
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
    return "";
  }

  public static String insertLineBreaksEveryFourLines(String input) {
    StringBuilder result = new StringBuilder();
    List<String> lines = Arrays.stream(input.split("\n"))
      .map(String::strip)
      .map(line -> line.replace("&nbsp;", ""))
      .filter(line -> !line.isBlank() && !line.startsWith("[") && !line.startsWith("]"))
      .collect(Collectors.toList());
    for (int i = 0; i < lines.size(); i++) {
      String line = lines.get(i);
      result.append(line).append("\n");
      if ((i + 1) % 4 == 0 && (i + 1) < lines.size()) {
        result.append("\n");
      }
    }
    return result.toString();
  }
}