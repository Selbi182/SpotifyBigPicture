
package spotify.playback.data.special.color;

public interface ColorProvider {
	/**
	 * Returns an approximation of the two most dominant colors from an image URL as
	 * [primary, secondary]. The primary color is intended for the text and icons,
	 * whereas the secondary one is to be used as the background overlay.<br/>
	 * <br/>
	 * The algorithm favors bright, vibrant colors over dull ones and will
	 * completely ignore colors that fall below a certain threshold in regards to
	 * pixel population or brightness. For particularily dull images that don't even
	 * manage to find two colors meeting the minimum requirement at all, WHITE is
	 * returned for any blank ones.
	 * 
	 * @param imageUrl the URL of the image
	 * @return the two most dominant colors as a RGB list of exactly two entries
	 *         (note: all results are indefinitely cached)
	 */
	public DominantRGBs getDominantColorFromImageUrl(String imageUrl);
}
