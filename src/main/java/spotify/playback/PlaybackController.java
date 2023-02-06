package spotify.playback;

import java.io.IOException;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import spotify.playback.data.PlaybackInfoDTO;
import spotify.playback.data.PlaybackInfoProvider;
import spotify.playback.data.help.PlaybackInfoConstants;

@EnableScheduling
@RestController
public class PlaybackController {

  private final PlaybackInfoProvider playbackInfoProvider;

  private final CopyOnWriteArrayList<SseEmitter> emitters;

  PlaybackController(PlaybackInfoProvider playbackInfoProvider) {
    this.playbackInfoProvider = playbackInfoProvider;
    this.emitters = new CopyOnWriteArrayList<>();
  }

  /**
   * Get the current playback info as a single request
   *
   * @param full force a full info package, otherwise only the differences
   * @return the playback info
   */
  @CrossOrigin
  @GetMapping("/playback-info")
  public ResponseEntity<PlaybackInfoDTO> getCurrentPlaybackInfo(@RequestParam(defaultValue = "false") boolean full) {
    return ResponseEntity.ok(playbackInfoProvider.getCurrentPlaybackInfo(full));
  }

  /**
   * Return an infinite SSEEmitter stream of any changes to the playback info
   * (observer pattern)
   *
   * @return the emitter
   * @throws IOException when the send event fails
   */
  @CrossOrigin
  @GetMapping("/playback-info-flux")
  public ResponseEntity<SseEmitter> createAndRegisterNewFlux() throws IOException {
    SseEmitter emitter = new SseEmitter();
    emitter.onError(e -> emitter.complete());
    emitter.onCompletion(() -> removeDeadEmitter(emitter));
    emitter.send(getCurrentPlaybackInfo(true));
    this.emitters.add(emitter);
    return ResponseEntity.ok().header("X-Accel-Buffering", "no").body(emitter);
  }

  /**
   * Manually toggle dark mode on every connected client.
   *
   * @return info string about if and how many clients were affected
   */
  @CrossOrigin
  @GetMapping("/dark")
  public ResponseEntity<String> globallyToggleDarkMode() {
    if (isAnyoneListening()) {
      sseSend(PlaybackInfoDTO.DARK_MODE);
      return ResponseEntity.ok("Dark mode toggled on " + this.emitters.size() + " listener(s)!");
    }
    return ResponseEntity.ok("No listeners available!");
  }

  /**
   * Manually refresh every listening client.
   *
   * @return info string about if and how many clients were affected
   */
  @CrossOrigin
  @GetMapping("/refresh")
  public ResponseEntity<String> globallyRefreshClients() {
    if (isAnyoneListening()) {
      playbackInfoProvider.refreshDeployTime();
      return ResponseEntity.ok("Refreshed " + this.emitters.size() + " listener(s)!");
    }
    return ResponseEntity.ok("No listeners available!");
  }

  /**
   * Poll the Spotify API for changed playback info and set it to the listeners if
   * anything was changed
   */
  @Scheduled(initialDelay = PlaybackInfoConstants.POLLING_RATE_MS, fixedRate = PlaybackInfoConstants.POLLING_RATE_MS)
  private void fetchAndPublishCurrentPlaybackInfo() {
    if (isAnyoneListening()) {
      PlaybackInfoDTO info = playbackInfoProvider.getCurrentPlaybackInfo(false);
      if (info != null && info.hasPayload()) {
        sseSend(info);
      }
    }
  }

  /**
   * Send empty data to indicate the stream is still alive (otherwise some
   * browsers might automatically time out)
   */
  @Scheduled(initialDelay = PlaybackInfoConstants.HEARTBEAT_MS, fixedRate = PlaybackInfoConstants.HEARTBEAT_MS)
  private void sendHeartbeat() {
    if (isAnyoneListening()) {
      sseSend(PlaybackInfoDTO.HEARTBEAT);
    }
  }

  private void sseSend(PlaybackInfoDTO info) {
    if (isAnyoneListening()) {
      for (SseEmitter emitter : emitters) {
        try {
          emitter.send(info);
        } catch (Exception e) {
          emitter.complete();
          removeDeadEmitter(emitter);
        }
      }
    }
  }

  private void removeDeadEmitter(SseEmitter emitter) {
    this.emitters.remove(emitter);
  }

  private boolean isAnyoneListening() {
    return !this.emitters.isEmpty();
  }
}
