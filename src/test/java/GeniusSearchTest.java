import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.fail;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit4.SpringRunner;

import se.michaelthelin.spotify.SpotifyApi;
import se.michaelthelin.spotify.model_objects.specification.Track;
import spotify.SpotifyBigPicture;
import spotify.api.SpotifyApiManager;
import spotify.api.SpotifyCall;
import spotify.api.events.SpotifyApiException;
import spotify.config.SpotifyApiConfig;
import spotify.playback.data.lyrics.GeniusLyricsScraper;
import spotify.services.PlaylistService;
import spotify.services.UserService;
import spotify.spring.SpringPortConfig;
import spotify.util.SpotifyLogger;
import spotify.util.SpotifyOptimizedExecutorService;
import spotify.util.SpotifyUtils;

@RunWith(SpringRunner.class)
@SpringBootTest(classes = {
  SpotifyApiConfig.class,
  SpotifyApiManager.class,
  SpringPortConfig.class,
  SpotifyLogger.class,
  SpotifyOptimizedExecutorService.class,
  PlaylistService.class,
  UserService.class,
  GeniusLyricsScraper.class,
  SpotifyBigPicture.SpotifyBigPictureSettings.class
})
@EnableConfigurationProperties
public class GeniusSearchTest {

  @Autowired
  private SpotifyApiManager spotifyApiManager;

  @Autowired
  private SpotifyApi spotifyApi;

  @Autowired
  private GeniusLyricsScraper geniusLyricsScraper;

  private static boolean initialized = false;

  @Before
  public void initializeTests() {
    if (!initialized) {
      login();
      initialized = true;
    }
  }

  private void login() {
    try {
      spotifyApiManager.initialLogin();
    } catch (SpotifyApiException e) {
      fail("Couldn't log in to Spotify Web API!");
    }
  }

  ///////////////////////////////

  private void testLyricsSearch(String id) {
    testLyricsSearch(id, true);
  }

  private void testLyricsSearch(String id, boolean expectation) {
    Track track = SpotifyCall.execute(spotifyApi.getTrack(id));
    assertNotNull("Track couldn't be found " + id, track);

    String songLyrics = geniusLyricsScraper.getSongLyrics(SpotifyUtils.getFirstArtistName(track), track.getName());
    String message = expectation ? "Lyrics couldn't be found" : "Lyrics could be found despite not being expected to";
    assertEquals(message, expectation, !songLyrics.isEmpty());
  }

  ///////////////////////////////

  @Test
  public void testLyricsSearchKnownToWork() {
    testLyricsSearch("4zdQmfTLWgGd5mAX4MUIaX");
    testLyricsSearch("4bV5sf2B4hWBBd5HQ8S7KB");
    testLyricsSearch("4bV5sf2B4hWBBd5HQ8S7KB");
    testLyricsSearch("5Hijdt7rmbj9fUJdXEs6Nz");
    testLyricsSearch("5KI4XeWRCHCFwkL2ozf06m");
    testLyricsSearch("4E23uX1BDdUTk9x56nEbla");
    testLyricsSearch("4IMP7v2UPYtFqjWucd7Lfw");
    testLyricsSearch("4HMop4Re0iucehmF7mgV27");
    testLyricsSearch("6q6hG6t5CWF501VRpBT1gC");
  }

  @Test
  public void testLyricsSearchKnownToNotWorkYet() {
    testLyricsSearch("23RoR84KodL5HWvUTneQ1w", false);
    testLyricsSearch("5gEEcgxnyagVvAZlQ43dfn", false);
  }

}

