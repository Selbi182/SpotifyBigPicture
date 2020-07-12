package spotify.bot.api.services;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.google.common.collect.Lists;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.wrapper.spotify.SpotifyApi;
import com.wrapper.spotify.model_objects.specification.Playlist;
import com.wrapper.spotify.model_objects.specification.PlaylistTrack;
import com.wrapper.spotify.model_objects.specification.Track;

import spotify.bot.api.SpotifyCall;
import spotify.bot.util.BotUtils;

@Service
public class PlaylistSongsService {
	private final static int TOP_OF_PLAYLIST = 0;
	private final static int PLAYLIST_ADDITION_COOLDOWN = 1000;
	private final static int PLAYLIST_ADD_LIMIT = 100;
	private final static int PLAYLIST_SIZE_LIMIT = 10000;
	private final static String TRACK_PREFIX = "spotify:track:";

	@Autowired
	private SpotifyApi spotifyApi;

	/**
	 * Add the given list of song IDs to the playlist (a delay of a second per
	 * release is used to retain order). May remove older songs to make room.
	 * 
	 * @param sortedNewReleases
	 * @param songs
	 * @return
	 */
	public void addSongsToPlaylistById(String playlistId, List<Track> tracks) {
		if (!tracks.isEmpty()) {
			boolean playlistHasCapacity = circularPlaylistFitting(playlistId, tracks.size());
			if (playlistHasCapacity) {
				for (List<Track> partition : Lists.partition(tracks, PLAYLIST_ADD_LIMIT)) {
					JsonArray json = new JsonArray();
					for (Track s : partition) {
						json.add(TRACK_PREFIX + s.getId());
					}
					SpotifyCall.execute(spotifyApi.addTracksToPlaylist(playlistId, json).position(TOP_OF_PLAYLIST));
					BotUtils.sneakySleep(PLAYLIST_ADDITION_COOLDOWN);
				}
			}
		}
	}

	/**
	 * Check if circular playlist fitting is required (if enabled; otherwise an
	 * exception is thrown)
	 * 
	 * @param playlistId
	 * @param songsToAddCount
	 * @return true on success, false if playlist is full and can't be cleared
	 */
	private boolean circularPlaylistFitting(String playlistId, int songsToAddCount) {
		Playlist p = SpotifyCall.execute(spotifyApi.getPlaylist(playlistId));
		final int currentPlaylistCount = p.getTracks().getTotal();
		if (currentPlaylistCount + songsToAddCount > PLAYLIST_SIZE_LIMIT) {
			deleteSongsFromBottomOnLimit(playlistId, currentPlaylistCount, songsToAddCount);
		}
		return true;
	}

	/**
	 * Delete as many songs from the bottom as necessary to make room for any new
	 * songs to add, as Spotify playlists have a fixed limit of 10000 songs.
	 * 
	 * If circularPlaylistFitting isn't enabled, an exception is thrown on a full
	 * playlist instead.
	 * 
	 * @param playlistId
	 * @param currentPlaylistCount
	 * @param songsToAddCount
	 */
	private void deleteSongsFromBottomOnLimit(String playlistId, int currentPlaylistCount, int songsToAddCount) {
		int totalSongsToDeleteCount = currentPlaylistCount + songsToAddCount - PLAYLIST_SIZE_LIMIT;
		boolean repeat = totalSongsToDeleteCount > PLAYLIST_ADD_LIMIT;
		int songsToDeleteCount = repeat ? PLAYLIST_ADD_LIMIT : totalSongsToDeleteCount;
		final int offset = currentPlaylistCount - songsToDeleteCount;

		List<PlaylistTrack> tracksToDelete = SpotifyCall.executePaging(spotifyApi.getPlaylistsTracks(playlistId).offset(offset).limit(PLAYLIST_ADD_LIMIT));

		JsonArray json = new JsonArray();
		for (int i = 0; i < tracksToDelete.size(); i++) {
			JsonObject object = new JsonObject();
			object.addProperty("uri", TRACK_PREFIX + tracksToDelete.get(i).getTrack().getId());
			JsonArray positions = new JsonArray();
			positions.add(currentPlaylistCount - songsToDeleteCount + i);
			object.add("positions", positions);
			json.add(object);
		}

		SpotifyCall.execute(spotifyApi.removeTracksFromPlaylist(playlistId, json));

		// Repeat if more than 100 songs have to be added/deleted (should rarely happen,
		// so a recursion will be slow, but it'll do the job)
		if (repeat) {
			deleteSongsFromBottomOnLimit(playlistId, currentPlaylistCount - 100, songsToAddCount);
		}
	}
}
