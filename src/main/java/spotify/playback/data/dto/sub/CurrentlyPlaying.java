package spotify.playback.data.dto.sub;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.google.common.base.Objects;

import spotify.playback.data.dto.BigPictureInclude;

@JsonInclude(Include.NON_NULL)
public class CurrentlyPlaying implements BigPictureInclude {
  private String id;
  private List<String> artists;
  private String title;
  private String album;
  private String year;
  private String description;
  private Integer timeCurrent;
  private Integer timeTotal;

  private ImageData imageData;

  public CurrentlyPlaying() {
    this.imageData = new ImageData();
  }

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public List<String> getArtists() {
    return artists;
  }

  public void setArtists(List<String> artists) {
    this.artists = artists;
  }

  public String getTitle() {
    return title;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public String getAlbum() {
    return album;
  }

  public void setAlbum(String album) {
    this.album = album;
  }

  public String getYear() {
    return year;
  }

  public void setYear(String year) {
    this.year = year;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public Integer getTimeCurrent() {
    return timeCurrent;
  }

  public void setTimeCurrent(Integer timeCurrent) {
    this.timeCurrent = timeCurrent;
  }

  public Integer getTimeTotal() {
    return timeTotal;
  }

  public void setTimeTotal(Integer timeTotal) {
    this.timeTotal = timeTotal;
  }

  public ImageData getImageData() {
    return imageData;
  }

  public void setImageData(ImageData imageData) {
    this.imageData = imageData;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o)
      return true;
    if (!(o instanceof CurrentlyPlaying))
      return false;
    CurrentlyPlaying that = (CurrentlyPlaying) o;
    return Objects.equal(id, that.id) && Objects.equal(artists, that.artists) && Objects.equal(title, that.title) && Objects.equal(album, that.album)
        && Objects.equal(year, that.year) && Objects.equal(description, that.description) && Objects.equal(timeCurrent, that.timeCurrent) && Objects.equal(timeTotal,
        that.timeTotal);
  }

  @Override
  public int hashCode() {
    return Objects.hashCode(id, artists, title, album, year, description, timeCurrent, timeTotal);
  }

}
