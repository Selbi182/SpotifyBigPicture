package spotify.playback;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

/**
 * Wrapper class for the playback info to be sent via SSEEmitter to the
 * frontend. Any field can be null to indicate no change.
 */
@JsonInclude(Include.NON_NULL)
public class PlaybackInfo {
	public final static PlaybackInfo EMPTY = new PlaybackInfo();

	private Boolean paused;
	private Boolean shuffle;
	private String repeat;
	private String device;
	private String playlist;
	private String artist;
	private String title;
	private String album;
	private String release;
	private String image;
	private Integer timeCurrent;
	private Integer timeTotal;

	protected PlaybackInfo() {
	}

	private PlaybackInfo(Builder builder) {
		this.paused = builder.paused;
		this.shuffle = builder.shuffle;
		this.repeat = builder.repeat;
		this.device = builder.device;
		this.playlist = builder.playlist;
		this.artist = builder.artist;
		this.title = builder.title;
		this.album = builder.album;
		this.release = builder.release;
		this.image = builder.image;
		this.timeCurrent = builder.timeCurrent;
		this.timeTotal = builder.timeTotal;
	}

	public static PlaybackInfo.Builder builder() {
		return new Builder();
	}

	@JsonIgnore
	public boolean isEmpty() {
		return this.equals(EMPTY);
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

	@Override
	public int hashCode() {
		final int prime = 31;
		int result = 1;
		result = prime * result + ((album == null) ? 0 : album.hashCode());
		result = prime * result + ((artist == null) ? 0 : artist.hashCode());
		result = prime * result + ((device == null) ? 0 : device.hashCode());
		result = prime * result + ((image == null) ? 0 : image.hashCode());
		result = prime * result + ((paused == null) ? 0 : paused.hashCode());
		result = prime * result + ((playlist == null) ? 0 : playlist.hashCode());
		result = prime * result + ((release == null) ? 0 : release.hashCode());
		result = prime * result + ((repeat == null) ? 0 : repeat.hashCode());
		result = prime * result + ((shuffle == null) ? 0 : shuffle.hashCode());
		result = prime * result + ((timeCurrent == null) ? 0 : timeCurrent.hashCode());
		result = prime * result + ((timeTotal == null) ? 0 : timeTotal.hashCode());
		result = prime * result + ((title == null) ? 0 : title.hashCode());
		return result;
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		PlaybackInfo other = (PlaybackInfo) obj;
		if (album == null) {
			if (other.album != null)
				return false;
		} else if (!album.equals(other.album))
			return false;
		if (artist == null) {
			if (other.artist != null)
				return false;
		} else if (!artist.equals(other.artist))
			return false;
		if (device == null) {
			if (other.device != null)
				return false;
		} else if (!device.equals(other.device))
			return false;
		if (image == null) {
			if (other.image != null)
				return false;
		} else if (!image.equals(other.image))
			return false;
		if (paused == null) {
			if (other.paused != null)
				return false;
		} else if (!paused.equals(other.paused))
			return false;
		if (playlist == null) {
			if (other.playlist != null)
				return false;
		} else if (!playlist.equals(other.playlist))
			return false;
		if (release == null) {
			if (other.release != null)
				return false;
		} else if (!release.equals(other.release))
			return false;
		if (repeat == null) {
			if (other.repeat != null)
				return false;
		} else if (!repeat.equals(other.repeat))
			return false;
		if (shuffle == null) {
			if (other.shuffle != null)
				return false;
		} else if (!shuffle.equals(other.shuffle))
			return false;
		if (timeCurrent == null) {
			if (other.timeCurrent != null)
				return false;
		} else if (!timeCurrent.equals(other.timeCurrent))
			return false;
		if (timeTotal == null) {
			if (other.timeTotal != null)
				return false;
		} else if (!timeTotal.equals(other.timeTotal))
			return false;
		if (title == null) {
			if (other.title != null)
				return false;
		} else if (!title.equals(other.title))
			return false;
		return true;
	}

	public static class Builder {
		private Boolean paused;
		private Boolean shuffle;
		private String repeat;
		private String device;
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

		public PlaybackInfo build() {
			return new PlaybackInfo(this);
		}
	}
}
