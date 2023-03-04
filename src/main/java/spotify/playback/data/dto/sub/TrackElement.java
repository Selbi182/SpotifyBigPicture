package spotify.playback.data.dto.sub;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;

import org.springframework.lang.NonNull;

import com.fasterxml.jackson.annotation.JsonInclude;

import se.michaelthelin.spotify.enums.ModelObjectType;
import se.michaelthelin.spotify.model_objects.IPlaylistItem;
import se.michaelthelin.spotify.model_objects.specification.Album;
import se.michaelthelin.spotify.model_objects.specification.Episode;
import se.michaelthelin.spotify.model_objects.specification.Track;
import se.michaelthelin.spotify.model_objects.specification.TrackSimplified;
import spotify.util.SpotifyUtils;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class TrackElement implements Comparable<TrackElement> {
  private String id;
  private List<String> artists;
  private String title;
  private String album;
  private String releaseDate;
  private String description;
  private Integer timeTotal;
  private Integer trackNumber;
  private Integer discNumber;

  public TrackElement() {
  }

  public TrackElement(String id, int trackNumber, int discNumber, List<String> artists, String title, String album, String releaseDate, String description, int timeTotal) {
    this.id = id;
    this.trackNumber = trackNumber;
    this.discNumber = discNumber;
    this.artists = artists;
    this.title = title;
    this.album = album;
    this.releaseDate = releaseDate;
    this.description = description;
    this.timeTotal = timeTotal;
  }

  public static TrackElement fromTrackSimplified(TrackSimplified track, Album album) {
    return new TrackElement(track.getId(), track.getTrackNumber(), track.getDiscNumber(), SpotifyUtils.toArtistNamesList(track), track.getName(), album.getName(), album.getReleaseDate(), "", track.getDurationMs());
  }

  public static TrackElement fromPlaylistItem(IPlaylistItem item) {
    if (ModelObjectType.TRACK.equals(item.getType())) {
      if (item instanceof Track) {
        Track track = (Track) item;
        return new TrackElement(track.getId(), track.getTrackNumber(), track.getDiscNumber(), SpotifyUtils.toArtistNamesList(track), track.getName(), track.getAlbum().getName(), track.getAlbum().getReleaseDate(), "", track.getDurationMs());
      }
    } else if (ModelObjectType.EPISODE.equals(item.getType())) {
      if (item instanceof Episode) {
        Episode episode = (Episode) item;
        if (episode.getShow() != null) {
          return new TrackElement(episode.getId(), 0, 0, List.of(episode.getShow().getName()), episode.getName(), episode.getShow().getName(), episode.getReleaseDate(), episode.getDescription(), episode.getDurationMs());
        } else {
          return new TrackElement(episode.getId(), 0, 0, List.of("PODCAST"), episode.getName(), "", "", "", episode.getDurationMs());
        }
      }
    }
    throw new IllegalArgumentException("Illegal IPlaylistItem type");
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

  public String getReleaseDate() {
    return releaseDate;
  }

  public void setReleaseDate(String releaseDate) {
    this.releaseDate = releaseDate;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public Integer getTimeTotal() {
    return timeTotal;
  }

  public void setTimeTotal(Integer timeTotal) {
    this.timeTotal = timeTotal;
  }

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

  @Override
  public int compareTo(@NonNull TrackElement o) {
    return Comparator
        .comparing(TrackElement::getDiscNumber)
        .thenComparing(TrackElement::getTrackNumber)
        .compare(this, o);
  }

  @Override
  public boolean equals(Object o) {
    if (this == o)
      return true;
    if (!(o instanceof TrackElement))
      return false;
    TrackElement that = (TrackElement) o;
    return Objects.equals(id, that.id) && Objects.equals(artists, that.artists) && Objects.equals(title, that.title) && Objects.equals(album, that.album) && Objects.equals(releaseDate, that.releaseDate)
        && Objects.equals(description, that.description) && Objects.equals(timeTotal, that.timeTotal) && Objects.equals(trackNumber, that.trackNumber) && Objects.equals(discNumber, that.discNumber);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id, artists, title, album, releaseDate, description, timeTotal, trackNumber, discNumber);
  }
}