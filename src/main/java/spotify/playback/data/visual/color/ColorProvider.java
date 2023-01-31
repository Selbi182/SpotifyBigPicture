package spotify.playback.data.visual.color;

import de.selbi.colorfetch.data.ColorFetchResult;

public interface ColorProvider {
  ColorFetchResult getDominantColorFromImageUrl(String artworkUrl);
}
