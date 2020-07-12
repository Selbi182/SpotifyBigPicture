package spotify.bot.config.database;

import java.sql.ResultSet;
import java.sql.SQLException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.neovisionaries.i18n.CountryCode;

import spotify.bot.config.dto.SpotifyApiConfig;

@Service
public class DatabaseService {

	@Autowired
	private DiscoveryDatabase database;

	///////////////////////

	/**
	 * Update the access and refresh tokens in the database
	 * 
	 * @param accessToken
	 * @param refreshToken
	 */
	public void updateTokens(String accessToken, String refreshToken) throws SQLException {
		database.update(DBConstants.TABLE_SPOTIFY_API, DBConstants.COL_ACCESS_TOKEN, accessToken);
		database.update(DBConstants.TABLE_SPOTIFY_API, DBConstants.COL_REFRESH_TOKEN, refreshToken);
	}

	////////////////////////
	// READ

	public SpotifyApiConfig getSpotifyApiConfig() throws SQLException {
		ResultSet db = database.selectSingle(DBConstants.TABLE_SPOTIFY_API);
		SpotifyApiConfig spotifyApiConfig = new SpotifyApiConfig();
		spotifyApiConfig.setClientId(db.getString(DBConstants.COL_CLIENT_ID));
		spotifyApiConfig.setClientSecret(db.getString(DBConstants.COL_CLIENT_SECRET));
		spotifyApiConfig.setAccessToken(db.getString(DBConstants.COL_ACCESS_TOKEN));
		spotifyApiConfig.setRefreshToken(db.getString(DBConstants.COL_REFRESH_TOKEN));
		spotifyApiConfig.setMarket(CountryCode.valueOf(db.getString(DBConstants.COL_MARKET)));
		return spotifyApiConfig;
	}
}
