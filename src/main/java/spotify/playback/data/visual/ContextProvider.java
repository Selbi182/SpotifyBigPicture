package spotify.playback.data.visual;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import org.springframework.stereotype.Component;

import se.michaelthelin.spotify.SpotifyApi;
import se.michaelthelin.spotify.enums.AlbumType;
import se.michaelthelin.spotify.enums.CurrentlyPlayingType;
import se.michaelthelin.spotify.enums.ModelObjectType;
import se.michaelthelin.spotify.model_objects.miscellaneous.CurrentlyPlayingContext;
import se.michaelthelin.spotify.model_objects.specification.Album;
import se.michaelthelin.spotify.model_objects.specification.Artist;
import se.michaelthelin.spotify.model_objects.specification.ArtistSimplified;
import se.michaelthelin.spotify.model_objects.specification.Context;
import se.michaelthelin.spotify.model_objects.specification.Episode;
import se.michaelthelin.spotify.model_objects.specification.Image;
import se.michaelthelin.spotify.model_objects.specification.Playlist;
import se.michaelthelin.spotify.model_objects.specification.PlaylistTrack;
import se.michaelthelin.spotify.model_objects.specification.Show;
import se.michaelthelin.spotify.model_objects.specification.ShowSimplified;
import se.michaelthelin.spotify.model_objects.specification.Track;
import se.michaelthelin.spotify.model_objects.specification.TrackSimplified;
import spotify.api.SpotifyApiException;
import spotify.api.SpotifyCall;
import spotify.playback.data.dto.PlaybackInfo;
import spotify.playback.data.dto.sub.PlaybackContext;
import spotify.playback.data.dto.sub.TrackElement;
import spotify.playback.data.help.BigPictureConstants;
import spotify.playback.data.help.BigPictureUtils;
import spotify.util.SpotifyUtils;
import spotify.util.data.AlbumTrackPair;

@Component
public class ContextProvider {
  private final SpotifyApi spotifyApi;

  private String previousSpotifyContext;
  private Album currentContextAlbum;
  private List<TrackSimplified> currentContextAlbumTracks;
  private List<TrackElement> listTracks;
  private Integer currentlyPlayingAlbumTrackNumber;
  private Integer currentlyPlayingAlbumTrackDiscNumber;
  private Integer trackCount;
  private Long totalTrackDuration;
  private String thumbnailUrl;

  ContextProvider(SpotifyApi spotifyApi) {
    this.spotifyApi = spotifyApi;
    this.listTracks = new ArrayList<>();
  }

  /**
   * Get the name of the currently playing context (either a playlist name, an
   * artist, or an album).
   *
   * @param info     the context info
   * @param previous the previous info to compare to
   * @return a String of the current context, null if none was found
   */
  public PlaybackContext.Context findContextName(CurrentlyPlayingContext info, PlaybackInfo previous) {
    PlaybackContext.Context contextDto = null;
    try {
      Context context = info.getContext();
      ModelObjectType type = BigPictureUtils.getModelObjectType(info);
      if (context != null || type != null) {
        boolean force = previous == null || previous.getPlaybackContext() == null || previous.getPlaybackContext().getContext() == null;
        if (type != null) {
          switch (type) {
            case ALBUM:
              contextDto = getAlbumContext(info, force);
              break;
            case PLAYLIST:
              contextDto = getPlaylistContext(context, force);
              break;
            case ARTIST:
              contextDto = getArtistContext(context, force);
              break;
            case SHOW:
            case EPISODE:
              contextDto = getPodcastContext(info, force);
              break;
          }
        }
      } else {
        contextDto = getFallbackContext(info);
      }
    } catch (SpotifyApiException e) {
      e.printStackTrace();
    }
    if (contextDto != null) {
      return contextDto;
    } else {
      return previous != null && previous.getPlaybackContext() != null && previous.getPlaybackContext().getContext() != null
          ? previous.getPlaybackContext().getContext()
          : PlaybackContext.Context.of(info.getCurrentlyPlayingType().toString(), PlaybackContext.Context.ContextType.FALLBACK);
    }
  }

  public List<TrackElement> getListTracks() {
    return listTracks;
  }

  public Integer getCurrentlyPlayingAlbumTrackNumber() {
    return currentlyPlayingAlbumTrackNumber;
  }

  public Integer getCurrentlyPlayingAlbumTrackDiscNumber() {
    return currentlyPlayingAlbumTrackDiscNumber;
  }

  public Integer getTotalDiscCount() {
    return currentContextAlbumTracks.stream().mapToInt(TrackSimplified::getDiscNumber).max().orElse(1);
  }

  public Integer getTrackCount() {
    return trackCount;
  }

  public Long getTotalTime() {
    return totalTrackDuration;
  }

  public String getThumbnailUrl() {
    return thumbnailUrl;
  }

  private void setTrackCount(Integer trackCount) {
    this.trackCount = trackCount;
  }

  private void setTotalTrackDuration(List<TrackElement> listTracks) {
    this.totalTrackDuration = listTracks.stream().mapToLong(TrackElement::getTimeTotal).sum();
  }

  public Integer getCurrentlyPlayingPlaylistTrackNumber(CurrentlyPlayingContext context) {
    int trackIndex = -1;
    if (context.getItem() != null && context.getItem().getId() != null) {
      String id = context.getItem().getId();
      trackIndex = IntStream.range(0, listTracks.size())
        .filter(i -> id.equals(listTracks.get(i).getId()))
        .findFirst()
        .orElse(-1);
    }
    return trackIndex + 1;
  }

  private PlaybackContext.Context getArtistContext(Context context, boolean force) {
    if (force || didContextChange(context)) {
      String artistId = context.getHref().replace(BigPictureConstants.ARTIST_PREFIX, "");
      Artist contextArtist = SpotifyCall.execute(spotifyApi.getArtist(artistId));

      Image[] artistImages = contextArtist.getImages();
      String largestImage = SpotifyUtils.findLargestImage(artistImages);
      this.thumbnailUrl = largestImage != null ? largestImage : BigPictureUtils.BLANK;

      this.listTracks = List.of();

      setTrackCount(contextArtist.getFollowers().getTotal());
      setTotalTrackDuration(List.of());

      return PlaybackContext.Context.of(contextArtist.getName(), PlaybackContext.Context.ContextType.ARTIST);
    }
    return null;
  }

  private PlaybackContext.Context getPlaylistContext(Context context, boolean force) {
    if (force || didContextChange(context)) {
      String playlistId = context.getHref().replace(BigPictureConstants.PLAYLIST_PREFIX, "");
      Playlist contextPlaylist = SpotifyCall.execute(spotifyApi.getPlaylist(playlistId));

      Image[] playlistImages = contextPlaylist.getImages();
      String largestImage = SpotifyUtils.findLargestImage(playlistImages);
      this.thumbnailUrl = largestImage != null ? largestImage : BigPictureUtils.BLANK;

      // Limit to 200 for performance reasons
      PlaylistTrack[] firstHalf = contextPlaylist.getTracks().getItems();
      PlaylistTrack[] secondHalf = SpotifyCall.execute(spotifyApi.getPlaylistsItems(playlistId).offset(firstHalf.length)).getItems();
      this.listTracks = Stream.concat(Arrays.stream(firstHalf), Arrays.stream(secondHalf))
          .map(PlaylistTrack::getTrack)
          .map(TrackElement::fromPlaylistItem)
          .collect(Collectors.toList());

      Integer realTrackCount = contextPlaylist.getTracks().getTotal();
      setTrackCount(realTrackCount);
      setTotalTrackDuration(realTrackCount <= this.listTracks.size() ? this.listTracks : List.of());

      return PlaybackContext.Context.of(contextPlaylist.getName(), PlaybackContext.Context.ContextType.PLAYLIST);
    }
    return null;
  }

  private PlaybackContext.Context getAlbumContext(CurrentlyPlayingContext info, boolean force) {
    Context context = info.getContext();
    Track track = null;
    String albumId;
    if (info.getCurrentlyPlayingType().equals(CurrentlyPlayingType.TRACK)) {
      track = (Track) info.getItem();
    }
    albumId = SpotifyUtils.getIdFromUri(context.getUri());

    if (force || didContextChange(context)) {
      currentContextAlbum = SpotifyCall.execute(spotifyApi.getAlbum(albumId));
      currentContextAlbumTracks = Arrays.asList(currentContextAlbum.getTracks().getItems());

      if (currentContextAlbum.getTracks().getNext() != null) {
        List<TrackSimplified> c = SpotifyCall.executePaging(spotifyApi.getAlbumsTracks(albumId).offset(currentContextAlbumTracks.size()));
        currentContextAlbumTracks = Stream.concat(currentContextAlbumTracks.stream(), c.stream()).collect(Collectors.toList());
      }

      this.thumbnailUrl = Arrays.stream(currentContextAlbum.getArtists())
          .findFirst()
          .map(ArtistSimplified::getId)
          .map(id -> SpotifyCall.execute(spotifyApi.getArtist(id)))
          .map(Artist::getImages)
          .map(SpotifyUtils::findSmallestImage)
          .orElse(BigPictureUtils.BLANK);

      this.listTracks = currentContextAlbumTracks.stream()
          .map(trackSimplified -> TrackElement.fromTrackSimplified(trackSimplified, currentContextAlbum))
          .collect(Collectors.toList());

      setTrackCount(this.listTracks.size());
      setTotalTrackDuration(this.listTracks);
    }
    String contextString = String.format("%s \u2013 %s (%s)", SpotifyUtils.getFirstArtistName(currentContextAlbum), currentContextAlbum.getName(), SpotifyUtils.findReleaseYear(currentContextAlbum));
    if (currentContextAlbumTracks != null && track != null) {
      // Track number (unfortunately, can't simply use track numbers because of disc numbers)
      final String trackId = track.getId();
      TrackSimplified currentTrack = currentContextAlbumTracks.stream()
          .filter(t -> t.getId().equals(trackId))
          .findFirst()
          .orElse(null);

      if (currentTrack != null) {
        this.currentlyPlayingAlbumTrackNumber = currentContextAlbumTracks.indexOf(currentTrack) + 1;
        this.currentlyPlayingAlbumTrackDiscNumber = currentTrack.getDiscNumber();
        if (this.currentlyPlayingAlbumTrackNumber > 0) {
          return PlaybackContext.Context.of(contextString, getReleaseTypeContextType());
        }
      }
    }

    // Fallback when playing back from the queue
    return PlaybackContext.Context.of(contextString, PlaybackContext.Context.ContextType.QUEUE_IN_ALBUM);
  }

  private PlaybackContext.Context getPodcastContext(CurrentlyPlayingContext info, boolean force) {
    if (info.getItem() instanceof Episode) {
      Episode episode = (Episode) info.getItem();
      ShowSimplified showSimplified = episode.getShow();
      if (force || didContextChange(episode.toString())) {
        Image[] artistImages = showSimplified.getImages();
        String largestImage = SpotifyUtils.findLargestImage(artistImages);
        this.thumbnailUrl = largestImage != null ? largestImage : BigPictureUtils.BLANK;

        Show show = SpotifyCall.execute(spotifyApi.getShow(showSimplified.getId()));
        setTrackCount(show.getEpisodes().getTotal());
        setTotalTrackDuration(List.of());

        return PlaybackContext.Context.of(show.getName(), PlaybackContext.Context.ContextType.PODCAST);
      }
    }
    return null;
  }

  private PlaybackContext.Context getFallbackContext(CurrentlyPlayingContext info) {
    if (info.getItem() != null && info.getItem() instanceof Track) {
      Track track = (Track) info.getItem();
      Image[] trackImages = track.getAlbum().getImages();
      String smallestImage = SpotifyUtils.findSmallestImage(trackImages);
      this.thumbnailUrl = smallestImage != null ? smallestImage : BigPictureUtils.BLANK;

      this.listTracks = List.of(TrackElement.fromPlaylistItem(track));
      setTrackCount(this.listTracks.size());
      setTotalTrackDuration(this.listTracks);

      return PlaybackContext.Context.of(SpotifyUtils.getFirstArtistName(track) + " \u2013 " + track.getName(), PlaybackContext.Context.ContextType.SEARCH);
    }
    return PlaybackContext.Context.of("Spotify", PlaybackContext.Context.ContextType.FALLBACK);
  }

  private PlaybackContext.Context.ContextType getReleaseTypeContextType() {
    if (currentContextAlbum.getAlbumType() == AlbumType.SINGLE) {
      AlbumTrackPair atp = AlbumTrackPair.of(SpotifyUtils.asAlbumSimplified(currentContextAlbum), currentContextAlbumTracks);
      if (SpotifyUtils.isExtendedPlay(atp)) {
        return PlaybackContext.Context.ContextType.EP;
      }
    }
    return PlaybackContext.Context.ContextType.valueOf(currentContextAlbum.getAlbumType().toString());
  }

  private boolean didContextChange(Context context) {
    return didContextChange(context.toString());
  }

  private boolean didContextChange(String contextString) {
    if (!contextString.equals(previousSpotifyContext)) {
      this.previousSpotifyContext = contextString;
      return true;
    }
    return false;
  }
}
