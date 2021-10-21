package spotify.playback.data.visual.color;

import java.awt.*;

public class DominantRGBs {

	public static final DominantRGBs FALLBACK = DominantRGBs.of(RGB.DEFAULT_RGB, RGB.DEFAULT_RGB, ColorUtil.calculateBrightness(RGB.DEFAULT_RGB));

	private RGB primary;
	private RGB secondary;
	private final double borderBrightness;

	private DominantRGBs(RGB primary, RGB secondary, double borderBrightness) {
		this.primary = primary;
		this.secondary = secondary;
		this.borderBrightness = borderBrightness;
	}

	public static DominantRGBs of(RGB primary, RGB secondary, double borderBrightness) {
		return new DominantRGBs(primary, secondary, borderBrightness);
	}

	public static DominantRGBs of(Color primary, Color secondary, double borderBrightness) {
		return new DominantRGBs(RGB.of(primary), RGB.of(secondary), borderBrightness);
	}

	public static class RGB {
		public static final RGB DEFAULT_RGB = RGB.of(Color.WHITE);

		private final int r;
		private final int g;
		private final int b;

		private RGB(int r, int g, int b) {
			this.r = r;
			this.g = g;
			this.b = b;
		}

		public static RGB of(int r, int g, int b) {
			return new RGB(r, g, b);
		}

		public static RGB of(int[] rgb) {
			return new RGB(rgb[0], rgb[1], rgb[2]);
		}

		public static RGB of(Color c) {
			return new RGB(c.getRed(), c.getGreen(), c.getBlue());
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

		@Override
		public String toString() {
			return String.format("R %d / G %d / B %d", r, g, b);
		}
	}

	public RGB getPrimary() {
		return primary;
	}

	public void setPrimary(RGB primary) {
		this.primary = primary;
	}

	public RGB getSecondary() {
		return secondary;
	}

	public void setSecondary(RGB secondary) {
		this.secondary = secondary;
	}

	public double getBorderBrightness() {
		return borderBrightness;
	}
}
