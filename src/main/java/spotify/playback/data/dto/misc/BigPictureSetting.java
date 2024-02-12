package spotify.playback.data.dto.misc;

public class BigPictureSetting {
  private String id;
  private String name;
  private String category;
  private String subcategoryHeader;
  private String description;
  private Boolean state;

  public BigPictureSetting() {
  }

  public BigPictureSetting(String id, String name, String category, String subcategoryHeader, String description, Boolean state) {
    this.id = id;
    this.name = name;
    this.category = category;
    this.subcategoryHeader = subcategoryHeader;
    this.description = description;
    this.state = state;
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

  public String getCategory() {
    return category;
  }

  public void setCategory(String category) {
    this.category = category;
  }

  public String getSubcategoryHeader() {
    return subcategoryHeader;
  }

  public void setSubcategoryHeader(String subcategoryHeader) {
    this.subcategoryHeader = subcategoryHeader;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public Boolean getState() {
    return state;
  }

  public void setState(Boolean state) {
    this.state = state;
  }
}
