package spotify.sketchpads.pads;

import java.util.Comparator;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.wrapper.spotify.model_objects.specification.PlaylistTrack;
import com.wrapper.spotify.model_objects.specification.Track;

import spotify.bot.util.BotUtils;
import spotify.sketchpads.Sketchpad;
import spotify.sketchpads.util.SketchCommons;
import spotify.sketchpads.util.SketchConst;

@Component
public class PrintEuphonicMessPopularSongs implements Sketchpad {

	@Autowired
	private SketchCommons utils;

	@Override
	public RuntimeState runtimeState() {
		return RuntimeState.DISABLED;
	}

	@Override
	public boolean sketch() throws Exception {
		List<PlaylistTrack> euphonicMessPlaylistTracks = utils.getPlaylistTracks(SketchConst.THE_EUPHONIC_MESS);

		Comparator<Track> comparator = Comparator
			.comparing(Track::getPopularity)
			.reversed()
			.thenComparing(Track::getName);

		euphonicMessPlaylistTracks.stream()
			.map(PlaylistTrack::getTrack)
			.sorted(comparator)
			.map(track -> String.format("[%03d] %s", track.getPopularity(), BotUtils.formatTrack(track)))
			.forEach(System.out::println);

		return true;
	}

}
