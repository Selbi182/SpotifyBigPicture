package spotify.playback.data.help;

import java.util.Arrays;
import java.util.Iterator;
import java.util.List;

import org.springframework.lang.NonNull;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

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

  /**
   * Traverses through a Gson object in a convenient way and returns the deepest element as String.
   * Example: "response.lyrics_for_edit_proposal.body.plain"
   * This method assumes that all elements are on the way are JsonObjects.
   *
   * @param rootJsonElement the entry point
   * @param traversalPath the traversal path
   * @return the deep string
   */
  @NonNull
  public static String getDeepJsonString(JsonElement rootJsonElement, String traversalPath) {
    JsonObject jsonObject = rootJsonElement.getAsJsonObject();
    List<String> memberNames = Arrays.asList(traversalPath.split("\\."));
    for (Iterator<String> itr = memberNames.iterator(); itr.hasNext(); ) {
      String next = itr.next();
      JsonElement nextJsonElement = jsonObject.get(next);
      if (itr.hasNext()) {
        jsonObject = nextJsonElement.getAsJsonObject();
      } else {
        return nextJsonElement.getAsString();
      }
    }
    throw new IllegalArgumentException("Invalid traversalPath");
  }
}
