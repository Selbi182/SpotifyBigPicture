package spotify.bot.api;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.apache.hc.core5.http.ParseException;

import com.wrapper.spotify.exceptions.SpotifyWebApiException;
import com.wrapper.spotify.exceptions.detailed.TooManyRequestsException;
import com.wrapper.spotify.model_objects.specification.Paging;
import com.wrapper.spotify.model_objects.specification.PagingCursorbased;
import com.wrapper.spotify.requests.IRequest;
import com.wrapper.spotify.requests.IRequest.Builder;
import com.wrapper.spotify.requests.data.IPagingCursorbasedRequestBuilder;
import com.wrapper.spotify.requests.data.IPagingRequestBuilder;

import spotify.bot.util.BotUtils;

public class SpotifyCall {

	private final static long RETRY_TIMEOUT_429 = 1000;
	private final static long RETRY_TIMEOUT_GENERIC_ERROR = 60 * 1000;

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
	 */
	public static <T, BT extends Builder<T, ?>> T execute(IRequest.Builder<T, BT> requestBuilder) {
		try {
			IRequest<T> builtRequest = requestBuilder.build();
			try {
				T result = builtRequest.execute();
				return result;
			} catch (ParseException | IOException e) {
				e.printStackTrace();
				throw new BotException(e);
			}
		} catch (TooManyRequestsException e) {
			int timeout = e.getRetryAfter();
			long sleepMs = (timeout * RETRY_TIMEOUT_429) + RETRY_TIMEOUT_429;
			BotUtils.sneakySleep(sleepMs);
		} catch (SpotifyWebApiException | RuntimeException e) {
			BotUtils.sneakySleep(RETRY_TIMEOUT_GENERIC_ERROR);
			e.printStackTrace();
		}
		return execute(requestBuilder);
	}

	/**
	 * Executes a paging-based Spotify Web API request. This process is done
	 * greedily, see {@link SpotifyApiWrapper#execute}.
	 * 
	 * @param <T>                  the injected return type
	 * @param <BT>                 the injected Builder
	 * @param pagingRequestBuilder the basic, unbuilt request paging builder
	 * @return the fully exhausted list of result items
	 */
	public static <T, BT extends Builder<Paging<T>, ?>> List<T> executePaging(IPagingRequestBuilder<T, BT> pagingRequestBuilder) {
		List<T> resultList = new ArrayList<>();
		Paging<T> paging = null;
		do {
			if (paging != null && paging.getNext() != null) {
				pagingRequestBuilder.offset(paging.getOffset() + paging.getLimit());
			}
			paging = execute(pagingRequestBuilder);
			BotUtils.addToListIfNotBlank(paging.getItems(), resultList);
		} while (paging.getNext() != null);
		return resultList;
	}

	/**
	 * Executes a pagingcursor-based Spotify Web API request. This process is done
	 * greedily, see {@link SpotifyApiWrapper#execute}.
	 * 
	 * @param <T>                  the injected return type
	 * @param <BT>                 the injected Builder
	 * @param <A>                  the After type (currently only String is
	 *                             supported)
	 * @param pagingRequestBuilder the basic, unbuilt request pagingcursor builder
	 * @return the fully exhausted list of result items
	 */
	@SuppressWarnings("unchecked")
	public static <T, A, BT extends Builder<PagingCursorbased<T>, ?>> List<T> executePaging(IPagingCursorbasedRequestBuilder<T, A, BT> pagingRequestBuilder) {
		List<T> resultList = new ArrayList<>();
		PagingCursorbased<T> paging = null;
		do {
			if (paging != null && paging.getNext() != null) {
				String after = paging.getCursors()[0].getAfter();
				try {
					pagingRequestBuilder.after((A) after);
				} catch (ClassCastException e) {
					throw new UnsupportedOperationException("Cursor-based paging is currently only supported for String-based curors!");
				}
			}
			paging = execute(pagingRequestBuilder);
			BotUtils.addToListIfNotBlank(paging.getItems(), resultList);
		} while (paging.getNext() != null);
		return resultList;
	}
}
	