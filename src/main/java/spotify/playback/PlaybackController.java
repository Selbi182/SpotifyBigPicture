package spotify.playback;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import reactor.core.Disposable;
import reactor.core.publisher.Flux;
import spotify.playback.PlaybackInfoComponent.CurrentPlaybackInfo;
import spotify.playback.PlaybackInfoComponent.CurrentPlaybackInfoFull;

@RestController
public class PlaybackController {

	private static final long INTERVAL_MS = 5 * 1000;
	private static final long TOLERANCE_MS = 2 * 1000;

	@Autowired
	private PlaybackInfoComponent currentPlaybackInfo;

	private Flux<CurrentPlaybackInfo> streamFlux;
	
	private long previousMs;
	
	public PlaybackController() {
		this.streamFlux = streamFlux();
	}

	private Flux<CurrentPlaybackInfo> streamFlux() {
		return Flux.interval(Duration.ofMillis(INTERVAL_MS))
			.map(sequence -> {
				CurrentPlaybackInfo info = playbackInfo(false);
				try {
					if (info instanceof CurrentPlaybackInfoFull) {
						return info;
					} else {
						long expectedProgressMs = previousMs + INTERVAL_MS;
						long actualProgressMs = info.getTimeCurrent();
						if (!equalsWithinTolerance(expectedProgressMs, actualProgressMs, 10000)) {
							System.out.println(expectedProgressMs - actualProgressMs);
							return info;
						}
					}
					return CurrentPlaybackInfo.EMPTY;
				} finally {
					this.previousMs = info.getTimeCurrent();
				}
			})
			.filter(CurrentPlaybackInfo::notEmpty);
	}
	
	@GetMapping("/playbackinfo")
	public CurrentPlaybackInfo playbackInfo(@RequestParam(defaultValue = "false") boolean full) {
		return currentPlaybackInfo.getCurrentPlaybackInfo(full);
	}
	
	@GetMapping(path = "/playbackinfoflux", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
	public Disposable fluxWhileSubscribing() {
		return this.streamFlux.subscribe();
		//return this.streamFlux;
	}

	public static boolean equalsWithinTolerance(long a, long b, long eps) {
		return Math.abs(a - b) < eps;
	}
}
