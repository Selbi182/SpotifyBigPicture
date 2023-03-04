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
    PREV
  }

  private final SpotifyApi spotifyApi;

  PlaybackControl(SpotifyApi spotifyApi) {
    this.spotifyApi = spotifyApi;
  }

  public void modifyPlaybackState(String controlName) {
    ControlOption controlOption = ControlOption.valueOf(controlName);
    CurrentlyPlayingContext context = SpotifyCall.execute(spotifyApi.getInformationAboutUsersCurrentPlayback());

    switch (controlOption) {
    case PLAY_PAUSE:
      if (context.getIs_playing()) {
        SpotifyCall.execute(spotifyApi.pauseUsersPlayback());
      } else {
        SpotifyCall.execute(spotifyApi.startResumeUsersPlayback());
      }
      break;
    case SHUFFLE:
      boolean newShuffleState = !context.getShuffle_state();
      SpotifyCall.execute(spotifyApi.toggleShuffleForUsersPlayback(newShuffleState));
      break;
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
      break;
    case NEXT:
      SpotifyCall.execute(spotifyApi.skipUsersPlaybackToNextTrack());
      break;
    case PREV:
      SpotifyCall.execute(spotifyApi.skipUsersPlaybackToPreviousTrack());
      break;
    }
  }
}
