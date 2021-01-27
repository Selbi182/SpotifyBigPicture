package spotify.playback;

import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
public class PlaybackController {

	protected static final int INTERVAL_MS = 1000;
	private static final int HEARTBEAT_MS = 25 * 1000;

	private static boolean newDataSinceLastHeartbeat = false;

	@Autowired
	private PlaybackInfoComponent currentPlaybackInfo;

	private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();

	/**
	 * Get the current playback info as a single request
	 * 
	 * @param full force a full info package, otherwise only the differences
	 * @return the playback info
	 */
	@GetMapping("/playbackinfo")
	public PlaybackInfo playbackInfo(@RequestParam(defaultValue = "false") boolean full) {
		return currentPlaybackInfo.getCurrentPlaybackInfo(full);
	}

	/**
	 * Return an infinte SSEEmitter stream of any changes to the playback info
	 * (observer pattern)
	 * 
	 * @return the emitter
	 */
	@GetMapping("/playbackinfoflux")
	public SseEmitter getNewNotification() {
		SseEmitter emitter = new SseEmitter();
		emitter.onError(e -> emitter.complete());
		emitter.onCompletion(() -> removeDeadEmitter(emitter));
		this.emitters.add(emitter);
		return emitter;
	}

	/**
	 * Poll the Spotify API for changed playback info and set it to the listeners if
	 * anything was changed
	 */
	@Scheduled(fixedRate = INTERVAL_MS)
	private void fetchCurrentPlaybackInfoAndPublish() {
		if (isAnyoneListening()) {
			PlaybackInfo info = playbackInfo(false);
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
	@Scheduled(fixedRate = HEARTBEAT_MS)
	private void sendHeartbeat() {
		if (!newDataSinceLastHeartbeat) {
			sseSend(PlaybackInfo.EMPTY);
		}
		newDataSinceLastHeartbeat = false;
	}

	private void sseSend(PlaybackInfo info) {
		if (isAnyoneListening()) {
			for (SseEmitter emitter : emitters) {
				try {
					emitter.send(info);
				} catch (Exception e) {
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
