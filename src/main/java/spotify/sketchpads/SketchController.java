package spotify.sketchpads;

import java.io.IOException;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

import javax.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import spotify.bot.api.SpotifyApiAuthorization;
import spotify.bot.api.events.LoggedInEvent;
import spotify.bot.util.BotLogger;
import spotify.sketchpads.Sketchpad.RuntimeState;
import spotify.sketchpads.util.SketchCommons;

@EnableScheduling
@RestController
public class SketchController {

	@Autowired
	private SpotifyApiAuthorization authorization;

	@Autowired
	private BotLogger log;

	@Autowired
	private SketchCommons sketchCommons;

	@Autowired
	private List<? extends Sketchpad> sketchpads;

	private final AtomicBoolean ready = new AtomicBoolean(false);

	@PostConstruct
	private void init() {
		// Sort sketchpads
		Collections.sort(sketchpads, Comparator
			.comparing(Sketchpad::order)
			.thenComparing(Sketchpad::name));

		// Filter potential solo sketchpad
		List<? extends Sketchpad> solo = sketchpads.stream()
			.filter(sketchpad -> sketchpad.runtimeState().equals(RuntimeState.SOLO))
			.collect(Collectors.toList());
		if (solo.size() == 1) {
			sketchpads = solo;
			log.info("SOLO Sketchpad: " + solo.get(0).name());
		} else if (solo.size() > 1) {
			String sketchpadNames = solo.stream().map(Sketchpad::name).collect(Collectors.joining(", "));
			throw new IllegalStateException("Can only have 1 solo sketchpad! Found SOLO state for: " + sketchpadNames);
		}

		// Set ready
		ready.set(true);
	}

	/**
	 * Gets fired after successfully logging into the Spotify API and starts the
	 * first sketch
	 */
	@EventListener(LoggedInEvent.class)
	private void sketchpadLog() {
		log.printLine();
		log.info("Spotify API sketchpad is ready!");
		log.printLine();

		sketch(true);
	}

	/**
	 * Automatically executed at every 18th and 48th minute of an hour (arbitrarily
	 * chosen to not conflict with other round-hour crons).
	 */
	@Scheduled(cron = "0 18,48 * * * *")
	private void scheduledSketch() {
		sketch(true);
	}

	/**
	 * Main sketch controller, accessed by calling {@code /sketch}
	 * 
	 * @param force if true, will flush all caches first
	 */
	@RequestMapping("/sketch")
	public ResponseEntity<String> sketch(@RequestParam(defaultValue = "false") Boolean force) {
		if (ready.get()) {
			authorization.refresh();
			try {
				ready.set(false);
				if (force) {
					sketchCommons.rebuildCaches();
				}
				for (Sketchpad sp : sketchpads) {
					if (sp.isEnabled()) {
						long startTime = System.currentTimeMillis();
						if (sp.sketch()) {
							long timeTaken = System.currentTimeMillis() - startTime;
							String sketchpadName = sp.name();
							log.info(sketchpadName + " completed in: " + timeTaken + "ms");
							log.printLine();
						}
					}
				}
				return new ResponseEntity<>("Sketches done!", HttpStatus.OK);
			} catch (Exception e) {
				log.info("Exception thrown during sketch:");
				log.stackTrace(e);
				log.printLine();
				return new ResponseEntity<>("Exception thrown during sketch: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
			} finally {
				ready.set(true);
			}
		}
		return new ResponseEntity<>("Sketch is currently in progess!", HttpStatus.LOCKED);
	}

	private final static String LOG_TITLE_AND_STLYE = "<title>Spotify Discovery Bot - Logs</title>"
		+ "<style>"
		+ "  body {"
		+ "    white-space: pre;"
		+ "    background-color: #222;"
		+ "    color: #ddd;"
		+ "    font-family: 'Consolas';"
		+ "  }"
		+ "</style>";

	/**
	 * Displays the contents of the of the most recent log entries in a humanly
	 * readable form (simply using HTML {@code pre} tags and some basic style).
	 * 
	 * @param limit (optional) maximum number of lines to read from the bottom of
	 *              the log (default: 100); Use -1 to read the entire file
	 * @return a ResponseEntity containing the entire log content as single String,
	 *         or an error
	 */
	@RequestMapping("/log")
	public ResponseEntity<String> showLog(@RequestParam(value = "limit", required = false) Integer limit) {
		try {
			String logs = log.readLog(limit).stream().collect(Collectors.joining("\n"));
			return new ResponseEntity<String>(LOG_TITLE_AND_STLYE + logs, HttpStatus.OK);
		} catch (IOException e) {
			log.stackTrace(e);
			return new ResponseEntity<String>(e.getMessage(), HttpStatus.NOT_FOUND);
		}
	}
}
