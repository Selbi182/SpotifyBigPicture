package spotify.playback.control;

import org.springframework.stereotype.Component;

import se.michaelthelin.spotify.SpotifyApi;
import se.michaelthelin.spotify.model_objects.miscellaneous.CurrentlyPlayingContext;
import spotify.api.SpotifyCall;

@Component
public class PlaybackControl {
  private enum ControlOption {
    PLAY_PAUSE,
    SHUFFLE,
    REPEAT,
    NEXT,
    PREV,
    VOLUME
  }

  private final SpotifyApi spotifyApi;

  PlaybackControl(SpotifyApi spotifyApi) {
    this.spotifyApi = spotifyApi;
  }

  /**
   * Modify the playback state of the player with the given control name.
   *
   * @param controlName the control name
   * @param optionalParam an optional parameter containing extra information required for some controls
   * @return true on success, false on error
   */
  public boolean modifyPlaybackState(String controlName, String optionalParam) {
    try {
      ControlOption controlOption = ControlOption.valueOf(controlName);
      CurrentlyPlayingContext context = SpotifyCall.execute(spotifyApi.getInformationAboutUsersCurrentPlayback());

      switch (controlOption) {
        case PLAY_PAUSE:
          if (context.getIs_playing()) {
            SpotifyCall.execute(spotifyApi.pauseUsersPlayback());
          } else {
            SpotifyCall.execute(spotifyApi.startResumeUsersPlayback());
          }
          return true;
        case SHUFFLE:
          boolean newShuffleState = !context.getShuffle_state();
          SpotifyCall.execute(spotifyApi.toggleShuffleForUsersPlayback(newShuffleState));
          return true;
        case REPEAT:
          String repeatState = context.getRepeat_state();
          if ("off".equals(repeatState)) {
            repeatState = "context";
          } else if ("context".equals(repeatState)) {
            repeatState = "track";
          } else if ("track".equals(repeatState)) {
            repeatState = "off";
          }
          SpotifyCall.execute(spotifyApi.setRepeatModeOnUsersPlayback(repeatState));
          return true;
        case NEXT:
          SpotifyCall.execute(spotifyApi.skipUsersPlaybackToNextTrack());
          return true;
        case PREV:
          SpotifyCall.execute(spotifyApi.skipUsersPlaybackToPreviousTrack());
          return true;
        case VOLUME:
          SpotifyCall.execute(spotifyApi.setVolumeForUsersPlayback(Integer.parseInt(optionalParam)));
          return true;
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
    return false;
  }
}
