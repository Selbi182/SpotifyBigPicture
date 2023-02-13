package spotify.playback.data.dto.sub;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.google.common.base.Objects;

import de.selbi.colorfetch.data.ColorFetchResult;
import spotify.playback.data.help.PlaybackInfoUtils;

@JsonInclude(Include.NON_NULL)
public class ImageData {

  private String imageUrl;
  private ColorFetchResult imageColors;

  public ImageData() {
    this.imageUrl = PlaybackInfoUtils.BLANK;
    this.imageColors = ColorFetchResult.FALLBACK;
  }

  public String getImageUrl() {
    return imageUrl;
  }

  public void setImageUrl(String imageUrl) {
    this.imageUrl = imageUrl;
  }

  public ColorFetchResult getImageColors() {
    return imageColors;
  }

  public void setImageColors(ColorFetchResult imageColors) {
    this.imageColors = imageColors;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o)
      return true;
    if (!(o instanceof ImageData))
      return false;
    ImageData imageData = (ImageData) o;
    return Objects.equal(imageUrl, imageData.imageUrl) && Objects.equal(imageColors, imageData.imageColors);
  }

  @Override
  public int hashCode() {
    return Objects.hashCode(imageUrl, imageColors);
  }
}