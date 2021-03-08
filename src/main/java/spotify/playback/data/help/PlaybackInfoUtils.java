package spotify.playback.data.help;

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
	 * Guess the ellapsed progress of the current song. Return true if it's still
	 * within tolerance.
	 * 
	 * @param previous the previous info
	 * @param current  the current info
	 * @return true if it's within tolerance
	 */
	public static boolean isWithinEstimatedProgressMs(PlaybackInfoDTO previous, PlaybackInfoDTO current) {
		int expectedProgressMs = previous.getTimeCurrent() + PlaybackInfoConstants.INTERVAL_MS;
		int actualProgressMs = current.getTimeCurrent();
		return Math.abs(expectedProgressMs - actualProgressMs) < PlaybackInfoConstants.ESTIMATED_PROGRESS_TOLERANCE_MS;
	}

	/**
	 * Rough brightness calculation based on the HSP Color Model.
	 * 
	 * @see http://alienryderflex.com/hsp.html
	 * 
	 * @param r red 0..255
	 * @param g green 0..255
	 * @param b blue 0..255
	 * @return the brightness as double (range 0.0..1.0)
	 */
	public static double calculateBrightness(int r, int g, int b) {
		return Math.sqrt(0.299 * Math.pow(r, 2) + 0.587 * Math.pow(g, 2) + 0.114 * Math.pow(b, 2)) / 255;
	}

	/**
	 * Rough implementation of Colorfulness Index defined by Hasler and Suesstrunk
	 * 
	 * @see https://infoscience.epfl.ch/record/33994/files/HaslerS03.pdf (p. 5+6)
	 * 
	 * @param r red 0..255
	 * @param g green 0..255
	 * @param b blue 0..255
	 * @return the colorfulness as double (range 0.0..255.0)
	 */
	public static double calculateColorfulness(int r, int g, int b) {
		double rg = Math.abs(r - g);
		double yb = Math.abs((0.5 * (r + g)) - b);
		return Math.sqrt(Math.pow(rg, 2) + Math.pow(yb, 2));
	}
}
