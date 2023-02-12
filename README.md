# Spotify Big Picture

An interface that displays your current playback status on Spotify in a beautiful little browser page!

You might want to use this over [Spotify's own (in my opinion, rather underwhelming) full-screen mode](https://i.imgur.com/dvreOAX.jpg), or you can use it for your TV/media-streamer to give [that outdated, low-resolution OSD](https://i.imgur.com/lNfCcrW.jpg) a fresh paint job!

## Examples
*Note: Due to the progressive development nature of this app, the screenshots may be slightly out of date at any time. The general layout is pretty much written in stone though.*

### Album View
![Deafheaven - Dream House](https://i.imgur.com/FEi7Z1N.png)

### Playlist View
![Playlist View](https://i.imgur.com/HsrgpeQ.png)

### Vertical Mode (with disabled background artwork)
![Vertical Mode](https://i.imgur.com/l5MUo6I.png)

## Installation
Here's a basic guide on how to set this app up, as a few people have been requesting it. As such, it isn't quite as simple to set up yet, but it isn't terribly difficult either:

1. Download the [current release](https://github.com/Selbi182/SpotifyBigPicture/releases)
2. Create an app on the [Spotify Developers dashboard](https://developer.spotify.com/dashboard) (you might need to create an account first)
3. As redirect URI for the app, use `http://localhost:8183/login-callback`
4. Copy the *Client ID* and *Client Secret* and insert them into the respective fields in the `spotifybot.properties` file
5. Open a terminal and start the app using `java -jar SpotifyBigPicture.jar` (Minimum required version: Java 11)
6. Once prompted to log in, copy-paste the displayed URL into your preferred browser (should look like this `https://accounts.spotify.com:443/authorize?client_id=[...]&response_type=code&redirect_uri=[...]&scope=[...]`) and log in
7. If everything worked out, the app will be available under http://localhost:8183/

## Usage and Features
### General Idea
This interface is entirely read-only. Specifically, this means that you **cannot actually control your music**. Instead, the idea is to set this app up once, and then it permanently runs as a pure information display.

An example where this is useful would be hosting a party where you want to let your guests see at any time which songs are up ahead, by putting a monitor near to the dance floor that you connect to a Raspberry Pi.

### Visual Preferences
![Visual Preferences](https://i.imgur.com/INoK3jS.png)

Click the cog symbol in the top left of the interface to open the settings for visual preferences. By default, most of the settings are enabled, but you got full control over which features you might want to turn off. A detailed explanation for each option appears when you hover over the individual settings.

### Idle Mode
After two hours of playing no music, the interface will turn black and stop rendering anything (other than the optional clock) to save on resources. As soon as music is played again, the interface will automatically return from its idle state as well.

### Color
The background image uses a copy of the album artwork, stretched to fit the screen and blurred in order to avoid clashes with the main image. Furthermore, the most dominant color of the art will be used as additional overlay to increase contrast. It's also used to give the text and icons a different color than white.

This was done using [ColorThief.js](https://lokeshdhakar.com/projects/color-thief).

## Troubleshooting
First and foremost:

1. This app has been optimized for **Firefox**! It may work to some degree on Chrome and the likes, but I won't guarantee full stability over there

2. Getting your current queue is **only** available for Spotify premium users. For free users, only the current song can be displayed. For albums, more than a good guess whichever song comes next is unfortunately not possible

### Interface doesn't update?

The information is fetched from Spotify's API by polling it once a second. Unfortunately, there is no "proper" way of doing it, as webhooks for song changes (like Discord uses them, for example) are unavailable for the public API.

As a result, the connection might get stuck from time to time. The app will automatically try to reestablish connections when possible, which usually only takes a few seconds. To keep the interface appearance as smooth as possible though, _the timer will simulate playback by keep counting up seconds on its own_ if a song is currently playing.

However, if the interface becomes completely unresponsive, try these approaches:

1. Change the current playback context (e.g. changing from a playlist to an album)

2. For whatever bizarre reason, simply clicking on the devices button in Spotify on your PC (not even selecting any different device, literally just opening the dropdown) sometimes forces the interface to catch up. This has been my go-to for fixing stuck screens, and it works surprisingly well:

![dropdown](https://user-images.githubusercontent.com/8850085/206453960-12d34f5e-03c0-41a0-aba1-7c214de4e53e.png)

3. Open the web console (F12) and take a look at the console out tab. There, you should hopefully find more helpful information about what's going on. The occasional "heartbeat timeout" is nothing to worry about, but if the console is just getting spammed with errors, something's definitely preventing a stable connection.

4. As a last resort, you can open the page with `polling=true` in the URL parameter. This will entirely bypass the Spring WebFlux service used to communicate between the Java application and the web interface. Instead, the web interface will simply fire a request to the Java app once every per second. While this is incredibly wasteful and spams your bandwidth with pointless requests, it tends to be more robust for many applications.

If all else fails, [write an issue ticket on GitHub](https://github.com/Selbi182/SpotifyBigPicture/issues) and I will gladly take a look at it :)
