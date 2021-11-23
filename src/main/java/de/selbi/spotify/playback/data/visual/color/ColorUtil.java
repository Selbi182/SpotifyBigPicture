package de.selbi.spotify.playback.data.visual.color;

import java.awt.Color;

import de.selbi.spotify.playback.data.visual.color.DominantRGBs.RGB;

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
   * Get the brightness of this color.
   *
   * @param r red 0..255
   * @param g green 0..255
   * @param b blue 0..255
   * @return the brightness as double (range 0.0..1.0)
   */
  public static double calculateBrightness(int r, int g, int b) {
    return rgbToHsb(r, g, b)[2];
  }

  /**
   * Get the colorfulness (saturation) of this color.
   *
   * @param r red 0..255
   * @param g green 0..255
   * @param b blue 0..255
   * @return the colorfulness as double (range 0.0..255.0)
   */
  public static double calculateColorfulness(int r, int g, int b) {
    return rgbToHsb(r, g, b)[1];
  }

  /**
   * @return float[0: hue, 1: saturation, 2: brightness]
   */
  private static float[] rgbToHsb(int r, int g, int b) {
    return Color.RGBtoHSB(r, g, b, null);
  }

  /**
   * @return float[0: hue, 1: saturation, 2: brightness]
   */
  private static int[] hsbToRgb(float[] hsb) {
    int rgb = Color.HSBtoRGB(hsb[0], hsb[1], hsb[2]);
    int red = (rgb >> 16) & 0xFF;
    int green = (rgb >> 8) & 0xFF;
    int blue = rgb & 0xFF;
    return new int[] { red, green, blue };
  }

  /**
   * Normalize the given color to improve readability. This is done by increasing
   * the brightness to the maximum.
   *
   * @param color the color
   * @return a new, normalized RBG object
   */
  public static RGB normalizeForReadability(RGB color) {
    int r = color.getR();
    int g = color.getG();
    int b = color.getB();
    float[] hsb = rgbToHsb(r, g, b);
    hsb[2] = 1.0f; // Set brightness to max
    return RGB.of(hsbToRgb(hsb));
  }

  /**
   * Calculate a rough perceived brightness for the human eye based on this color (e.g. we see green brighter than blue)
   * Taken from: http://alienryderflex.com/hsp.html
   * @param color the color
   * @return the rough perceived brightness 0.0..1.0
   */
  public static double calculatePerceivedBrightness(RGB color) {
    int r = color.getR();
    int g = color.getG();
    int b = color.getB();
    return Math.sqrt(0.299 * Math.pow(r, 2) + 0.587 * Math.pow(g, 2) + 0.114 * Math.pow(b, 2)) / 255;
  }

  /**
   * Convenience method to normalize all colors for readability
   *
   * @param colors the colors
   */
  public static void normalizeAllForReadability(DominantRGBs colors) {
    colors.setPrimary(normalizeForReadability(colors.getPrimary()));
    colors.setSecondary(normalizeForReadability(colors.getSecondary()));
  }
}
