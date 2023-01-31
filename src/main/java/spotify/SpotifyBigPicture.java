package spotify;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = {"de.selbi.colorfetch", "spotify"})
public class SpotifyBigPicture {

  public static boolean scheduledPollingDisabled;

  /**
   * Main entry point of the bot
   */
  public static void main(String[] args) {
    scheduledPollingDisabled = (args.length > 0 && args[0].equals("nopolling"));
    SpringApplication.run(SpotifyBigPicture.class, args);
  }
}
