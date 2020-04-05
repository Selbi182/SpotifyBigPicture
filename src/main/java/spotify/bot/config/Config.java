package spotify.bot.config;

import java.io.IOException;
import java.sql.SQLException;

import javax.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;

import spotify.bot.config.database.DatabaseService;
import spotify.bot.config.dto.SpotifyApiConfig;

@Configuration
public class Config {

	@Autowired
	private DatabaseService databaseService;

	private SpotifyApiConfig spotifyApiConfig;

	/**
	 * Sets up or refreshes the configuration for the Spotify bot from the database
	 */
	@PostConstruct
	private void init() throws SQLException, IOException {
		this.spotifyApiConfig = getSpotifyApiConfig();
	}

	/**
	 * Update the access and refresh tokens, both in the config object as well as
	 * the database
	 * 
	 * @param accessToken
	 * @param refreshToken
	 */
	public void updateTokens(String accessToken, String refreshToken) throws IOException, SQLException {
		spotifyApiConfig.setAccessToken(accessToken);
		spotifyApiConfig.setRefreshToken(refreshToken);
		databaseService.updateTokens(accessToken, refreshToken);
	}

	////////////////////
	// CONFIG DTOS

	/**
	 * Retuns the bot configuration. May be created if not present.
	 * 
	 * @return
	 */
	public SpotifyApiConfig getSpotifyApiConfig() throws SQLException, IOException {
		if (spotifyApiConfig == null) {
			spotifyApiConfig = databaseService.getSpotifyApiConfig();
		}
		return spotifyApiConfig;
	}
}
