package spotify.playback.data.help;

import se.michaelthelin.spotify.enums.CurrentlyPlayingType;
import se.michaelthelin.spotify.enums.ModelObjectType;
import se.michaelthelin.spotify.model_objects.miscellaneous.CurrentlyPlayingContext;

public class BigPictureUtils {

  /**
   * Used in cases where the interface should explicitly hide a field due to the absence of data.
   * This is needed because null fields are removed during a web transfer.
   */
  public static final String BLANK = "BLANK";

  private static final String FAVORITE_SONGS_HREF = "https://api.spotify.com/v1/me/tracks";

  /**
   * Guess the elapsed progress of the current song. Return true if it's still
   * within tolerance.
   *
   * @param previous the previous time
   * @param current  the current time
   * @return true if it's within tolerance
   */
  public static boolean isWithinEstimatedProgressMs(int previous, int current) {
    int expectedProgressMs = previous + BigPictureConstants.POLLING_RATE_MS;
    return Math.abs(expectedProgressMs - current) < BigPictureConstants.ESTIMATED_PROGRESS_TOLERANCE_MS;
  }

  /**
   * Return the ModelObjectType within the currently playing context.
   * If it's null, assume it's a Podcast.
   *
   * @param context the context
   * @return the ModelObjectType, null on no result
   */
  public static ModelObjectType getModelObjectType(CurrentlyPlayingContext context) {
    if (context.getContext() != null) {
      if (context.getContext().getType() != null) {
        return context.getContext().getType();
      } else if (FAVORITE_SONGS_HREF.equals(context.getContext().getHref())) {
        return ModelObjectType.USER;
      }
    } else if (CurrentlyPlayingType.EPISODE.equals(context.getCurrentlyPlayingType())) {
      return ModelObjectType.EPISODE;
    }
    return null;
  }
}
