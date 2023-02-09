package spotify.playback.data.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.google.common.base.Objects;

import spotify.playback.data.dto.sub.CurrentlyPlaying;
import spotify.playback.data.dto.sub.PlaybackContext;
import spotify.playback.data.dto.sub.TrackData;

/**
 * Data class for the playback info to be sent via SSEEmitter to the
 * frontend. Any field can be null to indicate no change.
 */
@JsonInclude(Include.NON_EMPTY)
public class PlaybackInfo implements BigPictureInclude {
  public static final PlaybackInfo EMPTY = new PlaybackInfo(Type.EMPTY);
  public static final PlaybackInfo HEARTBEAT = new PlaybackInfo(Type.HEARTBEAT);
  public static final PlaybackInfo DARK_MODE = new PlaybackInfo(Type.DARK_MODE);

  public enum Type {
    EMPTY,
    HEARTBEAT,
    DARK_MODE,
    DATA
  }

  private Type type;
  private Long deployTime;

  private CurrentlyPlaying currentlyPlaying;
  private PlaybackContext playbackContext;
  private TrackData trackData;

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

  @Override
  public boolean equals(Object o) {
    if (this == o)
      return true;
    if (!(o instanceof PlaybackInfo))
      return false;
    PlaybackInfo that = (PlaybackInfo) o;
    return type == that.type && Objects.equal(deployTime, that.deployTime) && Objects.equal(currentlyPlaying, that.currentlyPlaying) && Objects.equal(playbackContext, that.playbackContext)
        && Objects.equal(trackData, that.trackData);
  }

  @Override
  public int hashCode() {
    return Objects.hashCode(type, deployTime, currentlyPlaying, playbackContext, trackData);
  }
}
