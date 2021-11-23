package de.selbi.spotify.playback;

import java.io.IOException;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.context.event.EventListener;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import de.selbi.spotify.SpotifyBigPicture;
import de.selbi.spotify.bot.api.events.LoggedInEvent;
import de.selbi.spotify.playback.data.PlaybackInfoDTO;
import de.selbi.spotify.playback.data.PlaybackInfoProvider;
import de.selbi.spotify.playback.data.help.PlaybackInfoConstants;

@EnableScheduling
@RestController
public class PlaybackController {

  private final PlaybackInfoProvider playbackInfoProvider;

  PlaybackController(PlaybackInfoProvider playbackInfoProvider) {
    this.playbackInfoProvider = playbackInfoProvider;
  }

  private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();

  @EventListener(LoggedInEvent.class)
  public void ready() {
    System.out.println("Spotify Playback Info ready!");
    System.out.println("Scheduled polling is " + (SpotifyBigPicture.scheduledPollingDisabled ? "disabled" : "enabled"));
  }

  /**
   * Get the current playback info as a single request
   *
   * @param full force a full info package, otherwise only the differences
   * @return the playback info
   */
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
   * Manually set the playback info via an external POST request and forward it to any listeners
   *
   * @param info the playback info
   * @return a 204 no content response
   */
  @CrossOrigin
  @PostMapping("/playback-info-listener")
  public ResponseEntity<Void> playbackInfoListener(@RequestBody PlaybackInfoDTO info) {
    if (isAnyoneListening()) {
      if (info != null && info.hasPayload()) {
        sseSend(info);
      }
    }
    return ResponseEntity.noContent().build();
  }

  /**
   * Poll the Spotify API for changed playback info and set it to the listeners if
   * anything was changed
   */
  @Scheduled(initialDelay = PlaybackInfoConstants.INTERVAL_MS, fixedRate = PlaybackInfoConstants.INTERVAL_MS)
  private void fetchAndPublishCurrentPlaybackInfo() {
    if (!SpotifyBigPicture.scheduledPollingDisabled) {
      if (isAnyoneListening()) {
        PlaybackInfoDTO info = playbackInfoProvider.getCurrentPlaybackInfo(false);
        if (info != null && info.hasPayload()) {
          sseSend(info);
        }
      }
    }
  }

  /**
   * Send empty data to indicate the stream is still alive (otherwise some
   * browsers might automatically time out)
   */
  @Scheduled(initialDelay = PlaybackInfoConstants.HEARTBEAT_MS, fixedRate = PlaybackInfoConstants.HEARTBEAT_MS)
  private void sendHeartbeat() {
    sseSend(PlaybackInfoDTO.HEARTBEAT);
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
