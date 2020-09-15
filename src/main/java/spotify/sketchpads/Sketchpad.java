package spotify.sketchpads;

/**
 * Any class implementing this interface will get be candidate for the sketch
 * handler.
 */
public interface Sketchpad {

	/**
	 * 
	 * Spotify API Sketchpad to do play around and do dirty hacks in
	 * 
	 * @return true if this sketchpad was fully executed, false if it was skipped
	 * @throws Exception if anything at all goes wrong
	 */
	public boolean sketch() throws Exception;

	/**
	 * Determines the execution order of multiple sketchpads. Lower number results
	 * in higher priority. Identical orders will be executed by order of the sorted
	 * alphanumerical class names.
	 * 
	 * @return the order, default 0
	 */
	public default int order() {
		return 0;
	}

	/**
	 * Manually set the state of a sketchpad, e.g. if you want to disable it if it's
	 * broken.
	 * 
	 * @return if the sketchpad is enabled, default tru
	 */
	public default boolean enabled() {
		return true;
	}
}