package spotify.playback.data.dto.sub;

import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

import spotify.playback.data.help.BigPictureConstants;

@JsonInclude(Include.NON_NULL)
public class PlaybackContext {
  private Boolean paused;
  private Boolean shuffle;
  private String repeat;
  private Integer volume;
  private Context context;
  private String contextType;
  private String device;
  private String thumbnailUrl;

  public Boolean getPaused() {
    return paused;
  }

  public void setPaused(Boolean paused) {
    this.paused = paused;
  }

  public Boolean getShuffle() {
    return shuffle;
  }

  public void setShuffle(Boolean shuffle) {
    this.shuffle = shuffle;
  }

  public String getRepeat() {
    return repeat;
  }

  public void setRepeat(String repeat) {
    this.repeat = repeat;
  }

  public Integer getVolume() {
    return volume;
  }

  public void setVolume(Integer volume) {
    this.volume = volume;
  }

  public Context getContext() {
    return context;
  }

  public void setContext(Context context) {
    this.context = context;
  }

  public String getContextType() {
    return contextType;
  }

  public void setContextType(String contextType) {
    this.contextType = contextType;
  }

  public String getDevice() {
    return device;
  }

  public void setDevice(String device) {
    this.device = device;
  }

  public String getThumbnailUrl() {
    return thumbnailUrl;
  }

  public void setThumbnailUrl(String thumbnailUrl) {
    this.thumbnailUrl = thumbnailUrl;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o)
      return true;
    if (!(o instanceof PlaybackContext))
      return false;
    PlaybackContext that = (PlaybackContext) o;
    return Objects.equals(paused, that.paused) && Objects.equals(shuffle, that.shuffle) && Objects.equals(repeat, that.repeat) && Objects.equals(volume, that.volume) && Objects.equals(context, that.context)
        && Objects.equals(contextType, that.contextType) && Objects.equals(device, that.device) && Objects.equals(thumbnailUrl, that.thumbnailUrl);
  }

  @Override
  public int hashCode() {
    return Objects.hash(paused, shuffle, repeat, volume, context, contextType, device, thumbnailUrl);
  }

  public static class Context {
    public enum ContextType {
      ALBUM,
      EP,
      SINGLE,
      COMPILATION,
      PLAYLIST,
      ARTIST,
      PODCAST,
      SEARCH,
      QUEUE_IN_ALBUM,
      FAVORITE_TRACKS,
      FALLBACK
    }
    private String contextName;
    private ContextType contextType;
    private String contextDescription;

    private Context(String contextName, ContextType contextType, String contextDescription) {
      this.contextName = contextName;
      this.contextType = contextType;
      this.contextDescription = contextDescription;
    }

    public static Context of(String contextName, ContextType contextType) {
      return new Context(contextName, contextType, BigPictureConstants.BLANK);
    }

    public static Context of(String contextName, ContextType contextType, String contextDescription) {
      return new Context(contextName, contextType, contextDescription);
    }

    public String getContextName() {
      return contextName;
    }

    public void setContextName(String contextName) {
      this.contextName = contextName;
    }

    public ContextType getContextType() {
      return contextType;
    }

    public void setContextType(ContextType contextType) {
      this.contextType = contextType;
    }

    public String getContextDescription() {
      return contextDescription;
    }

    public void setContextDescription(String contextDescription) {
      this.contextDescription = contextDescription;
    }

    @Override
    public boolean equals(Object o) {
      if (this == o)
        return true;
      if (!(o instanceof Context))
        return false;
      Context context = (Context) o;
      return Objects.equals(contextName, context.contextName) && contextType == context.contextType && Objects.equals(contextDescription, context.contextDescription);
    }

    @Override
    public int hashCode() {
      return Objects.hash(contextName, contextDescription, contextType);
    }
  }
}
