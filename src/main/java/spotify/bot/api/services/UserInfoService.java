package spotify.bot.api.services;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.wrapper.spotify.SpotifyApi;
import com.wrapper.spotify.enums.ModelObjectType;
import com.wrapper.spotify.model_objects.specification.Artist;

import spotify.bot.api.SpotifyCall;
import spotify.bot.util.BotLogger;
import spotify.bot.util.BotUtils;

@Service
public class UserInfoService {

	private final static int MAX_FOLLOWED_ARTIST_FETCH_LIMIT = 50;

	@Autowired
	private SpotifyApi spotifyApi;

	@Autowired
	private BotLogger log;

	/**
	 * Get all the user's followed artists
	 * 
	 * @return
	 */
	public List<String> getFollowedArtistsIds() {
		List<Artist> followedArtists = SpotifyCall.executePaging(spotifyApi
			.getUsersFollowedArtists(ModelObjectType.ARTIST)
			.limit(MAX_FOLLOWED_ARTIST_FETCH_LIMIT));
		List<String> followedArtistIds = followedArtists.stream().map(Artist::getId).collect(Collectors.toList());
		BotUtils.removeNullStrings(followedArtistIds);
		if (followedArtistIds.isEmpty()) {
			log.warning("No followed artists found!");
		}
		return followedArtistIds;
	}
}
