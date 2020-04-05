package spotify;

import java.io.File;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import spotify.bot.api.SpotifyApiAuthorization;
import spotify.bot.api.events.LoggedInEvent;
import spotify.bot.util.BotLogger;

@RestController
@SpringBootApplication
public class Main {

	private static File alternateDatabaseFile = null;

	/**
	 * Return the alternate file path was given for the SQLite database that was
	 * given as parameter. <code>null</code> if none was given.
	 */
	public static File getAlternateDatabaseFilePath() {
		return alternateDatabaseFile;
	}

	/**
	 * Main entry point of the bot
	 * 
	 * @param args [0] the location of the SQLite database; if not set, will be
	 *             treated as "database.sql" of the current working directory
	 *             context of the application
	 */
	public static void main(String[] args) {
		if (args.length > 0) {
			alternateDatabaseFile = new File(args[0]);
		}
		SpringApplication.run(Main.class, args);
	}

	///////////////////////////////

	@Autowired
	private Sketchpad sketchpad;

	@Autowired
	private SpotifyApiAuthorization authorization;

	@Autowired
	private BotLogger log;

	@EventListener(LoggedInEvent.class)
	private void sketchpadLog() {
		log.printLine();
		log.info("Spotify API sketchpad is ready!");
		log.printLine();
		sketch();
	}

	@GetMapping("/sketch")
	public ResponseEntity<String> sketch() {
		if (authorization.isLoggedIn()) {
			log.info("Starting sketch...");
			try {
				sketchpad.sketch();
				log.info("Sketch done!");
				log.printLine();
				return new ResponseEntity<>("Sketch done!", HttpStatus.OK);
			} catch (Exception e) {
				log.info("Exception thrown during sketch:");
				log.stackTrace(e);
				log.printLine();
				return new ResponseEntity<>("Exception thrown during sketch: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
			}
		}
		return new ResponseEntity<>("Not authorized to access Spotify API!", HttpStatus.UNAUTHORIZED);
	}
}
