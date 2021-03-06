package spotify.playback.data.special;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

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
import com.wrapper.spotify.model_objects.specification.TrackSimplified;

import spotify.bot.api.BotException;
import spotify.bot.api.SpotifyCall;
import spotify.playback.data.PlaybackInfoDTO;
import spotify.playback.data.help.PlaybackInfoConstants;

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
			if (context != null && info.getCurrentlyPlayingType().equals(CurrentlyPlayingType.TRACK)) {
				if (ModelObjectType.PLAYLIST.equals(context.getType())) {
					contextName = getPlaylistContext(context);
				} else if (ModelObjectType.ARTIST.equals(context.getType())) {
					contextName = getArtistContext(context);
				} else if (ModelObjectType.ALBUM.equals(context.getType())) {
					contextName = getAlbumContext(info, context);
				}
			}
		} catch (BotException e) {
			e.printStackTrace();
		}
		if (contextName != null) {
			return contextName;
		} else {
			return previous != null && previous.getContext() != null ? previous.getContext() : "";
		}
	}

	private String getArtistContext(Context context) {
		if (didContextChange(context)) {
			String artistId = context.getHref().replace(PlaybackInfoConstants.ARTIST_PREFIX, "");
			Artist contextArtist = SpotifyCall.execute(spotifyApi.getArtist(artistId));
			return "ARTIST: " + contextArtist.getName();
		}
		return null;
	}

	private String getPlaylistContext(Context context) {
		if (didContextChange(context)) {
			String playlistId = context.getHref().replace(PlaybackInfoConstants.PLAYLIST_PREFIX, "");
			Playlist contextPlaylist = SpotifyCall.execute(spotifyApi.getPlaylist(playlistId));
			return contextPlaylist.getName();
		}
		return null;
	}

	private String getAlbumContext(CurrentlyPlayingContext info, Context context) {
		Track track = (Track) info.getItem();
		if (didContextChange(context)) {
			String albumId = track.getAlbum().getId();
			currentContextAlbum = SpotifyCall.execute(spotifyApi.getAlbum(albumId));
			if (currentContextAlbum.getTracks().getTotal() > MAX_IMMEDIATE_TRACKS) {
				currentContextAlbumTracks = SpotifyCall.executePaging(spotifyApi.getAlbumsTracks(albumId));
			} else {
				currentContextAlbumTracks = (List<TrackSimplified>) Arrays.asList(currentContextAlbum.getTracks().getItems());
			}
		}
		if (currentContextAlbumTracks != null) {
			Optional<TrackSimplified> currentTrackOfAlbum = currentContextAlbumTracks.stream()
				.filter(t -> t.getId().equals(track.getId()))
				.findFirst();
			if (currentTrackOfAlbum.isPresent()) {
				return String.format("Track: %02d / %02d", currentTrackOfAlbum.get().getTrackNumber(), currentContextAlbum.getTracks().getTotal());
			}
		}
		return "ALBUM: " + currentContextAlbum.getArtists()[0].getName() + " - " + currentContextAlbum.getName();
	}

	private boolean didContextChange(Context context) {
		if (!context.toString().equals(previousContextString)) {
			this.previousContextString = context.toString();
			return true;
		}
		return false;
	}
}
