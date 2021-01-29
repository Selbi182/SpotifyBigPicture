package spotify.playback.data;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.wrapper.spotify.SpotifyApi;
import com.wrapper.spotify.enums.CurrentlyPlayingType;
import com.wrapper.spotify.enums.ModelObjectType;
import com.wrapper.spotify.exceptions.SpotifyWebApiException;
import com.wrapper.spotify.model_objects.miscellaneous.CurrentlyPlayingContext;
import com.wrapper.spotify.model_objects.specification.Album;
import com.wrapper.spotify.model_objects.specification.Artist;
import com.wrapper.spotify.model_objects.specification.Context;
import com.wrapper.spotify.model_objects.specification.Playlist;
import com.wrapper.spotify.model_objects.specification.Track;

import spotify.bot.api.SpotifyCall;
import spotify.bot.util.BotUtils;
import spotify.playback.data.PlaybackInfoDTO.Type;
import spotify.playback.data.help.PlaybackInfoConstants;
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
		try {
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
		} catch (SpotifyWebApiException e) {
			e.printStackTrace();
			return PlaybackInfoDTO.IDLE;
		}
	}

	private PlaybackInfoDTO findInfoDifferencesAndUpdateCurrent(PlaybackInfoDTO current) {
		PlaybackInfoDTO differences = new PlaybackInfoDTO(Type.EMTPY);

		if (previous.getImage() == null || !previous.getImage().equals(current.getImage())) {
			differences.setType(Type.DATA);
			differences.setImage(current.getImage());
			this.previous.setImage(current.getImage());
		}
		
		if (!previous.getTitle().equals(current.getTitle())) {
			differences.setType(Type.DATA);
			differences.setTitle(current.getTitle());
			this.previous.setTitle(current.getTitle());
		}
		if (!previous.getArtist().equals(current.getArtist())) {
			differences.setType(Type.DATA);
			differences.setArtist(current.getArtist());
			this.previous.setArtist(current.getArtist());
		}
		if (!previous.getAlbum().equals(current.getAlbum())) {
			differences.setType(Type.DATA);
			differences.setAlbum(current.getAlbum());
			this.previous.setAlbum(current.getAlbum());
		}
		if (!previous.getRelease().equals(current.getRelease())) {
			differences.setType(Type.DATA);
			differences.setRelease(current.getRelease());
			this.previous.setRelease(current.getRelease());
		}

		if (!previous.getPlaylist().equals(current.getPlaylist())) {
			differences.setType(Type.DATA);
			differences.setPlaylist(current.getPlaylist());
			this.previous.setPlaylist(current.getPlaylist());
		}
		if (!previous.getDevice().equals(current.getDevice())) {
			differences.setType(Type.DATA);
			differences.setDevice(current.getDevice());
			this.previous.setDevice(current.getDevice());
		}

		if (!previous.isPaused().equals(current.isPaused())) {
			differences.setType(Type.DATA);
			differences.setPaused(current.isPaused());
			this.previous.setPaused(current.isPaused());
		}
		if (!previous.isShuffle().equals(current.isShuffle())) {
			differences.setType(Type.DATA);
			differences.setShuffle(current.isShuffle());
			this.previous.setShuffle(current.isShuffle());
		}
		if (!previous.getRepeat().equals(current.getRepeat())) {
			differences.setType(Type.DATA);
			differences.setRepeat(current.getRepeat());
			this.previous.setRepeat(current.getRepeat());
		}

		if (!PlaybackInfoUtils.isWithinEstimatedProgressMs(previous, current)) {
			differences.setType(Type.DATA);
			differences.setTimeCurrent(current.getTimeCurrent());
		}
		this.previous.setTimeCurrent(current.getTimeCurrent()); // always update

		if (!previous.getTimeTotal().equals(current.getTimeTotal())) {
			differences.setType(Type.DATA);
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
			.playlist(findContextName(info))
			.device(info.getDevice().getName())

			.artist(BotUtils.joinArtists(track.getArtists()))
			.title(track.getName())
			.album(track.getAlbum().getName())
			.release(PlaybackInfoUtils.findReleaseYear(track))
			.image(PlaybackInfoUtils.findLargestImage(track.getAlbum().getImages()))

			.timeCurrent(info.getProgress_ms())
			.timeTotal(track.getDurationMs())

			.build();
		return currentPlaybackInfoFull;
	}
	

	/**
	 * Get the name of the currently playing context (either a playlist name, an
	 * artist, or an album). Only works on Tracks.
	 * 
	 * @param info       the context info
	 * @return a String of the current context, null if none was found
	 */
	public String findContextName(CurrentlyPlayingContext info) {
		try {
			Context context = info.getContext();
			if (context != null && !context.toString().equals(previousContextString) && info.getCurrentlyPlayingType().equals(CurrentlyPlayingType.TRACK)) {
				this.previousContextString = context.toString();
				
				ModelObjectType type = context.getType();
				switch (type) {
					case PLAYLIST:
						String playlistId = context.getHref().replace(PlaybackInfoConstants.PLAYLIST_PREFIX, "");
						Playlist contextPlaylist = SpotifyCall.execute(spotifyApi.getPlaylist(playlistId));
						if (contextPlaylist != null) {
							return contextPlaylist.getName();
						}
						break;
					case ARTIST:
						String artistId = context.getHref().replace(PlaybackInfoConstants.ARTIST_PREFIX, "");
						Artist contextArtist = SpotifyCall.execute(spotifyApi.getArtist(artistId));
						if (contextArtist != null) {
							return contextArtist.getName();
						}
						break;
					case ALBUM:
						String albumId = context.getHref().replace(PlaybackInfoConstants.ALBUM_PREFIX, "");
						Album contextAlbum = SpotifyCall.execute(spotifyApi.getAlbum(albumId));
						if (contextAlbum != null) {
							return contextAlbum.getName();
						}
						break;
					default:
						break;
				}
			}			
		} catch (SpotifyWebApiException e) {
			e.printStackTrace();
		}
		return previous != null && previous.getPlaylist() != null ? previous.getPlaylist() : "";
	}

}
