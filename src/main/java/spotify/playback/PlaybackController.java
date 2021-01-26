package spotify.playback;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import spotify.playback.PlaybackInfoComponent.CurrentPlaybackInfo;
import spotify.playback.PlaybackInfoComponent.CurrentPlaybackInfoFull;

@RestController
public class PlaybackController {

	private static final long INTERVAL_MS = 1 * 1000;
	private static final long TOLERANCE_MS = 2 * 1000;
	private static final long HEARTBEAT_MS = 25 * 1000;

	@Autowired
	private PlaybackInfoComponent currentPlaybackInfo;

	private long previousMs;

	private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();

	@GetMapping("/playbackinfo")
	public CurrentPlaybackInfo playbackInfo(@RequestParam(defaultValue = "false") boolean full) {
		return currentPlaybackInfo.getCurrentPlaybackInfo(full);
	}

	@GetMapping("/playbackinfoflux")
	public SseEmitter getNewNotification() {
		SseEmitter emitter = new SseEmitter();
		emitter.onCompletion(() -> this.emitters.remove(emitter));
		emitter.onError(e -> emitter.complete());
		this.emitters.add(emitter);
		return emitter;
	}

	@Scheduled(fixedRate = INTERVAL_MS)
	private void fetchCurrentPlaybackInfoAndPublish() {
		if (!this.emitters.isEmpty()) {
			CurrentPlaybackInfo info = getCurrentPlaybackInfo();
			if (info != null && !CurrentPlaybackInfo.EMPTY.equals(info)) {
				List<SseEmitter> deadEmitters = new ArrayList<>();
				this.emitters.forEach(emitter -> {
					try {
						emitter.send(info);
					} catch (Exception e) {
						deadEmitters.add(emitter);
					}
				});
				this.emitters.removeAll(deadEmitters);
			}
		}
	}
	
	@Scheduled(fixedRate = HEARTBEAT_MS)
	private void sendHeartbeat() {
		if (!this.emitters.isEmpty()) {
			List<SseEmitter> deadEmitters = new ArrayList<>();
			this.emitters.forEach(emitter -> {
				try {
					emitter.send(CurrentPlaybackInfo.EMPTY);
				} catch (Exception e) {
					deadEmitters.add(emitter);
				}
			});
			this.emitters.removeAll(deadEmitters);
		}
	}

	private CurrentPlaybackInfo getCurrentPlaybackInfo() {
		CurrentPlaybackInfo info = playbackInfo(false);
		try {
			if (info instanceof CurrentPlaybackInfoFull) {
				return info;
			} else {
				long expectedProgressMs = previousMs + INTERVAL_MS;
				long actualProgressMs = info.getTimeCurrent();
				if (Math.abs(expectedProgressMs - actualProgressMs) > TOLERANCE_MS) {
					return info;
				}
			}
			return CurrentPlaybackInfo.EMPTY;
		} finally {
			this.previousMs = info.getTimeCurrent();
		}
	}
}
