package spotify.playback.data;

import java.beans.PropertyDescriptor;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.stereotype.Component;

import de.selbi.colorfetch.data.ColorFetchResult;
import se.michaelthelin.spotify.SpotifyApi;
import se.michaelthelin.spotify.enums.CurrentlyPlayingType;
import se.michaelthelin.spotify.enums.ModelObjectType;
import se.michaelthelin.spotify.model_objects.IPlaylistItem;
import se.michaelthelin.spotify.model_objects.miscellaneous.CurrentlyPlayingContext;
import se.michaelthelin.spotify.model_objects.specification.Episode;
import se.michaelthelin.spotify.model_objects.specification.Track;
import spotify.api.BotException;
import spotify.api.SpotifyCall;
import spotify.playback.data.help.PlaybackInfoUtils;
import spotify.playback.data.visual.ContextProvider;
import spotify.playback.data.visual.artwork.ArtworkUrlProvider;
import spotify.playback.data.visual.color.ColorProviderSetup;
import spotify.util.BotUtils;

@Component
public class PlaybackInfoProvider {

  private static final String BLANK = "BLANK";
  private static final int QUEUE_FALLBACK_THRESHOLD = 100;

  private final SpotifyApi spotifyApi;
  private final ContextProvider contextProvider;
  private final ArtworkUrlProvider artworkUrlProvider;
  private final ColorProviderSetup dominantColorProvider;

  private PlaybackInfoDTO previous;
  private long deployTime;

  private static final List<Field> DTO_FIELDS;

  static {
    DTO_FIELDS = Stream.of(PlaybackInfoDTO.class.getDeclaredFields())
        .filter(f -> !Modifier.isFinal(f.getModifiers()))
        .filter(f -> !f.getType().equals(PlaybackInfoDTO.Type.class))
        .sorted(Comparator.comparing(Field::getName))
        .collect(Collectors.toList());
  }

  PlaybackInfoProvider(SpotifyApi spotifyApi,
      ContextProvider contextProvider,
      ArtworkUrlProvider artworkUrlProvider,
      ColorProviderSetup colorProvider) {
    this.spotifyApi = spotifyApi;
    this.contextProvider = contextProvider;
    this.artworkUrlProvider = artworkUrlProvider;
    this.dominantColorProvider = colorProvider;
    refreshDeployTime();
  }

  public void refreshDeployTime() {
    this.deployTime = System.currentTimeMillis();
  }

  public PlaybackInfoDTO getCurrentPlaybackInfo(boolean full) {
    if (previous == null) {
      full = true;
    }
    try {
      CurrentlyPlayingContext info = SpotifyCall.execute(spotifyApi.getInformationAboutUsersCurrentPlayback().additionalTypes("episode"));
      if (info != null) {
        PlaybackInfoDTO currentPlaybackInfo = null;
        CurrentlyPlayingType type = info.getCurrentlyPlayingType();
        if (type.equals(CurrentlyPlayingType.TRACK)) {
          currentPlaybackInfo = buildInfoTrack(info);
        } else if (type.equals(CurrentlyPlayingType.EPISODE)) {
          currentPlaybackInfo = buildInfoEpisode(info);
        }
        if (full) {
          this.previous = currentPlaybackInfo;
          return currentPlaybackInfo;
        } else if (currentPlaybackInfo != null) {
          try {
            return findInfoDifferencesAndUpdateCurrent(currentPlaybackInfo);
          } catch (Exception e) {
            throw new BotException(e);
          }
        }
      }
    } catch (BotException e) {
      e.printStackTrace();
    }
    return PlaybackInfoDTO.EMPTY;
  }

  private void checkDifferences(PlaybackInfoDTO differences, PlaybackInfoDTO previous, PlaybackInfoDTO current, String field)
      throws Exception {
    PropertyDescriptor propertyDescriptor = new PropertyDescriptor(field, PlaybackInfoDTO.class);
    Object previousObject = propertyDescriptor.getReadMethod().invoke(previous);
    Object currentObject = propertyDescriptor.getReadMethod().invoke(current);
    if (!Objects.equals(previousObject, currentObject)) {
      differences.setType(PlaybackInfoDTO.Type.DATA);
      propertyDescriptor.getWriteMethod().invoke(differences, currentObject);
      propertyDescriptor.getWriteMethod().invoke(this.previous, currentObject);
    }
  }

  private PlaybackInfoDTO findInfoDifferencesAndUpdateCurrent(PlaybackInfoDTO current) throws Exception {
    PlaybackInfoDTO diff = new PlaybackInfoDTO(PlaybackInfoDTO.Type.EMPTY);
    for (Field field : DTO_FIELDS) {
      String fieldName = field.getName();
      if (fieldName.equals("timeCurrent")) {
        // Estimated progress always needs to get updated, so it's handled separately
        if (diff.isPaused() != null || !previous.getTimeTotal().equals(current.getTimeTotal())
            || !PlaybackInfoUtils.isWithinEstimatedProgressMs(previous, current)) {
          diff.setType(PlaybackInfoDTO.Type.DATA);
          diff.setTimeCurrent(current.getTimeCurrent());
        }
        this.previous.setTimeCurrent(current.getTimeCurrent());
      } else {
        checkDifferences(diff, previous, current, fieldName);
      }
    }

    return diff;
  }

  private PlaybackInfoDTO buildBaseInfo(CurrentlyPlayingContext info) {
    IPlaylistItem playlistItem = info.getItem();
    PlaybackInfoDTO pInfo = new PlaybackInfoDTO(PlaybackInfoDTO.Type.DATA);

    pInfo.setId(playlistItem.getId());

    pInfo.setPaused(!info.getIs_playing());
    pInfo.setShuffle(info.getShuffle_state());
    pInfo.setRepeat(info.getRepeat_state());
    pInfo.setVolume(info.getDevice().getVolume_percent());

    pInfo.setContext(contextProvider.findContextName(info, previous));
    pInfo.setDevice(info.getDevice().getName());

    if (info.getContext() != null && ModelObjectType.ALBUM.equals(info.getContext().getType())) {
      // Album context
      pInfo.setListTracks(contextProvider.getFormattedAlbumTracks());
      pInfo.setTrackNumber(contextProvider.getCurrentlyPlayingAlbumTrackNumber());
      pInfo.setTrackListView(PlaybackInfoDTO.ListViewType.ALBUM);
      if (pInfo.getContext().startsWith(ContextProvider.QUEUE_PREFIX)) {
        pInfo.setTrackListView(PlaybackInfoDTO.ListViewType.QUEUE);
      }
    } else if (info.getContext() != null && ModelObjectType.PLAYLIST.equals(info.getContext().getType())) {
      // Playlist context
      pInfo.setListTracks(contextProvider.getFormattedPlaylistTracks());
      pInfo.setTrackNumber(contextProvider.getCurrentlyPlayingPlaylistTrackNumber(info));
      pInfo.setTrackListView(PlaybackInfoDTO.ListViewType.PLAYLIST);
    } else if (info.getContext() != null && ModelObjectType.ARTIST.equals(info.getContext().getType())) {
      // Artist top tracks context
      pInfo.setListTracks(contextProvider.getFormattedPlaylistTracks());
      pInfo.setTrackNumber(contextProvider.getCurrentlyPlayingPlaylistTrackNumber(info));
      pInfo.setTrackListView(PlaybackInfoDTO.ListViewType.QUEUE);
    } else {
      // Fallback context
      pInfo.setTrackListView(PlaybackInfoDTO.ListViewType.QUEUE);
    }

    if (pInfo.isShuffle() || (pInfo.getListTracks() != null && pInfo.getListTracks().size() > QUEUE_FALLBACK_THRESHOLD)) {
      pInfo.setTrackListView(PlaybackInfoDTO.ListViewType.QUEUE);
    }

    if (pInfo.getTrackListView().equals(PlaybackInfoDTO.ListViewType.QUEUE)) {
      pInfo.setQueue(contextProvider.getQueue());
    }

    pInfo.setTimeCurrent(info.getProgress_ms());
    pInfo.setTimeTotal(playlistItem.getDurationMs());

    String artworkUrl = artworkUrlProvider.findArtworkUrl(playlistItem);
    if (artworkUrl != null && !artworkUrl.isEmpty()) {
      pInfo.setImage(artworkUrl);
      ColorFetchResult colors = dominantColorProvider.getDominantColorFromImageUrl(artworkUrl);
      pInfo.setImageColors(colors);
    } else {
      pInfo.setImage(BLANK);
      pInfo.setImageColors(ColorFetchResult.FALLBACK);
    }

    pInfo.setDeployTime(deployTime);

    return pInfo;
  }

  private PlaybackInfoDTO buildInfoTrack(CurrentlyPlayingContext info) {
    PlaybackInfoDTO pInfo = buildBaseInfo(info);

    Track track = (Track) info.getItem();
    pInfo.setArtists(BotUtils.toArtistNamesList(track.getArtists()));
    pInfo.setTitle(track.getName());
    pInfo.setAlbum(track.getAlbum().getName());
    pInfo.setRelease(PlaybackInfoUtils.findReleaseYear(track));
    pInfo.setDescription(BLANK);

    return pInfo;
  }

  private PlaybackInfoDTO buildInfoEpisode(CurrentlyPlayingContext info) {
    PlaybackInfoDTO pInfo = buildBaseInfo(info);

    Episode episode = (Episode) info.getItem();
    pInfo.setArtists(List.of(episode.getShow().getName()));
    pInfo.setTitle(episode.getName());
    pInfo.setAlbum(episode.getShow().getPublisher());
    pInfo.setDescription(episode.getDescription());
    pInfo.setRelease(episode.getReleaseDate());

    return pInfo;
  }
}
