package spotify.playback.data.help;

import se.michaelthelin.spotify.enums.CurrentlyPlayingType;
import se.michaelthelin.spotify.enums.ModelObjectType;
import se.michaelthelin.spotify.model_objects.miscellaneous.CurrentlyPlayingContext;

public class BigPictureUtils {
  /**
   * Guess the elapsed progress of the current song. Return true if it's still
   * within tolerance.
   *
   * @param previousMs the previous time
   * @param currentMs the current time
   * @return true if it's within tolerance
   */
  public static boolean isWithinEstimatedProgressMs(int previousMs, int currentMs) {
    return Math.abs(currentMs - previousMs) < BigPictureConstants.ESTIMATED_PROGRESS_TOLERANCE_MS;
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
      } else if (BigPictureConstants.FAVORITE_SONGS_HREF.equals(context.getContext().getHref())) {
        return ModelObjectType.USER;
      }
    } else if (CurrentlyPlayingType.EPISODE.equals(context.getCurrentlyPlayingType())) {
      return ModelObjectType.EPISODE;
    }
    return null;
  }
}
