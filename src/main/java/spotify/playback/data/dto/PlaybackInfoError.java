package spotify.playback.data.dto;

public class PlaybackInfoError implements PlaybackInfoResponse {
  private final String errorMessage;

  public PlaybackInfoError(Exception exception) {
    this.errorMessage = exception.getLocalizedMessage();
  }

  public String getErrorMessage() {
    return errorMessage;
  }
}
