package spotify.playback.data;

import java.beans.IntrospectionException;
import java.beans.PropertyDescriptor;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.wrapper.spotify.SpotifyApi;
import com.wrapper.spotify.enums.CurrentlyPlayingType;
import com.wrapper.spotify.enums.ModelObjectType;
import com.wrapper.spotify.model_objects.miscellaneous.CurrentlyPlayingContext;
import com.wrapper.spotify.model_objects.specification.Album;
import com.wrapper.spotify.model_objects.specification.Artist;
import com.wrapper.spotify.model_objects.specification.Context;
import com.wrapper.spotify.model_objects.specification.Playlist;
import com.wrapper.spotify.model_objects.specification.Track;

import spotify.bot.api.BotException;
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
	private static final List<Field> DTO_FIELDS;
	static {
		DTO_FIELDS = Stream.of(PlaybackInfoDTO.class.getDeclaredFields())
			.filter(f -> !Modifier.isFinal(f.getModifiers()))
			.filter(f -> !f.getType().equals(PlaybackInfoDTO.Type.class))
			.collect(Collectors.toList());
	}

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
					try {
						PlaybackInfoDTO changedInfos = findInfoDifferencesAndUpdateCurrent(currentPlaybackInfo);
						return changedInfos;
					} catch (IllegalArgumentException | IntrospectionException | ReflectiveOperationException e) {
						throw new BotException(e);
					}
				}
			}
			return PlaybackInfoDTO.IDLE;
		} catch (BotException e) {
			e.printStackTrace();
			return PlaybackInfoDTO.EMPTY;
		}
	}

	private void checkDifferences(PlaybackInfoDTO differences, PlaybackInfoDTO previous, PlaybackInfoDTO current, String field) throws IntrospectionException, ReflectiveOperationException, IllegalArgumentException {
		PropertyDescriptor propertyDescriptor = new PropertyDescriptor(field, PlaybackInfoDTO.class);
		Object previousObject = propertyDescriptor.getReadMethod().invoke(previous);
		Object currentObject = propertyDescriptor.getReadMethod().invoke(current);
		if (!Objects.equals(previousObject, currentObject)) {
			differences.setType(Type.DATA);
			propertyDescriptor.getWriteMethod().invoke(differences, currentObject);
			propertyDescriptor.getWriteMethod().invoke(this.previous, currentObject);
		}
	}

	private PlaybackInfoDTO findInfoDifferencesAndUpdateCurrent(PlaybackInfoDTO current) throws IllegalArgumentException, IntrospectionException, ReflectiveOperationException {
		PlaybackInfoDTO diff = new PlaybackInfoDTO(Type.EMTPY);
		for (Field field : DTO_FIELDS) {
			String fieldName = field.getName();
			if (fieldName.equals("timeCurrent")) {
				// Progress always needs to get updated, so it's handled separately
				if (!PlaybackInfoUtils.isWithinEstimatedProgressMs(previous, current)) {
					diff.setType(Type.DATA);
					diff.setTimeCurrent(current.getTimeCurrent());
				}
				this.previous.setTimeCurrent(current.getTimeCurrent());
			} else {
				checkDifferences(diff, previous, current, fieldName);
			}
		}

		return diff;
	}

	private PlaybackInfoDTO buildInfo(CurrentlyPlayingContext info, boolean forceContextCheck) {
		Track track = (Track) info.getItem();
		PlaybackInfoDTO currentPlaybackInfoFull = PlaybackInfoDTO.builder()
			.paused(!info.getIs_playing())
			.shuffle(info.getShuffle_state())
			.repeat(info.getRepeat_state())
			.playlist(findContextName(info))
			.device(info.getDevice().getName())
			.volume(info.getDevice().getVolume_percent())

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
	 * @param info the context info
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
		} catch (BotException e) {
			e.printStackTrace();
		}
		return previous != null && previous.getPlaylist() != null ? previous.getPlaylist() : "";
	}

}
