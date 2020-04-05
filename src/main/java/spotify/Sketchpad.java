package spotify;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.RestController;

import com.wrapper.spotify.SpotifyApi;

@Component
@RestController
public class Sketchpad {

	@Autowired
	private SpotifyApi spotifyApi;

	/**
	 * Spotify API Sketchpad to do play around and do dirty hacks in.
	 */
	public void sketch() throws Exception {
		// ... insert sketch code here
	}
}
