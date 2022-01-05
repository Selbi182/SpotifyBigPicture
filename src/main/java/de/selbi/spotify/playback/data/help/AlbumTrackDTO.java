package de.selbi.spotify.playback.data.help;

import java.util.Objects;

public class AlbumTrackDTO implements Comparable<AlbumTrackDTO> {
  private final int albumTrackNumber;
  private final String title;
  private final long length;

  public AlbumTrackDTO(int albumTrackNumber, String title, int length) {
    this.albumTrackNumber = albumTrackNumber;
    this.title = title;
    this.length = length;
  }

  public int getAlbumTrackNumber() {
    return albumTrackNumber;
  }

  public String getTitle() {
    return title;
  }

  public long getLength() {
    return length;
  }

  @Override
  public int compareTo(AlbumTrackDTO o) {
    return Integer.compare(this.albumTrackNumber, o.albumTrackNumber);
  }

  @Override
  public boolean equals(Object o) {
    if (this == o)
      return true;
    if (o == null || getClass() != o.getClass())
      return false;
    AlbumTrackDTO that = (AlbumTrackDTO) o;
    return albumTrackNumber == that.albumTrackNumber && length == that.length && Objects.equals(title, that.title);
  }

  @Override
  public int hashCode() {
    return Objects.hash(albumTrackNumber, title, length);
  }
}
