package spotify.playback.data.visual.color;

import java.awt.Color;

public class ColorFetchResult {
  public static final ColorFetchResult FALLBACK = new ColorFetchResult(RGB.DEFAULT_RGB, RGB.DEFAULT_RGB, 0.5);

  private RGB primary;
  private RGB secondary;
  private double averageBrightness;

  public ColorFetchResult() {
  }

  public ColorFetchResult(RGB primary, RGB secondary, double averageBrightness) {
    this.primary = primary;
    this.secondary = secondary;
    this.averageBrightness = averageBrightness;
  }

  public static class RGB {
    public static final RGB DEFAULT_RGB = RGB.of(Color.WHITE);

    private int r;
    private int g;
    private int b;

    public RGB() {

    }

    public RGB(int r, int g, int b) {
      this.r = r;
      this.g = g;
      this.b = b;
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

  public RGB getSecondary() {
    return secondary;
  }

  public double getAverageBrightness() {
    return averageBrightness;
  }
}
