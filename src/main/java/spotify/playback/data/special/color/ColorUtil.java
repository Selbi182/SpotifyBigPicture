package spotify.playback.data.special.color;

import spotify.playback.data.special.color.DominantRGBs.RGB;

public class ColorUtil {
	private ColorUtil() {
	}

	/**
	 * Convenience method for {@link ColorUtil#calculateBrightness(int, int, int)}
	 * 
	 * @param rgb the RGB object
	 * @return the brightness as double (range 0.0..1.0)
	 */
	public static double calculateBrightness(RGB rgb) {
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
