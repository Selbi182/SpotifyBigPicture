package spotify.playback;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import spotify.playback.PlaybackInfoComponent.CurrentPlaybackInfo;

@RestController
public class PlaybackController {

	@Autowired
	private PlaybackInfoComponent currentPlaybackInfo;
	
	/**
	 * REST controller for current playback info
	 */
	@GetMapping("/playbackinfo")
	public ResponseEntity<CurrentPlaybackInfo> playbackInfo(@RequestParam(defaultValue = "false") boolean full) throws Exception {
		CurrentPlaybackInfo info = currentPlaybackInfo.getCurrentPlaybackInfo(full);
		return ResponseEntity.ok(info);	
	}
}
