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
import com.wrapper.spotify.model_objects.miscellaneous.CurrentlyPlayingContext;
import com.wrapper.spotify.model_objects.specification.Track;

import spotify.bot.api.BotException;
import spotify.bot.api.SpotifyCall;
import spotify.bot.util.BotUtils;
import spotify.playback.data.PlaybackInfoDTO.Type;
import spotify.playback.data.help.DominantColorProvider;
import spotify.playback.data.help.PlaybackContextProvider;
import spotify.playback.data.help.PlaybackInfoUtils;

@Component
public class PlaybackInfoProvider {

	@Autowired
	private SpotifyApi spotifyApi;

	@Autowired
	private PlaybackContextProvider playbackContextProvider;

	@Autowired
	private DominantColorProvider dominantColorProvider;

	private PlaybackInfoDTO previous;
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
		} catch (BotException e) {
			e.printStackTrace();
		}
		return PlaybackInfoDTO.EMPTY;
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
		PlaybackInfoDTO pInfo = new PlaybackInfoDTO(Type.DATA);

		pInfo.setPaused(!info.getIs_playing());
		pInfo.setShuffle(info.getShuffle_state());
		pInfo.setRepeat(info.getRepeat_state());

		pInfo.setContext(playbackContextProvider.findContextName(info, previous));
		pInfo.setDevice(info.getDevice().getName());
		pInfo.setVolume(info.getDevice().getVolume_percent());

		pInfo.setArtists(BotUtils.toArtistNamesList(track.getArtists()));
		pInfo.setTitle(track.getName());
		pInfo.setAlbum(track.getAlbum().getName());
		pInfo.setRelease(PlaybackInfoUtils.findReleaseYear(track));

		pInfo.setTimeCurrent(info.getProgress_ms());
		pInfo.setTimeTotal(track.getDurationMs());

		String imageUrl = PlaybackInfoUtils.findLargestImage(track.getAlbum().getImages());
		if (imageUrl != null) {
			pInfo.setImage(imageUrl);
			pInfo.setImageColor(dominantColorProvider.getDominantColorFromImageUrl(imageUrl));
		}

		return pInfo;
	}
}
