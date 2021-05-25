package spotify.playback.data.visual.color;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.net.URL;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

import javax.imageio.ImageIO;

import org.springframework.stereotype.Component;

import com.google.common.annotations.Beta;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.trickl.palette.Palette;
import com.trickl.palette.Palette.Swatch;
import com.trickl.palette.Target;

/**
 * Implementation of the dominant color finding algorithm using a standalone
 * reimplementation of Android's Palette API. It is significantly slower in
 * comparison to {@link ColorThiefColorProvider}, but yields generally better
 * results, as it works with named palettes ("swatches") instead of just buckets
 * of pixels, which allows to weigh more appropriate colors over others, even if
 * they theoretically have more pixels on an image (Vibrant over DarkMuted ones
 * for example).<br/>
 * <br/>
 * 
 * Note: This implementation is in very early beta!
 */
@Beta
@Component
public class AndroidPaletteColorProvider implements ColorProvider {

	private static final double MIN_BRIGHTNESS = 0.2;
	private static final int MIN_POPULATION = 100;

	private LoadingCache<String, DominantRGBs> cachedDominantColorsForUrl;

	public AndroidPaletteColorProvider() {
		this.cachedDominantColorsForUrl = CacheBuilder.newBuilder()
			.build(new CacheLoader<String, DominantRGBs>() {
				@Override
				public DominantRGBs load(String imageUrl) throws IOException {
					return getDominantColors(imageUrl);
				}
			});
	}

	@Override
	public DominantRGBs getDominantColorFromImageUrl(String imageUrl) {
		if (imageUrl != null) {
			try {
				return cachedDominantColorsForUrl.get(imageUrl);
			} catch (ExecutionException e) {
				e.printStackTrace();
			}
		}
		return DominantRGBs.FALLBACK;
	}

	private DominantRGBs getDominantColors(String imageUrl) throws IOException {
		BufferedImage img = ImageIO.read(new URL(imageUrl));

		Palette palette = Palette.from(img).generate();
		List<Color> bestSwatches = getBestSwatch(palette, false);
		return DominantRGBs.of(bestSwatches.get(0), bestSwatches.get(1));
	}

	Map<Target, Integer> WEIGHTED_SWATCHES = Map.of(
		Target.VIBRANT, 5,
		Target.DARK_VIBRANT, 4,
		Target.LIGHT_VIBRANT, 3,
		Target.MUTED, 2,
		Target.LIGHT_MUTED, 2,
		Target.DARK_MUTED, 1);

	private List<Color> getBestSwatch(Palette palette, boolean ignoreMinimumRequirements) {
		double bestWeightedPopulation = 0.0;
		Swatch bestSwatch = null;

		double secondBestWeightedPopulation = 0.0;
		Swatch secondBestSwatch = null;

		for (Swatch swatch : palette.getSwatches()) {
			if (swatch != null && (ignoreMinimumRequirements || (swatch.getPopulation() > MIN_POPULATION && swatch.getHsl()[2] > MIN_BRIGHTNESS))) {
				double weightedPopulation = calculateWeightedPopulation(swatch, 1);
				if (bestSwatch == null || bestWeightedPopulation < weightedPopulation) {
					secondBestSwatch = bestSwatch;
					secondBestWeightedPopulation = bestWeightedPopulation;
					bestSwatch = swatch;
					bestWeightedPopulation = weightedPopulation;
				} else if (secondBestWeightedPopulation < weightedPopulation) {
					secondBestSwatch = swatch;
					secondBestWeightedPopulation = weightedPopulation;
				}
			}
		}
		if (bestSwatch == null && !ignoreMinimumRequirements) {
			return getBestSwatch(palette, true);
		} else {
			Color primary = bestSwatch != null ? bestSwatch.getColor() : Color.WHITE;
			Color secondary = secondBestSwatch != null ? secondBestSwatch.getColor() : bestSwatch != null ? primary : Color.WHITE;
			return List.of(primary.brighter(), secondary);
		}
	}

	private double calculateWeightedPopulation(Swatch swatch, int weight) {
		Color color = swatch.getColor();
		int r = color.getRed();
		int g = color.getGreen();
		int b = color.getBlue();
		int population = swatch.getPopulation();
		double colorfulness = ColorUtil.calculateColorfulness(r, g, b);
		return (population + (population * Math.pow(colorfulness, 2) * ColorUtil.calculateBrightness(r, g, b))) * weight;
	}
}
