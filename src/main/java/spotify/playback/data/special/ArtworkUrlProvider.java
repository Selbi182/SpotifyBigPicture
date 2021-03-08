package spotify.playback.data.special;

import java.io.IOException;
import java.util.concurrent.ExecutionException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.wrapper.spotify.model_objects.specification.Image;
import com.wrapper.spotify.model_objects.specification.Track;

@Component
public class ArtworkUrlProvider {

	private LoadingCache<ComparableTrack, String> artworkUrlCache;

	public ArtworkUrlProvider() {
		this.artworkUrlCache = CacheBuilder.newBuilder()
			.build(new CacheLoader<ComparableTrack, String>() {
				@Override
				public String load(ComparableTrack track) throws IOException {
					String spotifyImage = getDefaultSpotifyImage(track.getTrack());
					if (spotifyImage != null) {
						return spotifyImage;
					}

					String discogsImage = getArtworkFromDiscogs(track.getTrack());
					if (discogsImage != null) {
						return discogsImage;
					}

					return "";
				}
			});
	}

	public String findArtworkUrl(Track track) {
		try {
			ComparableTrack comparableTrack = new ComparableTrack(track);
			return artworkUrlCache.get(comparableTrack);
		} catch (ExecutionException e) {
			e.printStackTrace();
			return null;
		}
	}

	private String getDefaultSpotifyImage(Track track) {
		return findLargestImage(track.getAlbum().getImages());
	}

	private String findLargestImage(Image[] images) {
		Image largest = null;
		for (Image img : images) {
			if (largest == null || (img.getWidth() * img.getHeight()) > (largest.getWidth() * largest.getHeight())) {
				largest = img;
			}
		}
		return largest != null ? largest.getUrl() : null;
	}

	private String getArtworkFromDiscogs(Track track) throws IOException {
		// Find image library ID
		String query = (track.getArtists()[0].getName() + "+" + track.getAlbum().getName()).replace(" ", "+").toLowerCase();
		Document connection = Jsoup.connect("https://www.discogs.com/de/search/?layout=big&type=all&q=" + query).get();
		Elements select = connection.select("#search_results > .card:first-child img");
		if (!select.isEmpty()) {
			String href = select.attr("data-src");
			Matcher matcher = Pattern.compile("R-(\\d+)").matcher(href);
			boolean find = matcher.find();
			if (find) {
				String imageLibraryId = matcher.group(1);

				// Get first image from overview
				Document connection2 = Jsoup.connect("https://www.discogs.com/de/release/" + imageLibraryId + "/images").get();
				Elements select2 = connection2.select("#view_images img");
				if (!select2.isEmpty()) {
					return select2.first().attr("src");
				}
			}
		}
		return null;
	}

	private class ComparableTrack implements Comparable<Track> {
		private final Track track;

		private ComparableTrack(Track track) {
			this.track = track;
		}

		@Override
		public int compareTo(Track o) {
			return getTrack().getId().compareTo(o.getId());
		}

		@Override
		public int hashCode() {
			final int prime = 31;
			int result = 1;
			result = prime * result + ((track == null) ? 0 : track.getUri().hashCode());
			return result;
		}

		@Override
		public boolean equals(Object obj) {
			String id = null;
			if (obj instanceof Track) {
				id = ((Track) obj).getUri();
			} else if (obj instanceof ComparableTrack) {
				id = ((ComparableTrack) obj).getTrack().getUri();
			}
			return this.getTrack().getUri().equals(id);
		}

		public Track getTrack() {
			return track;
		}
	}
}
