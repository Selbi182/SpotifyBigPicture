package spotify.playback.data.visual.artwork.service;

import java.io.IOException;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import com.wrapper.spotify.model_objects.IPlaylistItem;
import com.wrapper.spotify.model_objects.specification.Track;

public class DiscogsArtworkUrlProvider {

  public static Optional<String> getArtworkFromDiscogs(IPlaylistItem item) {
    String url = null;

    if (item instanceof Track) { // Podcasts cannot be local files
      Track track = (Track) item;
      try {
        // Find image library ID
        String query = (track.getArtists()[0].getName() + "+" + track.getAlbum().getName()).replace(" ", "+").toLowerCase();
        Document connection = Jsoup.connect("https://www.discogs.com/de/search/?layout=big&type=all&q=" + query).get();
        Elements select = connection.select("#search_results > .card:first-child img");
        if (!select.isEmpty()) {
          String href = select.attr("data-src");
          Matcher matcher = Pattern.compile("R-(\\d+)").matcher(href);
          boolean find = matcher.find();
          if (find) {
            String imageLibraryId = matcher.group(1);

            // Get first image from overview
            Document connection2 = Jsoup.connect("https://www.discogs.com/de/release/" + imageLibraryId + "/images").get();
            Elements select2 = connection2.select("#view_images img");
            if (!select2.isEmpty()) {

              Element first = select2.first();
              if (first != null) {
                url = first.attr("src");
              }
            }
          }
        }
      } catch (IOException e) {
        // e.printStackTrace();
      }
    }
    return Optional.ofNullable(url);
  }

}
