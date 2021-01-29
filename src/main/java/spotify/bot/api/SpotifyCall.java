package spotify.bot.api;

import java.io.IOException;

import org.apache.hc.core5.http.ParseException;

import com.wrapper.spotify.exceptions.SpotifyWebApiException;
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
	 * <i>429 Too many requests</i> errors the request will be retried ad-infinitum
	 * until it succeeds. Any attempts will be delayed by the response body's given
	 * <code>retryAfter</code> parameter in seconds (with an extra second due to
	 * occasional inaccuracies with that value). Generic errors will be retried too.
	 * 
	 * @param <T>            the injected return type
	 * @param <BT>           the injected Builder
	 * @param requestBuilder the basic, unbuilt request builder
	 * @return the single result item
	 * @throws SpotifyWebApiException 
	 */
	public static <T, BT extends Builder<T, ?>> T execute(IRequest.Builder<T, BT> requestBuilder) throws SpotifyWebApiException {
		return execute(requestBuilder, 0);
	}
	
	private static <T, BT extends Builder<T, ?>> T execute(IRequest.Builder<T, BT> requestBuilder, int attempt) throws SpotifyWebApiException {
		if (attempt > MAX_ATTEMPS) {
			throw new SpotifyWebApiException("Couldn't complete Spotify Web request within " + MAX_ATTEMPS + " attempts");
		}
		try {
			IRequest<T> builtRequest = requestBuilder.build();
			try {
				T result = builtRequest.execute();
				return result;
			} catch (ParseException | IOException e) {
				e.printStackTrace();
				throw new BotException(e);
			}
		} catch (UnauthorizedException e) {
			spotifyApiAuthorization.refresh();
		} catch (TooManyRequestsException e) {
			int timeout = e.getRetryAfter();
			long sleepMs = (timeout * RETRY_TIMEOUT_429 * attempt) + RETRY_TIMEOUT_429;
			System.out.println("Too many requests, sleeping for " + sleepMs + "ms (attempt " + attempt + ")");
			BotUtils.sneakySleep(sleepMs);
		} catch (IllegalStateException e) {
			// TODO improve this workaround for "Connection pool shut down"
			System.exit(182);
		} catch (SpotifyWebApiException | RuntimeException e) {
			e.printStackTrace();
			System.out.println("Generic server error, sleeping for " + RETRY_TIMEOUT_GENERIC_ERROR + "ms (" + attempt + ")");
			BotUtils.sneakySleep(RETRY_TIMEOUT_GENERIC_ERROR);
		}
		return execute(requestBuilder, attempt + 1);
	}
}
	