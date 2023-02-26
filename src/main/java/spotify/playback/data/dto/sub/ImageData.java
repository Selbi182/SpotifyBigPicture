package spotify.playback.data.dto.sub;

import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

import de.selbi.colorfetch.data.ColorFetchResult;
import spotify.playback.data.help.BigPictureUtils;

@JsonInclude(Include.NON_NULL)
public class ImageData {

  private String imageUrl;
  private ColorFetchResult imageColors;

  public ImageData() {
    this.imageUrl = BigPictureUtils.BLANK;
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
    return Objects.equals(imageUrl, imageData.imageUrl) && Objects.equals(imageColors, imageData.imageColors);
  }

  @Override
  public int hashCode() {
    return Objects.hash(imageUrl, imageColors);
  }
}