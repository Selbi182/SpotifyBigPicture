package spotify.sketchpads.pads.info;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Iterables;
import com.wrapper.spotify.SpotifyApi;
import com.wrapper.spotify.model_objects.specification.Album;
import com.wrapper.spotify.model_objects.specification.PlaylistTrack;
import com.wrapper.spotify.model_objects.specification.Track;
import com.wrapper.spotify.model_objects.specification.TrackSimplified;

import spotify.bot.api.SpotifyCall;
import spotify.bot.util.BotUtils;
import spotify.sketchpads.Sketchpad;
import spotify.sketchpads.util.SketchCommons;
import spotify.sketchpads.util.SketchConst;

@Component
public class PrintEuphonicMessOpeners implements Sketchpad {

	@Autowired
	private SketchCommons utils;

	@Autowired
	private SpotifyApi spotifyApi;

	@Override
	public RuntimeState runtimeState() {
		return RuntimeState.DISABLED;
	}

	@Override
	public boolean sketch() throws Exception {
		List<PlaylistTrack> euphonicMessPlaylistTracks = utils.getPlaylistTracks(SketchConst.THE_EUPHONIC_MESS);

		ImmutableSet.Builder<String> albumIds = ImmutableSet.builder();
		for (PlaylistTrack pt : euphonicMessPlaylistTracks) {
			String id = ((Track) pt.getTrack()).getAlbum().getId();
			if (id != null) {
				albumIds.add(id);
			}
		}

		List<Album> allAlbums = new ArrayList<>();
		for (List<String> partition : Iterables.partition(albumIds.build(), 20)) {
			Album[] execute = SpotifyCall.execute(spotifyApi.getSeveralAlbums(partition.toArray(String[]::new)));
			allAlbums.addAll(Arrays.asList(execute));
		}

		Map<String, List<TrackSimplified>> trackIdToAlbum = new HashMap<>();
		for (Album a : allAlbums) {
			List<TrackSimplified> tracks = SpotifyCall.executePaging(spotifyApi.getAlbumsTracks(a.getId()));
			for (TrackSimplified ts : tracks) {
				trackIdToAlbum.put(ts.getId(), tracks);
			}
		}

		print(euphonicMessPlaylistTracks, trackIdToAlbum);
		return true;
	}

	private void print(List<PlaylistTrack> euphonicMessPlaylistTracks, Map<String, List<TrackSimplified>> trackIdToAlbum) {
		List<Track> collect = euphonicMessPlaylistTracks.stream()
			.map(PlaylistTrack::getTrack)
			.map(Track.class::cast)
			.collect(Collectors.toList());
		for (Track t : collect) {
			List<TrackSimplified> list = trackIdToAlbum.get(t.getId());
			if (list != null) {
				for (TrackSimplified ts : list) {
					if (ts.getId().equals(t.getId())) {
						System.out.println(String.format("[%02d] %s", t.getTrackNumber(), BotUtils.formatTrack(t)));
						break;
					}
				}
			}
		}
		System.out.println("bruh");

	}

}
