package spotify.bot.util;

import java.io.File;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.file.Files;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import javax.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.google.common.base.Strings;
import com.wrapper.spotify.model_objects.specification.AlbumSimplified;

import spotify.bot.util.data.AlbumTrackPair;

@Service
public class BotLogger {
	/**
	 * A comparator for {@link AlbumSimplified} following the order: Album Group >
	 * (first) Artist > Release Date > Release Name
	 */
	private final static Comparator<AlbumSimplified> ALBUM_SIMPLIFIED_COMPARATOR = Comparator.comparing(AlbumSimplified::getAlbumGroup)
		.thenComparing(as -> as.getArtists()[0].getName())
		.thenComparing(AlbumSimplified::getReleaseDate)
		.thenComparing(AlbumSimplified::getName);

	private final static String LOG_FILE_PATH = "./spring.log";
	private final static int DEFAULT_LOG_READ_LINES = 100;

	private final static int MAX_LINE_LENGTH = 160;
	private final static String ELLIPSIS = "...";
	private final static String DROPPED_SYMBOL = "x";
	private final static String LINE_SYMBOL = "-";

	private Logger log;

	@PostConstruct
	private void init() throws SecurityException, IOException {
		this.log = LoggerFactory.getLogger(BotLogger.class);
	}

	//////////////////////
	// Base Logging

	/**
	 * Log a debug message
	 */
	public void debug(String message) {
		log.debug(truncateToEllipsis(message));
	}

	/**
	 * Log an info message
	 */
	public void info(String message) {
		log.info(truncateToEllipsis(message));
	}

	/**
	 * Log a warning message
	 */
	public void warning(String message) {
		log.warn(truncateToEllipsis(message));
	}

	/**
	 * Log an error message
	 */
	public void error(String message) {
		log.error(truncateToEllipsis(message));
	}

	/**
	 * Chop off the message if it exceeds the maximum line length of 160 characters
	 * 
	 * @param message
	 * @return
	 */
	private String truncateToEllipsis(String message) {
		if (message.length() <= MAX_LINE_LENGTH - ELLIPSIS.length()) {
			return message;
		}
		return message.substring(0, message.length() - ELLIPSIS.length()) + ELLIPSIS;
	}

	/**
	 * Print a line of hyphens (----) as INFO-level log message
	 */
	public void printLine() {
		info(Strings.repeat(LINE_SYMBOL, MAX_LINE_LENGTH - ELLIPSIS.length()));
	}

	///////////////////////

	/**
	 * Return the content of the default log file (<code>./spring.log</code>).
	 * 
	 * @param limit
	 *            (optional) maximum number of lines to read from the top of the log
	 *            (default: 100); Use -1 to read the entire file
	 * @return a list of strings representing a line of logging
	 * @throws IOException
	 *             on a read error
	 */
	public List<String> readLog(Integer limit) throws IOException {
		File logFile = new File(LOG_FILE_PATH);
		if (logFile.exists()) {
			if (logFile.canRead()) {
				if (limit == null) {
					limit = DEFAULT_LOG_READ_LINES;
				} else if (limit < 0) {
					limit = Integer.MAX_VALUE;
				}
				List<String> logFileLines = Files.lines(logFile.toPath()).limit(limit).collect(Collectors.toList());
				return logFileLines;
			} else {
				throw new IOException("Log file is currently locked, likely because it is being written to. Try again.");
			}
		} else {
			throw new IOException("Couldn't find log file under expected location " + logFile.getAbsolutePath());
		}
	}

	//////////////////////

	/**
	 * Log and print the given exception's stack trace
	 * 
	 * @param e
	 */
	public void stackTrace(Exception e) {
		StringWriter stringWriter = new StringWriter();
		try (PrintWriter printWriter = new PrintWriter(stringWriter)) {
			e.printStackTrace(printWriter);
		}
		log.error(stringWriter.toString());
	}

	//////////////////////

	/**
	 * Print the given list of album track pairs
	 * 
	 * @param albumTrackPairs
	 */
	public void printAlbumTrackPairs(List<AlbumTrackPair> albumTrackPairs) {
		for (AlbumTrackPair as : albumTrackPairs) {
			debug(as.toString());
		}
	}

	/**
	 * Build a readable String for dropped AlbumSimplified
	 * 
	 * @param as
	 * @return
	 */
	private String printDroppedAlbum(AlbumSimplified as) {
		return String.format("%s [%s] %s - %s (%s)",
			DROPPED_SYMBOL,
			as.getAlbumGroup().toString(),
			as.getArtists()[0].getName(),
			as.getName(),
			as.getReleaseDate());
	}

	/**
	 * Print the given list of AlbumSimplifieds
	 * 
	 * @param albumTrackPairs
	 */
	private void printAlbumSimplifiedMulti(List<AlbumSimplified> albumSimplifieds) {
		for (AlbumSimplified as : albumSimplifieds) {
			debug(printDroppedAlbum(as));
		}

	}

	/**
	 * Log all releases in base which aren't in subtrahend
	 * 
	 * @param base
	 * @param subtrahend
	 * @param logDescription
	 */
	public void printDroppedAlbumDifference(Collection<AlbumSimplified> base, Collection<AlbumSimplified> subtrahend, String logDescription) {
		Set<AlbumSimplified> differenceView = new HashSet<>(base);
		differenceView.removeAll(subtrahend);
		if (!differenceView.isEmpty()) {
			if (logDescription != null) {
				debug(DROPPED_SYMBOL + " " + logDescription);
			}
			List<AlbumSimplified> sortedDifferenceView = differenceView
				.stream()
				.sorted(ALBUM_SIMPLIFIED_COMPARATOR)
				.collect(Collectors.toList());
			printAlbumSimplifiedMulti(sortedDifferenceView);
		}
	}

	/**
	 * Same as {@link BotLogger#printAlbumDifference} but for AlbumTrackPairs
	 * 
	 * @param unfilteredAppearsOnAlbums
	 * @param filteredAppearsOnAlbums
	 * @param logDescription
	 */
	public void printDroppedAlbumTrackPairDifference(Collection<AlbumTrackPair> unfilteredAppearsOnAlbums, Collection<AlbumTrackPair> filteredAppearsOnAlbums, String logDescription) {
		printDroppedAlbumDifference(
			unfilteredAppearsOnAlbums.stream().map(AlbumTrackPair::getAlbum).collect(Collectors.toList()),
			filteredAppearsOnAlbums.stream().map(AlbumTrackPair::getAlbum).collect(Collectors.toList()),
			logDescription);
	}
}
