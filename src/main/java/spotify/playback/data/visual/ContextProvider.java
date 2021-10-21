package spotify.playback.data.visual;

import com.google.common.collect.Iterables;
import com.wrapper.spotify.SpotifyApi;
import com.wrapper.spotify.enums.CurrentlyPlayingType;
import com.wrapper.spotify.enums.ModelObjectType;
import com.wrapper.spotify.model_objects.miscellaneous.CurrentlyPlayingContext;
import com.wrapper.spotify.model_objects.specification.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import spotify.bot.api.BotException;
import spotify.bot.api.SpotifyCall;
import spotify.bot.util.BotUtils;
import spotify.playback.data.PlaybackInfoDTO;
import spotify.playback.data.help.PlaybackInfoConstants;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;

@Component
public class ContextProvider {

	private static final int MAX_IMMEDIATE_TRACKS = 50;

	@Autowired
	private SpotifyApi spotifyApi;

	private String previousContextString;
	private Album currentContextAlbum;
	private List<TrackSimplified> currentContextAlbumTracks;

	/**
	 * Get the name of the currently playing context (either a playlist name, an
	 * artist, or an album). Only works on Tracks.
	 * 
	 * @param info     the context info
	 * @param previous the previous info to compare to
	 * @return a String of the current context, null if none was found
	 */
	public String findContextName(CurrentlyPlayingContext info, PlaybackInfoDTO previous) {
		String contextName = null;
		try {
			Context context = info.getContext();
			boolean force = previous == null || previous.getContext() == null || previous.getContext().isEmpty();
			if (context != null) {
				ModelObjectType type = context.getType();
				if (ModelObjectType.PLAYLIST.equals(type)) {
					contextName = getPlaylistContext(context, force);
				} else if (ModelObjectType.ARTIST.equals(type)) {
					contextName = getArtistContext(context, force);
				} else if (ModelObjectType.ALBUM.equals(type)) {
					contextName = getAlbumContext(info, force);
				} else if (ModelObjectType.SHOW.equals(type)) {
					contextName = getPodcastContext(info, force);
				}
			}
		} catch (BotException e) {
			e.printStackTrace();
		}
		if (contextName != null) {
			return contextName;
		} else {
			return previous != null && previous.getContext() != null ? previous.getContext() : "[context not found]";
		}
	}

	private String getArtistContext(Context context, boolean force) {
		if (force || didContextChange(context)) {
			String artistId = context.getHref().replace(PlaybackInfoConstants.ARTIST_PREFIX, "");
			Artist contextArtist = SpotifyCall.execute(spotifyApi.getArtist(artistId));
			return "ARTIST: " + contextArtist.getName();
		}
		return null;
	}

	private String getPlaylistContext(Context context, boolean force) {
		if (force || didContextChange(context)) {
			String playlistId = context.getHref().replace(PlaybackInfoConstants.PLAYLIST_PREFIX, "");
			Playlist contextPlaylist = SpotifyCall.execute(spotifyApi.getPlaylist(playlistId));
			return contextPlaylist.getName();
		}
		return null;
	}

	private String getAlbumContext(CurrentlyPlayingContext info, boolean force) {
		Context context = info.getContext();
		Track track = null;
		String albumId;
		if (info.getCurrentlyPlayingType().equals(CurrentlyPlayingType.TRACK)) {
			track = (Track) info.getItem();
			albumId = track.getAlbum().getId();
		} else {
			albumId = BotUtils.getIdFromUri(context.getUri());
		}

		if (force || didContextChange(context)) {
			currentContextAlbum = SpotifyCall.execute(spotifyApi.getAlbum(albumId));
			if (currentContextAlbum.getTracks().getTotal() > MAX_IMMEDIATE_TRACKS) {
				currentContextAlbumTracks = SpotifyCall.executePaging(spotifyApi.getAlbumsTracks(albumId));
			} else {
				currentContextAlbumTracks = Arrays.asList(currentContextAlbum.getTracks().getItems());
			}
		}
		if (currentContextAlbumTracks != null && track != null) {
			// Track number (unfortunately, can't simply use track numbers because of disc
			// numbers)
			final String trackId = track.getId();
			int currentlyPlayingTrackNumber = Iterables.indexOf(currentContextAlbumTracks, t -> t.getId().equals(trackId)) + 1;

			// Total album duration
			Integer totalDurationMs = currentContextAlbumTracks.stream().mapToInt(TrackSimplified::getDurationMs).sum();
			String totalDurationFormatted = formatTime(totalDurationMs);

			// Assemble it all
			if (currentlyPlayingTrackNumber > 0) {
				return String.format("Total Time: %s // Track: %02d of %02d", totalDurationFormatted, currentlyPlayingTrackNumber, currentContextAlbum.getTracks().getTotal());
			}
		}

		// Fallback when playing back from the queue
		return "Queue (ALBUM: " + currentContextAlbum.getArtists()[0].getName() + " - " + currentContextAlbum.getName() + ")";
	}

	private String getPodcastContext(CurrentlyPlayingContext info, boolean force) {
		Context context = info.getContext();
		String showId = BotUtils.getIdFromUri(context.getUri());
		if (force || didContextChange(context)) {
			Show show = SpotifyCall.execute(spotifyApi.getShow(showId));
			return "PODCAST: " + show.getName();
		}
		return null;
	}

	private boolean didContextChange(Context context) {
		if (!context.toString().equals(previousContextString)) {
			this.previousContextString = context.toString();
			return true;
		}
		return false;
	}

	private String formatTime(Integer timeInMs) {
		Duration duration = Duration.ofMillis(timeInMs);
		long hours = duration.toHours();
		int minutesPart = duration.toMinutesPart();
		if (hours > 0) {
			return String.format("%d hr %d min", hours, minutesPart);
		} else {
			int secondsPart = duration.toSecondsPart();
			return String.format("%d min %d sec", minutesPart, secondsPart);
		}
	}
}
