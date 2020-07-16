package spotify.bot.api;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.wrapper.spotify.SpotifyApi;
import com.wrapper.spotify.SpotifyHttpManager;

import spotify.bot.config.Config;

@Configuration
public class SpotifyApiWrapper {

	@Autowired
	private Config config;

	/**
	 * Creates a SpotifyApi instance with the most common settings. A
	 * preconfiguration from the database is taken first.
	 * 
	 * @return the API instance
	 */
	@Bean
	SpotifyApi spotifyApi() {
		SpotifyApi spotifyApi = new SpotifyApi.Builder()
			.setClientId(config.spotifyBotConfig().getClientId())
			.setClientSecret(config.spotifyBotConfig().getClientSecret())
			.setRedirectUri(SpotifyHttpManager.makeUri(SpotifyApiAuthorization.LOGIN_CALLBACK_URI))
			.build();
		spotifyApi.setAccessToken(config.spotifyBotConfig().getAccessToken());
		spotifyApi.setRefreshToken(config.spotifyBotConfig().getRefreshToken());
		return spotifyApi;
	}
}
