package spotify.playback;

import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import spotify.playback.data.PlaybackInfoProvider;
import spotify.playback.data.dto.PlaybackInfo;

@EnableScheduling
@RestController
public class PlaybackController {
  private final PlaybackInfoProvider playbackInfoProvider;

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
}
