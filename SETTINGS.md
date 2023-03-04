# SpotifyBigPicture - Customization
There are two main methods of customizing this app: Pick a preset or create your own configuration. You can do both by accessing the settings menu. Click the cog symbol in the top right to open it.

# Presets
![Preset Selection](https://i.imgur.com/CQivw21.png)

Presets are the recommended way to customize the app. They're combinations of multiple settings (see below) that form a unique identity and purpose.

There's no harm done in just switching between presets at any time, so feel free to experiment until you find your desired configuration!

### Default Mode (Reset)
![Preset Thumbnail](https://raw.githubusercontent.com/Selbi182/SpotifyBigPicture/master/src/main/resources/static/design/img/presets/preset-default.png)

The default mode. A balanced design that aims to present as much information as possible about the current track (along with its artwork) without compromising on visual appeal. Clicking this behaves likes a reset button for all settings

### Compact Mode
![Preset Thumbnail](https://raw.githubusercontent.com/Selbi182/SpotifyBigPicture/master/src/main/resources/static/design/img/presets/preset-compact.png)
Similar to the default mode, but the artwork is on the right and a little smaller, opening up slightly more room for the main content

### XL-Artwork Mode
![Preset Thumbnail](https://raw.githubusercontent.com/Selbi182/SpotifyBigPicture/master/src/main/resources/static/design/img/presets/preset-xl-artwork.png)

The artwork is stretched to its maximum possible size. Apart from that, only the current track, the track list, and the progress bar are displayed

### Track-List Mode
![Preset Thumbnail](https://raw.githubusercontent.com/Selbi182/SpotifyBigPicture/master/src/main/resources/static/design/img/presets/preset-tracklist.png)

Disables the artwork and instead only dimly displays it in the background. Doing this opens up more room for the track list, which becomes centered. Also disables some lesser useful information

### Split-Panel Mode
![Preset Thumbnail](https://raw.githubusercontent.com/Selbi182/SpotifyBigPicture/master/src/main/resources/static/design/img/presets/preset-split-text.png)

A combination of the default preset and Track-List Mode that puts the current track information on the left and the track list on the right. Disables the artwork and instead only dimly displays it in the background

### Big Current-Track Mode
![Preset Thumbnail](https://raw.githubusercontent.com/Selbi182/SpotifyBigPicture/master/src/main/resources/static/design/img/presets/preset-big-current-song.png)

Only shows the current track's title, artist and release in an extra large manner. Track list is disabled, artwork is moved to the background

### Minimalistic Mode
![Preset Thumbnail](https://raw.githubusercontent.com/Selbi182/SpotifyBigPicture/master/src/main/resources/static/design/img/presets/preset-minimalistic.png)

A minimalistic design preset only containing the most relevant information about the currently playing track. The background only displays a plain color. Inspired by the original Spotify fullscreen interface for Chromecast

### Artwork-Only Mode
![Preset Thumbnail](https://raw.githubusercontent.com/Selbi182/SpotifyBigPicture/master/src/main/resources/static/design/img/presets/preset-artwork-only.png)

Just displays the artwork on a background, literally nothing else

# All Settings
![Settings Menu](https://i.imgur.com/XBuLv1z.png)

If you wish for a more nuanced way to control the appearance, click "Show All Settings" to switch show *all* settings. In here, you will be able to customize every single option individually. A detailed explanation for each option appears when you hover over the respective settings.

Do note that, under the hood, presets are just preconfigured selections of these individual settings; they each form a unique purpose and identity. While you're free to change individual settings as you like (and are encouraged to!), there are combinations that simply won't make sense together. Stick to the presets if you're unsure about anything.

## General
### Colored Text
If enabled, the dominant color of the current artwork will be used as color for all texts and some symbols. Otherwise, plain white will be used
### Show Featured Artists
Display any potential featured artists. Otherwise, only show the main artist
### Strip Titles
Hides any kind of potentially unnecessary extra information from track tiles and release names (such as 'Remastered Version', 'Anniversary Edition', '2023 Re-Issue', etc.)
### Smooth Transitions
Smoothly fade from one track to another. Otherwise, track switches will be displayed instantaneously
### Guess Next Track
If enabled, simulate the transition to the expected next track in the queue. Otherwise, wait for the actual data to arrive. Enabling this will make the transitions feel much smoother, but it may be inconsistent at times
### Dark Mode
Darkens the entire screen by 50%

## Main Content
### Enable Artwork
Whether to display the artwork of the current track or not. If disabled, the layout will be centered
### Artwork Shadow
Show a subtle shadow underneath the artwork
### Enable Main Content
Enable the main content, the container for the current track data and the track list
### Show Artists
Display the artist(s)
### Show Titles
Show the title of the currently playing track
### Show Release Name/Date
Displays the release name with its release date (usually the year of the currently playing track's album)
### Separate Release Date
Displays the release date in a new line, rather than right next to the release name
### Full Release Date
If enabled, the whole release date is shown (including month and day). Otherwise, only the year is shown. Note that some releases on Spotify only have the year (usually older releases)
### Full Release Date only for Podcasts
Limit full release dates only for podcasts. Normal songs will continue to only display the year
### Show Podcast Descriptions
While listening to a podcast episode, displays the description of that episode underneath the title
### XL Main Content
If enabled, the font size for the current track's title, artist, and release is doubled. This setting is intended to be used with disabled artwork, as there isn't a lot of space available otherwise
### Conditional XL Main Content
Limit 'XL Main Content' to only kick into effect when the title is hidden by 'Album View: Hide Duplicate Track Name'

## Top Content
### Enable Top Content
Enable the top content, the container for the context and Spotify logo. Disabling this will increase the available space for the main content
### Show Context
Displays the playlist/artist/album name along with some additional information at the top of the page
### Context Summary
Show a small summary of the current context (total track count and total time). Do note that total time cannot be displayed for playlists above 200 tracks for performance reasons
### Context Image
Display a small image (thumbnail) of the current context. For playlists, it's the playlist image and for anything else it's the first artist
### Colored Context Image
If enabled, the dominant color of the current artwork will be used as color for the context image
### Spotify Logo
Whether to display the Spotify logo in the top right
### Colored Spotify Logo
If enabled, the dominant color of the current artwork will be used as color for the Spotify logo

## Bottom Content
### Enable Bottom Content
Enable the bottom content, the container for the progress bar and various meta information. Disabling this will increase the available space for the main content
### Progress Bar
Displays a bar of that spans the entire screen, indicating how far along the currently played track is
### Timestamps
Displays the current and total timestamps of the currently playing track as numeric values
### Spread-out Timestamps
When enabled, the current timestamp is separated from the total timestamp and displayed on the left
### Show Play/Pause/Shuffle/Repeat Icons
Display the state icons for play/pause as well as shuffle and repeat in the bottom left
### Show Volume
Display the current volume in the bottom left
### Show Volume Bar
Show an additional bar underneath the volume
### Show Device Name
Display the name of the current playback device in the bottom left
### Show Clock
Displays a clock at the bottom center of the page
### Show Full Date in Clock
If enabled, the clock displays the full date, weekday, and current time. Otherwise, only displays the current time

## Track List
### Enable Track List
If enabled, show the queue/tracklist for playlists and albums. Otherwise, only the current track is displayed
### Show Time Stamps
Show the timestamps for each track in the track list. If disabled, the track names are right-aligned
### Enable Album View
If enabled, while playing an album with shuffle DISABLED, the track list is replaced by an alternate design that displays the surrounding tracks in an automatically scrolling list. (Only works for 200 tracks or fewer, for performance reasons)
### Album View: Hide Duplicate Track Name
If 'Album View' is enabled, the current track's name will not be displayed in the main content container (since it's already visible in the track list)
### XL Track List
If enabled, the font size for the track list is doubled. This setting is intended to be used with disabled artwork, as there isn't a lot of space available otherwise

## Layout: Main Content
### Expand Artwork to Top
If enabled, expand the artwork to the top content and push that content to the side
### Expand Artwork to Bottom
If enabled, expand the artwork to the bottom content and push that content to the side
### Center-Align
Center the main content (current track information and track list). Otherwise, the text will be aligned to the border
### Split Mode
Separate the main content from the track list and display both in their own panel. This setting is intended to be used with disabled artwork, as there isn't a lot of space available otherwise
### Left/Right Margins
This adds margins to the left and right of the main content. This setting has minimum effect if Split Main Content isn't enabled
### Reduced Top/Bottom Margins
Halves the top/bottom margins of the center container

## Layout: Swap
### Swap Main Content
If enabled, the main content swaps positions with the artwork
### Swap Top Content
If enabled, the Context and Spotify Logo swap positions
### Swap Bottom Content
If enabled, the progress bar and the timestamps/playback state info swap positions
### Swap Top with Bottom Content
If enabled, the top content swaps position with the bottom content

## Layout: Misc
### Decreased Margins
If enabled, all margins are halved. This allows for more content to be displayed on screen, but will make everything look slightly crammed
### Vertical Mode
Convert the two-panel layout into a vertical, centered layout (artwork above track name). Do note that this setting overrides many other settings, namely the track list

## Background
### Enable Background
Enable the background. Otherwise, plain black will be displayed at all times
### Background Artwork
If enabled, uses the release artwork for the background as a blurry, darkened version
### Background Overlay Color
Add a subtle layer of one of the artwork's most dominant colors to the background. This helps to increase the contrast for very dark artworks
### Background Gradient
Add a subtle gradient to the background that gets steadily darker towards the bottom
### Background Dithering
Adds a subtle layer of film grain to the background to increase contrast and prevent color banding for dark images

# Remote Control
![Remote Control](https://i.imgur.com/YFVF90k.png)

By clicking the "Remote Control" button located next to the "Show All Settings" button, you will be redirected to a new tab. From here, all settings can be controlled remotely.

This is especially useful if you plan on using the interface on an external device such as a Raspberry Pi, but don't want to plug in a keyboard every time you want to change the settings. As a result, the design has been specifically created with mobile phones in mind.

Of course, this will require the PC to be reachable from an outside source. Most people won't need this thing, but I found it very handy, because I change the settings quite frequently to whatever mood I'm in at the time.

### Warning

It is expected that only one browser tab is open for the interface at any time. With multiple ones, whatever interface polls for an update first will get the changes. I don't know why you would have two instances open at the same time and use the remote control, but it's worth pointing out.

Also, the remote control won't keep track of what options are enabled or disabled, it just sends a toggle command to the server. Just something to keep in mind; this tool really is meant for experts only.