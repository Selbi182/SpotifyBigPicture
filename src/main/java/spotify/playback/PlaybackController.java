package spotify.playback;

import java.io.IOException;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.beans.factory.annotation.Autowired;
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

import spotify.bot.api.events.LoggedInEvent;
import spotify.playback.data.PlaybackInfoDTO;
import spotify.playback.data.PlaybackInfoProvider;
import spotify.playback.data.help.PlaybackInfoConstants;

@EnableScheduling
@RestController
public class PlaybackController {

	@Autowired
	private PlaybackInfoProvider currentPlaybackInfo;

	private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();

	private boolean scheduledPollingEnabled = true;

	@EventListener(LoggedInEvent.class)
	private void ready() {
		System.out.println("Spotify Playback Info ready!");
		System.out.println("Scheduled polling is " + (scheduledPollingEnabled ? "enabled" : "disabled"));
	}

	/**
	 * Get the current playback info as a single request
	 * 
	 * @param full force a full info package, otherwise only the differences
	 * @return the playback info
	 */
	@GetMapping("/playbackinfo")
	public ResponseEntity<PlaybackInfoDTO> getCurrentPlaybackInfo(@RequestParam(defaultValue = "false") boolean full) {
		return ResponseEntity.ok(currentPlaybackInfo.getCurrentPlaybackInfo(full));
	}

	/**
	 * Return an infinite SSEEmitter stream of any changes to the playback info
	 * (observer pattern)
	 * 
	 * @return the emitter
	 * @throws IOException
	 */
	@GetMapping("/playbackinfoflux")
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
	@PostMapping("/playbackinfolistner")
	public ResponseEntity<Void> playbackInfoListener(@RequestBody PlaybackInfoDTO info) {
		if (isAnyoneListening()) {
			if (info != null && !info.isEmpty()) {
				sseSend(info);
			}
		}
		return ResponseEntity.noContent().build();
		
		/* TODO
	    	Spicetify.Player.addEventListener("songchange", () => {
		        const data = Spicetify.Player.data || Spicetify.Queue;
		
		        const jsonData = {
		              type: "DATA",
		              paused: data.is_paused,
		              shuffle: data.options.shuffling_context,
		              repeat: data.options.repeating_context || data.options.repeating_track,
		              device: data.play_origin.view_uri,
		              context: data.context_metadata.context_description,
		              artists: [data.track.metadata.artist_name],
		              title: data.track.metadata.title,
		              album: data.track.metadata.album_title,
		              release: "1970",
		              image: data.track.metadata.image_xlarge_url.replace("spotify:image:", "https://i.scdn.co/image/"),
		              imageColors: null,
		              timeCurrent: 0,
		              timeTotal: data.track.metadata.duration
		        };
		
		        var xmlhttp = new XMLHttpRequest();
		        var theUrl = "http://localhost:8183/playbackinfolistner";
		        xmlhttp.open("POST", theUrl);
		        xmlhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
		        xmlhttp.send(JSON.stringify(jsonData));
		        console.log(data);
		    });
		*/
	}

	/**
	 * Poll the Spotify API for changed playback info and set it to the listeners if
	 * anything was changed
	 */
	@Scheduled(initialDelay = PlaybackInfoConstants.INTERVAL_MS, fixedRate = PlaybackInfoConstants.INTERVAL_MS)
	private void fetchAndPublishCurrentPlaybackInfo() {
		if (scheduledPollingEnabled) {
			if (isAnyoneListening()) {
				PlaybackInfoDTO info = currentPlaybackInfo.getCurrentPlaybackInfo(false);
				if (info != null && !info.isEmpty()) {
					sseSend(info);
				}
			}
		}
	}

	/**
	 * Send empty data to indicate the stream is still alive (otherwise some
	 * browsers might automatically timeout)
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

	private boolean removeDeadEmitter(SseEmitter emitter) {
		return this.emitters.remove(emitter);
	}

	private boolean isAnyoneListening() {
		return !this.emitters.isEmpty();
	}
}
