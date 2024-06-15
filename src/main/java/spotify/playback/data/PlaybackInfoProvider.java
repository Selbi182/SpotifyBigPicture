package spotify.playback.data;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.logging.Logger;
import java.util.stream.Collectors;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import de.selbi.colorfetch.data.ColorFetchResult;
import se.michaelthelin.spotify.SpotifyApi;
import se.michaelthelin.spotify.enums.ModelObjectType;
import se.michaelthelin.spotify.exceptions.detailed.ForbiddenException;
import se.michaelthelin.spotify.model_objects.IPlaylistItem;
import se.michaelthelin.spotify.model_objects.miscellaneous.CurrentlyPlayingContext;
import se.michaelthelin.spotify.model_objects.special.PlaybackQueue;
import se.michaelthelin.spotify.model_objects.specification.AlbumSimplified;
import se.michaelthelin.spotify.model_objects.specification.Episode;
import se.michaelthelin.spotify.model_objects.specification.Track;
import spotify.api.SpotifyCall;
import spotify.api.events.SpotifyApiException;
import spotify.api.events.SpotifyApiLoggedInEvent;
import spotify.playback.data.dto.PlaybackInfo;
import spotify.playback.data.dto.sub.CurrentlyPlaying;
import spotify.playback.data.dto.sub.ImageData;
import spotify.playback.data.dto.sub.PlaybackContext;
import spotify.playback.data.dto.sub.TrackData;
import spotify.playback.data.dto.sub.TrackElement;
import spotify.playback.data.help.BigPictureConstants;
import spotify.playback.data.help.BigPictureUtils;
import spotify.playback.data.help.CustomVolumeSettingsProvider;
import spotify.playback.data.visual.ContextProvider;
import spotify.playback.data.visual.artwork.ArtworkUrlCache;
import spotify.playback.data.visual.color.ColorProviderService;
import spotify.spring.SpringPortConfig;
import spotify.util.SpotifyUtils;

@Component
public class PlaybackInfoProvider {
  private static final int QUEUE_FALLBACK_THRESHOLD = 200;
  private static final int QUEUE_EXPECTED_SIZE = 20;

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
  private final List<PlaybackInfo.CustomVolumeSettings> customVolumeSettings;

  private final int port;

  PlaybackInfoProvider(SpotifyApi spotifyApi,
      ContextProvider contextProvider,
      ArtworkUrlCache artworkUrlCache,
      ColorProviderService colorProvider,
      CustomVolumeSettingsProvider customVolumeSettingsProvider,
      SpringPortConfig springPortConfig) {
    this.spotifyApi = spotifyApi;
    this.contextProvider = contextProvider;
    this.artworkUrlCache = artworkUrlCache;
    this.dominantColorProvider = colorProvider;
    this.ready = false;
    this.queueEnabled = true;
    this.settingsToToggle = new HashSet<>();
    this.customVolumeSettings = customVolumeSettingsProvider.getCustomVolumeSettings();
    this.port = springPortConfig.getPort();
    refreshDeployTime();
  }

  @EventListener(SpotifyApiLoggedInEvent.class)
  public void ready() {
    logger.info("SpotifyBigPicture is ready! URL: http://localhost:" + port);

    // Test if the queue is available (i.e. if the user is a free user or not)
    try {
      SpotifyCall.execute(spotifyApi.getTheUsersQueue());
      queueEnabled = true;
    } catch (SpotifyApiException e) {
      if (ForbiddenException.class.equals(e.getNestedException().getClass())) {
        queueEnabled = false;
        logger.warning("Queue has been disabled, as this feature is unavailable for free users!");
      }
    }

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
      CurrentlyPlayingContext currentlyPlayingContext = SpotifyCall.execute(spotifyApi.getInformationAboutUsersCurrentPlayback().additionalTypes("episode"));
      if (currentlyPlayingContext != null && currentlyPlayingContext.getItem() != null) {
        PlaybackQueue playbackQueue = null;
        if (queueEnabled) {
          playbackQueue = SpotifyCall.execute(spotifyApi.getTheUsersQueue());

          if (playbackQueue == null || playbackQueue.getCurrentlyPlaying() == null) {
            // Edge case for local files
            PlaybackQueue.Builder builder = new PlaybackQueue.Builder();
            builder.setCurrentlyPlaying(currentlyPlayingContext.getItem());
            builder.setQueue(playbackQueue != null ? playbackQueue.getQueue() : List.of());
            playbackQueue = builder.build();
          } else if (currentlyPlayingContext.getItem().getId() != null && playbackQueue.getCurrentlyPlaying() != null && !Objects.equals(currentlyPlayingContext.getItem().getId(), playbackQueue.getCurrentlyPlaying().getId())) {
            // If the currently playing song in the queue doesn't match the currently playing context's song, the endpoints have gotten out of sync
            // It's a hackish solution, but the only way I can feasibly avoid this problem is to force the user to re-request until a match arrives
            return getCurrentPlaybackInfo(previousVersionId);
          } else if (previous != null && previous.getTrackData().getQueue().size() == QUEUE_EXPECTED_SIZE && playbackQueue.getQueue() != null && playbackQueue.getQueue().size() < QUEUE_EXPECTED_SIZE) {
            // For some bizarre reason, Spotify sometimes only returns a small chunk of the queue
            // If that happens, pretend that no new data arrived to avoid spamming the frontend with pointless tracklist re-renders
            List<TrackElement> previousQueue = previous.getTrackData().getQueue();
            List<IPlaylistItem> newQueue = playbackQueue.getQueue();
            boolean startsWith = true;
            for (int i = 0; i < newQueue.size(); i++) {
              if (!Objects.equals(previousQueue.get(i).getId(), newQueue.get(i).getId())) {
                startsWith = false;
                break;
              }
            }
            if (startsWith) {
              return PlaybackInfo.EMPTY;
            }
          }
        }
        if (playbackQueue == null) {
          playbackQueue = createFakePlaybackQueueWithoutQueue(currentlyPlayingContext);
        }
        if (playbackQueue.getCurrentlyPlaying() != null && currentlyPlayingContext.getItem() != null) {
          PlaybackInfo currentPlaybackInfo;
          ModelObjectType type = playbackQueue.getCurrentlyPlaying().getType();
          if (currentlyPlayingContext.getItem() != null && !Objects.equals(playbackQueue.getCurrentlyPlaying().getId(), currentlyPlayingContext.getItem().getId())) {
            type = ModelObjectType.TRACK;
          }
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
      }
    }
    return PlaybackInfo.EMPTY;
  }

  private PlaybackQueue createFakePlaybackQueueWithoutQueue(CurrentlyPlayingContext currentlyPlayingContext) {
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
    if (context.getItem() != null && !Objects.equals(currentTrack.getId(), context.getItem().getId())) {
      currentTrack = context.getItem();
    }
    if (previous != null && previous.hasPayload() && !Objects.equals(currentTrack.getId(), previous.getCurrentlyPlaying().getId())) {
      previous = null; // Force a full context refresh on song change
    }

    // Meta data
    PlaybackInfo playbackInfo = new PlaybackInfo(PlaybackInfo.Type.DATA);
    playbackInfo.setDeployTime(deployTime);
    playbackInfo.setCustomVolumeSettings(this.customVolumeSettings);

    // CurrentlyPlaying
    CurrentlyPlaying currentlyPlaying = playbackInfo.getCurrentlyPlaying();
    currentlyPlaying.setId(currentTrack.getId());
    currentlyPlaying.setTimeCurrent(context.getProgress_ms());
    currentlyPlaying.setTimeTotal(currentTrack.getDurationMs());
    currentlyPlaying.setTrackNumber(1);
    currentlyPlaying.setDiscNumber(0);

    ImageData imageData = currentlyPlaying.getImageData();
    String artworkUrl = artworkUrlCache.getSpotifyArtworkUrl(currentTrack);
    if (artworkUrl != null && !artworkUrl.isEmpty()) {
      imageData.setImageUrl(artworkUrl);
      ImageData previousImageData = Optional.ofNullable(previous)
        .map(PlaybackInfo::getCurrentlyPlaying)
        .map(CurrentlyPlaying::getImageData)
        .orElse(null);
      String spotifyArtworkUrl = artworkUrlCache.getSpotifyArtworkUrl(currentTrack);
      ColorFetchResult colors = dominantColorProvider.getDominantColorFromImageUrl(spotifyArtworkUrl, previousImageData);
      imageData.setImageColors(colors);

      String iTunesHDArtworkUrl = artworkUrlCache.findITunesHDArtworkUrl(currentTrack);
      imageData.setImageUrlHD(iTunesHDArtworkUrl);
    }

    // PlaybackContext
    PlaybackContext playbackContext = playbackInfo.getPlaybackContext();
    playbackContext.setPaused(!context.getIs_playing());
    playbackContext.setShuffle(context.getShuffle_state());
    playbackContext.setRepeat(context.getRepeat_state());
    playbackContext.setVolume(context.getDevice().getVolume_percent());
    playbackContext.setDevice(context.getDevice().getName());
    playbackContext.setThumbnailUrl(BigPictureConstants.BLANK);

    PlaybackContext.Context contextName = contextProvider.findContextName(context, previous);
    playbackContext.setContext(contextName);

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
          if (!playbackContext.getContext().getContextType().equals(PlaybackContext.Context.ContextType.QUEUE_IN_ALBUM)) {
            trackData.setTrackListView(TrackData.ListViewType.ALBUM);
          }
          currentlyPlaying.setTrackNumber(contextProvider.getCurrentlyPlayingAlbumTrackNumber());
          currentlyPlaying.setDiscNumber(contextProvider.getCurrentlyPlayingAlbumTrackDiscNumber());
          break;
        case PLAYLIST:
          // Playlist context
          Long playlistTotalTime = contextProvider.getTotalTime();
          trackData.setListTracks(playlistTotalTime != null && playlistTotalTime > 0 ? contextProvider.getListTracks() : List.of());
          trackData.setTrackNumber(contextProvider.getCurrentlyPlayingPlaylistTrackNumber(context));
          trackData.setTrackCount(contextProvider.getTrackCount());
          trackData.setCombinedTime(playlistTotalTime);
          trackData.setTrackListView(TrackData.ListViewType.PLAYLIST);
          playbackContext.getContext().setContextType(PlaybackContext.Context.ContextType.PLAYLIST);
          playbackContext.setThumbnailUrl(contextProvider.getThumbnailUrl());
          currentlyPlaying.setTrackNumber(contextProvider.getCurrentlyPlayingPlaylistTrackNumber(context));
          if (trackData.getListTracks().size() < QUEUE_FALLBACK_THRESHOLD && !playbackContext.getShuffle()) {
            trackData.setTrackListView(TrackData.ListViewType.PLAYLIST_ALBUM);
          }
          break;
        case ARTIST:
        case USER:
        // User favorite tracks or Artist top tracks context
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
        if (queue.size() == 1 && Objects.equals(currentlyPlaying.getId(), cutOffTrackElement.getId())) {
          queue = List.of();
        }
      }
    }

    // If next song in queue during an album doesn't match next song in track list, we know a song has been manually queued
    boolean inAlbumView = Objects.equals(trackData.getTrackListView(), TrackData.ListViewType.ALBUM);
    boolean inPlaylistAlbumView = Objects.equals(trackData.getTrackListView(), TrackData.ListViewType.PLAYLIST_ALBUM);
    if (!playbackContext.getShuffle() && (inAlbumView || inPlaylistAlbumView)) {
      Optional<TrackElement> nextTrackInQueue = queue.stream().findFirst();
      if (nextTrackInQueue.isPresent()) {
        int nextAlbumTrackIndex = inAlbumView ? contextProvider.getCurrentlyPlayingAlbumTrackNumber() : contextProvider.getCurrentlyPlayingPlaylistTrackNumber(context);
        if (nextAlbumTrackIndex >= contextProvider.getListTracks().size()) {
          nextAlbumTrackIndex = 0;
        }
        TrackElement nextTrackInAlbum = contextProvider.getListTracks().get(nextAlbumTrackIndex);
        if (!nextTrackInQueue.get().getId().equals(nextTrackInAlbum.getId())) {
          playbackContext.getContext().setContextType(PlaybackContext.Context.ContextType.QUEUE_IN_ALBUM);
        }
      }
    }

    trackData.setQueue(queue);

    if (playbackQueueQueue.size() > 1) {
      IPlaylistItem nextSong = playbackQueueQueue.get(0);
      ImageData nextImageData = new ImageData();
      String nextArtworkUrl = artworkUrlCache.getSpotifyArtworkUrl(nextSong);
      if (nextArtworkUrl != null && !nextArtworkUrl.isEmpty()) {
        nextImageData.setImageUrl(nextArtworkUrl);
        ImageData previousNextImageData = Optional.ofNullable(previous)
          .map(PlaybackInfo::getTrackData)
          .map(TrackData::getNextImageData)
          .orElse(null);
        ColorFetchResult colors = dominantColorProvider.getDominantColorFromImageUrl(nextArtworkUrl, previousNextImageData);
        nextImageData.setImageColors(colors);

        String iTunesHDArtworkUrl = artworkUrlCache.findITunesHDArtworkUrl(currentTrack);
        nextImageData.setImageUrlHD(iTunesHDArtworkUrl);
      }
      trackData.setNextImageData(nextImageData);
    }

    return playbackInfo;
  }

  private PlaybackInfo buildInfoTrack(PlaybackQueue playbackQueue, CurrentlyPlayingContext context) {
    PlaybackInfo pInfo = buildBaseInfo(playbackQueue, context);

    IPlaylistItem item = playbackQueue.getCurrentlyPlaying();
    if (context.getItem() != null && !Objects.equals(item.getId(), context.getItem().getId())) {
      item = context.getItem();
    }

    Track track = (Track) item;

    AlbumSimplified album = track.getAlbum();
    CurrentlyPlaying currentlyPlaying = pInfo.getCurrentlyPlaying();

    currentlyPlaying.setArtists(SpotifyUtils.toArtistNamesList(track.getArtists()));
    currentlyPlaying.setTitle(track.getName());
    currentlyPlaying.setAlbum(album.getName());
    currentlyPlaying.setReleaseDate(album.getReleaseDate() != null ? album.getReleaseDate() : BigPictureConstants.BLANK);
    currentlyPlaying.setDescription(BigPictureConstants.BLANK);

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
