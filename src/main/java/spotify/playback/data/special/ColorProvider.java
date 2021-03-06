package spotify.playback.data.special;

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
import spotify.playback.data.help.PlaybackInfoUtils;

@Component
public class ColorProvider {

	private static final int PALETTE_SAMPLE_SIZE = 10;
	private static final double MIN_BRIGHTNESS = 0.1;
	private static final int MIN_POPULATION = 1000;

	private LoadingCache<String, RGB> cachedDominantColorsForUrl;

	public ColorProvider() {
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

		List<VBox> vboxes = ColorThief.getColorMap(img, PALETTE_SAMPLE_SIZE).vboxes;

		double bestWeightedPopulation = 0;
		VBox bestVbox = null;
		for (VBox vBox : vboxes) {
			int[] pal = vBox.avg(false);
			int r = pal[0];
			int g = pal[1];
			int b = pal[2];

			double brightness = PlaybackInfoUtils.calculateBrightness(r, g, b);
			double colorfulness = PlaybackInfoUtils.calculateColorfulness(r, g, b);
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
		} else {
			// For dark and grayscale images
			return RGB.DEFAULT_RGB;
		}
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
