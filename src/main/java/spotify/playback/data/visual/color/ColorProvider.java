package spotify.playback.data.visual.color;

import de.selbi.colorfetch.data.ColorFetchResult;

public interface ColorProvider {
  float NORMALIZE = 1.0f;

  ColorFetchResult getDominantColorFromImageUrl(String artworkUrl);
}
