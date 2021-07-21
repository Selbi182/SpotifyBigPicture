package spotify.playback.data.visual.artwork.service;

import java.util.Map;
import java.util.Optional;

import com.google.common.annotations.Beta;
import com.wrapper.spotify.model_objects.IPlaylistItem;

/**
 * This was thrown together in a few minutes because Discogs suddenly decided to
 * Ccompletely die for local files. Will need to find a better solution in the
 * long rung.
 */
@Beta
public class DictionaryArtworkUrlProvider {
	private static Map<String, String> URLS = Map.ofEntries(
		Map.entry("spotify:local:Yhdarl:%C3%98:%C3%98:2400", "https://f4.bcbits.com/img/a1003975092_10.jpg"),
		Map.entry("spotify:local:Crimson+Shadows:Glory+on+the+Battlefield:Lost+in+a+Dark+Forest:382", "https://i.imgur.com/TwhnDXy.png"),
		Map.entry("spotify:local:DragonForce:Inhuman+Rampage:Lost+Souls+In+Endless+Time:381", "https://images-na.ssl-images-amazon.com/images/I/81vhNC4oZNL._SL1425_.jpg"),
		Map.entry("spotify:local:DragonForce:Ultra+Beatdown:E.P.M.:444", "https://blob.cede.ch/catalog/100836000/100836934_1_92.jpg?v=1"),
		Map.entry("spotify:local:Manowar:The+Dawn+Of+Battle:The+Dawn+Of+Battle:404", "https://is2-ssl.mzstatic.com/image/thumb/Music1/v4/27/fe/22/27fe2222-f4b4-d912-c0c3-032a1b2a0bbf/iTunes_MW_TDOB_Cover_Art.jpg/1200x1200bf-60.jpg"),
		Map.entry("spotify:local:Manowar:Warriors+Of+The+World:Swords+In+The+Wind:320", "https://steamuserimages-a.akamaihd.net/ugc/960857516894251734/49040CDDB67718B571E38B022F4C1FC8C47E7AEF/"),
		Map.entry("spotify:local:Manowar:Warriors+Of+The+World:Warriors+Of+The+World+United:351", "https://steamuserimages-a.akamaihd.net/ugc/960857516894251734/49040CDDB67718B571E38B022F4C1FC8C47E7AEF/"),
		Map.entry("spotify:local:Manowar:Warriors+Of+The+World:House+Of+Death:265", "https://steamuserimages-a.akamaihd.net/ugc/960857516894251734/49040CDDB67718B571E38B022F4C1FC8C47E7AEF/"),
		Map.entry("spotify:local:Manowar:Warriors+Of+The+World:Fight+Until+We+Die:243", "https://steamuserimages-a.akamaihd.net/ugc/960857516894251734/49040CDDB67718B571E38B022F4C1FC8C47E7AEF/"),
		Map.entry("spotify:local:Efence:Lost+Future:Cassette:230", "https://f4.bcbits.com/img/a0533575606_10.jpg"),
		Map.entry("spotify:local:Yhdarl:Ave+Maria:Ave+Maria:3007", "https://i.imgur.com/x06NWEZ.png"),
		Map.entry("spotify:local:Yhdarl:Ave+Maria:The+Last+...:871", "https://i.imgur.com/x06NWEZ.png"),
		Map.entry("spotify:local:Mesarthim:Vacuum+Solution+%28E.P.%29:Vacuum+Solution:468", "https://f4.bcbits.com/img/a3054134247_10.jpg"),
		Map.entry("spotify:local:Mesarthim:CLG+J02182%E2%80%9305102:Infinite+Density:255", "https://f4.bcbits.com/img/a3404054915_10.jpg")
	);

	public static Optional<String> getUrlFromList(IPlaylistItem item) {
		return Optional.ofNullable(URLS.get(item.getUri()));
	}

}
