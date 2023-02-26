package spotify.playback.data.dto.sub;

import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

@JsonInclude(Include.NON_NULL)
public class PlaybackContext {
  private Boolean paused;
  private Boolean shuffle;
  private String repeat;
  private Integer volume;
  private String context;
  private String device;
  private String thumbnailUrl;

  public Boolean getPaused() {
    return paused;
  }

  public void setPaused(Boolean paused) {
    this.paused = paused;
  }

  public Boolean getShuffle() {
    return shuffle;
  }

  public void setShuffle(Boolean shuffle) {
    this.shuffle = shuffle;
  }

  public String getRepeat() {
    return repeat;
  }

  public void setRepeat(String repeat) {
    this.repeat = repeat;
  }

  public Integer getVolume() {
    return volume;
  }

  public void setVolume(Integer volume) {
    this.volume = volume;
  }

  public String getContext() {
    return context;
  }

  public void setContext(String context) {
    this.context = context;
  }

  public String getDevice() {
    return device;
  }

  public void setDevice(String device) {
    this.device = device;
  }

  public String getThumbnailUrl() {
    return thumbnailUrl;
  }

  public void setThumbnailUrl(String thumbnailUrl) {
    this.thumbnailUrl = thumbnailUrl;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o)
      return true;
    if (!(o instanceof PlaybackContext))
      return false;
    PlaybackContext that = (PlaybackContext) o;
    return Objects.equals(paused, that.paused) && Objects.equals(shuffle, that.shuffle) && Objects.equals(repeat, that.repeat) && Objects.equals(volume, that.volume) && Objects.equals(context, that.context)
        && Objects.equals(device, that.device) && Objects.equals(thumbnailUrl, that.thumbnailUrl);
  }

  @Override
  public int hashCode() {
    return Objects.hash(paused, shuffle, repeat, volume, context, device, thumbnailUrl);
  }
}
