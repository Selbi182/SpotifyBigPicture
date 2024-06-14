package spotify.playback.data.visual.artwork.service;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Optional;

import org.jsoup.Jsoup;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.neovisionaries.i18n.CountryCode;

import se.michaelthelin.spotify.model_objects.IPlaylistItem;
import se.michaelthelin.spotify.model_objects.specification.Track;
import spotify.services.UserService;
import spotify.util.SpotifyUtils;

/**
 * Searches for high-quality album artwork on iTunes (1000x1000 pixels) to be used instead of the low-res Spotify images.
 * Inspired by: https://bendodson.com/projects/itunes-artwork-finder/index.html
 */
@Component
public class ITunesHDArtworkProvider implements ArtworkUrlProvider {
  private final UriComponentsBuilder uriBuilder;

  ITunesHDArtworkProvider(UserService userService) {
    CountryCode market = userService.getMarketOfCurrentUser();
    this.uriBuilder = UriComponentsBuilder.newInstance()
      .scheme("https")
      .host("itunes.apple.com")
      .path("/search")
      .queryParam("country", market.toString())
      .queryParam("entity", "album");
  }

  @Override
  public Optional<String> getImageUrlFromItem(IPlaylistItem item) {
    if (item instanceof Track) {
      try {
        Track track = (Track) item;
        String artist = SpotifyUtils.getFirstArtistName(track);
        String album = track.getAlbum().getName();
        String iTunesSearchResult = iTunesSearch(artist, album);
        return Optional.ofNullable(iTunesSearchResult);
      } catch (Exception e) {
        e.printStackTrace();
      }
    }
    return Optional.empty();
  }

  private String iTunesSearch(String artist, String album) throws IOException {
    String searchQuery = URLEncoder.encode(artist + " " + album, StandardCharsets.UTF_8);
    String url = uriBuilder.cloneBuilder()
      .queryParam("term", searchQuery)
      .build().toUriString();

    String rawJson = Jsoup.connect(url).ignoreContentType(true).execute().body();
    JsonObject json = JsonParser.parseString(rawJson).getAsJsonObject();

    JsonArray results = json.getAsJsonArray("results");
    if (!results.isEmpty()) {
      String artworkUrl100 = results.get(0).getAsJsonObject().get("artworkUrl100").getAsString();
      return getUncompressedArtworkUrl(artworkUrl100);
    }
    return null;
  }

  private String getUncompressedArtworkUrl(String url) {
    String[] urlParts = url.split("/");
    String newPath = String.join("/", Arrays.copyOfRange(urlParts, 5, urlParts.length - 1));
    return urlParts[0] + "//a5.mzstatic.com/us/r1000/0/" + newPath;
  }
}
