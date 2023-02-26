package spotify.playback.data;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.logging.Logger;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import de.selbi.colorfetch.data.ColorFetchResult;
import se.michaelthelin.spotify.SpotifyApi;
import se.michaelthelin.spotify.enums.ModelObjectType;
import se.michaelthelin.spotify.exceptions.detailed.ForbiddenException;
import se.michaelthelin.spotify.model_objects.IPlaylistItem;
import se.michaelthelin.spotify.model_objects.miscellaneous.CurrentlyPlayingContext;
import se.michaelthelin.spotify.model_objects.special.PlaybackQueue;
import se.michaelthelin.spotify.model_objects.specification.Episode;
import se.michaelthelin.spotify.model_objects.specification.Track;
import spotify.api.SpotifyApiException;
import spotify.api.SpotifyCall;
import spotify.api.events.SpotifyApiLoggedInEvent;
import spotify.playback.data.dto.PlaybackInfo;
import spotify.playback.data.dto.sub.CurrentlyPlaying;
import spotify.playback.data.dto.sub.ImageData;
import spotify.playback.data.dto.sub.PlaybackContext;
import spotify.playback.data.dto.sub.TrackData;
import spotify.playback.data.dto.sub.TrackElement;
import spotify.playback.data.help.BigPictureUtils;
import spotify.playback.data.visual.ContextProvider;
import spotify.playback.data.visual.artwork.ArtworkUrlCache;
import spotify.playback.data.visual.color.ColorProviderService;
import spotify.util.SpotifyUtils;

@Component
public class PlaybackInfoProvider {
  private static final int QUEUE_FALLBACK_THRESHOLD = 200;

  private final SpotifyApi spotifyApi;
  private final ContextProvider contextProvider;
  private final ArtworkUrlCache artworkUrlCache;
  private final ColorProviderService dominantColorProvider;

  private final Logger logger = Logger.getLogger(PlaybackInfoProvider.class.getName());

  private PlaybackInfo previous;
  private long deployTime;
  private boolean ready;

  private boolean queueEnabled;

  private final Set<String> settingsToToggle;

  @Value("${server.port}")
  private String port;

  PlaybackInfoProvider(SpotifyApi spotifyApi,
      ContextProvider contextProvider,
      ArtworkUrlCache artworkUrlCache,
      ColorProviderService colorProvider) {
    this.spotifyApi = spotifyApi;
    this.contextProvider = contextProvider;
    this.artworkUrlCache = artworkUrlCache;
    this.dominantColorProvider = colorProvider;
    this.ready = false;
    this.queueEnabled = true;
    this.settingsToToggle = new HashSet<>();
    refreshDeployTime();
  }

  @EventListener(SpotifyApiLoggedInEvent.class)
  public void ready() {
    logger.info("SpotifyBigPicture is ready! URL: http://localhost:" + port);
    ready = true;
  }

  public void refreshDeployTime() {
    this.deployTime = System.currentTimeMillis();
  }

  public void addSettingToToggleForNextPoll(String settingId) {
    settingsToToggle.add(settingId);
  }

  public PlaybackInfo getCurrentPlaybackInfo(int previousVersionId) {
    if (ready) {
      try {
        CurrentlyPlayingContext currentlyPlayingContext = SpotifyCall.execute(spotifyApi.getInformationAboutUsersCurrentPlayback().additionalTypes("episode"));
        PlaybackQueue playbackQueue = null;
        if (queueEnabled) {
          try {
            playbackQueue = SpotifyCall.execute(spotifyApi.getTheUsersQueue());
            if (currentlyPlayingContext != null && playbackQueue.getCurrentlyPlaying() == null) {
              // Edge case for local files
              PlaybackQueue.Builder builder = new PlaybackQueue.Builder();
              builder.setCurrentlyPlaying(currentlyPlayingContext.getItem());
              builder.setQueue(playbackQueue.getQueue());
              playbackQueue = builder.build();
            }
          } catch (SpotifyApiException e) {
            if (e.getNestedException().getClass().equals(ForbiddenException.class)) {
              queueEnabled = false;
              logger.warning("Queue has been disabled, as this feature is unavailable for free users!");
            }
          }
        }
        if (playbackQueue == null && currentlyPlayingContext != null) {
          playbackQueue = createFakePlaybackQueueForFreeUsers(currentlyPlayingContext);
        }
        if (playbackQueue != null && playbackQueue.getCurrentlyPlaying() != null && currentlyPlayingContext != null && currentlyPlayingContext.getItem() != null) {
          PlaybackInfo currentPlaybackInfo;
          ModelObjectType type = playbackQueue.getCurrentlyPlaying().getType();
          switch (type) {
            case TRACK:
              currentPlaybackInfo = buildInfoTrack(playbackQueue, currentlyPlayingContext);
              break;
            case EPISODE:
              currentPlaybackInfo = buildInfoEpisode(playbackQueue, currentlyPlayingContext);
              break;
            default:
              throw new IllegalStateException("Unknown ModelObjectType: " + type);
          }
          try {
            if (previous == null || isSeekedSong(currentPlaybackInfo) || currentPlaybackInfo.hashCode() != previousVersionId || !settingsToToggle.isEmpty()) {
              if (!settingsToToggle.isEmpty()) {
                currentPlaybackInfo.setSettingsToToggle(List.copyOf(settingsToToggle));
                settingsToToggle.clear();
              }
              return currentPlaybackInfo;
            }
          } finally {
            this.previous = currentPlaybackInfo;
          }
        }
      } catch (SpotifyApiException e) {
        e.printStackTrace();
      }
    }
    return PlaybackInfo.EMPTY;
  }

  private PlaybackQueue createFakePlaybackQueueForFreeUsers(CurrentlyPlayingContext currentlyPlayingContext) {
    PlaybackQueue.Builder builder = new PlaybackQueue.Builder();
    builder.setCurrentlyPlaying(currentlyPlayingContext.getItem());
    builder.setQueue(List.of());
    return builder.build();
  }

  private boolean isSeekedSong(PlaybackInfo current) {
    Integer previousTimeCurrent = previous.getCurrentlyPlaying().getTimeCurrent();
    Integer timeCurrent = current.getCurrentlyPlaying().getTimeCurrent();
    if (timeCurrent != null && previousTimeCurrent != null) {
      if (BigPictureUtils.isWithinEstimatedProgressMs(previousTimeCurrent, timeCurrent)) {
        previous.getCurrentlyPlaying().setTimeCurrent(timeCurrent);
        return false;
      }
    }
    return true;
  }

  private PlaybackInfo buildBaseInfo(PlaybackQueue playbackQueue, CurrentlyPlayingContext context) {
    IPlaylistItem currentTrack = playbackQueue.getCurrentlyPlaying();

    // Meta data
    PlaybackInfo playbackInfo = new PlaybackInfo(PlaybackInfo.Type.DATA);
    playbackInfo.setDeployTime(deployTime);

    // CurrentlyPlaying
    CurrentlyPlaying currentlyPlaying = playbackInfo.getCurrentlyPlaying();
    currentlyPlaying.setId(currentTrack.getId());
    currentlyPlaying.setTimeCurrent(context.getProgress_ms());
    currentlyPlaying.setTimeTotal(currentTrack.getDurationMs());
    currentlyPlaying.setTrackNumber(1);
    currentlyPlaying.setDiscNumber(0);

    ImageData imageData = currentlyPlaying.getImageData();
    String artworkUrl = artworkUrlCache.findArtworkUrl(currentTrack);
    if (artworkUrl != null && !artworkUrl.isEmpty()) {
      imageData.setImageUrl(artworkUrl);
      ImageData previousImageData = Optional.ofNullable(previous)
        .map(PlaybackInfo::getCurrentlyPlaying)
        .map(CurrentlyPlaying::getImageData)
        .orElse(null);
      ColorFetchResult colors = dominantColorProvider.getDominantColorFromImageUrl(artworkUrl, previousImageData);
      imageData.setImageColors(colors);
    }

    // PlaybackContext
    PlaybackContext playbackContext = playbackInfo.getPlaybackContext();
    playbackContext.setPaused(!context.getIs_playing());
    playbackContext.setShuffle(context.getShuffle_state());
    playbackContext.setRepeat(context.getRepeat_state());
    playbackContext.setVolume(context.getDevice().getVolume_percent());
    playbackContext.setContext(contextProvider.findContextName(context, previous));
    playbackContext.setDevice(context.getDevice().getName());
    playbackContext.setThumbnailUrl(BigPictureUtils.BLANK);

    // TrackData
    TrackData trackData = playbackInfo.getTrackData();
    trackData.setListTracks(List.of(TrackElement.fromPlaylistItem(currentTrack)));
    trackData.setTrackNumber(1);
    trackData.setTrackCount(1);
    trackData.setCombinedTime(0L);
    trackData.setDiscNumber(1);
    trackData.setTotalDiscCount(1);
    trackData.setTrackListView(TrackData.ListViewType.QUEUE);
    ModelObjectType type = BigPictureUtils.getModelObjectType(context);
    if (type != null) {
      switch (type) {
        case ALBUM:
          // Album context
          trackData.setListTracks(contextProvider.getListTracks());
          trackData.setTrackCount(contextProvider.getTrackCount());
          trackData.setCombinedTime(contextProvider.getTotalTime());
          trackData.setTrackNumber(contextProvider.getCurrentlyPlayingAlbumTrackNumber());
          trackData.setDiscNumber(contextProvider.getCurrentlyPlayingAlbumTrackDiscNumber());
          trackData.setTotalDiscCount(contextProvider.getTotalDiscCount());
          playbackContext.setThumbnailUrl(contextProvider.getThumbnailUrl());
          if (!playbackContext.getContext().startsWith(ContextProvider.QUEUE_PREFIX)) {
            trackData.setTrackListView(TrackData.ListViewType.ALBUM);
          }
          currentlyPlaying.setTrackNumber(contextProvider.getCurrentlyPlayingAlbumTrackNumber());
          currentlyPlaying.setDiscNumber(contextProvider.getCurrentlyPlayingAlbumTrackDiscNumber());
          break;
        case PLAYLIST:
          // Playlist context
          Long playlistTotalTime = contextProvider.getTotalTime();
          trackData.setListTracks(playlistTotalTime > 0 ? contextProvider.getListTracks() : List.of());
          trackData.setTrackNumber(contextProvider.getCurrentlyPlayingPlaylistTrackNumber(context));
          trackData.setTrackCount(contextProvider.getTrackCount());
          trackData.setCombinedTime(playlistTotalTime);
          trackData.setTrackListView(TrackData.ListViewType.PLAYLIST);
          playbackContext.setThumbnailUrl(contextProvider.getThumbnailUrl());
          currentlyPlaying.setTrackNumber(contextProvider.getCurrentlyPlayingPlaylistTrackNumber(context));
          break;
        case ARTIST:
          // Artist top tracks context
          trackData.setTrackNumber(contextProvider.getCurrentlyPlayingPlaylistTrackNumber(context));
          trackData.setTrackCount(contextProvider.getTrackCount());
          trackData.setCombinedTime(contextProvider.getTotalTime());
          playbackContext.setThumbnailUrl(contextProvider.getThumbnailUrl());
          currentlyPlaying.setTrackNumber(contextProvider.getCurrentlyPlayingPlaylistTrackNumber(context));
          break;
        case SHOW:
        case EPISODE:
          // Podcast context
          trackData.setTrackListView(TrackData.ListViewType.PODCAST);
          trackData.setTrackNumber(contextProvider.getCurrentlyPlayingPlaylistTrackNumber(context));
          trackData.setTrackCount(contextProvider.getTrackCount());
          trackData.setCombinedTime(contextProvider.getTotalTime());
          playbackContext.setThumbnailUrl(contextProvider.getThumbnailUrl());
          currentlyPlaying.setTrackNumber(contextProvider.getCurrentlyPlayingPlaylistTrackNumber(context));
          break;
      }
    } else {
      // Fallback context
      trackData.setTrackListView(TrackData.ListViewType.QUEUE);
      trackData.setTrackNumber(contextProvider.getCurrentlyPlayingPlaylistTrackNumber(context));
      trackData.setTrackCount(contextProvider.getTrackCount());
      trackData.setCombinedTime(contextProvider.getTotalTime());
      playbackContext.setThumbnailUrl(contextProvider.getThumbnailUrl());
      currentlyPlaying.setTrackNumber(contextProvider.getCurrentlyPlayingPlaylistTrackNumber(context));
    }

    // Kill-switch for gigantic playlists, to save performance
    if (playbackContext.getShuffle() || (trackData.getListTracks() != null && trackData.getListTracks().size() > QUEUE_FALLBACK_THRESHOLD)) {
      trackData.setTrackListView(TrackData.ListViewType.QUEUE);
      trackData.setListTracks(List.of());
    }

    List<IPlaylistItem> playbackQueueQueue = playbackQueue.getQueue();
    List<TrackElement> queue = playbackQueueQueue.stream()
      .map(TrackElement::fromPlaylistItem)
      .collect(Collectors.toList());

    // Because Spotify returns the queue with repeated sessions in mind (even if the option is disabled), we need to clean up manually
    if (!playbackContext.getShuffle() && playbackContext.getRepeat().equals("off") && !trackData.getListTracks().isEmpty())  {
      List<TrackElement> listTracks = trackData.getListTracks();
      TrackElement lastTrackOfList = listTracks.get(listTracks.size() - 1);
      Optional<TrackElement> queueCutOffTrack = queue.stream().filter(track -> track.getId().equals(lastTrackOfList.getId())).findFirst();
      if (queueCutOffTrack.isPresent()) {
        TrackElement cutOffTrackElement = queueCutOffTrack.get();
        queue = queue.subList(0, queue.indexOf(cutOffTrackElement) + 1);
        if (queue.size() == 1 && currentlyPlaying.getId().equals(cutOffTrackElement.getId())) {
          queue = List.of();
        }
      }
    }

    trackData.setQueue(queue);

    if (playbackQueueQueue.size() > 1) {
      IPlaylistItem nextSong = playbackQueueQueue.get(0);
      ImageData nextImageData = new ImageData();
      String nextArtworkUrl = artworkUrlCache.findArtworkUrl(nextSong);
      if (nextArtworkUrl != null && !nextArtworkUrl.isEmpty()) {
        nextImageData.setImageUrl(nextArtworkUrl);
        ImageData previousNextImageData = Optional.ofNullable(previous)
          .map(PlaybackInfo::getTrackData)
          .map(TrackData::getNextImageData)
          .orElse(null);
        ColorFetchResult colors = dominantColorProvider.getDominantColorFromImageUrl(nextArtworkUrl, previousNextImageData);
        nextImageData.setImageColors(colors);
      }
      trackData.setNextImageData(nextImageData);
    }

    return playbackInfo;
  }

  private PlaybackInfo buildInfoTrack(PlaybackQueue playbackQueue, CurrentlyPlayingContext context) {
    PlaybackInfo pInfo = buildBaseInfo(playbackQueue, context);

    Track track = (Track) playbackQueue.getCurrentlyPlaying();
    CurrentlyPlaying currentlyPlaying = pInfo.getCurrentlyPlaying();

    currentlyPlaying.setArtists(SpotifyUtils.toArtistNamesList(track.getArtists()));
    currentlyPlaying.setTitle(track.getName());
    currentlyPlaying.setAlbum(track.getAlbum().getName());
    currentlyPlaying.setReleaseDate(BigPictureUtils.findReleaseYear(track));
    currentlyPlaying.setDescription(BigPictureUtils.BLANK);

    return pInfo;
  }

  private PlaybackInfo buildInfoEpisode(PlaybackQueue playbackQueue, CurrentlyPlayingContext context) {
    PlaybackInfo pInfo = buildBaseInfo(playbackQueue, context);

    Episode episode = (Episode) playbackQueue.getCurrentlyPlaying();
    CurrentlyPlaying currentlyPlaying = pInfo.getCurrentlyPlaying();

    currentlyPlaying.setArtists(List.of(episode.getShow().getName()));
    currentlyPlaying.setTitle(episode.getName());
    currentlyPlaying.setAlbum(episode.getShow().getPublisher());
    currentlyPlaying.setDescription(episode.getDescription());
    currentlyPlaying.setReleaseDate(episode.getReleaseDate());

    return pInfo;
  }
}
