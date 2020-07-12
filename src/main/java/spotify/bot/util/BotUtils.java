package spotify.bot.util;

import java.io.File;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collection;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.wrapper.spotify.enums.AlbumGroup;
import com.wrapper.spotify.model_objects.specification.AlbumSimplified;
import com.wrapper.spotify.model_objects.specification.ArtistSimplified;

public final class BotUtils {

	/**
	 * Utility class
	 */
	private BotUtils() {
	}

	///////

	/**
	 * Performs a <code>Thread.sleep(sleepMs);</code> call in a surrounded try-catch
	 * that ignores any interrupts. This method mostly exists to reduce the number
	 * of try-catch and throws clutter throughout the code. Yes, I know it's bad
	 * practice, cry me a river.
	 * 
	 * @param millis the number of milliseconds to sleep
	 */
	public static void sneakySleep(long millis) {
		try {
			Thread.sleep(millis);
		} catch (InterruptedException e) {
			e.printStackTrace();
		}
	}

	/**
	 * Check if the given old date is still within the allowed timeout window
	 * 
	 * @param baseDate       the date to check "now" against
	 * @param timeoutInHours the timeout in hours
	 */
	public static boolean isWithinTimeoutWindow(Date baseDate, int timeoutInHours) {
		Instant baseTime = Instant.ofEpochMilli(baseDate.getTime());
		Instant currentTime = Instant.now();
		boolean isWithinTimeoutWindow = currentTime.minus(timeoutInHours, ChronoUnit.HOURS).isBefore(baseTime);
		return isWithinTimeoutWindow;
	}

	/**
	 * Creates a map with a full AlbumGroup -> List<T> relationship (the lists are
	 * empty)
	 * 
	 * @return
	 */
	public static <T> Map<AlbumGroup, List<T>> createAlbumGroupToListOfTMap() {
		Map<AlbumGroup, List<T>> albumGroupToList = new HashMap<>();
		for (AlbumGroup ag : AlbumGroup.values()) {
			albumGroupToList.put(ag, new ArrayList<>());
		}
		return albumGroupToList;
	}

	/**
	 * Returns true if all mappings just contain an empty list (not null)
	 * 
	 * @param listsByMap
	 * @return
	 */
	public static <T, K> boolean isAllEmptyLists(Map<K, List<T>> listsByMap) {
		return listsByMap.values().stream().allMatch(List::isEmpty);
	}

	/**
	 * Remove all items from this list that are either <i>null</i> or "null" (a
	 * literal String)
	 * 
	 * @param followedArtists
	 */
	public static void removeNullStrings(Collection<String> collection) {
		collection.removeIf(e -> e == null || e.toLowerCase().equals("null"));
	}

	/**
	 * Remove all items from this collection that are null
	 * 
	 * @param collection
	 */
	public static void removeNulls(Collection<?> collection) {
		collection.removeIf(e -> e == null);
	}

	/**
	 * Return the current time as unix timestamp
	 * 
	 * @return
	 */
	public static long currentTime() {
		Calendar cal = Calendar.getInstance();
		return cal.getTimeInMillis();
	}

	/**
	 * Build a readable String for dropped AlbumSimplified
	 * 
	 * @param as
	 * @return
	 */
	public static String formatAlbum(AlbumSimplified as) {
		return String.format("[%s] %s - %s (%s)",
			as.getAlbumGroup().toString(),
			joinArtists(as.getArtists()),
			as.getName(),
			as.getReleaseDate());
	}

	/**
	 * Return a string representation of all artist names, separated by ", "
	 * 
	 * @param artists
	 * @return
	 */
	public static String joinArtists(ArtistSimplified[] artists) {
		return Stream.of(artists)
			.map(ArtistSimplified::getName)
			.collect(Collectors.joining(", "));
	}

	/**
	 * Returns the name of the first artist of this album (usually the only one)
	 * 
	 * @param as
	 * @return
	 */
	public static String getFirstArtistName(AlbumSimplified as) {
		return as.getArtists()[0].getName();
	}

	/**
	 * Returns the name of the last artist of this album
	 * 
	 * @param as
	 * @return
	 */
	public static String getLastArtistName(AlbumSimplified as) {
		return as.getArtists()[as.getArtists().length - 1].getName();
	}

	/**
	 * Normalizes a file by converting it to a Path object, calling .normalize(),
	 * and returning it back as file.
	 * 
	 * @param file
	 * @return
	 */
	public static File normalizeFile(File file) {
		if (file != null) {
			return file.toPath().normalize().toFile();
		}
		return null;
	}
}
