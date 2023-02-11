package spotify.playback.data.dto.sub;

import java.util.Comparator;
import java.util.List;

import org.springframework.lang.NonNull;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.google.common.base.Objects;

import se.michaelthelin.spotify.enums.ModelObjectType;
import se.michaelthelin.spotify.model_objects.IPlaylistItem;
import se.michaelthelin.spotify.model_objects.specification.Episode;
import se.michaelthelin.spotify.model_objects.specification.EpisodeSimplified;
import se.michaelthelin.spotify.model_objects.specification.Track;
import se.michaelthelin.spotify.model_objects.specification.TrackSimplified;
import spotify.playback.data.dto.BigPictureInclude;
import spotify.util.BotUtils;

@JsonInclude(Include.NON_NULL)
public class TrackData implements BigPictureInclude {
  public enum ListViewType {
    ALBUM,
    PODCAST,
    PLAYLIST,
    QUEUE,
  }

  private Integer trackNumber;
  private Integer discCount;
  private ListViewType trackListView;
  private Integer trackCount;
  private Long totalTime;
  private List<ListTrack> listTracks;
  private List<ListTrack> queue;

  private ImageData nextImageData;

  public Integer getTrackNumber() {
    return trackNumber;
  }

  public void setTrackNumber(Integer trackNumber) {
    this.trackNumber = trackNumber;
  }

  public Integer getDiscCount() {
    return discCount;
  }

  public void setDiscCount(Integer discCount) {
    this.discCount = discCount;
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

  public Long getTotalTime() {
    return totalTime;
  }

  public void setTotalTime(Long totalTime) {
    this.totalTime = totalTime;
  }

  public List<ListTrack> getListTracks() {
    return listTracks;
  }

  public void setListTracks(List<ListTrack> listTracks) {
    this.listTracks = listTracks;
  }

  public List<ListTrack> getQueue() {
    return queue;
  }

  public void setQueue(List<ListTrack> queue) {
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
    return Objects.equal(trackNumber, trackData.trackNumber) && Objects.equal(discCount, trackData.discCount) && trackListView == trackData.trackListView && Objects.equal(trackCount,
        trackData.trackCount) && Objects.equal(totalTime, trackData.totalTime) && Objects.equal(listTracks, trackData.listTracks) && Objects.equal(queue, trackData.queue)
        && Objects.equal(nextImageData, trackData.nextImageData);
  }

  @Override
  public int hashCode() {
    return Objects.hashCode(trackNumber, discCount, trackListView, trackCount, totalTime, listTracks, queue, nextImageData);
  }

  @JsonInclude(Include.NON_NULL)
  public static class ListTrack implements Comparable<ListTrack>, BigPictureInclude {
    private final String id;
    private final int trackNumber;
    private final int discNumber;
    private final List<String> artists;
    private final String title;
    private final long length;

    public ListTrack(String id, int trackNumber, int discNumber, List<String> artists, String title, int length) {
      this.id = id;
      this.trackNumber = trackNumber;
      this.discNumber = discNumber;
      this.artists = artists;
      this.title = title;
      this.length = length;
    }

    public static ListTrack fromPlaylistItem(IPlaylistItem item) {
      if (ModelObjectType.TRACK.equals(item.getType())) {
        if (item instanceof Track) {
          Track track = (Track) item;
          return new ListTrack(track.getId(), track.getTrackNumber(), track.getDiscNumber(), BotUtils.toArtistNamesList(track), track.getName(), track.getDurationMs());
        } else if (item instanceof TrackSimplified) {
          TrackSimplified track = (TrackSimplified) item;
          return new ListTrack(track.getId(), track.getTrackNumber(), track.getDiscNumber(), BotUtils.toArtistNamesList(track), track.getName(), track.getDurationMs());
        }
      } else if (ModelObjectType.EPISODE.equals(item.getType())) {
        if (item instanceof Episode) {
          Episode episode = (Episode) item;
          return new ListTrack(episode.getId(), 0, 0, List.of(episode.getShow().getName()), episode.getName(), episode.getDurationMs());
        } else if (item instanceof EpisodeSimplified) {
          EpisodeSimplified episode = (EpisodeSimplified) item;
          return new ListTrack(episode.getId(), 0, 0, List.of(episode.getName()), episode.getName(), episode.getDurationMs());
        }
      }
      throw new IllegalArgumentException("Illegal IPlaylistItem type");
    }

    public String getId() {
      return id;
    }

    public int getTrackNumber() {
      return trackNumber;
    }

    public int getDiscNumber() {
      return discNumber;
    }

    public List<String> getArtists() {
      return artists;
    }

    public String getTitle() {
      return title;
    }

    public long getLength() {
      return length;
    }

    @Override
    public int compareTo(@NonNull ListTrack o) {
      return Comparator
          .comparing(ListTrack::getDiscNumber)
          .thenComparing(ListTrack::getTrackNumber)
          .compare(this, o);
    }

    @Override
    public boolean equals(Object o) {
      if (this == o)
        return true;
      if (!(o instanceof ListTrack))
        return false;
      ListTrack listTrack = (ListTrack) o;
      return trackNumber == listTrack.trackNumber && discNumber == listTrack.discNumber && length == listTrack.length && Objects.equal(id, listTrack.id) && Objects.equal(artists, listTrack.artists)
          && Objects.equal(title, listTrack.title);
    }

    @Override
    public int hashCode() {
      return Objects.hashCode(id, trackNumber, discNumber, artists, title, length);
    }
  }

}
