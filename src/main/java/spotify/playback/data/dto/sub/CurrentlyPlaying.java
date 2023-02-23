package spotify.playback.data.dto.sub;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.google.common.base.Objects;

@JsonInclude(Include.NON_NULL)
public class CurrentlyPlaying extends TrackElement {
  private Integer timeCurrent;
  private ImageData imageData;

  public CurrentlyPlaying() {
    super();
    this.imageData = new ImageData();
  }

  public CurrentlyPlaying(String id, int trackNumber, int discNumber, List<String> artists, String title, String album, String releaseDate, String description, int timeTotal, int timeCurrent, ImageData imageData) {
    super(id, trackNumber, discNumber, artists, title, album, releaseDate, description, timeTotal);
    this.timeCurrent = timeCurrent;
    this.imageData = imageData;
  }

  public Integer getTimeCurrent() {
    return timeCurrent;
  }

  public void setTimeCurrent(Integer timeCurrent) {
    this.timeCurrent = timeCurrent;
  }

  public ImageData getImageData() {
    return imageData;
  }

  public void setImageData(ImageData imageData) {
    this.imageData = imageData;
  }

  // Equals and hashCode explicitly ignore timeCurrent

  @Override
  public boolean equals(Object o) {
    if (this == o)
      return true;
    if (!(o instanceof CurrentlyPlaying))
      return false;
    if (!super.equals(o))
      return false;
    CurrentlyPlaying that = (CurrentlyPlaying) o;
    return Objects.equal(imageData, that.imageData);
  }

  @Override
  public int hashCode() {
    return Objects.hashCode(super.hashCode(), imageData);
  }
}
