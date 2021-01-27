package spotify.playback.data;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.wrapper.spotify.SpotifyApi;
import com.wrapper.spotify.model_objects.miscellaneous.CurrentlyPlayingContext;
import com.wrapper.spotify.model_objects.specification.Track;

import spotify.bot.api.SpotifyCall;
import spotify.bot.util.BotUtils;
import spotify.playback.data.help.PlaybackInfoUtils;

@Component
public class PlaybackInfoProvider {

	@Autowired
	private SpotifyApi spotifyApi;

	private PlaybackInfoDTO previous;

	private String previousContextString;

	public PlaybackInfoDTO getCurrentPlaybackInfo(boolean full) {
		if (previous == null) {
			full = true;
		}
		CurrentlyPlayingContext info = SpotifyCall.execute(spotifyApi.getInformationAboutUsersCurrentPlayback());
		if (info != null && info.getItem() != null && info.getItem() instanceof Track) {
			PlaybackInfoDTO currentPlaybackInfo = buildInfo(info, full);
			if (full) {
				this.previous = currentPlaybackInfo;
				return currentPlaybackInfo;
			} else {
				PlaybackInfoDTO changedInfos = findInfoDifferencesAndUpdateCurrent(currentPlaybackInfo);
				return changedInfos;
			}
		}
		return PlaybackInfoDTO.EMPTY;
	}

	private PlaybackInfoDTO findInfoDifferencesAndUpdateCurrent(PlaybackInfoDTO current) {
		PlaybackInfoDTO differences = new PlaybackInfoDTO();

		if (previous.getImage() == null || !previous.getImage().equals(current.getImage())) {
			differences.setImage(current.getImage());
			this.previous.setImage(current.getImage());
		}

		if (!previous.getTitle().equals(current.getTitle())) {
			differences.setTitle(current.getTitle());
			this.previous.setTitle(current.getTitle());
		}
		if (!previous.getArtist().equals(current.getArtist())) {
			differences.setArtist(current.getArtist());
			this.previous.setArtist(current.getArtist());
		}
		if (!previous.getAlbum().equals(current.getAlbum())) {
			differences.setAlbum(current.getAlbum());
			this.previous.setAlbum(current.getAlbum());
		}
		if (!previous.getRelease().equals(current.getRelease())) {
			differences.setRelease(current.getRelease());
			this.previous.setRelease(current.getRelease());
		}

		if (previous.getPlaylist() == null || !previous.getPlaylist().equals(current.getPlaylist())) {
			differences.setPlaylist(current.getPlaylist());
			this.previous.setPlaylist(current.getPlaylist());
		}
		if (!previous.getDevice().equals(current.getDevice())) {
			differences.setDevice(current.getDevice());
			this.previous.setDevice(current.getDevice());
		}

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

		if (!PlaybackInfoUtils.isWithinEstimatedProgressMs(previous, current)) {
			differences.setTimeCurrent(current.getTimeCurrent());
		}
		this.previous.setTimeCurrent(current.getTimeCurrent()); // always update

		if (!previous.getTimeTotal().equals(current.getTimeTotal())) {
			differences.setTimeTotal(current.getTimeTotal());
			this.previous.setTimeTotal(current.getTimeTotal());
		}
		return differences;
	}

	private PlaybackInfoDTO buildInfo(CurrentlyPlayingContext info, boolean forceContextCheck) {
		Track track = (Track) info.getItem();
		PlaybackInfoDTO currentPlaybackInfoFull = PlaybackInfoDTO.builder()
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
}
