package de.selbi.spotify.bot.config.dto;

import com.neovisionaries.i18n.CountryCode;

public class SpotifyApiConfig {
	private String clientId;
	private String clientSecret;
	private String accessToken;
	private String refreshToken;
	private CountryCode market;

	public String getClientId() {
		return clientId;
	}

	public void setClientId(String clientId) {
		this.clientId = clientId;
	}

	public String getClientSecret() {
		return clientSecret;
	}

	public void setClientSecret(String clientSecret) {
		this.clientSecret = clientSecret;
	}

	public String getAccessToken() {
		return accessToken;
	}

	public void setAccessToken(String accessToken) {
		this.accessToken = accessToken;
	}

	public String getRefreshToken() {
		return refreshToken;
	}

	public void setRefreshToken(String refreshToken) {
		this.refreshToken = refreshToken;
	}

	public CountryCode getMarket() {
		return market;
	}

	public void setMarket(CountryCode market) {
		this.market = market;
	}
}
