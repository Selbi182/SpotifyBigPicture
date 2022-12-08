# Spotify Big Picture

An interface that displays your current playback status on Spotify in a beautiful little browser page!

You might want to use this over [Spotify's own (in my opinion, rather underwhelming) full-screen mode](https://i.imgur.com/dvreOAX.jpg), or you can use it for your TV/media-streamer to give [that outdated, low-resolution OSD](https://i.imgur.com/lNfCcrW.jpg) a fresh paint job!

## Examples

### Single Song
![Deafheaven - Dream House](https://i.imgur.com/OBO0GiM.png)

### Album View
![Rammstein - Mein Herz brennt](https://i.imgur.com/13cd9oF.png)

### Playlist View
![Playlist View](https://i.imgur.com/TI5ZFyh.png)

## Installation

Here's a basic guide on how to set this app up, as a few people have been requesting it. As such, it isn't quite as simple to set up yet, but it isn't terribly difficult either. Here's the basic approach:

0. Download the [current release](https://github.com/Selbi182/SpotifyBigPicture/releases) (Try the `thin` version first. If that one causes issues, use the `fat` version.)
1. Create an app on the Spotify Developers site (you might need to create an account first): https://developer.spotify.com/dashboard/
2. As redirect URI for the app, use `http://localhost:8183/login-callback`
3. Grab the Client ID and Client Secret and insert them in the respective fields in the `spotifybot.properties` file
4. Open a terminal and start the app using `java -jar SpotifyBigPicture.jar`
5. Once prompted to log in, copy-paste the displayed URL into your browser (should look like this `https://accounts.spotify.com:443/authorize?client_id=[...]&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A8183%2Flogin-callback&scope=user-read-playback-position%20user-read-playback-state`) and log in. I haven't yet figured out how to automate this, sorry
6. If everything worked out, the app will be available under http://localhost:8183/

## Features

### Displayed Information

* **Main info:** Song name, artist name, album name (with the release year)
* **Time:** Current progress of the song with properly formatted times (works even for 1h+ songs!)
* **States:** Whether something is paused, set to shuffle, or repeat/repeat-one
* **Context:** The playlist/album/artist name and the current device name (your PC, your phone, etc.)
* **Album Track Numbers:** For album playback only, the current track number of the total will be displayed as well

### Color

The background is the album artwork again, but stretched to fit the screen and blurred to not clash with the main image. Furthermore, the most dominant color of the art will be used as additional overlay to better separate the two. It's also used to give the text and icons a different color than white.

This is done using [ColorThief.js](https://lokeshdhakar.com/projects/color-thief) and a very rough implementation of the [Colorfulness Index defined by Hasler and Süsstrunk](https://infoscience.epfl.ch/record/33994/files/HaslerS03.pdf). This closely emulates what Spotify would attempt on a Chromecast (minus the blurred image).

### Visual Preferences

![Visual Preferences](https://i.imgur.com/BvwoduC.png)

Not everyone might be a fan of the colored texts or maybe even the smooth transitions. These and various other features can be customized with the click of a button directly on the main interface!

These options are currently available (the letter in the brackets denotes a hotkey):

* **Fullscreen (f):** Take a wild guess what this does.
* **Background Artwork (b):** Whether the album artwork should be re-used for the background as a blurry picture, or if a simple gradient background should be used
* **Colored Text (c):** Whether the texts, progress bar, and icons should be adjusted to the most dominant color of the currently playing track's album cover art. White if disabled
* **Transitions (t):** Toggles the transition animations between songs and the smoothness of the progress bar. One might want to disable these when the app is run on something like Raspberry Pi, where fancy CSS is often too expensive
* **Strip Titles (s):** Throws away anything of the song titles one might not care about, such as "Remastered Version" or "Anniversary Edition". Might be overzealous depending on how much information you wish to have.
* **Noise (n):** Adds a subtle layer of noise to the background to increase contrast and prevent color banding for dark images (only works when Prerender mode is enabled)
* **Prerender Background (p):** This saves a lot of processing time and is especially useful for weaker hardware. It captures a screenshot of the background whenever it changes to indefinitely display that until the next song change, as opposed to calculating the expensive CSS every single frame. Requires a relatively modern browser to function properly, though
* **Volume (v):** Show the volume from 0-100% (in reference to the playback device)
* **Clock (w):** Show a clock at the bottom center of the screen, showing the full date and the time. This will show even during idle mode
* **Dark Mode (d):** Darkens the entire screen by 65%. This mode will automatically be disabled after 8 hours. (I had to implement this because my TV was too cumbersome to control on-the-fly)

## Troubleshooting
 
This bot is in *very* early development stages and probably not 100% stable yet. The biggest problem is getting a reliable `EventSource` stream, since it just dies after some time (though, that often takes hours), despite my best attempts to keep it alive with heartbeats and whatnot.

Therefore, any time the connection gets lost, the interface will automatically try to reestablish one. This usually only takes a few seconds, to not mess with the interface _the player will keep ticking down seconds on its own, despite having no connection_. While perhaps not the cleanest solution on a technical level, it certainly is an unobtrusive one for the viewer.

Two other things you can try though:

1. For whatever bizarre reason, simply clicking on the devices button in Spotify (not even selecting any different device, literally just opening the dropdown) sometimes forces the API to catch up. This has been my go-to for fixing stuck screens and it works surprisingly well.
![grafik](https://user-images.githubusercontent.com/8850085/206453960-12d34f5e-03c0-41a0-aba1-7c214de4e53e.png)
2. You mentioned looking at the terminal to find any errors. That won't help you much, as all the errors regarding the connection (flux) are shown on the web console. So, hit F12 and navigate to the console out. There, you should hopefully find more helpful information.

### Note about album/playlist view
This mode is only enabled when Shuffle is *disabled*; it will also not account for any songs in the queue. This is due to limitations of the Spotify API.
