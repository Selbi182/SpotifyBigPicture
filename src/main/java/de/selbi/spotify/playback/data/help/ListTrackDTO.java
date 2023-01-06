package de.selbi.spotify.playback.data.help;

import java.util.List;
import java.util.Objects;

public class ListTrackDTO implements Comparable<ListTrackDTO> {
  private final String id;
  private final int trackNumber;
  private final List<String> artists;
  private final String title;
  private final long length;

  public ListTrackDTO(String id, int trackNumber, List<String> artists, String title, int length) {
    this.id = id;
    this.trackNumber = trackNumber;
    this.artists = artists;
    this.title = title;
    this.length = length;
  }

  public String getId() {
    return id;
  }

  public int getTrackNumber() {
    return trackNumber;
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
  public int compareTo(ListTrackDTO o) {
    return Integer.compare(this.trackNumber, o.trackNumber);
  }

  @Override
  public boolean equals(Object o) {
    if (this == o)
      return true;
    if (o == null || getClass() != o.getClass())
      return false;
    ListTrackDTO that = (ListTrackDTO) o;
    return trackNumber == that.trackNumber && length == that.length && Objects.equals(id, that.id)
        && Objects.equals(artists, that.artists) && Objects.equals(title, that.title);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id, trackNumber, artists, title, length);
  }
}
