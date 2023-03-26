package spotify.playback.data.help;

public class BigPictureConstants {
  private BigPictureConstants() {}

  /**
   * Used in cases where the interface should explicitly hide a field due to the absence of data.
   * This is needed because null fields are removed during a web transfer.
   */
  public static final String BLANK = "BLANK";

  /**
   * The allowed tolerance for the estimated current progress, in reference to polling rate from
   * the interface (which is 2 seconds). If it's beyond that scope, it's safe to assume that the
   * user has manually seeked within the song.
   */
  public static final long ESTIMATED_PROGRESS_TOLERANCE_MS = 3 * 1000;

  /**
   * Prefix for playlist URLs.
   */
  public static final String PLAYLIST_PREFIX = "https://api.spotify.com/v1/playlists/";

  /**
   * Prefix for artist URLs.
   */
  public static final String ARTIST_PREFIX = "https://api.spotify.com/v1/artists/";

  /**
   * URL for the user's favorite tracks.
   */
  public static final String FAVORITE_SONGS_HREF = "https://api.spotify.com/v1/me/tracks";
}
