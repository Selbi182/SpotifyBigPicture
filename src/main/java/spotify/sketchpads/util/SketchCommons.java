package spotify.sketchpads.util;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

import javax.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.google.common.base.Supplier;
import com.google.common.base.Suppliers;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.collect.Lists;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.wrapper.spotify.SpotifyApi;
import com.wrapper.spotify.model_objects.specification.PlaylistTrack;
import com.wrapper.spotify.model_objects.specification.SavedTrack;
import com.wrapper.spotify.model_objects.specification.Track;

import spotify.bot.api.SpotifyCall;
import spotify.bot.util.BotUtils;

@Component
public class SketchCommons {

	@Autowired
	private SpotifyApi spotifyApi;

	private LoadingCache<String, List<PlaylistTrack>> playlistCache;
	private Supplier<List<SavedTrack>> savedTrackCache;

	private final static int CACHE_TIMEOUT_MINUTES = 4; // just enough to avoid heavily repeated calls

	@PostConstruct
	private void init() {
		rebuildCaches();
	}
	
	public void rebuildCaches() {
		CacheBuilder<Object, Object> cacheBuilder = CacheBuilder.newBuilder()
			.expireAfterWrite(CACHE_TIMEOUT_MINUTES, TimeUnit.MINUTES);

		this.playlistCache = cacheBuilder
			.build(
				new CacheLoader<String, List<PlaylistTrack>>() {
					@Override
					public List<PlaylistTrack> load(String playlistId) throws Exception {
						return getPlaylistTracksReal(playlistId);
					}
				});

		this.savedTrackCache = Suppliers.memoizeWithExpiration(
			this::getSavedSongsReal,
			CACHE_TIMEOUT_MINUTES, TimeUnit.MINUTES);
	}

	/////////////////////////////////////////////////
	// BULK GETTERS (with cache)

	public List<PlaylistTrack> getPlaylistTracks(String id) {
		try {
			return playlistCache.get(id);
		} catch (ExecutionException e) {
			return getPlaylistTracksReal(id);
		}
	}

	public List<SavedTrack> getSavedSongs() {
		return savedTrackCache.get();
	}

	private List<PlaylistTrack> getPlaylistTracksReal(String id) {
		List<PlaylistTrack> playlistTracks = SpotifyCall.executePaging(spotifyApi.getPlaylistsItems(id));
		return playlistTracks;
	}

	private List<SavedTrack> getSavedSongsReal() {
		List<SavedTrack> savedSongs = SpotifyCall.executePaging(spotifyApi.getUsersSavedTracks());
		return savedSongs;
	}

	/////////////////////////////////////////////////
	// PLAYLIST MANIPULATORS

	public void addToPlaylist(String playlistId, List<String> allUris) {
		for (List<String> uris : Lists.partition(allUris, SketchConst.PLAYLIST_ADD_LIMIT)) {
			String[] urisArray = uris.toArray(String[]::new);
			SpotifyCall.execute(spotifyApi.addItemsToPlaylist(playlistId, urisArray));
			BotUtils.sneakySleep(1000);
		}
		invalidatePlaylist(playlistId);
	}

	public void reorderPlaylistTracksToTop(String playlistId, int rangeStart, int count) {
		SpotifyCall.execute(spotifyApi.reorderPlaylistsItems(playlistId, rangeStart, 0).range_length(count));
		invalidatePlaylist(playlistId);
	}

	public void removeTracksFromPlaylist(String playlistId, List<PlaylistTrack> playlistTracksToRemove) {
		if (!playlistTracksToRemove.isEmpty()) {
			for (List<PlaylistTrack> pts : Lists.partition(playlistTracksToRemove, SketchConst.PLAYLIST_ADD_LIMIT)) {
				JsonArray jsonArray = new JsonArray();
				for (PlaylistTrack pt : pts) {
					if (!pt.getIsLocal()) {
						JsonObject jo = new JsonObject();
						jo.addProperty("uri", pt.getTrack().getUri());
						jsonArray.add(jo);
					}
				}
				SpotifyCall.execute(spotifyApi.removeItemsFromPlaylist(playlistId, jsonArray));
			}
			invalidatePlaylist(playlistId);
		}
	}

	private void invalidatePlaylist(String playlistId) {
		playlistCache.invalidate(playlistId);
	}

	/////////////////////////////////////////////////
	// OTHER

	public String uniquePlaylistIdentifier(Track t) {
		String artist = t.getArtists()[0].getName()
			.toLowerCase()
			.replaceAll("\\s+", "")
			.replaceAll("\\W+", "");
		
		String track = t.getName()
			.toLowerCase()
			.replaceAll(",", " ")
			.replaceAll("bonus track", "")
			.replaceAll("\\d{4}.*", "")
			.replaceAll("remaster.*", "")
			.replaceAll("feat.*", "")
//			.replaceAll("\\(.+\\)", "")
//			.replaceAll("\\-.*", "")
			.replaceAll("\\s+", "")
			.replaceAll("\\W+", "");

		String compound = artist + "_" + track;
		return compound;
	}

	public void printMostCommonArtists(List<PlaylistTrack> playlistTracks) {
		Map<String, List<PlaylistTrack>> byArtist = new HashMap<>();
		for (PlaylistTrack pt : playlistTracks) {
			String artist = ((Track) pt.getTrack()).getArtists()[0].getName();
			if (!byArtist.containsKey(artist)) {
				byArtist.put(artist, new ArrayList<>());
			}
			byArtist.get(artist).add(pt);
		}

		List<List<PlaylistTrack>> pts = new ArrayList<>();
		pts.addAll(byArtist.values());
		Collections.sort(pts, new Comparator<List<PlaylistTrack>>() {
			@Override
			public int compare(List<PlaylistTrack> o1, List<PlaylistTrack> o2) {
				return Integer.valueOf(o2.size()).compareTo(o1.size());
			}
		});

		for (List<PlaylistTrack> lpt : pts) {
			String artist = ((Track) lpt.get(0).getTrack()).getArtists()[0].getName();
			int songs = 0;
			int millis = 0;
			for (PlaylistTrack lptpt : lpt) {
				songs++;
				millis += ((Track) lptpt.getTrack()).getDurationMs();
			}

			int minutes = (int) Math.round(((double) millis) / 1000.0 / 60.0);

			if (minutes > 100 && songs > 2) {
				String f = String.format("%s <%s>: %s min", artist, String.valueOf(songs), String.valueOf(minutes));
				System.out.println(f);
			}

		}
	}
}
