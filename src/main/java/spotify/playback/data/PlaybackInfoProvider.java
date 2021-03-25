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
import com.wrapper.spotify.model_objects.IPlaylistItem;
import com.wrapper.spotify.model_objects.miscellaneous.CurrentlyPlayingContext;
import com.wrapper.spotify.model_objects.specification.Episode;
import com.wrapper.spotify.model_objects.specification.Track;

import spotify.bot.api.BotException;
import spotify.bot.api.SpotifyCall;
import spotify.bot.util.BotUtils;
import spotify.playback.data.PlaybackInfoDTO.Type;
import spotify.playback.data.help.PlaybackInfoUtils;
import spotify.playback.data.special.ArtworkUrlProvider;
import spotify.playback.data.special.ContextProvider;
import spotify.playback.data.special.color.ColorProvider;
import spotify.playback.data.special.color.ColorThiefColorProvider;

@Component
public class PlaybackInfoProvider {

	@Autowired
	private SpotifyApi spotifyApi;

	@Autowired
	private ContextProvider playbackContextProvider;

	@Autowired
	private ArtworkUrlProvider artworkUrlProvider;

	private ColorProvider dominantColorProvider = new ColorThiefColorProvider(); // simply the better implementation, all downsides considered

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
			CurrentlyPlayingContext info = SpotifyCall.execute(spotifyApi.getInformationAboutUsersCurrentPlayback().additionalTypes("episode"));
			if (info != null) {
				PlaybackInfoDTO currentPlaybackInfo = null;
				CurrentlyPlayingType type = info.getCurrentlyPlayingType();
				if (type.equals(CurrentlyPlayingType.TRACK)) {
					currentPlaybackInfo = buildInfoTrack(info);
				} else if (type.equals(CurrentlyPlayingType.EPISODE)) {
					currentPlaybackInfo = buildInfoEpisode(info);
				}
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

	private PlaybackInfoDTO buildInfoTrack(CurrentlyPlayingContext info) {
		PlaybackInfoDTO pInfo = buildBaseInfo(info);

		Track track = (Track) info.getItem();
		pInfo.setArtists(BotUtils.toArtistNamesList(track.getArtists()));
		pInfo.setTitle(track.getName());
		pInfo.setAlbum(track.getAlbum().getName());
		pInfo.setRelease(PlaybackInfoUtils.findReleaseYear(track));

		return pInfo;
	}

	private PlaybackInfoDTO buildInfoEpisode(CurrentlyPlayingContext info) {
		PlaybackInfoDTO pInfo = buildBaseInfo(info);

		Episode episode = (Episode) info.getItem();
		pInfo.setArtists(List.of(episode.getShow().getPublisher()));
		pInfo.setTitle(episode.getName());
		pInfo.setAlbum(episode.getShow().getName());
		pInfo.setRelease(episode.getReleaseDate());

		return pInfo;
	}

	private PlaybackInfoDTO buildBaseInfo(CurrentlyPlayingContext info) {
		IPlaylistItem episode = info.getItem();
		PlaybackInfoDTO pInfo = new PlaybackInfoDTO(Type.DATA);

		pInfo.setPaused(!info.getIs_playing());
		pInfo.setShuffle(info.getShuffle_state());
		pInfo.setRepeat(info.getRepeat_state());

		pInfo.setContext(playbackContextProvider.findContextName(info, previous));
		pInfo.setDevice(info.getDevice().getName());

		pInfo.setTimeCurrent(info.getProgress_ms());
		pInfo.setTimeTotal(episode.getDurationMs());

		String artworkUrl = artworkUrlProvider.findArtworkUrl(episode);
		if (artworkUrl != null && !artworkUrl.isEmpty()) {
			pInfo.setImage(artworkUrl);
			pInfo.setImageColors(dominantColorProvider.getDominantColorFromImageUrl(artworkUrl));
		} else {
			pInfo.setImage("BLANK");
		}

		return pInfo;
	}
}
