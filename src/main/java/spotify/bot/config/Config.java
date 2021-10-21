package spotify.bot.config;

import com.neovisionaries.i18n.CountryCode;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.IOException;
import java.util.Properties;

@Configuration
public class Config {

    private static final String MARKET = "market";
    private static final String REFRESH_TOKEN = "refresh_token";
    private static final String ACCESS_TOKEN = "access_token";
    private static final String CLIENT_SECRET = "client_secret";
    private static final String CLIENT_ID = "client_id";

    private static final String PROPERTIES_FILE = "./spotifybot.properties";

    private SpotifyBotConfig spotifyApiConfig;

    /**
     * Sets up or refreshes the configuration for the Spotify bot from the settings
     */
    @PostConstruct
    private void init() {
        this.spotifyApiConfig = spotifyBotConfig();
    }

    /**
     * Update the access and refresh tokens, both in the config object and
     * the settings
     *
     * @param accessToken  the new access token
     * @param refreshToken the new refresh token
     * @throws IOException on read/write failure
     */
    public void updateTokens(String accessToken, String refreshToken) throws IOException {
        spotifyApiConfig.setAccessToken(accessToken);
        spotifyApiConfig.setRefreshToken(refreshToken);

        spotifyApiProperties().setProperty(ACCESS_TOKEN, accessToken);
        spotifyApiProperties().setProperty(REFRESH_TOKEN, refreshToken);
        spotifyApiProperties().store(new FileOutputStream(PROPERTIES_FILE), null);
    }

    ////////////////////
    // CONFIG DTOs

    @Bean
    public Properties spotifyApiProperties() {
        try {
            FileReader reader = new FileReader(PROPERTIES_FILE);
            Properties properties = new Properties();
            properties.load(reader);
            return properties;
        } catch (IOException e) {
            e.printStackTrace();
            System.out.println("Failed to read " + PROPERTIES_FILE + ". Exiting!");
            System.exit(1);
            return null;
        }
    }

    /**
     * Returns the bot configuration. May be created if not present.
     *
     * @return the bot config
     */
    @Bean
    public SpotifyBotConfig spotifyBotConfig() {
        Properties properties = spotifyApiProperties();

        SpotifyBotConfig config = new SpotifyBotConfig();
        config.setClientId(properties.getProperty(CLIENT_ID));
        config.setClientSecret(properties.getProperty(CLIENT_SECRET));
        config.setAccessToken(properties.getProperty(ACCESS_TOKEN));
        config.setRefreshToken(properties.getProperty(REFRESH_TOKEN));
        config.setMarket(CountryCode.valueOf(properties.getProperty(MARKET)));

        return config;
    }

    public static class SpotifyBotConfig {
        private String clientId;
        private String clientSecret;
        private String accessToken;
        private String refreshToken;
        private CountryCode market;

        public String getClientId() {
            return clientId;
        }

        public void setClientId(String clientId) {
            this.clientId = clientId;
        }

        public String getClientSecret() {
            return clientSecret;
        }

        public void setClientSecret(String clientSecret) {
            this.clientSecret = clientSecret;
        }

        public String getAccessToken() {
            return accessToken;
        }

        public void setAccessToken(String accessToken) {
            this.accessToken = accessToken;
        }

        public String getRefreshToken() {
            return refreshToken;
        }

        public void setRefreshToken(String refreshToken) {
            this.refreshToken = refreshToken;
        }

        public CountryCode getMarket() {
            return market;
        }

        public void setMarket(CountryCode market) {
            this.market = market;
        }

        @Override
        public String toString() {
            return "SpotifyBotConfig [clientId=" + clientId + ", clientSecret=" + clientSecret + ", accessToken=" + accessToken + ", refreshToken=" + refreshToken + ", market=" + market + "]";
        }

    }
}