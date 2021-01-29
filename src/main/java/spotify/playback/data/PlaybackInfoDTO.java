package spotify.playback.data;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

/**
 * Wrapper class for the playback info to be sent via SSEEmitter to the
 * frontend. Any field can be null to indicate no change.
 */
@JsonInclude(Include.NON_NULL)
public class PlaybackInfoDTO {
	public static final PlaybackInfoDTO EMPTY = new PlaybackInfoDTO(Type.EMTPY);
	public static final PlaybackInfoDTO HEARTBEAT = new PlaybackInfoDTO(Type.HEARTBEAT);
	public static final PlaybackInfoDTO IDLE = new PlaybackInfoDTO(Type.IDLE);
	
	enum Type {
		EMTPY,
		HEARTBEAT,
		IDLE,
		DATA
	}

	private Type type;
	private Boolean paused;
	private Boolean shuffle;
	private String repeat;
	private String device;
	private Integer volume;
	private String playlist;
	private String artist;
	private String title;
	private String album;
	private String release;
	private String image;
	private Integer timeCurrent;
	private Integer timeTotal;

	protected PlaybackInfoDTO() {
	}
	
	protected PlaybackInfoDTO(Type type) {
		this.type = type;
	}

	private PlaybackInfoDTO(Builder builder) {
		this.type = Type.DATA;
		this.paused = builder.paused;
		this.shuffle = builder.shuffle;
		this.repeat = builder.repeat;
		this.device = builder.device;
		this.volume = builder.volume;
		this.playlist = builder.playlist;
		this.artist = builder.artist;
		this.title = builder.title;
		this.album = builder.album;
		this.release = builder.release;
		this.image = builder.image;
		this.timeCurrent = builder.timeCurrent;
		this.timeTotal = builder.timeTotal;
	}

	public static PlaybackInfoDTO.Builder builder() {
		return new Builder();
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

	public Integer getVolume() {
		return volume;
	}
	
	public void setVolume(Integer volume) {
		this.volume = volume;
	}
	
	public String getPlaylist() {
		return playlist;
	}

	public void setPlaylist(String playlist) {
		this.playlist = playlist;
	}

	public String getArtist() {
		return artist;
	}

	public void setArtist(String artist) {
		this.artist = artist;
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

	public static class Builder {
		private Boolean paused;
		private Boolean shuffle;
		private String repeat;
		private String device;
		private Integer volume;
		private String playlist;
		private String artist;
		private String title;
		private String album;
		private String release;
		private String image;
		private Integer timeCurrent;
		private Integer timeTotal;
		
		public Builder paused(Boolean paused) {
			this.paused = paused;
			return Builder.this;
		}

		public Builder shuffle(Boolean shuffle) {
			this.shuffle = shuffle;
			return Builder.this;
		}

		public Builder repeat(String repeat) {
			this.repeat = repeat;
			return Builder.this;
		}

		public Builder device(String device) {
			this.device = device;
			return Builder.this;
		}
		
		public Builder volume(Integer volume) {
			this.volume = volume;
			return Builder.this;
		}

		public Builder playlist(String playlist) {
			this.playlist = playlist;
			return Builder.this;
		}

		public Builder artist(String artist) {
			this.artist = artist;
			return Builder.this;
		}

		public Builder title(String title) {
			this.title = title;
			return Builder.this;
		}

		public Builder album(String album) {
			this.album = album;
			return Builder.this;
		}

		public Builder release(String release) {
			this.release = release;
			return Builder.this;
		}

		public Builder image(String image) {
			this.image = image;
			return Builder.this;
		}

		public Builder timeCurrent(Integer timeCurrent) {
			this.timeCurrent = timeCurrent;
			return Builder.this;
		}

		public Builder timeTotal(Integer timeTotal) {
			this.timeTotal = timeTotal;
			return Builder.this;
		}

		public PlaybackInfoDTO build() {
			return new PlaybackInfoDTO(this);
		}
	}
}
