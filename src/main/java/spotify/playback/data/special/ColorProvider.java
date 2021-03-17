package spotify.playback.data.special;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ExecutionException;

import javax.imageio.ImageIO;

import org.springframework.stereotype.Component;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;

import de.androidpit.colorthief.ColorThief;
import de.androidpit.colorthief.MMCQ.VBox;

@Component
public class ColorProvider {

	private static final int PALETTE_SAMPLE_SIZE = 10;
	private static final int PALETTE_SAMPLE_QUALITY = 5;
	private static final double MIN_BRIGHTNESS = 0.15;
	private static final int MIN_POPULATION = 1000;

	private LoadingCache<String, List<RGB>> cachedDominantColorsForUrl;

	public ColorProvider() {
		this.cachedDominantColorsForUrl = CacheBuilder.newBuilder()
			.build(new CacheLoader<String, List<RGB>>() {
				@Override
				public List<RGB> load(String imageUrl) throws IOException {
					return getDominantColors(imageUrl);
				}
			});
	}

	/**
	 * Returns an approximation of the two most dominant colors from an image as a
	 * list [primary, secondary]. The algorithm favors bright, vibrant colors over
	 * dull ones and will completely ignore ones that fall below a certain threshold
	 * for pixel population or brightness. For particularily dull images that don't
	 * even manage to find two colors meeting the minimum requirement at all, WHITE
	 * is returned.
	 * 
	 * @param imageUrl the URL of the image
	 * @return the two most dominant colors as a RGB list of exactly two entries
	 *         (note: all results are indefinitely cached)
	 */
	public List<RGB> getDominantColorFromImageUrl(String imageUrl) {
		if (imageUrl != null) {
			try {
				return cachedDominantColorsForUrl.get(imageUrl);
			} catch (ExecutionException e) {
				e.printStackTrace();
			}
		}
		return List.of(RGB.DEFAULT_RGB, RGB.DEFAULT_RGB);
	}

	private List<RGB> getDominantColors(String imageUrl) throws IOException {
		BufferedImage img = ImageIO.read(new URL(imageUrl));

		List<VBox> vboxes = new ArrayList<>(ColorThief.getColorMap(img, PALETTE_SAMPLE_SIZE, PALETTE_SAMPLE_QUALITY, false).vboxes);
		vboxes.removeIf(vBox -> !isValidVbox(vBox));
		Collections.sort(vboxes, new Comparator<VBox>() {
			@Override
			public int compare(VBox v1, VBox v2) {
				return Integer.compare(calculateWeightedPopulation(v1), calculateWeightedPopulation(v2));
			}
		});
		Collections.reverse(vboxes);

		if (vboxes.isEmpty()) {
			return List.of(RGB.DEFAULT_RGB, RGB.DEFAULT_RGB);
		} else if (vboxes.size() == 1) {
			int[] pal = vboxes.get(0).avg(false);
			RGB rgb = new RGB(pal[0], pal[1], pal[2]);
			return List.of(rgb, rgb);
		} else {
			int[] pal1 = vboxes.get(0).avg(false);
			int[] pal2 = vboxes.get(1).avg(false);
			RGB rgb1 = new RGB(pal1[0], pal1[1], pal1[2]);
			RGB rgb2 = new RGB(pal2[0], pal2[1], pal2[2]);
			if (calculateBrightness(rgb1) > calculateBrightness(rgb2)) {
				return List.of(rgb1, rgb2);
			} else {
				return List.of(rgb2, rgb1);
			}
		}
	}

	private boolean isValidVbox(VBox vBox) {
		int[] pal = vBox.avg(false);
		int r = pal[0];
		int g = pal[1];
		int b = pal[2];

		double brightness = calculateBrightness(r, g, b);
		int population = vBox.count(false);

		return (population > MIN_POPULATION && brightness > MIN_BRIGHTNESS);
	}

	private int calculateWeightedPopulation(VBox vBox) {
		int[] pal = vBox.avg(false);
		int r = pal[0];
		int g = pal[1];
		int b = pal[2];
		int population = vBox.count(false);
		double colorfulness = calculateColorfulness(r, g, b);
		return (int) (population + (population * Math.pow(colorfulness, 2)));
	}

	private static double calculateBrightness(RGB rgb) {
		return calculateBrightness(rgb.getR(), rgb.getG(), rgb.getB());
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
	private static double calculateBrightness(int r, int g, int b) {
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
	private static double calculateColorfulness(int r, int g, int b) {
		double rg = Math.abs(r - g);
		double yb = Math.abs((0.5 * (r + g)) - b);
		return Math.sqrt(Math.pow(rg, 2) + Math.pow(yb, 2));
	}

	public static class RGB {
		private static final RGB DEFAULT_RGB = new RGB(255, 255, 255);

		private final int r;
		private final int g;
		private final int b;

		protected RGB(int r, int g, int b) {
			this.r = r;
			this.g = g;
			this.b = b;
		}

		public int getR() {
			return r;
		}

		public int getG() {
			return g;
		}

		public int getB() {
			return b;
		}
	}
}
