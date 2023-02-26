package spotify.playback.data.visual.color;

import de.selbi.colorfetch.cache.ColorCacheKey;
import de.selbi.colorfetch.cache.ColorResultCache;
import de.selbi.colorfetch.data.ColorFetchResult;
import de.selbi.colorfetch.provider.AndroidPaletteColorProvider;
import de.selbi.colorfetch.provider.ColorThiefColorProvider;

public class InternalColorProvider implements ColorProvider {
  private final ColorResultCache colorResultCache;

  InternalColorProvider() {
    this.colorResultCache = new ColorResultCache(new ColorThiefColorProvider(), new AndroidPaletteColorProvider());
  }

  @Override
  public ColorFetchResult getDominantColorFromImageUrl(String artworkUrl) {
    ColorCacheKey colorCacheKey = ColorCacheKey.of(artworkUrl, ColorCacheKey.Strategy.COLOR_THIEF, NORMALIZE);
    return colorResultCache.getColor(colorCacheKey);
  }
}
