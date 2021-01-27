package spotify.playback;

import javax.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.wrapper.spotify.SpotifyApi;
import com.wrapper.spotify.model_objects.miscellaneous.CurrentlyPlayingContext;
import com.wrapper.spotify.model_objects.specification.Track;

import spotify.bot.api.SpotifyCall;
import spotify.bot.util.BotUtils;


@Component
public class PlaybackInfoComponent {
	
	@Autowired
	private SpotifyApi spotifyApi;

	private PlaybackInfo previous;

	private String previousContextString;
	
	/**
	 * Get the full info once on startup
	 */
	@PostConstruct
	private void init() {
		getCurrentPlaybackInfo(true);
	}

	/**
	 * TODO:
	 * - Display volume on change
	 * - Display next/prev songs (if possible)
	 * - Properly center pause when only one setting is selected (shuffle/repeat)
	 * - Shrink heartbeat to null
	 * - Alternate high performance render mode for Raspi
	 * - Fix scaled background messing with the size
	 * - Fix small shadow shortly going missing during transition
	 * - True partial updates
	 * - Extract playback into own project (fork)
	 * - Fix 182 on very first launch
	 */

	public PlaybackInfo getCurrentPlaybackInfo(boolean full) {
		CurrentlyPlayingContext info = SpotifyCall.execute(spotifyApi.getInformationAboutUsersCurrentPlayback());
		if (info != null && info.getItem() != null && info.getItem() instanceof Track) {
			PlaybackInfo currentPlaybackInfo = buildInfo(info, full);
			if (full) {
				this.previous = currentPlaybackInfo;
				return currentPlaybackInfo;
			} else {
				PlaybackInfo changedInfos = findInfoDifferencesAndUpdateCurrent(currentPlaybackInfo);
				return changedInfos;
			}
		}
		return PlaybackInfo.EMPTY;
	}

	private PlaybackInfo findInfoDifferencesAndUpdateCurrent(PlaybackInfo current) {
		PlaybackInfo differences = new PlaybackInfo();
		
		if (!previous.isPaused().equals(current.isPaused())) {
			differences.setPaused(current.isPaused());
			this.previous.setPaused(current.isPaused());
		}
		
		if (!previous.isShuffle().equals(current.isShuffle())) {
			differences.setShuffle(current.isShuffle());
			this.previous.setShuffle(current.isShuffle());
		}
		
		if (!previous.getRepeat().equals(current.getRepeat())) {
			differences.setRepeat(current.getRepeat());
			this.previous.setRepeat(current.getRepeat());
		}
		
		if (!previous.getDevice().equals(current.getDevice())) {
			differences.setDevice(current.getDevice());
			this.previous.setDevice(current.getDevice());
		}
		
		if (!previous.getArtist().equals(current.getArtist())) {
			differences.setArtist(current.getArtist());
			this.previous.setArtist(current.getArtist());
		}
		
		if (!previous.getTitle().equals(current.getTitle())) {
			differences.setTitle(current.getTitle());
			this.previous.setTitle(current.getTitle());
		}
		
		if (!previous.getAlbum().equals(current.getAlbum())) {
			differences.setAlbum(current.getAlbum());
			this.previous.setAlbum(current.getAlbum());
		}
		
		if (!previous.getRelease().equals(current.getRelease())) {
			differences.setRelease(current.getRelease());
			this.previous.setRelease(current.getRelease());
		}
		
		if (!PlaybackInfoUtils.isWithinEstimatedProgressMs(previous, current)) {
			differences.setTimeCurrent(current.getTimeCurrent());
		}
		this.previous.setTimeCurrent(current.getTimeCurrent()); // always update
		
		if (!previous.getTimeTotal().equals(current.getTimeTotal())) {
			differences.setTimeTotal(current.getTimeTotal());
			this.previous.setTimeTotal(current.getTimeTotal());
		}
		
		if (!previous.getImage().equals(current.getImage())) {
			differences.setImage(current.getImage());
			this.previous.setImage(current.getImage());
		}
		
		return differences;
	}

	private PlaybackInfo buildInfo(CurrentlyPlayingContext info, boolean forceContextCheck) {
		Track track = (Track) info.getItem();
		PlaybackInfo currentPlaybackInfoFull = PlaybackInfo.builder()
			.paused(!info.getIs_playing())
			.shuffle(info.getShuffle_state())
			.repeat(info.getRepeat_state())
			.playlist(PlaybackInfoUtils.findContextName(info, forceContextCheck ? null : previousContextString, spotifyApi))
			.device(info.getDevice().getName())

			.artist(BotUtils.joinArtists(track.getArtists()))
			.title(track.getName())
			.album(track.getAlbum().getName())
			.release(PlaybackInfoUtils.findReleaseYear(track))
			.image(PlaybackInfoUtils.findLargestImage(track.getAlbum().getImages()))

			.timeCurrent(info.getProgress_ms())
			.timeTotal(track.getDurationMs())

			.build();
		this.previousContextString = info.getContext().toString();
		return currentPlaybackInfoFull;
	}


	
//	private boolean hasMajorChange(CurrentlyPlayingContext info) {
//		if (this.currentSongPlaybackInfo == null) {
//			return true;
//		}
//		Track track = (Track) info.getItem();
//		return track == null
//			|| track.getId() == null
//			|| !track.getId().equals(currentSongPlaybackInfo.getId())
//			|| info.getIs_playing().equals(currentSongPlaybackInfo.isPaused())
//			|| !info.getShuffle_state().equals(currentSongPlaybackInfo.isShuffle())
//			|| !info.getRepeat_state().equals(currentSongPlaybackInfo.getRepeat())
//			|| !info.getDevice().getName().equals(currentSongPlaybackInfo.getDevice())
//			|| (info.getContext() != null && !info.getContext().toString().equals(contextString));
//	}
//
//

	
}
