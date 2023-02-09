package spotify.playback.data.help;

import se.michaelthelin.spotify.model_objects.specification.Track;

public class PlaybackInfoUtils {

  /**
   * Get the year of the currently playing track's release date (which is in ISO format,
   * so it's always the first four characters).
   *
   * @param track the track
   * @return the year, "LOCAL" if no year was found
   */
  public static String findReleaseYear(Track track) {
    if (track.getAlbum().getReleaseDate() != null) {
      return track.getAlbum().getReleaseDate().substring(0, 4);
    }
    return "LOCAL";
  }

  /**
   * Guess the elapsed progress of the current song. Return true if it's still
   * within tolerance.
   *
   * @param previous the previous time
   * @param current  the current time
   * @return true if it's within tolerance
   */
  public static boolean isWithinEstimatedProgressMs(int previous, int current) {
    int expectedProgressMs = previous + PlaybackInfoConstants.POLLING_RATE_MS;
    return Math.abs(expectedProgressMs - current) < PlaybackInfoConstants.ESTIMATED_PROGRESS_TOLERANCE_MS;
  }
}
