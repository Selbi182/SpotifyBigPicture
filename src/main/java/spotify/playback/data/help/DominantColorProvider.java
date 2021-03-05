package spotify.playback.data.help;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.net.URL;
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
public class DominantColorProvider {

	private static final double MIN_BRIGHTNESS = 0.1;
	private static final int MIN_POPULATION = 500;

	private LoadingCache<String, RGB> cachedDominantColorsForUrl;

	public DominantColorProvider() {
		this.cachedDominantColorsForUrl = CacheBuilder.newBuilder()
			.build(new CacheLoader<String, RGB>() {
				@Override
				public RGB load(String imageUrl) throws IOException {
					return getDominantColor(imageUrl);
				}
			});
	}

	public RGB getDominantColorFromImageUrl(String imageUrl) {
		if (imageUrl != null) {
			try {
				return cachedDominantColorsForUrl.get(imageUrl);
			} catch (ExecutionException e) {
				e.printStackTrace();
			}
		}
		return RGB.DEFAULT_RGB;
	}

	private RGB getDominantColor(String imageUrl) throws IOException {
		BufferedImage img = ImageIO.read(new URL(imageUrl));

		List<VBox> vboxes = ColorThief.getColorMap(img, 10).vboxes;

		double bestWeightedPopulation = 0;
		VBox bestVbox = null;
		for (VBox vBox : vboxes) {
			int[] pal = vBox.avg(false);
			int r = pal[0];
			int g = pal[1];
			int b = pal[2];

			double brightness = calculateBrightness(r, g, b);
			double colorfulness = calculateColorfulness(r, g, b);
			int population = vBox.count(false);

			double weightedPopulation = population + (population * Math.pow(colorfulness, 2));

			if (population > MIN_POPULATION && brightness > MIN_BRIGHTNESS && weightedPopulation > bestWeightedPopulation) {
				bestWeightedPopulation = weightedPopulation;
				bestVbox = vBox;
			}
		}

		if (bestVbox != null) {
			int[] rgb = bestVbox.avg(false);
			return new RGB(rgb[0], rgb[1], rgb[2]);
		}
		return RGB.DEFAULT_RGB; // for dark and grayscale images
	}

	private static double calculateBrightness(int r, int g, int b) {
		// Rough brightness calculation based on the HSP Color Model
		// -> http://alienryderflex.com/hsp.html
		return Math.sqrt(0.299 * Math.pow(r, 2) + 0.587 * Math.pow(g, 2) + 0.114 * Math.pow(b, 2)) / 255;
	}

	private static double calculateColorfulness(int r, int g, int b) {
		// Rough implementation of Colorfulness Index defined by Hasler and Suesstrunk
		// -> https://infoscience.epfl.ch/record/33994/files/HaslerS03.pdf (p. 5+6)
		double rg = Math.abs(r - g);
		double yb = Math.abs((0.5 * (r + g)) - b);
		double meanRoot = Math.sqrt(Math.pow(rg, 2) + Math.pow(yb, 2));
		return meanRoot;
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
