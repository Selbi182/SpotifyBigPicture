# Spotify Big Picture

An interface that displays your current playback status on Spotify in a beautiful little browser page!

You might want to use this over [Spotify's own (in my opinion, rather underwhelming) full-screen mode](https://i.imgur.com/dvreOAX.jpg), or you can use it for your TV/media-streamer to give [that outdated, low-resolution OSD](https://i.imgur.com/lNfCcrW.jpg) a fresh paint job!

## Examples
### Album View
![Deafheaven - Dream House](https://i.imgur.com/O4xEa1V.png)

![Rammstein - Mein Herz brennt](https://i.imgur.com/XJOZgtZ.png)

### Playlist View
![Playlist View](https://i.imgur.com/30nknxN.png)

## Installation
Here's a basic guide on how to set this app up, as a few people have been requesting it. As such, it isn't quite as simple to set up yet, but it isn't terribly difficult either:

1. Download the [current release](https://github.com/Selbi182/SpotifyBigPicture/releases)
2. Create an app on the [Spotify Developers dashboard](https://developer.spotify.com/dashboard) (you might need to create an account first)
3. As redirect URI for the app, use `http://localhost:8183/login-callback`
4. Copy the *Client ID* and *Client Secret* and insert them into the respective fields in the `spotifybot.properties` file
5. Open a terminal and start the app using `java -jar SpotifyBigPicture.jar` (Minimum required version: Java 11)
6. Once prompted to log in, copy-paste the displayed URL into your preferred browser (should look like this `https://accounts.spotify.com:443/authorize?client_id=[...]&response_type=code&redirect_uri=[...]&scope=[...]`) and log in
7. If everything worked out, the app will be available under http://localhost:8183/

## Features
### Displayed Information
* **Main info:** Song name, artist name, album name (with the release year)
* **Time:** Current progress of the song with properly formatted times (works even for 1h+ songs!)
* **States:** Whether something is paused, set to shuffle, or repeat/repeat-once. Also displays the current device name (your PC, your phone, etc.)
* **Context:** The current playlist/album/artist name with a summary of the track count
* **Queue:** Shows the upcoming songs in your playback queue. For albums, it also shows the previous ones

### Color
The background image uses a copy of the album artwork, stretched to fit the screen and blurred in order to avoid clashes with the main image. Furthermore, the most dominant color of the art will be used as additional overlay to increase contrast. It's also used to give the text and icons a different color than white.

This was done using [ColorThief.js](https://lokeshdhakar.com/projects/color-thief).

### Idle Mode
After two hours of playing no music, the interface will turn black and stop rendering anything (other than the optional clock) to save on resources. As soon as music is played again, the interface will automatically return from its idle state as well.

### Visual Preferences
![Visual Preferences](https://i.imgur.com/RIFcQxq.png)

By default, most of the settings are enabled, but you got full control over which features you might want to turn off. Click the cog symbol in the top left of the interface to open the settings for visual preferences.

Explanation of each setting (the letter in the brackets denotes the hotkey):

* **Full Screen (f):** Toggle full-screen mode. You can also double-click anywhere on the screen to achieve the same
* **Queue (q):** If enabled, show the queue of upcoming tracks for playlists and albums. Otherwise, only the current song will be displayed
* **Artwork (a):** If enabled, the album artwork will be displayed on the left-hand side of the interface. Otherwise, hide it center the song info
* **Background Artwork (b):** If enabled, the album artwork will be re-used for the background as a blurry picture. Otherwise, a simple colored gradient background will be used
* **Black Background (k):** If enabled, the background stays permanently black and overrides any other background-related settings
* **Colored Text (c):** If enabled, the texts, progress bar, and icons will be colored in with the most dominant color of the currently playing track's album cover art. Otherwise, plain white will be used for everything
* **Transitions (t):** If enabled, smooth transition animations are shown between song changes. Otherwise, song changes will be displayed immediately. (You might want to disable this setting when the app is run on something like Raspberry Pi, where fancy CSS is often too expensive)
* **Strip Titles (s):** If enabled, all album and track titles will be stripped off anything that could be considered too verbose, such as "Remastered Version" or "Anniversary Edition". Otherwise, keep the titles untouched
* **Grain (g):** If enabled, adds a subtle layer of film grain/noise to the background to increase contrast and prevent color banding for dark images. Otherwise, keep the background as it is. (This feature only works when *Extended Background Rendering* is enabled)
* **Playlist Info (p):** If enabled, displays the playlist name along with its track count and duration at the top right of the page. Otherwise, hide it
* **Timestamps (h):** If enabled, display the current and total timestamps of the currently playing track. Otherwise, only the progress bar is visible
* **Playback Meta Info (m):** If enabled, shows the playback meta info at the bottom left of the page (play, shuffle, repeat, volume, device name). Otherwise, hide it and put the current timestamp there instead
* **Clock (w):** If enabled, displays a clock/watch at the bottom center of the screen, showing the full date and the current time. Otherwise, hide it. (The clock will show even during idle mode)
* **Dark Mode (d):** If enabled, darkens the entire screen by 65%. Otherwise, display everything at normal brightness (This mode will automatically be disabled after 8 hours)

## Troubleshooting
The information is fetched from Spotify's API by polling it once a second. Unfortunately, there is no "proper" way of doing it, as webhooks for song changes (like Discord uses them, for example) are unavailable for the public API.

As a result, the connection might get stuck from time to time. The app will automatically try to reestablish connections when possible, which usually only takes a few seconds. To keep the interface appearance as smooth as possible though, _the timer will simulate playback by keep counting up seconds on its own_ if a song is currently playing.

However, if the interface becomes completely unresponsive, try one of these approaches:

1. First and foremost, this app has been optimized for **Firefox**! It may work to some degree on Chrome and the likes, but I won't guarantee full stability over there

2. Getting your current queue is only available for Spotify premium users. For anyone else, more than a good guess by this interface is unfortunately not possible

3. Change the current playback context (e.g. changing from a playlist to an album)

4. For whatever bizarre reason, simply clicking on the devices button in Spotify (not even selecting any different device, literally just opening the dropdown) sometimes forces the interface to catch up. This has been my go-to for fixing stuck screens, and it works surprisingly well:

![dropdown](https://user-images.githubusercontent.com/8850085/206453960-12d34f5e-03c0-41a0-aba1-7c214de4e53e.png)

4. Open the web console (F12) and take a look at the console out tab. There, you should hopefully find more helpful information about what's going on. The occasional "heartbeat timeout" is nothing to worry about, but if the console is just getting spammed with errors, something's definitely preventing a stable connection.

5. As a last resort, you can open the page with `polling=true` to true in the URL parameter. This will entirely bypass the Spring WebFlux service used to communicate between the Java application and the web interface. Instead, the web interface will simply fire a request to the Java app once every 1000 milliseconds. While this is incredibly wasteful, it tends to be more robust for many applications.

If all else fails, [write an issue ticket on GitHub](https://github.com/Selbi182/SpotifyBigPicture/issues) and I will take a look at it :)
