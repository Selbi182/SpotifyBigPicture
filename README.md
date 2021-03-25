
# Spotify Playback Info

An interface that checks for your current playback status on Spotify and displays the information in a beautiful little browser page.

You might want to use this over [Spotify's own (rather underwhelming) full-screen mode](https://i.imgur.com/dvreOAX.jpg), or you can use it for your TV/media-streamer to give [that outdated, low-resolution OSD](https://i.imgur.com/lNfCcrW.jpg) a fresh paintjob!

## Examples

### Animation

![Sample Animation](https://i.imgur.com/CuPz1eJ.gif)

(I had to dramatically reduce the GIF's quality to have it be allowed on GitHub)

### Pictures

![Rammstein - Mein Herz brennt](https://i.imgur.com/711oYL9.png)

![Haken - Prothetic](https://i.imgur.com/vBBLKkq.png)

![Deafheaven - Dream House](https://i.imgur.com/FO64o96.png)

![Finsterforst - Ecce Homo](https://i.imgur.com/p3OGz6s.png)

![Steven Wilson - Personal Shopper](https://i.imgur.com/JKhjSXn.png)

## Features

### Displayed Information

* **Main info:** Song name, artist name, album name (with the release year)
* **Time:** Current progress of the song with properly formatted times (works even for 1h+ songs!)
* **States:** Whether something is paused, set to shuffle, or repeat/repeat-one
* **Context:** The playlist/album/artist name and the current device name (your PC, your phone, etc.)

### Color

The background is the album artwork again, but stretched to fit the screen and blurred to not clash with the main image too much. Furthermore, the most dominant color of the art will be used as additional overlay to better separate the two. It's also used to give the text and icons a different color than white.

This is done using [ColorThief.js](https://lokeshdhakar.com/projects/color-thief) and a very rough implementation of the [Colorfulness Index defined by Hasler and Süsstrunk](https://infoscience.epfl.ch/record/33994/files/HaslerS03.pdf). This closely emulates what Spotify would attempt on a Chromecast (minus the blurred image).

### Visual Preferences

![Visual Preferences](https://i.imgur.com/QUH8eNo.png)

Not everyone might be a fan of the colored texts, the volume slider, or maybe even the smooth transitions. These and various other features can be customized with the click of a button directly on the main interface!

## Note about stability
 
This bot is in *very* early development stages and probably not 100% stable yet. The biggest problem is getting a reliable `EventSource` stream, since it just dies after some time (though, that often takes hours), despite my best attempts to keep it alive with heartbeats and whatnot.

Therefore, any time the connection gets lost, the interface will automatically try to reestablish one. This usually only takes a few seconds, so as to not mess with the interface _the player will keep ticking down seconds on its own, despite having no connection_. While perhaps not the cleanest solution on a technical level, it certainly is an unobtrusive one for the viewer.
