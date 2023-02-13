package spotify.playback.data.dto.sub;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.google.common.base.Objects;

@JsonInclude(Include.NON_NULL)
public class PlaybackContext {
  private Boolean paused;
  private Boolean shuffle;
  private String repeat;
  private Integer volume;
  private String context;
  private String device;
  private String playlistImageUrl;

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

  public String getPlaylistImageUrl() {
    return playlistImageUrl;
  }

  public void setPlaylistImageUrl(String playlistImageUrl) {
    this.playlistImageUrl = playlistImageUrl;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o)
      return true;
    if (!(o instanceof PlaybackContext))
      return false;
    PlaybackContext that = (PlaybackContext) o;
    return Objects.equal(paused, that.paused) && Objects.equal(shuffle, that.shuffle) && Objects.equal(repeat, that.repeat) && Objects.equal(volume, that.volume)
        && Objects.equal(context, that.context) && Objects.equal(device, that.device) && Objects.equal(playlistImageUrl, that.playlistImageUrl);
  }

  @Override
  public int hashCode() {
    return Objects.hashCode(paused, shuffle, repeat, volume, context, device, playlistImageUrl);
  }
}
