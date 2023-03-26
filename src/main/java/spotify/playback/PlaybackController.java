package spotify.playback;

import java.util.List;
import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.ModelAndView;

import spotify.playback.control.PlaybackControl;
import spotify.playback.data.PlaybackInfoProvider;
import spotify.playback.data.dto.PlaybackInfo;
import spotify.playback.data.dto.misc.BigPictureSetting;

@RestController
public class PlaybackController {
  private final PlaybackInfoProvider playbackInfoProvider;
  private final PlaybackControl playbackControl;

  private List<BigPictureSetting> bigPictureSettings;

  PlaybackController(PlaybackInfoProvider playbackInfoProvider, PlaybackControl playbackControl) {
    this.playbackInfoProvider = playbackInfoProvider;
    this.playbackControl = playbackControl;
  }

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
   * @return the playback info
   */
  @CrossOrigin
  @GetMapping("/playback-info")
  public ResponseEntity<PlaybackInfo> getCurrentPlaybackInfo(@RequestParam int v) {
    PlaybackInfo currentPlaybackInfo = playbackInfoProvider.getCurrentPlaybackInfo(v);
    return ResponseEntity.ok(currentPlaybackInfo);
  }

  ///////////////

  /**
   * Used to control some basic playback states of Spotify from the interface,
   * such as play, pause, toggle shuffle.
   *
   * @param control the control to modify
   * @param param an optional parameter requires for some options (like volume)
   * @return 200 on success, 400 on bad request
   *         (unknown parameter name or controls have been disabled using the
   *         <code>disable_playback_controls=true</code> environment variable)
   */
  @CrossOrigin
  @PostMapping("/modify-playback/{control}")
  public ResponseEntity<Void> modifyPlaybackState(@PathVariable String control, @RequestParam(required = false) String param) {
    if (playbackControl.modifyPlaybackState(control, param)) {
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
}
