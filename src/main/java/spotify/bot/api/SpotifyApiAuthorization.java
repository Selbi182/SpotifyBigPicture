package spotify.bot.api;

import java.awt.Desktop;
import java.awt.HeadlessException;
import java.io.IOException;
import java.net.URI;
import java.sql.SQLException;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

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
import com.wrapper.spotify.model_objects.credentials.AuthorizationCodeCredentials;

import spotify.bot.api.events.LoggedInEvent;
import spotify.bot.config.Config;
import spotify.bot.util.BotLogger;
import spotify.bot.util.BotUtils;

@Component
@RestController
public class SpotifyApiAuthorization {

	protected final static String LOGIN_CALLBACK_URI = "/login-callback";

	private final static String SCOPES = "user-follow-read playlist-modify-private";
	private final static int BACKOFF_MAX_TRIES = 10;
	private final static int BACKOFF_TIME_BASE_MS = 1000;
	private final static int LOGIN_TIMEOUT = 10;

	@Autowired
	private SpotifyApi spotifyApi;

	@Autowired
	private Config config;

	@Autowired
	private BotLogger log;

	private AtomicBoolean loggedIn = new AtomicBoolean();

	@Autowired
	private ApplicationEventPublisher applicationEventPublisher;

	/////////////////////

	public boolean isLoggedIn() {
		return loggedIn.get();
	}

	/**
	 * Log in to Spotify. Retry up to ten times with exponentially increasing sleep
	 * intervals on an error.
	 * 
	 * @throws InterruptedException
	 * @throws BotException
	 */
	@EventListener(ApplicationReadyEvent.class)
	private void login() throws InterruptedException {
		loggedIn.set(false);
		login(0);
		loggedIn.set(true);
		applicationEventPublisher.publishEvent(new LoggedInEvent(this));
	}

	private void login(final int retryCount) throws InterruptedException {
		try {
			authorizationCodeRefresh();
		} catch (SQLException e) {
			if (retryCount >= BACKOFF_MAX_TRIES) {
				log.error(String.format("Failed to refresh authorization token after %d tries. Log in again!", retryCount));
				log.stackTrace(e);
				authenticate();
				return;
			}
			long timeout = Math.round(Math.pow(2, retryCount));
			BotUtils.sneakySleep(BACKOFF_TIME_BASE_MS * timeout);
			login(retryCount + 1);
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
	 * @throws BotException
	 * @throws InterruptedException
	 */
	private void authenticate() throws InterruptedException {
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
		boolean loggedIn = lock.tryAcquire(LOGIN_TIMEOUT, TimeUnit.MINUTES);
		if (!loggedIn) {
			log.error("Login timeout! Shutting down application in case of a Spotify Web API anomaly.!");
			System.exit(1);
		}
	}

	/**
	 * Callback receiver for logins
	 * 
	 * @param code
	 * @return
	 * @throws BotException
	 * @throws SQLException
	 * @throws IOException
	 */
	@RequestMapping(LOGIN_CALLBACK_URI)
	private ResponseEntity<String> loginCallback(@RequestParam String code) {
		AuthorizationCodeCredentials acc = SpotifyCall.execute(spotifyApi.authorizationCode(code));
		updateTokens(acc);
		lock.release();
		return new ResponseEntity<String>("Successfully logged in!", HttpStatus.OK);
	}

	///////////////////////

	/**
	 * Refresh the access token
	 * 
	 * @param api
	 * @throws BotException
	 * @throws SQLException
	 * @throws IOException
	 */
	private void authorizationCodeRefresh() throws SQLException {
		AuthorizationCodeCredentials acc = SpotifyCall.execute(spotifyApi.authorizationCodeRefresh());
		updateTokens(acc);
	}

	/**
	 * Store the access and refresh tokens in the database
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
		config.updateTokens(accessToken, refreshToken);
	}
}
