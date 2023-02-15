package spotify.playback.data.dto.misc;

public class BigPictureSetting {
  private String id;
  private String name;
  private String hotkey;
  private String description;

  public BigPictureSetting() {
  }

  public BigPictureSetting(String id, String name, String hotkey, String description) {
    this.id = id;
    this.name = name;
    this.hotkey = hotkey;
    this.description = description;
  }

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getHotkey() {
    return hotkey;
  }

  public void setHotkey(String hotkey) {
    this.hotkey = hotkey;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }
}
