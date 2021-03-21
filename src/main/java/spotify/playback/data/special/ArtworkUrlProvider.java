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
import com.wrapper.spotify.model_objects.IPlaylistItem;
import com.wrapper.spotify.model_objects.specification.Episode;
import com.wrapper.spotify.model_objects.specification.Image;
import com.wrapper.spotify.model_objects.specification.Track;

@Component
public class ArtworkUrlProvider {

	private LoadingCache<ComparablePlaybackItem, String> artworkUrlCache;

	public ArtworkUrlProvider() {
		this.artworkUrlCache = CacheBuilder.newBuilder()
			.build(new CacheLoader<ComparablePlaybackItem, String>() {
				@Override
				public String load(ComparablePlaybackItem item) throws IOException {
					String spotifyImage = getDefaultSpotifyImage(item.getItem());
					if (spotifyImage != null) {
						return spotifyImage;
					}

					if (item.getItem() instanceof Track) { // Podcasts cannot be local files
						String discogsImage = getArtworkFromDiscogs((Track) item.getItem());
						if (discogsImage != null) {
							return discogsImage;
						}
					}

					return "";
				}
			});
	}

	public String findArtworkUrl(IPlaylistItem track) {
		try {
			ComparablePlaybackItem comparableTrack = new ComparablePlaybackItem(track);
			return artworkUrlCache.get(comparableTrack);
		} catch (ExecutionException e) {
			e.printStackTrace();
			return null;
		}
	}

	private String getDefaultSpotifyImage(IPlaylistItem track) {
		Image[] images = null;
		if (track instanceof Track) {
			images = ((Track) track).getAlbum().getImages();
		} else if (track instanceof Episode) {
			images = ((Episode) track).getShow().getImages();
		}
		return findLargestImage(images);
	}

	private String findLargestImage(Image[] images) {
		if (images != null) {
			Image largest = null;
			for (Image img : images) {
				if (largest == null || (img.getWidth() * img.getHeight()) > (largest.getWidth() * largest.getHeight())) {
					largest = img;
				}
			}
			return largest != null ? largest.getUrl() : null;
		}
		return null;
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

	private class ComparablePlaybackItem implements Comparable<IPlaylistItem> {
		private final IPlaylistItem item;

		private ComparablePlaybackItem(IPlaylistItem item) {
			this.item = item;
		}

		@Override
		public int compareTo(IPlaylistItem o) {
			return getItem().getId().compareTo(o.getId());
		}

		@Override
		public int hashCode() {
			final int prime = 31;
			int result = 1;
			result = prime * result + ((item == null) ? 0 : item.getUri().hashCode());
			return result;
		}

		@Override
		public boolean equals(Object obj) {
			String id = null;
			if (obj instanceof Track) {
				id = ((Track) obj).getUri();
			} else if (obj instanceof Episode) {
				id = ((Episode) obj).getUri();
			} else if (obj instanceof ComparablePlaybackItem) {
				id = ((ComparablePlaybackItem) obj).getItem().getUri();
			}
			return this.getItem().getUri().equals(id);
		}

		public IPlaylistItem getItem() {
			return item;
		}
	}
}
