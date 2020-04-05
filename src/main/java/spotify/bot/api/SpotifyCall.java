package spotify.bot.api;

import java.io.IOException;
import java.net.SocketException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import com.wrapper.spotify.exceptions.SpotifyWebApiException;
import com.wrapper.spotify.exceptions.detailed.TooManyRequestsException;
import com.wrapper.spotify.model_objects.specification.Paging;
import com.wrapper.spotify.model_objects.specification.PagingCursorbased;
import com.wrapper.spotify.requests.IRequest;
import com.wrapper.spotify.requests.data.IPagingCursorbasedRequestBuilder;
import com.wrapper.spotify.requests.data.IPagingRequestBuilder;

public class SpotifyCall {

	private final static int RETRY_TIMEOUT_4XX = 500;
	private final static int RETRY_TIMEOUT_5XX = 60 * 1000;

	/**
	 * Utility class
	 */
	private SpotifyCall() {}

	/**
	 * Executes a single "greedy" Spotify Web API request, meaning that on potential
	 * <i>429 Too many requests</i> errors the request will be retried ad-infinitum
	 * until it succeeds. Any attempts will be delayed by the response body's given
	 * <code>retryAfter</code> parameter, in seconds. Server errors will be retried
	 * as well.
	 * 
	 * @param <T>
	 *            the injected return type
	 * @param <BT>
	 *            the injected Builder
	 * @param requestBuilder
	 *            the basic, unbuilt request builder
	 * @return the single result item
	 */
	public static <T, BT> T execute(IRequest.Builder<T, BT> requestBuilder) throws SpotifyWebApiException, IOException, InterruptedException {
		try {
			IRequest<T> builtRequest = requestBuilder.build();
			T result = builtRequest.execute();
			return result;
		} catch (TooManyRequestsException e) {
			int timeout = e.getRetryAfter() + 1;
			Thread.sleep(timeout * RETRY_TIMEOUT_4XX);
		} catch (SpotifyWebApiException | SocketException e) {
			Thread.sleep(RETRY_TIMEOUT_5XX);
		}
		return execute(requestBuilder);
	}

	/**
	 * Executes a paging-based Spotify Web API request. This process is done
	 * greedily, see {@link SpotifyApiWrapper#execute}.
	 * 
	 * @param <T>
	 *            the injected return type
	 * @param <BT>
	 *            the injected Builder
	 * @param pagingRequestBuilder
	 *            the basic, unbuilt request paging builder
	 * @return the fully exhausted list of result items
	 */
	public static <T, BT> List<T> executePaging(IPagingRequestBuilder<T, BT> pagingRequestBuilder) throws SpotifyWebApiException, IOException, InterruptedException {
		List<T> resultList = new ArrayList<>();
		Paging<T> paging = null;
		do {
			if (paging != null && paging.getNext() != null) {
				pagingRequestBuilder.offset(paging.getOffset() + paging.getLimit());
			}
			paging = execute(pagingRequestBuilder);
			resultList.addAll(Arrays.asList(paging.getItems()));
		} while (paging.getNext() != null);
		return resultList;
	}

	/**
	 * Executes a pagingcursor-based Spotify Web API request. This process is done
	 * greedily, see {@link SpotifyApiWrapper#execute}.
	 * 
	 * @param <T>
	 *            the injected return type
	 * @param <BT>
	 *            the injected Builder
	 * @param <A>
	 *            the After type (currently only String is supported)
	 * @param pagingRequestBuilder
	 *            the basic, unbuilt request pagingcursor builder
	 * @return the fully exhausted list of result items
	 */
	@SuppressWarnings("unchecked")
	public static <T, A, BT> List<T> executePaging(IPagingCursorbasedRequestBuilder<T, A, BT> pagingRequestBuilder) throws SpotifyWebApiException, IOException, InterruptedException {
		List<T> resultList = new ArrayList<>();
		PagingCursorbased<T> paging = null;
		do {
			if (paging != null && paging.getNext() != null) {
				String after = paging.getCursors()[0].getAfter();
				try {
					pagingRequestBuilder.after((A) after);
				} catch (ClassCastException e) {
					throw new UnsupportedOperationException("Cursor-based paging is only applicable for String-based curors.");
				}
			}
			paging = execute(pagingRequestBuilder);
			resultList.addAll(Arrays.asList(paging.getItems()));
		} while (paging.getNext() != null);
		return resultList;
	}
}
