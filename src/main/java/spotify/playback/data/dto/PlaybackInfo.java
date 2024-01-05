package spotify.playback.data.dto;

import java.util.List;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

import spotify.playback.data.dto.sub.CurrentlyPlaying;
import spotify.playback.data.dto.sub.PlaybackContext;
import spotify.playback.data.dto.sub.TrackData;

@JsonInclude(Include.NON_EMPTY)
public class PlaybackInfo implements PlaybackInfoResponse {
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
  private List<CustomVolumeSettings> customVolumeSettings;

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

  public List<CustomVolumeSettings> getCustomVolumeSettings() {
    return customVolumeSettings;
  }

  public void setCustomVolumeSettings(List<CustomVolumeSettings> customVolumeSettings) {
    this.customVolumeSettings = customVolumeSettings;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o)
      return true;
    if (!(o instanceof PlaybackInfo))
      return false;
    PlaybackInfo that = (PlaybackInfo) o;
    return type == that.type && Objects.equals(deployTime, that.deployTime) && Objects.equals(currentlyPlaying, that.currentlyPlaying) && Objects.equals(playbackContext, that.playbackContext) && Objects.equals(trackData,
        that.trackData) && Objects.equals(settingsToToggle, that.settingsToToggle) && Objects.equals(customVolumeSettings, that.customVolumeSettings);
  }

  @Override
  public int hashCode() {
    return Objects.hash(type, deployTime, currentlyPlaying, playbackContext, trackData, settingsToToggle, customVolumeSettings);
  }

  public static class CustomVolumeSettings {
    private String device;
    private int baseDb;

    public CustomVolumeSettings(String device, int baseDb) {
      this.device = device;
      this.baseDb = baseDb;
    }

    public String getDevice() {
      return device;
    }

    public void setDevice(String device) {
      this.device = device;
    }

    public int getBaseDb() {
      return baseDb;
    }

    public void setBaseDb(int baseDb) {
      this.baseDb = baseDb;
    }

    @Override
    public boolean equals(Object o) {
      if (this == o)
        return true;
      if (!(o instanceof CustomVolumeSettings))
        return false;
      CustomVolumeSettings that = (CustomVolumeSettings) o;
      return baseDb == that.baseDb && Objects.equals(device, that.device);
    }

    @Override
    public int hashCode() {
      return Objects.hash(device, baseDb);
    }
  }
}
