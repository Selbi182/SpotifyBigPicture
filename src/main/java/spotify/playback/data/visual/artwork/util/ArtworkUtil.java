
package spotify.playback.data.visual.artwork.util;

import com.wrapper.spotify.model_objects.specification.Image;

public class ArtworkUtil {

	public static String findLargestImage(Image[] images) {
		if (images != null) {
			Image largest = null;
			for (Image img : images) {
				if (largest == null || (img.getWidth() * img.getHeight()) > (largest.getWidth() * largest.getHeight())) {
					largest = img;
				}
			}
			return largest != null ? largest.getUrl() : null;
		}
		return null;
	}
}
