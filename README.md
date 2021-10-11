# Spotify Big Picture

An interface that checks for your current playback status on Spotify and displays the information in a beautiful little browser page.

You might want to use this over [Spotify's own (in my opinion, rather underwhelming) full-screen mode](https://i.imgur.com/dvreOAX.jpg), or you can use it for your TV/media-streamer to give [that outdated, low-resolution OSD](https://i.imgur.com/lNfCcrW.jpg) a fresh paintjob!

## Examples

### Pictures

![Rammstein - Mein Herz brennt](https://i.imgur.com/eLpoG0B.png)

![Haken - Invasion](https://i.imgur.com/Zk3Ssg1.png)

![Deafheaven - Dream House](https://i.imgur.com/zGN1Las.png)

![Finsterforst - Ecce Homo](https://i.imgur.com/1vcOF1D.png)

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

![Visual Preferences](https://i.imgur.com/DtIq8T8.png)

Not everyone might be a fan of the colored texts or maybe even the smooth transitions. These and various other features can be customized with the click of a button directly on the main interface!

These options are currently available (the letter in the brackets denotes a hotkey):

* **Dark Mode (d):** Dims the screen and applies a blue-light filter similar to what you'd accomplish with tools like f.lux (I had to implement this because my TV was too cumbersome to control on-the-fly)
* **Transitions (t):** Toggles the transition animations between songs and the smoothness of the progress bar. One might want to disable these when the app is run on something like Raspberry Pi, where fancy CSS is often too expensive
* **Colored Text (c):** Whether the texts, progress bar, and icons should be adjusted to the most dominant color of the currently playing track's album cover art. White if disabled.
* **Artwork Border (b):** Draws a thin, colored line around the cover art image. This is especially useful for darker images, so that they won't blend in with the background. One might want to disable it for asthetic preference though. ([see here for an example](https://i.imgur.com/jmSsbyo.png))
* **BG Artwork (a):** Whether the album artwork should be re-used for the background as a blurry picture, or if a simple gradient background should be used
* **Strip Titles (s):** Throws away anything of the song titles one might not care about, such as "Remastered Version" or "Anniversary Edition". Might be overzealous depending on how much information you wish to have.
* **Fullscreen (f):** Take a wild guess.

## Note about stability
 
This bot is in *very* early development stages and probably not 100% stable yet. The biggest problem is getting a reliable `EventSource` stream, since it just dies after some time (though, that often takes hours), despite my best attempts to keep it alive with heartbeats and whatnot.

Therefore, any time the connection gets lost, the interface will automatically try to reestablish one. This usually only takes a few seconds, so as to not mess with the interface _the player will keep ticking down seconds on its own, despite having no connection_. While perhaps not the cleanest solution on a technical level, it certainly is an unobtrusive one for the viewer.
