package spotify.sketchpads.pads.info;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.wrapper.spotify.model_objects.specification.PlaylistTrack;
import com.wrapper.spotify.model_objects.specification.Track;

import spotify.sketchpads.Sketchpad;
import spotify.sketchpads.util.SketchCommons;
import spotify.sketchpads.util.SketchConst;

@Component
public class PrintEuphonicMessSongDurations implements Sketchpad {

	@Autowired
	private SketchCommons utils;

	@Override
	public RuntimeState runtimeState() {
		return RuntimeState.DISABLED;
	}

	@Override
	public boolean sketch() throws Exception {
		List<PlaylistTrack> euphonicMessPlaylistTracks = utils.getPlaylistTracks(SketchConst.THE_EUPHONIC_MESS);

		euphonicMessPlaylistTracks.stream()
			.map(PlaylistTrack::getTrack)
			.map(Track.class::cast)
			.map(Track::getDurationMs)
			.sorted()
			.map(ms -> Math.round(((ms / 1000.0) / 60.0) * 100.0) / 100.0)
//			.map(m -> String.format("%02d:%02d",
//				(int) m.doubleValue(),
//				Math.round(((m % 1.0) * 0.6) * 100.0)))
			.forEach(System.out::println);

		return true;
	}

}
