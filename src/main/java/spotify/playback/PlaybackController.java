package spotify.playback;

import java.io.IOException;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
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

	private static boolean newDataSinceLastHeartbeat = false;

	@Autowired
	private PlaybackInfoProvider currentPlaybackInfo;

	private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();
	
	@EventListener(ApplicationReadyEvent.class)
	private void done() {
		System.out.println("Spotify Playback Info ready!");
	}
	
	/**
	 * Get the current playback info as a single request
	 * 
	 * @param full force a full info package, otherwise only the differences
	 * @return the playback info
	 */
	@GetMapping("/playbackinfo")
	public PlaybackInfoDTO playbackInfo(@RequestParam(defaultValue = "false") boolean full) {
		return currentPlaybackInfo.getCurrentPlaybackInfo(full);
	}

	/**
	 * Return an infinte SSEEmitter stream of any changes to the playback info
	 * (observer pattern)
	 * 
	 * @return the emitter
	 * @throws IOException 
	 */
	@GetMapping("/playbackinfoflux")
	public SseEmitter getNewNotification() throws IOException {
		SseEmitter emitter = new SseEmitter();
		emitter.onError(e -> emitter.complete());
		emitter.onCompletion(() -> removeDeadEmitter(emitter));
		emitter.send(PlaybackInfoDTO.EMPTY);
		this.emitters.add(emitter);
		return emitter;
	}

	/**
	 * Poll the Spotify API for changed playback info and set it to the listeners if
	 * anything was changed
	 */
	@Scheduled(initialDelay = PlaybackInfoConstants.INTERVAL_MS, fixedRate = PlaybackInfoConstants.INTERVAL_MS)
	private synchronized void fetchCurrentPlaybackInfoAndPublish() {
		if (isAnyoneListening()) {
			PlaybackInfoDTO info = playbackInfo(false);
			if (info != null && !info.isEmpty()) {
				newDataSinceLastHeartbeat = true;
				sseSend(info);
			}
		}
	}

	/**
	 * Send empty data to indicate the stream is still alive (otherwise some
	 * browsers might automatically timeout)
	 */
	@Scheduled(initialDelay = PlaybackInfoConstants.HEARTBEAT_MS, fixedRate = PlaybackInfoConstants.HEARTBEAT_MS)
	private void sendHeartbeat() {
		if (!newDataSinceLastHeartbeat) {
			sseSend(PlaybackInfoDTO.EMPTY);
		}
		newDataSinceLastHeartbeat = false;
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

	private boolean removeDeadEmitter(SseEmitter emitter) {
		return this.emitters.remove(emitter);
	}

	private boolean isAnyoneListening() {
		return !this.emitters.isEmpty();
	}
}
