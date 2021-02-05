package spotify.bot.api;

import java.awt.Desktop;
import java.awt.HeadlessException;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpConnectTimeoutException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import javax.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.wrapper.spotify.SpotifyApi;
import com.wrapper.spotify.exceptions.SpotifyWebApiException;
import com.wrapper.spotify.model_objects.credentials.AuthorizationCodeCredentials;

import spotify.bot.api.events.LoggedInEvent;
import spotify.bot.config.Config;
import spotify.bot.util.BotLogger;

@Component
@RestController
public class SpotifyApiAuthorization {

	protected final static String LOGIN_CALLBACK_URI = "/login-callback";

	private final static String SCOPES = "user-read-playback-position user-read-playback-state";

	private static final long LOGIN_TIMEOUT = 10;

	@Autowired
	private SpotifyApi spotifyApi;

	@Autowired
	private Config config;

	@Autowired
	private BotLogger log;

	@Autowired
	private ApplicationEventPublisher applicationEventPublisher;
	
	@PostConstruct
	private void initSpotifyCall() {
		SpotifyCall.spotifyApiAuthorization = this;
	}

	/////////////////////

	@EventListener(ApplicationReadyEvent.class)
	private void initialLogin() {
		refresh();
		applicationEventPublisher.publishEvent(new LoggedInEvent(this));
	}
	
	public String refresh() {
		try {
			return authorizationCodeRefresh();
		} catch (HttpConnectTimeoutException e) {
			authenticate();
			return refresh();
		}
	}

	///////////////////////

	/**
	 * Authentication mutex to be used while the user is being prompted to log in
	 */
	private static Semaphore lock = new Semaphore(0);

	/**
	 * Authentication process
	 * 
	 * @param api
	 */
	private void authenticate() {
		try {
			URI uri = SpotifyCall.execute(spotifyApi.authorizationCodeUri().scope(SCOPES));
			try {
				if (!Desktop.isDesktopSupported()) {
					throw new HeadlessException();
				}
				Desktop.getDesktop().browse(uri);
			} catch (IOException | HeadlessException e) {
				log.warning("Couldn't open browser window. Please login at this URL:");
				System.out.println(uri.toString());
			}
			try {
				lock.tryAcquire(LOGIN_TIMEOUT, TimeUnit.MINUTES);
			} catch (InterruptedException e) {
				log.error("Login timeout! Shutting down application in case of a Spotify Web API anomaly!");
				System.exit(1);
			}
		} catch (BotException e) {
			System.exit(182);
		}
	}

	/**
	 * Callback receiver for logins
	 * 
	 * @param code
	 * @return
	 * @throws SpotifyWebApiException 
	 * @throws BotException
	 * @throws IOException
	 */
	@RequestMapping(LOGIN_CALLBACK_URI)
	private ResponseEntity<String> loginCallback(@RequestParam String code) throws SpotifyWebApiException {
		AuthorizationCodeCredentials acc = SpotifyCall.execute(spotifyApi.authorizationCode(code));
		updateTokens(acc);
		lock.release();
		return new ResponseEntity<String>("Successfully logged in!", HttpStatus.OK);
	}

	///////////////////////

	/**
	 * Refresh the access token
	 * 
	 * @return the new access token
	 */
	private String authorizationCodeRefresh() throws HttpConnectTimeoutException {
		try {
			AuthorizationCodeCredentials acc = Executors.newSingleThreadExecutor()
				.submit(() -> SpotifyCall.execute(spotifyApi.authorizationCodeRefresh()))
				.get(LOGIN_TIMEOUT, TimeUnit.SECONDS);
			updateTokens(acc);
			return acc.getAccessToken();
		} catch (InterruptedException | ExecutionException | TimeoutException e) {
			String msg = "Failed to automatically refresh access token after " + LOGIN_TIMEOUT + " seconds. A manual (re-)login might be required.";
			log.error(msg);
			throw new HttpConnectTimeoutException(msg);
		}
	}

	/**
	 * Store the access and refresh tokens in the settings
	 */
	private void updateTokens(AuthorizationCodeCredentials acc) {
		String accessToken = spotifyApi.getAccessToken();
		if (acc.getAccessToken() != null) {
			accessToken = acc.getAccessToken();
		}
		String refreshToken = spotifyApi.getRefreshToken();
		if (acc.getRefreshToken() != null) {
			refreshToken = acc.getRefreshToken();
		}

		spotifyApi.setAccessToken(accessToken);
		spotifyApi.setRefreshToken(refreshToken);
		try {
			config.updateTokens(accessToken, refreshToken);
		} catch (IOException e) {
			log.error("Failed to update tokens in the properties file! These will get lost during a server restart.");
			e.printStackTrace();
		}
	}
}
