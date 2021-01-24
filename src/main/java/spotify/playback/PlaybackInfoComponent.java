package spotify.playback;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.wrapper.spotify.model_objects.miscellaneous.CurrentlyPlayingContext;
import com.wrapper.spotify.model_objects.specification.Image;
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

	@Autowired
	private SketchCommons utils;

	private CurrentPlaybackInfoFull currentSongPlaybackInfo;

	public CurrentPlaybackInfo getCurrentPlaybackInfo(boolean forceFull) throws Exception {
		CurrentlyPlayingContext info = SpotifyCall.execute(utils.getSpotifyApi().getInformationAboutUsersCurrentPlayback());
		if (info != null && info.getItem() != null && info.getItem() instanceof Track) {
			boolean hasMajorChange = hasMajorChange(info);
			int timeCurrent = info.getProgress_ms();
			if (forceFull || hasMajorChange) {
				Track track = (Track) info.getItem();

				boolean paused = !info.getIs_playing();
				boolean shuffle = info.getShuffle_state();
				String repeat = info.getRepeat_state();
				String device = info.getDevice().getName();

				String id = track.getId();
				String artist = BotUtils.joinArtists(track.getArtists());
				String title = track.getName();
				String album = track.getAlbum().getName();
				String release = track.getAlbum().getReleaseDate().substring(0, 4);
				String image = findLargestImage(track.getAlbum().getImages());

				int timeTotal = track.getDurationMs();

				CurrentPlaybackInfoFull currentPlaybackInfoFull = new CurrentPlaybackInfoFull(paused, shuffle, repeat, device, id, artist, title, album, release, image, timeCurrent, timeTotal);
				this.currentSongPlaybackInfo = currentPlaybackInfoFull;
				return currentPlaybackInfoFull;
			} else {
				return new CurrentPlaybackInfo(timeCurrent);
			}

		}
		return CurrentPlaybackInfo.EMPTY;
	}

	/*
	 * TODO: - Display next/prev songs - Properly display playlist - Properly center
	 * pause and only one setting (shuffle/repeat) - Fix 1 second innaccuracies -
	 * Transition effect when changing songs
	 */

	private boolean hasMajorChange(CurrentlyPlayingContext info) {
		if (this.currentSongPlaybackInfo == null) {
			return true;
		}
		Track track = (Track) info.getItem();
		return (!track.getId().equals(currentSongPlaybackInfo.getId())
			|| info.getIs_playing().equals(currentSongPlaybackInfo.isPaused())
			|| !info.getShuffle_state().equals(currentSongPlaybackInfo.isShuffle())
			|| !info.getRepeat_state().equals(currentSongPlaybackInfo.getRepeat())
			|| !info.getDevice().getName().equals(currentSongPlaybackInfo.getDevice()));
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
		private final boolean paused;
		private final boolean shuffle;
		private final String repeat;
		private final String device;

		private final String id;
		private final String artist;
		private final String title;
		private final String album;
		private final String release;
		private final String image;

		private final int timeTotal;

		public CurrentPlaybackInfoFull(boolean paused, boolean shuffle, String repeat, String device, String id,
			String artist, String title, String album, String release, String image, int timeCurrent, int timeTotal) {
			super(timeCurrent);
			this.paused = paused;
			this.shuffle = shuffle;
			this.repeat = repeat;
			this.device = device;
			this.id = id;
			this.artist = artist;
			this.title = title;
			this.album = album;
			this.release = release;
			this.image = image;
			this.timeTotal = timeTotal;
		}

		public boolean isPartial() {
			return false;
		}

		public boolean isPaused() {
			return paused;
		}

		public boolean isShuffle() {
			return shuffle;
		}

		public String getRepeat() {
			return repeat;
		}

		public String getDevice() {
			return device;
		}

		public String getId() {
			return id;
		}

		public String getArtist() {
			return artist;
		}

		public String getTitle() {
			return title;
		}

		public String getAlbum() {
			return album;
		}

		public String getRelease() {
			return release;
		}

		public String getImage() {
			return image;
		}

		public int getTimeCurrent() {
			return super.timeCurrent;
		}

		public int getTimeTotal() {
			return timeTotal;
		}
	}
}
