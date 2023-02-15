package spotify.playback.data.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.google.common.base.Objects;

import spotify.playback.data.dto.sub.CurrentlyPlaying;
import spotify.playback.data.dto.sub.PlaybackContext;
import spotify.playback.data.dto.sub.TrackData;

@JsonInclude(Include.NON_EMPTY)
public class PlaybackInfo {
  public static final PlaybackInfo EMPTY = new PlaybackInfo(Type.EMPTY);

  public enum Type {
    EMPTY,
    DATA
  }

  private Type type;
  private Long deployTime;

  private CurrentlyPlaying currentlyPlaying;
  private PlaybackContext playbackContext;
  private TrackData trackData;

  private List<String> settingsToToggle;

  public PlaybackInfo(Type type) {
    this(type, true);
  }

  public PlaybackInfo(Type type, boolean buildDefaultValues) {
    if (buildDefaultValues) {
      this.currentlyPlaying = new CurrentlyPlaying();
      this.playbackContext = new PlaybackContext();
      this.trackData = new TrackData();
    }
    this.type = type;
    this.settingsToToggle = List.of();
  }

  @JsonIgnore
  public boolean hasPayload() {
    return getType() != null && !Type.EMPTY.equals(getType());
  }

  public Type getType() {
    return type;
  }

  public void setType(Type type) {
    this.type = type;
  }

  public Long getDeployTime() {
    return deployTime;
  }

  public void setDeployTime(Long deployTime) {
    this.deployTime = deployTime;
  }

  public CurrentlyPlaying getCurrentlyPlaying() {
    return currentlyPlaying;
  }

  public void setCurrentlyPlaying(CurrentlyPlaying currentlyPlaying) {
    this.currentlyPlaying = currentlyPlaying;
  }

  public PlaybackContext getPlaybackContext() {
    return playbackContext;
  }

  public void setPlaybackContext(PlaybackContext playbackContext) {
    this.playbackContext = playbackContext;
  }

  public TrackData getTrackData() {
    return trackData;
  }

  public void setTrackData(TrackData trackData) {
    this.trackData = trackData;
  }

  public int getVersionId() {
    return hashCode();
  }

  public List<String> getSettingsToToggle() {
    return settingsToToggle;
  }

  public void setSettingsToToggle(List<String> settingsToToggle) {
    this.settingsToToggle = settingsToToggle;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o)
      return true;
    if (!(o instanceof PlaybackInfo))
      return false;
    PlaybackInfo that = (PlaybackInfo) o;
    return type == that.type && Objects.equal(deployTime, that.deployTime) && Objects.equal(currentlyPlaying, that.currentlyPlaying) && Objects.equal(playbackContext, that.playbackContext)
        && Objects.equal(trackData, that.trackData) && Objects.equal(settingsToToggle, that.settingsToToggle);
  }

  @Override
  public int hashCode() {
    return Objects.hashCode(type, deployTime, currentlyPlaying, playbackContext, trackData, settingsToToggle);
  }
}
