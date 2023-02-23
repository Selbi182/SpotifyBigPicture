package spotify.playback.data.dto.sub;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.google.common.base.Objects;

@JsonInclude(Include.NON_NULL)
public class TrackData {
  public enum ListViewType {
    ALBUM,
    PODCAST,
    PLAYLIST,
    QUEUE,
  }

  private Integer trackNumber;
  private Integer discNumber;
  private Integer totalDiscCount;
  private ListViewType trackListView;
  private Integer trackCount;
  private Long combinedTime;
  private List<TrackElement> listTracks;
  private List<TrackElement> queue;

  private ImageData nextImageData;

  public Integer getTrackNumber() {
    return trackNumber;
  }

  public void setTrackNumber(Integer trackNumber) {
    this.trackNumber = trackNumber;
  }

  public Integer getDiscNumber() {
    return discNumber;
  }

  public void setDiscNumber(Integer discNumber) {
    this.discNumber = discNumber;
  }

  public Integer getTotalDiscCount() {
    return totalDiscCount;
  }

  public void setTotalDiscCount(Integer totalDiscCount) {
    this.totalDiscCount = totalDiscCount;
  }

  public ListViewType getTrackListView() {
    return trackListView;
  }

  public void setTrackListView(ListViewType trackListView) {
    this.trackListView = trackListView;
  }

  public Integer getTrackCount() {
    return trackCount;
  }

  public void setTrackCount(Integer trackCount) {
    this.trackCount = trackCount;
  }

  public Long getCombinedTime() {
    return combinedTime;
  }

  public void setCombinedTime(Long combinedTime) {
    this.combinedTime = combinedTime;
  }

  public List<TrackElement> getListTracks() {
    return listTracks;
  }

  public void setListTracks(List<TrackElement> listTracks) {
    this.listTracks = listTracks;
  }

  public List<TrackElement> getQueue() {
    return queue;
  }

  public void setQueue(List<TrackElement> queue) {
    this.queue = queue;
  }

  public ImageData getNextImageData() {
    return nextImageData;
  }

  public void setNextImageData(ImageData nextImageData) {
    this.nextImageData = nextImageData;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o)
      return true;
    if (!(o instanceof TrackData))
      return false;
    TrackData trackData = (TrackData) o;
    return Objects.equal(trackNumber, trackData.trackNumber) && Objects.equal(discNumber, trackData.discNumber) && Objects.equal(totalDiscCount, trackData.totalDiscCount)
        && trackListView == trackData.trackListView && Objects.equal(trackCount, trackData.trackCount) && Objects.equal(combinedTime, trackData.combinedTime) && Objects.equal(listTracks,
        trackData.listTracks) && Objects.equal(queue, trackData.queue) && Objects.equal(nextImageData, trackData.nextImageData);
  }

  @Override
  public int hashCode() {
    return Objects.hashCode(trackNumber, discNumber, totalDiscCount, trackListView, trackCount, combinedTime, listTracks, queue, nextImageData);
  }
}
