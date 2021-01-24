package spotify.playback;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.wrapper.spotify.enums.ModelObjectType;
import com.wrapper.spotify.model_objects.miscellaneous.CurrentlyPlayingContext;
import com.wrapper.spotify.model_objects.specification.Image;
import com.wrapper.spotify.model_objects.specification.Playlist;
import com.wrapper.spotify.model_objects.specification.Track;

import spotify.bot.api.SpotifyCall;
import spotify.bot.util.BotUtils;
import spotify.sketchpads.util.SketchCommons;

/**
 * Creates an inverted playlist of The Euphonic Mess, basically ordering the
 * songs by the time they were historically added to my life. This was necessary
 * because Spotify doesn't have a feature to sort playlists by manual position.
 */
@Component
public class PlaybackInfoComponent {

	private final static String PLAYLIST_PREFIX = "https://api.spotify.com/v1/playlists/";

	@Autowired
	private SketchCommons utils;

	private CurrentPlaybackInfoFull currentSongPlaybackInfo;
	private String contextString = "";

	public CurrentPlaybackInfo getCurrentPlaybackInfo(boolean forceFull) throws Exception {
		CurrentlyPlayingContext info = SpotifyCall.execute(utils.getSpotifyApi().getInformationAboutUsersCurrentPlayback());
		if (info != null && info.getItem() != null && info.getItem() instanceof Track) {
			boolean hasMajorChange = hasMajorChange(info);
			int timeCurrent = info.getProgress_ms();
			if (forceFull || hasMajorChange) {
				Track track = (Track) info.getItem();

				CurrentPlaybackInfoFull currentPlaybackInfoFull = CurrentPlaybackInfoFull.builder()
					.paused(!info.getIs_playing())
					.shuffle(info.getShuffle_state())
					.repeat(info.getRepeat_state())
					.playlist(getPlaylistName(info))
					.device(info.getDevice().getName())

					.id(track.getId())
					.artist(BotUtils.joinArtists(track.getArtists()))
					.title(track.getName())
					.album(track.getAlbum().getName())
					.release(track.getAlbum().getReleaseDate().substring(0, 4))
					.image(findLargestImage(track.getAlbum().getImages()))

					.timeCurrent(timeCurrent)
					.timeTotal(track.getDurationMs())

					.build();

				this.currentSongPlaybackInfo = currentPlaybackInfoFull;
				return currentPlaybackInfoFull;
			} else {
				return new CurrentPlaybackInfo(timeCurrent);
			}

		}
		return CurrentPlaybackInfo.EMPTY;
	}

	/**
	 * TODO:
	 * - Display next/prev songs (if possible)
	 * - Properly center pause when only one setting is selected (shuffle/repeat)
	 * - Fix delay on Raspi
	 */

	private String getPlaylistName(CurrentlyPlayingContext info) {
		if (info.getContext() != null && ModelObjectType.PLAYLIST.equals(info.getContext().getType()) && !info.getContext().toString().equals(contextString)) {
			this.contextString = info.getContext().toString();
			String uri = info.getContext().getHref().replace(PLAYLIST_PREFIX, "");
			Playlist contextPlaylist = SpotifyCall.execute(utils.getSpotifyApi().getPlaylist(uri));
			if (contextPlaylist != null) {
				return contextPlaylist.getName();
			}
		}
		return currentSongPlaybackInfo != null ? currentSongPlaybackInfo.getPlaylist() : "";
	}

	private boolean hasMajorChange(CurrentlyPlayingContext info) {
		if (this.currentSongPlaybackInfo == null) {
			return true;
		}
		Track track = (Track) info.getItem();
		return (!track.getId().equals(currentSongPlaybackInfo.getId())
			|| info.getIs_playing().equals(currentSongPlaybackInfo.isPaused())
			|| !info.getShuffle_state().equals(currentSongPlaybackInfo.isShuffle())
			|| !info.getRepeat_state().equals(currentSongPlaybackInfo.getRepeat())
			|| !info.getDevice().getName().equals(currentSongPlaybackInfo.getDevice())
			|| !info.getContext().toString().equals(contextString));
	}

	private String findLargestImage(Image[] images) {
		Image largest = null;
		for (Image img : images) {
			if (largest == null || img.getWidth() > largest.getWidth()) {
				largest = img;
			}
		}
		return largest.getUrl();
	}

	public static class CurrentPlaybackInfo {
		public final static CurrentPlaybackInfo EMPTY = new CurrentPlaybackInfo(-1);

		private final int timeCurrent;

		public CurrentPlaybackInfo(int timeCurrent) {
			this.timeCurrent = timeCurrent;
		}

		public boolean isPartial() {
			return true;
		}

		public int getTimeCurrent() {
			return timeCurrent;
		}
	}

	public static class CurrentPlaybackInfoFull extends CurrentPlaybackInfo {
		private boolean paused;
		private boolean shuffle;
		private String repeat;
		private String device;
		private String playlist;
		private String id;
		private String artist;
		private String title;
		private String album;
		private String release;
		private String image;
		private int timeTotal;

		private CurrentPlaybackInfoFull(Builder builder) {
			super(builder.timeCurrent);
			this.paused = builder.paused;
			this.shuffle = builder.shuffle;
			this.repeat = builder.repeat;
			this.device = builder.device;
			this.playlist = builder.playlist;
			this.id = builder.id;
			this.artist = builder.artist;
			this.title = builder.title;
			this.album = builder.album;
			this.release = builder.release;
			this.image = builder.image;
			this.timeTotal = builder.timeTotal;
		}

		public static CurrentPlaybackInfoFull.Builder builder() {
			return new Builder();
		}

		@Override
		public boolean isPartial() {
			return false;
		}

		public boolean isPaused() {
			return paused;
		}

		public void setPaused(boolean paused) {
			this.paused = paused;
		}

		public boolean isShuffle() {
			return shuffle;
		}

		public void setShuffle(boolean shuffle) {
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

		public String getId() {
			return id;
		}

		public void setId(String id) {
			this.id = id;
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

		public int getTimeTotal() {
			return timeTotal;
		}

		public void setTimeTotal(int timeTotal) {
			this.timeTotal = timeTotal;
		}

		public static class Builder {
			private boolean paused;
			private boolean shuffle;
			private String repeat;
			private String device;
			private String playlist;
			private String id;
			private String artist;
			private String title;
			private String album;
			private String release;
			private String image;
			private int timeCurrent;
			private int timeTotal;

			public Builder paused(boolean paused) {
				this.paused = paused;
				return Builder.this;
			}

			public Builder shuffle(boolean shuffle) {
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

			public Builder id(String id) {
				this.id = id;
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

			public Builder timeCurrent(int timeCurrent) {
				this.timeCurrent = timeCurrent;
				return Builder.this;
			}

			public Builder timeTotal(int timeTotal) {
				this.timeTotal = timeTotal;
				return Builder.this;
			}

			public CurrentPlaybackInfoFull build() {
				return new CurrentPlaybackInfoFull(this);
			}
		}
	}

}
