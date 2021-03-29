package spotify.playback.data;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

import spotify.playback.data.special.color.DominantRGBs;

/**
 * Wrapper class for the playback info to be sent via SSEEmitter to the
 * frontend. Any field can be null to indicate no change.
 */
@JsonInclude(Include.NON_NULL)
public class PlaybackInfoDTO {
	public static final PlaybackInfoDTO EMPTY = new PlaybackInfoDTO(Type.EMTPY);
	public static final PlaybackInfoDTO HEARTBEAT = new PlaybackInfoDTO(Type.HEARTBEAT);

	enum Type {
		EMTPY,
		HEARTBEAT,
		DATA
	}

	private Type type;
	private Boolean paused;
	private Boolean shuffle;
	private String repeat;
	private String device;
	private String context;
	private List<String> artists;
	private String title;
	private String album;
	private String release;
	private String image;
	private DominantRGBs imageColors;
	private Integer timeCurrent;
	private Integer timeTotal;

	protected PlaybackInfoDTO() {
	}

	protected PlaybackInfoDTO(Type type) {
		this.type = type;
	}

	@JsonIgnore
	public boolean isEmpty() {
		return getType().equals(Type.EMTPY);
	}

	public Type getType() {
		return type;
	}

	public void setType(Type type) {
		this.type = type;
	}

	public Boolean isPaused() {
		return paused;
	}

	public void setPaused(Boolean paused) {
		this.paused = paused;
	}

	public Boolean isShuffle() {
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

	public String getDevice() {
		return device;
	}

	public void setDevice(String device) {
		this.device = device;
	}

	public String getContext() {
		return context;
	}

	public void setContext(String context) {
		this.context = context;
	}

	public List<String> getArtists() {
		return artists;
	}

	public void setArtists(List<String> artists) {
		this.artists = artists;
	}

	public String getTitle() {
		return title;
	}

	public void setTitle(String title) {
		this.title = title;
	}

	public String getAlbum() {
		return album;
	}

	public void setAlbum(String album) {
		this.album = album;
	}

	public String getRelease() {
		return release;
	}

	public void setRelease(String release) {
		this.release = release;
	}

	public String getImage() {
		return image;
	}

	public void setImage(String image) {
		this.image = image;
	}

	public DominantRGBs getImageColors() {
		return imageColors;
	}

	public void setImageColors(DominantRGBs imageColors) {
		this.imageColors = imageColors;
	}

	public Integer getTimeCurrent() {
		return timeCurrent;
	}

	public void setTimeCurrent(Integer timeCurrent) {
		this.timeCurrent = timeCurrent;
	}

	public Integer getTimeTotal() {
		return timeTotal;
	}

	public void setTimeTotal(Integer timeTotal) {
		this.timeTotal = timeTotal;
	}
}
