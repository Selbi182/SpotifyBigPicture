package spotify.playback.data.visual;

import java.net.MalformedURLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
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
import se.michaelthelin.spotify.model_objects.specification.Paging;
import se.michaelthelin.spotify.model_objects.specification.Playlist;
import se.michaelthelin.spotify.model_objects.specification.PlaylistTrack;
import se.michaelthelin.spotify.model_objects.specification.SavedTrack;
import se.michaelthelin.spotify.model_objects.specification.Show;
import se.michaelthelin.spotify.model_objects.specification.ShowSimplified;
import se.michaelthelin.spotify.model_objects.specification.Track;
import se.michaelthelin.spotify.model_objects.specification.TrackSimplified;
import se.michaelthelin.spotify.model_objects.specification.User;
import spotify.api.SpotifyCall;
import spotify.api.events.SpotifyApiException;
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

  private ModelObjectType previousType;
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
        boolean force = previous == null || previous.getPlaybackContext() == null || previous.getPlaybackContext().getContext() == null || !Objects.equals(type, previousType);
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
            case USER:
              contextDto = getUserFavoriteTracksContext(context, force);
              break;
          }
        }
      } else {
        contextDto = getFallbackContext(info);
      }
      previousType = type;
    } catch (SpotifyApiException | MalformedURLException e) {
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

  private void calculateAndSetTotalTrackDuration(List<TrackElement> listTracks) {
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
      if (trackIndex < 0 && context.getItem() != null && context.getItem() instanceof Episode) {
        Episode episode = (Episode) context.getItem();
        trackIndex = IntStream.range(0, listTracks.size())
          .filter(i -> listTracks.get(i).getTitle().contains(episode.getName()))
          .findFirst()
          .orElse(-1);
      }
    }
    return trackIndex + 1;
  }

  private PlaybackContext.Context getArtistContext(Context context, boolean force) {
    if (force || didContextChange(context)) {
      String artistId = context.getHref().replace(BigPictureConstants.ARTIST_PREFIX, "");
      Artist contextArtist = SpotifyCall.execute(spotifyApi.getArtist(artistId));

      Image[] artistImages = contextArtist.getImages();
      String largestImage = SpotifyUtils.findLargestImage(artistImages);
      this.thumbnailUrl = largestImage != null ? largestImage : BigPictureConstants.BLANK;

      this.listTracks = List.of();

      setTrackCount(contextArtist.getFollowers().getTotal());
      calculateAndSetTotalTrackDuration(List.of());

      return PlaybackContext.Context.of(contextArtist.getName(), PlaybackContext.Context.ContextType.ARTIST);
    }
    return null;
  }

  private PlaybackContext.Context getPlaylistContext(Context context, boolean force) throws MalformedURLException {
    if (force || didContextChange(context)) {
      String playlistId = SpotifyUtils.getIdFromSpotifyUrl(context.getHref());
      Playlist contextPlaylist = SpotifyCall.execute(spotifyApi.getPlaylist(playlistId));

      Image[] playlistImages = contextPlaylist.getImages();
      String largestImage = SpotifyUtils.findLargestImage(playlistImages);
      this.thumbnailUrl = largestImage != null ? largestImage : BigPictureConstants.BLANK;

      // Limit to 200 for performance reasons
      Paging<PlaylistTrack> contextTracks = contextPlaylist.getTracks();
      List<PlaylistTrack> playlistTracks = new ArrayList<>(Arrays.asList(contextTracks.getItems()));
      if (contextTracks.getNext() != null) {
        PlaylistTrack[] secondHalf = SpotifyCall.execute(spotifyApi.getPlaylistsItems(playlistId).offset(playlistTracks.size())).getItems();
        playlistTracks.addAll(Arrays.asList(secondHalf));

      }
      this.listTracks = playlistTracks.stream()
        .map(PlaylistTrack::getTrack)
        .map(TrackElement::fromPlaylistItem)
        .collect(Collectors.toList());
      for (int i = 1; i <= listTracks.size(); i++) {
        this.listTracks.get(i - 1).setTrackNumber(i);
      }

      Integer realTrackCount = contextPlaylist.getTracks().getTotal();
      setTrackCount(realTrackCount);
      calculateAndSetTotalTrackDuration(realTrackCount <= this.listTracks.size() ? this.listTracks : List.of());

      return PlaybackContext.Context.of(contextPlaylist.getName(), PlaybackContext.Context.ContextType.PLAYLIST, contextPlaylist.getDescription());
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
        .orElse(BigPictureConstants.BLANK);

      this.listTracks = currentContextAlbumTracks.stream()
        .map(trackSimplified -> TrackElement.fromTrackSimplified(trackSimplified, currentContextAlbum))
        .collect(Collectors.toList());

      setTrackCount(this.listTracks.size());
      calculateAndSetTotalTrackDuration(this.listTracks);
    }
    String contextString = String.format("%s \u2022 %s", SpotifyUtils.getFirstArtistName(currentContextAlbum), currentContextAlbum.getName());
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
        this.thumbnailUrl = largestImage != null ? largestImage : BigPictureConstants.BLANK;

        Show show = SpotifyCall.execute(spotifyApi.getShow(showSimplified.getId()));
        setTrackCount(show.getEpisodes().getTotal());
        calculateAndSetTotalTrackDuration(List.of());

        return PlaybackContext.Context.of(show.getName(), PlaybackContext.Context.ContextType.PODCAST, episode.getShow().getDescription());
      }
    }
    return null;
  }

  private PlaybackContext.Context getUserFavoriteTracksContext(Context context, boolean force) {
    if (force || didContextChange(context)) {
      Paging<SavedTrack> usersSavedTracks = SpotifyCall.execute(spotifyApi.getUsersSavedTracks());

      User user = SpotifyCall.execute(spotifyApi.getCurrentUsersProfile());

      Image[] artistImages = user.getImages();
      String largestImage = SpotifyUtils.findLargestImage(artistImages);
      this.thumbnailUrl = largestImage != null ? largestImage : BigPictureConstants.BLANK;

      this.listTracks = List.of();

      setTrackCount(usersSavedTracks.getTotal());
      calculateAndSetTotalTrackDuration(List.of());

      return PlaybackContext.Context.of(user.getDisplayName(), PlaybackContext.Context.ContextType.FAVORITE_TRACKS);
    }
    return null;
  }

  private PlaybackContext.Context getFallbackContext(CurrentlyPlayingContext info) {
    if (info.getItem() != null && info.getItem() instanceof Track) {
      Track track = (Track) info.getItem();
      Image[] trackImages = track.getAlbum().getImages();
      String smallestImage = SpotifyUtils.findSmallestImage(trackImages);
      this.thumbnailUrl = smallestImage != null ? smallestImage : BigPictureConstants.BLANK;

      this.listTracks = List.of(TrackElement.fromPlaylistItem(track));
      setTrackCount(this.listTracks.size());
      calculateAndSetTotalTrackDuration(this.listTracks);

      return PlaybackContext.Context.of(SpotifyUtils.getFirstArtistName(track) + " \u2022 " + track.getName(), PlaybackContext.Context.ContextType.SEARCH);
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
