package spotify;

import java.awt.GraphicsEnvironment;
import java.util.List;

import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.stereotype.Component;

import spotify.api.SpotifyDependenciesSettings;

@SpringBootApplication
public class SpotifyBigPicture {

  /**
   * Main entry point of the bot
   */
  public static void main(String[] args) {
    new SpringApplicationBuilder(SpotifyBigPicture.class).headless(GraphicsEnvironment.isHeadless()).run(args);
  }

  @Component
  public static class SpotifyBigPictureSettings implements SpotifyDependenciesSettings {

    @Override
    public List<String> requiredScopes() {
      return List.of(
          "user-read-playback-position",
          "user-read-playback-state",
          "user-read-currently-playing",
          "user-read-private",
          "user-modify-playback-state",
          "user-library-read"
      );
    }

    @Override
    public int port() {
      return 8183;
    }
  }
}