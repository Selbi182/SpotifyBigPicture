# SpotifyBigPicture - "Show All Settings"
![Settings Menu](https://i.imgur.com/6aGNZmB.png)

If you wish for a more nuanced way to control the appearance, click the "Show All Settings" checkbox. In here, you will be able to customize everything individually. A detailed explanation for each setting appears when you hover over the respective settings.

Do note that, under the hood, [presets](https://github.com/Selbi182/SpotifyBigPicture/blob/master/PRESETS.md) are just preconfigured selections of these individual settings; they each form a unique purpose and identity. While you're free to change individual settings as you'd like (and are encouraged to!), there are combinations that simply won't make sense together. Stick to the presets if you're unsure about anything.

Here are some noteworthy things to keep in mind:

## Enable Playback Controls
![Playback Controls](https://i.imgur.com/RBgj1Us.png)

If enabled, the interface can be used to directly control some basic playback functions of Spotify: play, pause, next track, previous track, shuffle, and repeat.

**Security notice about playback controls:** If your interface is publicly accessible from the internet, it is _strongly_ recommended you disable the backend controls for this feature, so that people who randomly got their hands on the URL won't be able to mess with your music. You can do this by passing the following environment variable to the service:

```disable_playback_controls=true```

This will prevent the buttons from the interface from having any functions. It won't visually disable them, but clicking them will do nothing.

## (!) Symbols
Some settings have a small (!) symbol next to them. These are all options that come down to individual user preference (such as Colored Text) and as such are *not* affected by changing presets. The only way to revert these settings is by pressing Reset.

## Hotkeys
### Settings
* *Space*: toggle the settings menu (same effect as clicking the gears symbol in the top right)
* *Ctrl*: toggle between the preset list or all-settings list
* *Up/Down arrow keys*: scroll in settings menu
* *Esc*: Close settings menu

### Other
* *F*: toggle fullscreen (or just double click anywhere)
* *D*: toggle dark mode
* *L*: toggle lyrics

## Remote Control
![Remote Control](https://i.imgur.com/Es48dMs.png)

By clicking the "Remote Control" button located next to the "Show All Settings" button, you will be redirected to a new tab. From here, all settings can be controlled remotely.

This is especially useful if you plan on using the interface on an external device such as a Raspberry Pi, but don't want to plug in a keyboard every time you want to change the settings. As a result, the design has been specifically created with mobile phones in mind. Of course, this will require the server hosting the app to be reachable from an outside source.

Most people won't need this feature, but I found it very handy, because I change the settings quite frequently to whatever mood I'm in at the time.

**Warning:** It is expected that only one browser tab is open for the interface at any time. With multiple ones, whatever interface polls for an update first will get the changes. I don't know why you would have two instances open at the same time and use the remote control, but it's worth pointing out.
