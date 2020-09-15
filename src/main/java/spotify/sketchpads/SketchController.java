package spotify.sketchpads;

import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import spotify.bot.api.SpotifyApiAuthorization;
import spotify.bot.api.events.LoggedInEvent;
import spotify.bot.util.BotLogger;

@EnableScheduling
@RestController
public class SketchController {

	@Autowired
	private SpotifyApiAuthorization authorization;

	@Autowired
	private BotLogger log;

	@Autowired
	private List<? extends Sketchpad> sketchpads;

	private final AtomicBoolean ready = new AtomicBoolean(false);

	@PostConstruct
	private void init() {
		// Sort sketchpads
		Collections.sort(sketchpads, Comparator
			.comparing(Sketchpad::order)
			.thenComparing((sk1, sk2) -> sk1.getClass().getSimpleName().compareTo(sk2.getClass().getSimpleName())));

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

		sketch();
	}

	/**
	 * Main sketch controller, accessed by calling {@code /sketch} and automatically
	 * executed at every 18th and 48th minute of an hour (arbitraly chosen to not
	 * conflict with other round-hour crons).
	 */
	@Scheduled(cron = "0 18,48 * * * *")
	@GetMapping("/sketch")
	public ResponseEntity<String> sketch() {
		if (ready.get()) {
			authorization.refresh();
			try {
				ready.set(false);
				for (Sketchpad sp : sketchpads) {
					if (sp.enabled()) {
						long startTime = System.currentTimeMillis();
						if (sp.sketch()) {
							long timeTaken = System.currentTimeMillis() - startTime;
							String sketchpadName = sp.getClass().getSimpleName();
							log.info(sketchpadName + " completed in: " + timeTaken + "ms");
							log.printLine();
						}						
					}
				}
				return new ResponseEntity<>("Sketches done!", HttpStatus.OK);
			} catch (Exception e) {
				log.info("Exception thrown during sketch:");
				log.stackTrace(e);
				log.printLine('=');
				return new ResponseEntity<>("Exception thrown during sketch: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
			} finally {
				ready.set(true);
			}
		}
		return new ResponseEntity<>("Sketch is currently in progess!", HttpStatus.LOCKED);
	}
}
