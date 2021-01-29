package spotify.playback.data.help;

import com.wrapper.spotify.model_objects.specification.Image;
import com.wrapper.spotify.model_objects.specification.Track;

import spotify.playback.data.PlaybackInfoDTO;

public class PlaybackInfoUtils {

	/**
	 * Get the year of the currently playing's release date (which is in ISO format,
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
	 * Find the largest image (width x height, because not all images are squares)
	 * of a given array of images.
	 * 
	 * @param images to check
	 * @return URL of the largest image, null if no image was given
	 */
	public static String findLargestImage(Image[] images) {
		Image largest = null;
		for (Image img : images) {
			if (largest == null || (img.getWidth() * img.getHeight()) > (largest.getWidth() * largest.getHeight())) {
				largest = img;
			}
		}
		return largest != null ? largest.getUrl() : null;
	}

	/**
	 * Guess the ellapsed progress of the current song. Return true if it's still
	 * within tolerance.
	 * 
	 * @param previous the previous info
	 * @param current the current info
	 * @return true if it's within tolerance
	 */
	public static boolean isWithinEstimatedProgressMs(PlaybackInfoDTO previous, PlaybackInfoDTO current) {
		int expectedProgressMs = previous.getTimeCurrent() + PlaybackInfoConstants.INTERVAL_MS;
		int actualProgressMs = current.getTimeCurrent();
		return Math.abs(expectedProgressMs - actualProgressMs) < PlaybackInfoConstants.ESTIMATED_PROGRESS_TOLERANCE_MS;
	}
}
