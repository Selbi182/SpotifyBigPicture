package spotify.bot.api.services;

import java.io.IOException;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.StringJoiner;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.wrapper.spotify.SpotifyApi;
import com.wrapper.spotify.enums.AlbumGroup;
import com.wrapper.spotify.model_objects.specification.AlbumSimplified;

import spotify.bot.api.BotException;
import spotify.bot.api.SpotifyCall;
import spotify.bot.config.Config;

@Service
public class AlbumService {

	private final static int MAX_ALBUM_FETCH_LIMIT = 50;

	@Autowired
	private Config config;

	@Autowired
	private SpotifyApi spotifyApi;

	/**
	 * Fetch all albums of the given artists
	 * 
	 * @param followedArtists
	 * @param albumGroups
	 * @return
	 * @throws IOException 
	 * @throws SQLException 
	 */
	public List<AlbumSimplified> getAllAlbumsOfArtists(List<String> followedArtists) throws SQLException, IOException {
		Collection<AlbumGroup> enabledAlbumGroups = Arrays.asList(AlbumGroup.values());
		List<AlbumSimplified> allAlbums = getAlbumsOfArtists(followedArtists, enabledAlbumGroups);
		return allAlbums;
	}

	/**
	 * Get all album IDs of the given list of artists, mapped into album group
	 * 
	 * @param artists
	 * @return
	 * @throws IOException 
	 * @throws SQLException 
	 */
	private List<AlbumSimplified> getAlbumsOfArtists(List<String> artists, Collection<AlbumGroup> enabledAlbumGroups) throws SQLException, IOException {
		String albumGroupString = createAlbumGroupString(enabledAlbumGroups);
		List<AlbumSimplified> albums = new ArrayList<>();
		for (String a : artists) {
			List<AlbumSimplified> albumsOfCurrentArtist = getAlbumIdsOfSingleArtist(a, albumGroupString);
			albums.addAll(albumsOfCurrentArtist);
		}
		return albums;
	}

	/**
	 * Creates the comma-delimited, lowercase String of album groups to search for
	 * 
	 * @param enabledAlbumGroups
	 * @return
	 */
	private String createAlbumGroupString(Collection<AlbumGroup> enabledAlbumGroups) {
		StringJoiner albumGroupsAsString = new StringJoiner(",");
		for (AlbumGroup ag : enabledAlbumGroups) {
			albumGroupsAsString.add(ag.getGroup());
		}
		return albumGroupsAsString.toString();
	}

	/**
	 * Return the albums of a single given artist
	 * 
	 * @param artistId
	 * @param albumGroup
	 * @return
	 * @throws IOException
	 * @throws SQLException
	 * @throws BotException
	 */
	private List<AlbumSimplified> getAlbumIdsOfSingleArtist(String artistId, String albumGroups) throws SQLException, IOException {
		List<AlbumSimplified> albumsOfCurrentArtist = SpotifyCall.executePaging(spotifyApi
			.getArtistsAlbums(artistId)
			.market(config.spotifyBotConfig().getMarket())
			.limit(MAX_ALBUM_FETCH_LIMIT)
			.album_type(albumGroups));
		return albumsOfCurrentArtist;
	}
}
