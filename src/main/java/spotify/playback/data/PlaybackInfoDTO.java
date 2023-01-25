package spotify.playback.data;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

import spotify.playback.data.help.ListTrackDTO;
import spotify.playback.data.visual.color.DominantRGBs;

/**
 * Wrapper class for the playback info to be sent via SSEEmitter to the
 * frontend. Any field can be null to indicate no change.
 */
@JsonInclude(Include.NON_NULL)
public class PlaybackInfoDTO {
  public static final PlaybackInfoDTO EMPTY = new PlaybackInfoDTO(Type.EMPTY);
  public static final PlaybackInfoDTO HEARTBEAT = new PlaybackInfoDTO(Type.HEARTBEAT);
  public static final PlaybackInfoDTO DARK_MODE = new PlaybackInfoDTO(Type.DARK_MODE);

  enum Type {
    EMPTY,
    HEARTBEAT,
    DARK_MODE,
    DATA
  }

  enum ListViewType {
    ALBUM,
    PLAYLIST,
    QUEUE
  }

  private Type type;
  private String id;
  private Boolean paused;
  private Boolean shuffle;
  private String repeat;
  private Integer volume;
  private String context;
  private String device;
  private List<String> artists;
  private Integer trackNumber;
  private ListViewType trackListView;
  private String title;
  private String album;
  private String release;
  private String image;
  private DominantRGBs imageColors;
  private Integer timeCurrent;
  private Integer timeTotal;
  private String description;
  private Long deployTime;
  private List<ListTrackDTO> listTracks;
  private List<ListTrackDTO> queue;

  public PlaybackInfoDTO() {
  }

  public PlaybackInfoDTO(Type type) {
    this.type = type;
  }

  @JsonIgnore
  public boolean hasPayload() {
    return !getType().equals(Type.EMPTY);
  }

  public Type getType() {
    return type;
  }

  public void setType(Type type) {
    this.type = type;
  }

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public Boolean isPaused() {
    return paused;
  }

  public void setPaused(Boolean paused) {
    this.paused = paused;
  }

  public Boolean isShuffle() {
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

  public String getDevice() {
    return device;
  }

  public void setDevice(String device) {
    this.device = device;
  }

  public String getContext() {
    return context;
  }

  public void setContext(String context) {
    this.context = context;
  }

  public List<String> getArtists() {
    return artists;
  }

  public void setArtists(List<String> artists) {
    this.artists = artists;
  }

  public Integer getTrackNumber() {
    return trackNumber;
  }

  public void setTrackNumber(Integer trackNumber) {
    this.trackNumber = trackNumber;
  }

  public ListViewType getTrackListView() {
    return trackListView;
  }

  public void setTrackListView(ListViewType trackListView) {
    this.trackListView = trackListView;
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

  public String getRelease() {
    return release;
  }

  public void setRelease(String release) {
    this.release = release;
  }

  public String getImage() {
    return image;
  }

  public void setImage(String image) {
    this.image = image;
  }

  public DominantRGBs getImageColors() {
    return imageColors;
  }

  public void setImageColors(DominantRGBs imageColors) {
    this.imageColors = imageColors;
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

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public Long getDeployTime() {
    return deployTime;
  }

  public void setDeployTime(Long deployTime) {
    this.deployTime = deployTime;
  }

  public List<ListTrackDTO> getListTracks() {
    return listTracks;
  }

  public void setListTracks(List<ListTrackDTO> listTracks) {
    this.listTracks = listTracks;
  }

  public List<ListTrackDTO> getQueue() {
    return queue;
  }

  public void setQueue(List<ListTrackDTO> queue) {
    this.queue = queue;
  }
}
