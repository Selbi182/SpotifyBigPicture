package spotify.playback;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Logger;

import javax.annotation.PostConstruct;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.ModelAndView;

import spotify.config.SpotifyApiConfig;
import spotify.playback.control.PlaybackControl;
import spotify.playback.data.PlaybackInfoProvider;
import spotify.playback.data.dto.PlaybackInfo;
import spotify.playback.data.dto.PlaybackInfoError;
import spotify.playback.data.dto.PlaybackInfoResponse;
import spotify.playback.data.dto.misc.BigPictureSetting;
import spotify.playback.data.lyrics.GeniusLyricsScraper;

@RestController
public class PlaybackController {
  private static final String DISABLE_PLAYBACK_CONTROLS_ENV_NAME = "disable_playback_controls";

  private final PlaybackInfoProvider playbackInfoProvider;
  private final PlaybackControl playbackControl;
  private final SpotifyApiConfig spotifyApiConfig;
  private final GeniusLyricsScraper geniusLyrics;

  private List<BigPictureSetting> bigPictureSettings;

  private final boolean playbackControlsDisabled;
  private final Logger logger = Logger.getLogger(PlaybackController.class.getName());

  PlaybackController(PlaybackInfoProvider playbackInfoProvider, PlaybackControl playbackControl, SpotifyApiConfig spotifyApiConfig, GeniusLyricsScraper geniusLyrics) {
    this.playbackInfoProvider = playbackInfoProvider;
    this.spotifyApiConfig = spotifyApiConfig;
    this.playbackControl = playbackControl;
    this.geniusLyrics = geniusLyrics;

    String env = System.getenv(DISABLE_PLAYBACK_CONTROLS_ENV_NAME);
    this.playbackControlsDisabled = Boolean.parseBoolean(env);
  }

  @PostConstruct
  void printPlaybackDisabledState() {
    if (this.playbackControlsDisabled) {
      logger.warning("Playback controls have been manually disabled with " + DISABLE_PLAYBACK_CONTROLS_ENV_NAME + "=true");
    }
  }

  ///////////////

  /**
   * Return the layout.html file (root entry endpoint)
   */
  @GetMapping("/")
  public ModelAndView createSpotifyPlaybackInterfaceView() {
    return new ModelAndView("layout.html");
  }

  /**
   * Get the current playback info as a single request
   *
   * @param v versionId provided by the interface
   *          to see if there actually were any updates
   * @return a PlaybackInfoResponse (either the playback info or an error object)
   */
  @CrossOrigin
  @GetMapping("/playback-info")
  public ResponseEntity<? extends PlaybackInfoResponse> getCurrentPlaybackInfo(@RequestParam int v) {
    try {
      PlaybackInfo currentPlaybackInfo = playbackInfoProvider.getCurrentPlaybackInfo(v);
      return ResponseEntity.ok(currentPlaybackInfo);
    } catch (Exception e) {
      PlaybackInfoError playbackInfoError = new PlaybackInfoError(e);
      return ResponseEntity.internalServerError().body(playbackInfoError);
    }
  }

  ///////////////

  /**
   * Try to look for lyrics for the given song name and artist.
   *
   * @param artist the artist name
   * @param song the song name
   * @return the lyrics as String (empty string when none were found)
   */
  @CrossOrigin
  @GetMapping("/lyrics")
  public ResponseEntity<String> getSongLyrics(@RequestParam String artist, @RequestParam String song) {
    String songLyrics = geniusLyrics.getSongLyrics(artist, song);
    return ResponseEntity.ok(songLyrics);
  }

  ///////////////

  /**
   * Used to control some basic playback states of Spotify from the interface,
   * such as play, pause, toggle shuffle. Returns with the updated playback info.
   *
   * @param control the control to modify
   * @param param an optional parameter requires for some options (like volume)
   * @return the updated playback info on 200, bad request on 400
   *         (unknown parameter name or controls have been disabled using the
   *         <code>disable_playback_controls=true</code> environment variable)
   */
  @CrossOrigin
  @PostMapping("/modify-playback/{control}")
  public ResponseEntity<? extends PlaybackInfoResponse> modifyPlaybackState(@PathVariable String control, @RequestParam(required = false) String param) {
    if (checkPlaybackControlsEnabled() && playbackControl.modifyPlaybackState(control, param)) {
      return getCurrentPlaybackInfo(0);
    }
    return ResponseEntity.badRequest().build();
  }

  ///////////////

  /**
   * Shutdown the application.
   *
   * @param logout if "true", also logs out the user (more specifically, removes the tokens from the properties file)
   * @return 200 on success, 400 on bad request
   *         (unknown parameter name or controls have been disabled using the
   *         <code>disable_playback_controls=true</code> environment variable)
   * @throws IOException on a write error to the properties file
   */
  @CrossOrigin
  @PostMapping("/shutdown")
  public ResponseEntity<Void> shutdown(@RequestParam String logout) throws IOException {
    if (checkPlaybackControlsEnabled()) {
      if (Boolean.parseBoolean(logout)) {
        spotifyApiConfig.logout();
      }
      CompletableFuture.runAsync(() -> System.exit(0));
      return ResponseEntity.ok().build();
    }
    return ResponseEntity.badRequest().build();
  }

  ///////////////

  /**
   * Get a view to manage the visual preferences from anywhere.
   */
  @CrossOrigin
  @GetMapping("/settings")
  public ModelAndView createSettingsView() {
    checkSettingAreSet();
    return new ModelAndView("/settings/settings.html");
  }

  /**
   * Set a flag to toggle the given setting with the next polling request.
   */
  @CrossOrigin
  @PostMapping("/settings/toggle/{settingId}")
  public ResponseEntity<BigPictureSetting> toggleSetting(@PathVariable String settingId) {
    checkSettingAreSet();
    if (settingId.startsWith("preset-") || settingId.equals("reload")) {
      playbackInfoProvider.addSettingToToggleForNextPoll(settingId);
      return ResponseEntity.ok(null);
    } else if (settingId.startsWith("dark-mode-")) {
      Optional<BigPictureSetting> darkModeSetting = this.bigPictureSettings.stream()
        .filter(setting -> setting.getId().equals("dark-mode"))
        .findFirst();
      if (darkModeSetting.isPresent()) {
        BigPictureSetting bigPictureSetting = darkModeSetting.get();
        bigPictureSetting.setState(!bigPictureSetting.getState());
        playbackInfoProvider.addSettingToToggleForNextPoll(settingId);
        return ResponseEntity.ok(bigPictureSetting);
      }
      return ResponseEntity.notFound().build();
    } else {
      Optional<BigPictureSetting> settingToToggle = this.bigPictureSettings.stream()
        .filter(setting -> setting.getId().equals(settingId))
        .findFirst();
      if (settingToToggle.isPresent()) {
        BigPictureSetting bigPictureSetting = settingToToggle.get();
        bigPictureSetting.setState(!bigPictureSetting.getState());
        playbackInfoProvider.addSettingToToggleForNextPoll(settingId);
        return ResponseEntity.ok(bigPictureSetting);
      }
      return ResponseEntity.notFound().build();
    }
  }

  /**
   * Return the currently set list of settings.
   */
  @CrossOrigin
  @GetMapping("/settings/list")
  public ResponseEntity<List<BigPictureSetting>> getSettingsList() {
    checkSettingAreSet();
    return ResponseEntity.ok(bigPictureSettings);
  }

  /**
   * Receive the settings from the backend.
   */
  @CrossOrigin
  @PostMapping("/settings/list")
  public ResponseEntity<String> setSettingsList(@RequestBody List<BigPictureSetting> bigPictureSettings) {
    this.bigPictureSettings = bigPictureSettings;
    return ResponseEntity.ok("Settings have been received!");
  }

  private void checkSettingAreSet() {
    if (bigPictureSettings == null) {
      throw new IllegalStateException("Settings haven't been transmitted yet. Open the interface at least once.");
    }
  }

  private boolean checkPlaybackControlsEnabled() {
    if (playbackControlsDisabled) {
      logger.warning("Playback controls have been manually disabled with " + DISABLE_PLAYBACK_CONTROLS_ENV_NAME + "=true");
      return false;
    }
    return true;
  }
}
