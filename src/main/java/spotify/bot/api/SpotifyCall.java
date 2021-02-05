package spotify.bot.api;

import java.io.IOException;

import org.apache.hc.core5.http.ParseException;

import com.wrapper.spotify.exceptions.detailed.TooManyRequestsException;
import com.wrapper.spotify.exceptions.detailed.UnauthorizedException;
import com.wrapper.spotify.requests.IRequest;
import com.wrapper.spotify.requests.IRequest.Builder;

import spotify.bot.util.BotUtils;

public class SpotifyCall {

	static SpotifyApiAuthorization spotifyApiAuthorization;

	private final static long RETRY_TIMEOUT_429 = 1000;
	private final static long RETRY_TIMEOUT_GENERIC_ERROR = 60 * 1000;
	private final static int MAX_ATTEMPS = 10;

	/**
	 * Utility class
	 */
	private SpotifyCall() {
	}

	/**
	 * Executes a single "greedy" Spotify Web API request, meaning that on potential
	 * <i>429 Too many requests</i> errors the request will be retried up to 10
	 * times until it succeeds. Any attempts will be delayed by the response body's
	 * given <code>retryAfter</code> parameter in seconds (with an extra second due
	 * to occasional inaccuracies with that value). Generic errors will be retried
	 * too.
	 * 
	 * @param <T>            return type (e.g. Album, Playlist...)
	 * @param <BT>           Builder (e.g. Album.Builder, Playlist.Builder...)
	 * @param requestBuilder the basic, unbuilt request builder
	 * @return the result item
	 * @throws BotException if request didn't complete within 10 attempts
	 */
	public static <T, BT extends Builder<T, ?>> T execute(IRequest.Builder<T, BT> requestBuilder) throws BotException {
		Exception finalException = null;

		for (int attempt = 1; attempt <= MAX_ATTEMPS; attempt++) {
			try {
				IRequest<T> builtRequest = requestBuilder.build();
				T result = builtRequest.execute();
				return result;
			} catch (Exception ex) {
				try {
					finalException = ex;
					throw ex;
				} catch (ParseException | IOException e) {
					throw new BotException(e);
				} catch (UnauthorizedException e) {
					String newAccessToken = spotifyApiAuthorization.refresh();
					requestBuilder.setHeader("Authorization", "Bearer " + newAccessToken);
				} catch (TooManyRequestsException e) {
					int timeout = e.getRetryAfter();
					long sleepMs = (timeout * RETRY_TIMEOUT_429 * attempt) + RETRY_TIMEOUT_429;
					BotUtils.sneakySleep(sleepMs);
				} catch (Exception e) {
					BotUtils.sneakySleep(RETRY_TIMEOUT_GENERIC_ERROR);
				}
			}
		}

		finalException.printStackTrace();
		throw new BotException(finalException);
	}
}
