# SpotifyBigPicture
A highly customizable interface that displays your current playback status on Spotify in a beautiful little browser page!

Proudly utilizes the [Spotify Web API Java Wrapper](https://github.com/thelinmichael/spotify-web-api-java).

## What is this for?

You might want to use this over [Spotify's own full-screen mode](https://i.imgur.com/eIIRnrV.png) which is (in my opinion) rather underwhelming, or you can use it for your TV to give [that outdated, low-resolution OSD of your AVR](https://i.imgur.com/lNfCcrW.jpg) a fresh coat of paint!

This interface is primarily read-only. Specifically, this means that you **cannot actually control your music**, beyond a few basic commands like play, pause, and skip ([which needs to be enabled in the settings first](https://github.com/Selbi182/SpotifyBigPicture/blob/master/SETTINGS.md#enable-playback-controls)). This is both because of limitations to the Spotify API, and also because the idea of this app is to set it up once and then let it permanently run as a pure information display.

An example use case would be at a party, where guests can see at any time which songs are up ahead, by putting a monitor near the dance floor that you connect to a Raspberry Pi.

## Screenshots
These two examples only show examples of SpotifyBigPicture's default preset. For more screenshots, [see the other presets](https://github.com/Selbi182/SpotifyBigPicture/blob/master/PRESETS.md)!

### Album View
![Deafheaven - Dream House](https://i.imgur.com/h84xCiV.png)

### Playlist View
![Playlist View](https://i.imgur.com/mXwsDCP.png)

### Customization
Click the gear symbol in the top left of the interface to open the settings for Visual Preferences. Here you can customize the styling of the interface from a number of options with just a few clicks!

Your settings are automatically stored locally, so you won't need to worry about reconfiguring everything each time you reopen the website.

* A full list of every preset can be found here: [PRESETS.md](https://github.com/Selbi182/SpotifyBigPicture/blob/master/PRESETS.md)
* General information about the settings can be found here: [SETTINGS.md](https://github.com/Selbi182/SpotifyBigPicture/blob/master/SETTINGS.md)

## Installation
[If you prefer a (slightly outdated) video tutorial, [click here](https://www.youtube.com/watch?v=NyJoiEh_qhQ)]

### Step 1: Create Spotify App
1. Create an app on the [Spotify Developers dashboard](https://developer.spotify.com/dashboard) (you might need to create an account first)
2. Copy the *Client ID* and *Client Secret* and save them for later
3. Go to "Users and Access" and add your account there (name and email address)

From here on you can choose between one of two ways to continue with the installation.

### Step 2 - Variant A: Manual Java installation
1. After creating the Spotify app, click on "Edit Settings" and add the redirect URI for this app: `http://127.0.0.1:8183/callback` (make sure you click the little green "Add" button before saving!) [Note: As of April 2025, `localhost` is no longer allowed and must always be `127.0.0.1` instead](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
2. Download the [current release](https://github.com/Selbi182/SpotifyBigPicture/releases)
3. Paste the *Client ID* and *Client Secret* you've saved earlier into the respective fields in the `spotifybot.properties` file
4. Run `Launch_SpotifyBigPicture.bat` to start the app. Alternatively, open a terminal in the same folder as the JAR file (just hold Shift and right-click, then select "Open terminal here") and type in `java -jar SpotifyBigPicture.jar`

### Step 2 - Variant B: Pull Docker Image
1. After creating the Spotify app, click on "Edit Settings" and add the redirect URI for this app. Depending on where you plan to run the app, you must provide a URI that's reachable from the outside. For example `https://ip-of-docker-machine:8183/callback`. The redirect URI *must* end with `/callback`, and [as of April 2025 it must also be `https`](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)! Also make sure you click the little green "Add" button before saving
2. Pull the Docker image: `docker pull ghcr.io/selbi182/spotifybigpicture`
3. Run the Docker image. Insert the *Client ID*, *Client Secret*, and *Redirect URI* you have specified earlier into the respective fields, to pass them as environment variables: `docker run --name spotifybigpicture -d -p 8183:8183 -e client_id=CLIENTID -e client_secret=CLIENTSECRET -e redirect_uri=REDIRECTURI ghcr.io/selbi182/spotifybigpicture`
4. Then run `docker logs -f spotifybigpicture` so you can see the URL required for the next step

### Step 3: Login
1. You will be prompted to log in. The app will attempt to open the browser by itself, but if it fails, take a look at the console output and copy-paste the displayed URL into your browser manually. It should look like this: `https://accounts.spotify.com:443/authorize?client_id=[...]&response_type=code&redirect_uri=[...]&scope=[...]`
2. If everything worked out, you're done! If you've chosen variant A, the app will be available under http://127.0.0.1:8183/ and if you chose variant B, it's going to be whatever server you've provided

## Requirements
* **Java 11 or newer:**
  * [Download here](https://adoptium.net/de/temurin/releases/?version=11) (obviously only required if you're doing the manual java installation) 
* **Monitor should have 16:9 aspect ratio:**
  * [While there is a preset specifically optimized for portrait mode](https://github.com/Selbi182/SpotifyBigPicture/blob/master/PRESETS.md#vertical-mode), this app has been optimized primarily for landscape mode. Any aspect ratio should theoretically work, but 16:9 is the only aspect ratio that is 100% supported and tested
* **A modern browser:**
  * There are a lot of fancy bells and whistles attached to this app that simply won't work on older browsers. I primarily developed and optimized it for Mozilla Firefox, but it also works on Google Chrome. Not tested on any other browsers, so I won't guarantee full stability over there
* **Spotify Premium:**
  * You can still use this app as a free user, but you won't get the full functionality. For example, getting your current queue is **only** available for Spotify premium users. For free users, only the current song can be displayed. For albums, more than a good guess of whichever song comes next is unfortunately not possible

### Interface doesn't update?
The information is fetched from Spotify's API by polling it once a second. Unfortunately, there is no "proper" way of doing it, as webhooks for song changes (like Discord uses them, for example) are unavailable for the public API.

As a result, the connection might get stuck from time to time. The app will automatically try to reestablish connections when possible, which usually only takes a few seconds. To keep the interface appearance as smooth as possible though, _the timer will simulate playback by keep counting up seconds on its own_ if a song is currently playing.

However, if the interface becomes completely unresponsive, try these approaches:

1. Change the current playback context (e.g. changing from a playlist to an album)

2. For whatever bizarre reason, simply clicking on the devices button in Spotify on your PC (not even selecting any different device, literally just opening the dropdown) sometimes forces the interface to catch up. This has been my go-to for fixing stuck screens, and it works surprisingly well:

![dropdown](https://user-images.githubusercontent.com/8850085/206453960-12d34f5e-03c0-41a0-aba1-7c214de4e53e.png)

## Support
If you got any problems, [write an issue ticket on GitHub](https://github.com/Selbi182/SpotifyBigPicture/issues) and I will gladly take a look at it :)

Alternatively, I'm always happy to help over on Discord! My username is: **selbi** (Please leave a message request if you do so, as I don't accept random, unexplained invites anymore.)

## Donate
If you'd like to support my work and feel like leaving a tip, check out [my Ko-fi page](https://ko-fi.com/selbi)!
