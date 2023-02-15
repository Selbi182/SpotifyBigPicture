package spotify.playback;

import java.util.List;

import org.apache.hc.core5.net.URIBuilder;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.ModelAndView;

import spotify.playback.data.PlaybackInfoProvider;
import spotify.playback.data.dto.BigPictureSetting;
import spotify.playback.data.dto.PlaybackInfo;

@EnableScheduling
@RestController
public class PlaybackController {
  private final PlaybackInfoProvider playbackInfoProvider;

  private List<BigPictureSetting> bigPictureSettings;

  PlaybackController(PlaybackInfoProvider playbackInfoProvider) {
    this.playbackInfoProvider = playbackInfoProvider;
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
   * Get a view to manage the visual preferences from anywhere.
   */
  @GetMapping("/settings")
  public ModelAndView createSettingsView() {
    checkSettingAreSet();
    URIBuilder uriBuilder = new URIBuilder();
    uriBuilder.setPath("/settings/settings.html");
    ModelAndView modelAndView = new ModelAndView();
    modelAndView.setViewName(uriBuilder.toString());
    return modelAndView;
  }

  /**
   * Set a flag to toggle the given setting with the next polling request.
   */
  @PostMapping("/settings/toggle/{settingId}")
  public ResponseEntity<String> toggleSetting(@PathVariable String settingId) {
    checkSettingAreSet();
    playbackInfoProvider.addSettingToToggleForNextPoll(settingId);
    return ResponseEntity.ok("");
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
