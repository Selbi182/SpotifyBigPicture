package spotify.playback.data.help;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;

import org.springframework.lang.NonNull;

import se.michaelthelin.spotify.model_objects.specification.Track;
import se.michaelthelin.spotify.model_objects.specification.TrackSimplified;
import spotify.util.BotUtils;

public class ListTrackDTO implements Comparable<ListTrackDTO> {
  private final String id;
  private final int trackNumber;
  private final int discNumber;
  private final List<String> artists;
  private final String title;
  private final long length;

  public ListTrackDTO(String id, int trackNumber, int discNumber, List<String> artists, String title, int length) {
    this.id = id;
    this.trackNumber = trackNumber;
    this.discNumber = discNumber;
    this.artists = artists;
    this.title = title;
    this.length = length;
  }

  public static ListTrackDTO fromTrack(Track track) {
    return new ListTrackDTO(track.getId(), track.getTrackNumber(), track.getDiscNumber(), BotUtils.toArtistNamesList(track), track.getName(), track.getDurationMs());
  }
  public static ListTrackDTO fromTrack(TrackSimplified track) {
    return new ListTrackDTO(track.getId(), track.getTrackNumber(), track.getDiscNumber(), BotUtils.toArtistNamesList(track), track.getName(), track.getDurationMs());
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
  public int compareTo(@NonNull ListTrackDTO o) {
    return Comparator
        .comparing(ListTrackDTO::getDiscNumber)
        .thenComparing(ListTrackDTO::getTrackNumber)
        .compare(this, o);
  }

  @Override
  public boolean equals(Object o) {
    if (this == o)
      return true;
    if (o == null || getClass() != o.getClass())
      return false;
    ListTrackDTO that = (ListTrackDTO) o;
    return length == that.length && Objects.equals(id, that.id) && Objects.equals(trackNumber, that.trackNumber)
        && Objects.equals(artists, that.artists) && Objects.equals(title, that.title);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id, trackNumber, artists, title, length);
  }
}
