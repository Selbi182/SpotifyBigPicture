const PREFERENCES_CATEGORY_ORDER = [
  "General",
  "Lyrics",
  "Tracklist",
  "Artwork",
  "Main Content",
  "Top Content",
  "Bottom Content",
  "Background",
  "Misc"
];

const PREFERENCES = [
  ///////////////////////////////
  // General
  {
    id: "playback-control",
    name: "Enable Playback Controls",
    description: "If enabled, the interface can be used to directly control some basic playback functions of Spotify: "
      + "play, pause, next track, previous track",
    category: "General",
    default: false,
    protected: true,
    css: {"playback-controller": "!hide"}
  },
  {
    id: "colored-text",
    name: "Colored Text",
    description: "If enabled, the dominant color of the current artwork will be used as the color for all texts and some symbols. Otherwise, plain white will be used",
    category: "General",
    subcategoryHeader: "Basic Design",
    default: true,
    css: {"main": "!no-colored-text"}
  },
  {
    id: "text-shadows",
    name: "Text Shadows",
    description: "Adds shadows to all texts and symbols",
    category: "General",
    default: false,
    css: {"content": "text-shadows"}
  },
  {
    id: "text-balancing",
    name: "Text Balancing",
    description: "If enabled, multiline text is balanced to have roughly the same amount of width per line",
    category: "General",
    default: true,
    css: {"body": "text-balance"}
  },
  {
    id: "strip-titles",
    name: "Strip Titles",
    description: "Hides any kind of potentially unnecessary extra information from track tiles and release names "
      + "(such as 'Remastered Version', 'Anniversary Edition', '2023 Re-Release', etc.)",
    category: "General",
    default: true,
    protected: true,
    requiredFor: ["strip-titles-aggressive"],
    css: {
      "title-extra": "hide",
      "album-title-extra": "hide",
      "track-list": "strip"
    }
  },
  {
    id: "strip-titles-aggressive",
    name: "Aggressive Strip Titles",
    description: "When also enabled, whitelisted words such as 'live', 'demo', 'remix' are also stripped.",
    category: "General",
    default: false,
    protected: true,
    callback: () => refreshTextData()
  },
  {
    id: "dark-mode",
    name: "Dark Mode",
    description: "Darkens the entire screen by 50%. This setting gets automatically disabled on a page refresh<br>[Hotkey: D]",
    category: "General",
    default: false,
    css: {"dark-overlay": "show"}
  },
  {
    id: "transitions",
    name: "Transitions",
    description: "Smoothly fade from one track to another. Otherwise, track switches will be displayed instantaneously. "
      + "It is recommended to disable this setting for low-power hardware to save on resources",
    category: "General",
    default: true,
    protected: true,
    requiredFor: ["slow-transitions"],
    css: {"main": "transitions"}
  },
  {
    id: "slow-transitions",
    name: "Slower Transitions",
    description: "If enabled, the transition speed is halved (increased to 1s, up from 0.5s)",
    category: "General",
    default: false,
    css: {"main": "slow-transitions"},
    callback: () => {
      requestAnimationFrame(() => { // to avoid race conditions
        getTransitionFromCss(true);
      });
    }
  },
  {
    id: "swap-top-bottom",
    name: "Swap Top with Bottom Content",
    description: "If enabled, the top content swaps position with the bottom content",
    category: "General",
    default: false,
    css: {"content": "swap-top-bottom"}
  },

  // Behavior
  {
    id: "guess-next-track",
    name: "Guess Next Track",
    description: "If enabled, simulate the transition to the expected next track in the queue before the actual data is returned from Spotify. "
      + "Enabling this will reduce the delay between songs, but it may be inconsistent at times",
    category: "General",
    subcategoryHeader: "Behavior",
    default: false,
    protected: true,
    callback: (state) => {
      if (!state) {
        clearTimeout(fakeSongTransition);
      }
    }
  },
  {
    id: "fullscreen-double-click",
    name: "Toggle Fullscreen With Double Click",
    description: "If enabled, you can double click anywhere on the screen to toggle fullscreen mode " +
      "(remember: you can always toggle fullscreen by pressing F)",
    category: "General",
    default: true,
    protected: true
  },
  {
    id: "show-error-toasts",
    name: "Show Error Messages",
    description: "If enabled, display any potential error messages as a toast notification at the top",
    category: "General",
    default: true,
    protected: true
  },
  {
    id: "allow-user-select",
    name: "Allow Text Selection",
    description: "If enabled, text on can be selected/copied. Otherwise it's all read-only",
    category: "General",
    default: false,
    protected: true,
    css: {"main": "allow-user-select"}
  },
  {
    id: "hide-mouse",
    name: "Hide Mouse Cursor",
    description: "Hides the mouse cursor after a short duration of no movement",
    category: "General",
    default: true,
    protected: true,
    css: {"body": "hide-cursor-enabled"}
  },
  {
    id: "hide-top-buttons",
    name: "Show Top Buttons",
    description: "Show a few useful buttons at the top when moving the mouse. Note: If you disable this, the settings menu can only be accessed by pressing Space!",
    category: "General",
    default: true,
    protected: true,
    css: {"top-buttons": "!hide"}
  },
  {
    id: "allow-idle-mode",
    name: "Idle After One Hour",
    description: "If enabled and no music has been played for the past 60 minutes, the screen will go black to save on resources. "
      + "Once playback resumes, the page will refresh automatically. Recommended for 24/7 hosting of this app",
    category: "General",
    default: true,
    protected: true,
    callback: () => refreshIdleTimeout(currentData, true)
  },
  {
    id: "idle-when-hidden",
    name: "Idle When Tab Is Hidden",
    description: "If enabled, idle mode is automatically turned on when you switch tabs. It is STRONGLY recommended to keep this setting enabled, " +
      "or else you might run into freezes after the page has been hidden for a long while!",
    category: "General",
    default: true,
    protected: true
  },


  ///////////////////////////////
  // Lyrics
  {
    id: "show-lyrics",
    name: "Enable Lyrics",
    description: "Searches for and displays the lyrics of the current song from Genius.com<br>[Hotkey: L]",
    category: "Lyrics",
    default: false,
    requiredFor: ["lyrics-simulated-scroll", "lyrics-hide-tracklist", "xl-lyrics", "dim-lyrics", "max-width-lyrics"],
    css: {"lyrics": "!hide"},
    callback: (state) => {
      if (state) {
        refreshLyrics(currentData)
        setClass("lyrics-toggle-button".select(), "enabled", true);
      } else {
        setClass("content-center".select(), "lyrics", false);
        setClass("lyrics-toggle-button".select(), "enabled", false);
      }
    }
  },
  {
    id: "lyrics-simulated-scroll",
    name: "Automatic Scrolling",
    description: "Automatically scrolls the lyrics container as the current song progresses after a short delay (pseudo-synchronization). " +
      "Won't always be flawless, unfortunately",
    category: "Lyrics",
    default: true,
    callback: (state) => {
      if (state) {
        scrollLyrics(currentData, true);
      } else {
        stopLyricsScroll();
      }
    }
  },
  {
    id: "lyrics-hide-tracklist",
    name: "Hide Tracklist for Lyrics",
    description: "If lyrics for the current song were found, hide the tracklist to make room for them",
    category: "Lyrics",
    default: true,
    css: {"track-list": "hide-for-lyrics"}
  },
  {
    id: "xl-lyrics",
    name: "XL Lyrics",
    description: "Increases the font size of the lyrics",
    category: "Lyrics",
    default: false,
    css: {"lyrics": "xl"}
  },
  {
    id: "dim-lyrics",
    name: "Dim Lyrics",
    description: "When enabled, dims the opacity down to 65% (same as the tracklist)",
    category: "Lyrics",
    default: false,
    css: {"lyrics": "dim"}
  },
  {
    id: "max-width-lyrics",
    name: "Max Width Lyrics",
    description: "When enabled, the lyrics container is always at 100% width",
    category: "Lyrics",
    default: false,
    css: {"lyrics": "max-width"}
  },

  ///////////////////////////////
  // Tracklist
  {
    id: "show-queue",
    name: "Enable Tracklist",
    description: "If enabled, show the queue/tracklist for playlists and albums. Otherwise, only the current track is displayed",
    category: "Tracklist",
    default: true,
    requiredFor: ["scrollable-track-list", "album-view", "always-show-track-numbers-album-view", "album-spacers", "hide-single-item-album-view", "show-timestamps-track-list",
      "show-featured-artists-track-list", "full-track-list", "increase-min-track-list-scaling", "increase-max-track-list-scaling", "hide-tracklist-podcast-view"],
    css: {
      "title": "!force-display",
      "track-list": "!hide"
    },
    callback: () => refreshTrackList()
  },
  {
    id: "scrollable-track-list",
    name: "Scrollable",
    description: "If enabled, the tracklist can be scrolled through with the mouse wheel. Otherwise it can only scroll on its own",
    category: "Tracklist",
    default: false,
    css: {"track-list": "scrollable"}
  },
  {
    id: "show-featured-artists-track-list",
    name: "Show Featured Artists",
    description: "Display any potential featured artists in the tracklist. Otherwise, only show the song name",
    category: "Tracklist",
    default: true,
    css: {"track-list": "!no-feat"}
  },
  {
    id: "full-track-list",
    name: "Show Full Titles",
    description: "If enabled, longer titles will always be fully displayed (with line breaks). "
      + "Otherwise, the line count will be limited to 1 and overflowing text will be cut off with ellipsis",
    category: "Tracklist",
    default: false,
    css: {"track-list": "no-clamp"}
  },
  {
    id: "titles-right-align",
    name: "Right-Align Titles",
    description: "Right-aligns the titles in the tracklist",
    category: "Tracklist",
    default: false,
    css: {"track-list": "right-align-titles"}
  },
  {
    id: "show-timestamps-track-list",
    name: "Show Time Stamps",
    description: "Displays the timestamps for each track in the tracklist.",
    category: "Tracklist",
    default: true,
    css: {"track-list": "show-timestamps"}
  },
  {
    id: "increase-min-track-list-scaling",
    name: "Increase Minimum Text Scaling Limit",
    description: "If enabled, the minimum font size for the tracklist is drastically increased (factor 3 instead of 2)",
    category: "Tracklist",
    default: false,
    css: {"track-list": "increase-min-scale"}
  },
  {
    id: "increase-max-track-list-scaling",
    name: "Increase Maximum Text Scaling Limit",
    description: "If enabled, the maximum font size for the tracklist is drastically increased (factor 5 instead of 3)",
    category: "Tracklist",
    default: false,
    css: {"track-list": "increase-max-scale"}
  },
  {
    id: "hide-tracklist-podcast-view",
    name: "Hide Tracklist for Podcasts",
    description: "If the currently playing track is a podcast, hides the tracklist. This opens up more room for the episode description",
    category: "Tracklist",
    default: true,
    css: {"track-list": "hide-for-podcasts"}
  },
  {
    id: "album-spacers",
    name: "Margin Between Albums",
    description: "If enabled, after each album in the tracklist, some margin is added to visually separate them. " +
      "Only works for playlists that have multiple albums in chunks, not individual ones",
    category: "Tracklist",
    default: true,
    css: {"track-list": "album-spacers"}
  },

  // Album View
  {
    id: "album-view",
    name: "Enable Album View",
    description: "If enabled, while playing an album or playlist with shuffle DISABLED, the tracklist is replaced by an alternate design that displays the surrounding tracks in an automatically scrolling list. "
      + "(Only works for 200 tracks or fewer, for performance reasons)",
    category: "Tracklist",
    subcategoryHeader: "Album View",
    default: true,
    requiredFor: ["always-show-track-numbers-album-view", "hide-single-item-album-view"],
    callback: () => refreshTrackList()
  },
  {
    id: "hide-single-item-album-view",
    name: "Hide Tracklist for Single Song",
    description: "If 'Album View' is enabled and the current context only has one track (such as a single), don't render the tracklist at all",
    category: "Tracklist",
    default: true,
    callback: () => refreshTrackList()
  },
  {
    id: "always-show-track-numbers-album-view",
    name: "Always Show Everything",
    description: "If 'Album View' is enabled, the track numbers and artists are always displayed as well (four columns). " +
      "Otherwise, track numbers are hidden for playlists and artists are hidden for albums",
    category: "Tracklist",
    default: false,
    overrides: ["one-artist-numbers-album-view"],
    css: {"track-list": "always-show-track-numbers-album-view"},
    callback: () => refreshTrackList()
  },
  {
    id: "one-artist-numbers-album-view",
    name: "Use Numbers For One-Artist Playlists",
    description: "If 'Album View' is enabled while the current context is a playlist and ALL songs are by the same artist, " +
      "show index numbers instead of the artist name",
    category: "Tracklist",
    default: true,
    callback: () => refreshTrackList()
  },

  // Queue View
  {
    id: "queue-big-gradient",
    name: "Large Gradient",
    description: "If enabled and while in queue mode, use a larger gradient that covers the entire tracklist",
    category: "Tracklist",
    subcategoryHeader: "Queue View",
    default: true,
    css: {"track-list": "queue-big-gradient"}
  },

  ///////////////////////////////
  // Artwork
  {
    id: "display-artwork",
    name: "Enable Artwork",
    description: "Whether to display the artwork of the current track or not. If disabled, the layout will be centered",
    category: "Artwork",
    default: true,
    requiredFor: ["artwork-shadow", "artwork-expand-top", "artwork-expand-bottom", "artwork-right"],
    css: {
      "artwork": "!hide",
      "content": "!full-content"
    }
  },
  {
    id: "artwork-shadow",
    name: "Artwork Shadow",
    description: "Adds a subtle shadow underneath the artwork",
    category: "Artwork",
    default: true,
    requiredFor: ["artwork-soft-light"],
    css: {"artwork": "shadow"}
  },
  {
    id: "artwork-soft-light",
    name: "Soft-Light Blend",
    description: "Blends the artwork using the soft-light blend mode. This generally makes it darker",
    category: "Artwork",
    default: false,
    css: {"artwork": "soft-light"}
  },
  {
    id: "artwork-expand-top",
    name: "Expand Artwork to Top",
    description: "If enabled, expand the artwork to the top content and push that content to the side",
    category: "Artwork",
    default: true,
    css: {"main": "artwork-expand-top"}
  },
  {
    id: "artwork-expand-bottom",
    name: "Expand Artwork to Bottom",
    description: "If enabled, expand the artwork to the bottom content and push that content to the side",
    category: "Artwork",
    default: false,
    css: {"main": "artwork-expand-bottom"}
  },
  {
    id: "artwork-right",
    name: "Move Artwork to the Right",
    description: "If enabled, the main content swaps positions with the artwork",
    category: "Artwork",
    default: false,
    css: {"main": "artwork-right"}
  },
  {
    id: "hd-artwork",
    name: "HD-Artwork From iTunes [BETA]",
    description: "Try to look for the artwork of the current track on iTunes instead of Spotify, which hosts high-quality, uncompressed images. " +
      "Unfortunately, SO high-quality and uncompressed that enabling this option can make the application a lot slower, so use it with caution!",
    category: "Artwork",
    default: false,
    protected: true
  },

  ///////////////////////////////
  // Main Content
  {
    id: "enable-center-content",
    name: "Enable Main Content",
    description: "Enable the main content, the container for the current track data",
    category: "Main Content",
    default: true,
    requiredFor: ["show-artists", "show-titles", "xl-text", "show-release-name", "show-release-date",
      "show-podcast-descriptions", "main-content-centered", "split-main-panels", "reduced-center-margins"],
    css: {
      "center-info-main": "!hide",
      "artwork": "!center-disabled"
    }
  },
  {
    id: "show-artists",
    name: "Show Artists",
    description: "Display the artist(s)",
    category: "Main Content",
    default: true,
    requiredFor: ["show-featured-artists"],
    css: {"artists": "!hide"}
  },
  {
    id: "show-featured-artists",
    name: "Show Featured Artists",
    description: "Display any potential featured artists. Otherwise, only show the main artist",
    category: "Main Content",
    default: true,
    requiredFor: ["featured-artists-new-line"],
    css: {"artists": "!no-feat"}
  },
  {
    id: "show-titles",
    name: "Show Titles",
    description: "Displays the title of the currently playing track",
    category: "Main Content",
    default: true,
    css: {"title": "!hide"}
  },

  {
    id: "show-podcast-descriptions",
    name: "Show Podcast Descriptions",
    description: "While listening to a podcast episode, displays the description of that episode underneath the title",
    category: "Main Content",
    default: true,
    css: {"description": "!hide"}
  },

  // Release
  {
    id: "show-release-name",
    name: "Show Release Name",
    description: "Displays the release name (e.g. album title)",
    category: "Main Content",
    subcategoryHeader: "Release",
    default: true,
    requiredFor: ["separate-release-line"],
    css: {"album": "!hide-name"}
  },
  {
    id: "show-release-date",
    name: "Show Release Date",
    description: "Displays the release date (usually the year of the currently playing track's album)",
    category: "Main Content",
    default: true,
    requiredFor: ["separate-release-line", "full-release-date"],
    css: {"album": "!hide-date"}
  },
  {
    id: "separate-release-line",
    name: "Release Date in New Line",
    description: "Displays the release date in a new line, rather than right next to the release name",
    category: "Main Content",
    default: false,
    css: {"album": "separate-date"}
  },
  {
    id: "full-release-date",
    name: "Full Release Date",
    description: "If enabled, the whole release date is shown (including month and day). Otherwise, only the year is shown. "
      + "Note that some releases on Spotify only have the year (usually older releases)",
    category: "Main Content",
    default: true,
    requiredFor: ["full-release-date-podcasts"],
    css: {"album-release": "full"}
  },
  {
    id: "full-release-date-podcasts",
    name: "Full Release Date only for Podcasts",
    description: "Limit full release dates to only be displayed for podcasts. Normal songs will continue to only display the year",
    category: "Main Content",
    default: true,
    css: {"album-release": "podcasts-only"}
  },

  // Layout
  {
    id: "swap-artist-title",
    name: "Titles Above Artists",
    description: "If enabled, the current track's title is displayed above the artist(s) instead of underneath " +
      "(this mimics the layout of Spotify's own interface)",
    category: "Main Content",
    subcategoryHeader: "Layout",
    default: false,
    callback: (state) => {
      let artists = "artists".select();
      let title = "title".select();
      let contentInfoMainContainer = "center-info-main".select();
      if (state) {
        contentInfoMainContainer.insertBefore(title, artists);
      } else {
        contentInfoMainContainer.insertBefore(artists, title);
      }
    }
  },
  {
    id: "featured-artists-new-line",
    name: "Featured Artists in New Line",
    description: "Display any potential featured artists in a new line",
    category: "Main Content",
    default: false,
    css: {"artists": "feat-new-line"}
  },
  {
    id: "xl-text",
    name: "XL Main Content",
    description: "If enabled, the font size for the current track's title, artist, and release is doubled. "
      + "This setting is intended to be used with disabled artwork, as there isn't a lot of space available otherwise",
    category: "Main Content",
    default: false,
    css: {"center-info-main": "big-text"}
  },
  {
    id: "main-content-centered",
    name: "Center-Align",
    description: "Center the main content (current track information and tracklist). Otherwise, the text will be aligned to the border",
    category: "Main Content",
    default: true,
    css: {"content-center": "centered"}
  },
  {
    id: "split-main-panels",
    name: "Split Mode",
    description: "Separate the main content from the tracklist and display both in their own panel. "
      + "This setting is intended to be used with disabled artwork, as there isn't a lot of space available otherwise",
    category: "Main Content",
    default: false,
    css: {"content-center": "split-main-panels"}
  },
  {
    id: "center-lr-margins",
    name: "Left/Right Margins",
    description: "This adds margins to the left and right of the main content. "
      + "This setting has minimum effect if Split Main Content isn't enabled",
    category: "Main Content",
    default: false,
    css: {"content-center": "extra-margins"}
  },
  {
    id: "reduced-center-margins",
    name: "Reduced Top/Bottom Margins",
    description: "Halves the top/bottom margins of the center container",
    category: "Main Content",
    default: false,
    css: {"content": "decreased-margins"}
  },
  {
    id: "artwork-above-content",
    name: "Artwork Above Track Info",
    description: "If enabled, the artwork is placed above the track info, rather than next to it. "
      + "Use this setting with caution!",
    category: "Main Content",
    default: false,
    css: {"main": "artwork-above-content"}
  },

  ///////////////////////////////
  // Top Content
  {
    id: "enable-top-content",
    name: "Enable Top Content",
    description: "Enable the top content, the container for the context and the Spotify logo. "
      + "Disabling this will increase the available space for the main content",
    category: "Top Content",
    default: true,
    requiredFor: ["show-context", "show-logo", "swap-top", "artwork-expand-top"],
    css: {
      "content-top": "!hide",
      "artwork": "!top-disabled"
    }
  },
  {
    id: "show-context",
    name: "Show Context",
    description: "Displays the playlist/artist/album name along with some additional information",
    category: "Top Content",
    default: true,
    requiredFor: ["show-context-thumbnail", "show-context-summary"],
    css: {"meta-left": "!hide"}
  },
  {
    id: "show-context-summary",
    name: "Context Summary",
    description: "Displays a small summary of the current context (context type, total track count, and total time). "
      + "Do note that total time cannot be displayed for playlists above 200 tracks for performance reasons",
    category: "Top Content",
    default: true,
    requiredFor: ["show-context-description"],
    css: {"context-extra": "!hide"}
  },
  {
    id: "show-context-description",
    name: "Context Descriptions",
    description: "Displays the context's description, if available (such as playlist description). Limited to 1 line due to space concerns",
    category: "Top Content",
    default: false,
    css: {"context-extra": "show-description"}
  },
  {
    id: "show-context-thumbnail",
    name: "Context Image",
    description: "Displays a small image (thumbnail) of the current context. "
      + "For playlists, it's the playlist's image and for anything else the artist's thumbnail",
    category: "Top Content",
    default: true,
    requiredFor: ["colored-symbol-context"],
    css: {"thumbnail-wrapper": "!hide"}
  },
  {
    id: "colored-symbol-context",
    name: "Colored Context Image",
    description: "If enabled, the dominant color of the current artwork will be used as the color for the context image",
    category: "Top Content",
    default: false,
    css: {"thumbnail-wrapper": "colored"}
  },
  {
    id: "show-logo",
    name: "Spotify Logo",
    description: "Whether to display the Spotify logo",
    category: "Top Content",
    default: true,
    requiredFor: ["colored-symbol-spotify"],
    css: {"meta-right": "!hide"}
  },
  {
    id: "colored-symbol-spotify",
    name: "Colored Spotify Logo",
    description: "If enabled, the dominant color of the current artwork will be used as the color for the Spotify logo instead of the default Spotify green",
    category: "Top Content",
    default: true,
    css: {"logo": "colored"}
  },
  {
    id: "swap-top",
    name: "Swap Top Content",
    description: "If enabled, the Context and Spotify Logo swap positions",
    category: "Top Content",
    default: false,
    css: {"content-top": "swap"}
  },

  ///////////////////////////////
  // Bottom Content
  {
    id: "enable-bottom-content",
    name: "Enable Bottom Content",
    description: "Enable the bottom content, the container for the progress bar and various meta information. "
      + "Disabling this will increase the available space for the main content",
    category: "Bottom Content",
    default: true,
    requiredFor: ["show-progress-bar", "show-timestamps", "show-info-icons", "show-volume", "show-device", "reverse-bottom", "show-clock", "artwork-expand-bottom"],
    css: {
      "content-bottom": "!hide",
      "artwork": "!bottom-disabled"
    }
  },
  {
    id: "show-info-icons",
    name: "Show Playback Status Icons",
    description: "Displays the state icons for play/pause as well as shuffle and repeat. ",
    category: "Bottom Content",
    default: true,
    requiredFor: ["center-info-icons"],
    css: {"info-symbols": "!hide"}
  },
  {
    id: "center-info-icons",
    name: "Center Playback Status Icons",
    description: "If enabled, the play/pause/shuffle/repeat icons are centered (like it's the case on the default Spotify player). "
      + "Enabling this will disable the clock",
    category: "Bottom Content",
    default: false,
    overrides: ["show-clock"],
    css: {"bottom-meta-container": "centered-controls"},
    callback: (state) => {
      let infoSymbols = "info-symbols".select();
      let bottomLeft = "bottom-left".select();
      let bottomMetaContainer = "bottom-meta-container".select();
      let clock = "clock".select();
      let volume = "volume".select();
      if (state) {
        bottomMetaContainer.insertBefore(infoSymbols, clock);
      } else {
        bottomLeft.insertBefore(infoSymbols, volume);
      }
    }
  },
  {
    id: "show-volume",
    name: "Show Volume",
    description: "Displays the current Spotify volume",
    category: "Bottom Content",
    default: true,
    requiredFor: ["show-volume-bar"],
    css: {"volume": "!hide"}
  },
  {
    id: "show-volume-bar",
    name: "Show Volume Bar",
    description: "Displays an additional bar underneath the volume",
    category: "Bottom Content",
    default: true,
    css: {"volume-bar": "!hide"}
  },
  {
    id: "show-device",
    name: "Show Device Name",
    description: "Displays the name of the current playback device",
    category: "Bottom Content",
    default: true,
    css: {"device": "!hide"}
  },
  {
    id: "show-timestamps",
    name: "Show Timestamps",
    description: "Displays the current and total timestamps of the currently playing track",
    category: "Bottom Content",
    default: true,
    requiredFor: ["spread-timestamps", "remaining-time-timestamp"],
    css: {
      "artwork": "!hide-timestamps",
      "bottom-meta-container": "!hide-timestamps"
    }
  },
  {
    id: "spread-timestamps",
    name: "Spread-out Timestamps",
    description: "When enabled, the current timestamp is separated from the total timestamp and displayed on the left",
    category: "Bottom Content",
    default: false,
    css: {"bottom-meta-container": "spread-timestamps"},
    callback: (state) => {
      let timeCurrent = "time-current".select();
      let bottomLeft = "bottom-left".select();
      let bottomRight = "timestamp-container".select();
      if (state) {
        bottomLeft.insertBefore(timeCurrent, bottomLeft.firstChild);
      } else {
        bottomRight.insertBefore(timeCurrent, bottomRight.firstChild);
      }
    }
  },
  {
    id: "remaining-time-timestamp",
    name: "Show Remaining Time",
    description: "When enabled, the current timestamp of the current track instead displays the remaining time",
    category: "Bottom Content",
    default: false,
    callback: () => updateProgress(currentData)
  },
  {
    id: "show-next-track",
    name: "Show Next Track",
    description: "If enabled, shows the upcoming track in the queue (artist and name) next to the timestamp. " +
      "Consider disabling the clock for more space",
    category: "Bottom Content",
    default: false,
    css: {"next-track-info": "show"}
  },

  // Progress Bar
  {
    id: "show-progress-bar",
    name: "Progress Bar",
    description: "Displays a progress bar, indicating how far along the currently played track is",
    category: "Bottom Content",
    subcategoryHeader: "Progress Bar",
    default: true,
    requiredFor: ["smooth-progress-bar", "progress-bar-gradient"],
    css: {"progress": "!hide"}
  },
  {
    id: "progress-bar-gradient",
    name: "Progress Bar Gradient",
    description: "Uses an alternate design for the progress bar with a gradient instead of a flat color",
    category: "Bottom Content",
    default: false,
    css: {"progress-current": "gradient"}
  },
  {
    id: "reverse-bottom",
    name: "Progress Bar Underneath",
    description: "If enabled, the progress bar and the timestamps/playback state info swap positions",
    category: "Bottom Content",
    default: false,
    css: {"content-bottom": "reverse"}
  },
  {
    id: "smooth-progress-bar",
    name: "Smooth Progress Bar",
    description: "If enabled, the progress bar will get updated smoothly, rather than only once per second. "
      + "It is recommended keep this setting disabled for low-power hardware to save on resources!",
    category: "Bottom Content",
    default: false,
    protected: true,
    callback: () => refreshProgress()
  },

  // Clock
  {
    id: "show-clock",
    name: "Show Clock",
    description: "Displays the current time",
    category: "Bottom Content",
    subcategoryHeader: "Clock",
    default: true,
    requiredFor: ["clock-full", "clock-24"],
    css: {"clock": "!hide"}
  },
  {
    id: "clock-full",
    name: "Show Full Date in Clock",
    description: "If enabled, the clock displays the full date, weekday, and current time. Otherwise, only displays the current time",
    category: "Bottom Content",
    default: true
  },
  {
    id: "clock-24",
    name: "Use 24-Hour Format for Clock",
    description: "If enabled, the clock uses the 24-hour format. Otherwise, the 12-hour format",
    category: "Bottom Content",
    default: true,
    protected: true
  },

  ///////////////////////////////
  // Background
  {
    id: "bg-enable",
    name: "Enable Background",
    description: "Enable the background. Otherwise, plain black will be displayed at all times",
    category: "Background",
    default: true,
    requiredFor: ["bg-artwork", "bg-tint", "bg-gradient", "bg-grain", "bg-blur"],
    css: {"background-canvas": "!hide"}
  },
  {
    id: "bg-artwork",
    name: "Artwork",
    description: "If enabled, uses the release artwork for the background as a darkened version",
    category: "Background",
    default: true,
    requiredFor: ["bg-blur", "bg-fill-screen"],
    css: {"background-canvas": "!color-only"}
  },
  {
    id: "bg-fill-screen",
    name: "Fill Screen",
    description: "If enabled, the artwork is zoomed in to cover the screen. Otherwise, it will be contained within the borders and fill the remaining " +
      "background with a plain color",
    category: "Background",
    default: true,
    css: {"background-canvas-img": "fill-screen"}
  },
  {
    id: "bg-blur",
    name: "Blur",
    description: "Blurs the background. Note that disabling this will result in low-quality background images, as the pictures provided by Spotify are limited to " +
      "a resolution of 640x640",
    category: "Background",
    default: true,
    css: {"background-canvas-img": "!no-blur"}
  },
  {
    id: "bg-zoom",
    name: "Zoom",
    description: "Zooms the background image slightly in (intended to hide darkened edges when the image is blurred)",
    category: "Background",
    default: true,
    css: {"background-canvas": "!no-zoom"}
  },
  {
    id: "bg-gradient",
    name: "Gradient",
    description: "Adds a subtle gradient to the background that gets steadily darker towards the bottom",
    category: "Background",
    default: true,
    css: {"background-canvas-overlay": "!no-gradient"}
  },
  {
    id: "bg-grain",
    name: "Dithering",
    description: "Adds a subtle layer of film grain/noise to the background to increase contrast and prevent color banding for dark images",
    category: "Background",
    default: true,
    css: {"grain": "show"}
  },

  // Overlay Color
  {
    id: "bg-tint",
    name: "Overlay Color",
    description: "Add a subtle layer of one of the artwork's most dominant colors to the background. This helps to increase the contrast between the background and foreground",
    category: "Background",
    subcategoryHeader: "Overlay Color",
    default: true,
    requiredFor: ["bg-tint-dark-compensation", "bg-tint-bright-compensation"],
    css: {"background-canvas-overlay": "!no-tint"}
  },
  {
    id: "bg-tint-dark-compensation",
    name: "Darkness Compensation",
    description: "Increases the overlay color's brightness for very dark artworks",
    category: "Background",
    default: true,
    css: {"background-canvas-overlay": "dark-compensation"}
  },
  {
    id: "bg-tint-bright-compensation",
    name: "Brightness Compensation",
    description: "Decreases the overlay color's brightness for very bright artworks",
    category: "Background",
    default: true,
    css: {"background-canvas-overlay": "bright-compensation"}
  },

  ///////////////////////////////
  // Misc
  {
    id: "decreased-margins",
    name: "Decreased Margins",
    description: "If enabled, all margins are halved. " +
      "This allows for more content to be displayed on screen, but will make everything look slightly crammed",
    category: "Misc",
    default: false,
    css: {"main": "decreased-margins"},
  },
  {
    id: "extra-wide-mode",
    name: "Extra-wide Mode",
    description: "If enabled, the top and bottom margins will be doubled, resulting in a wider and more compact view",
    category: "Misc",
    default: false,
    css: {"content": "extra-wide"},
  },
  {
    id: "color-dodge-skin",
    name: "Color-Doge Blend",
    description: "If enabled, blends the content with the background using 'mix-blend-mode: color-dodge' " +
      "(might look cool or terrible, that's up to you)",
    category: "Misc",
    default: false,
    css: {"content": "color-dodge"},
  },

  // Website Title
  {
    id: "current-track-in-website-title",
    name: "Current Track in Website Title",
    description: "If enabled, displays the current track's name and artist in the website title. "
      + `Otherwise, only show '${WEBSITE_TITLE_BRANDING}'`,
    category: "Misc",
    subcategoryHeader: "Website Title",
    default: true,
    protected: true,
    requiredFor: ["track-first-in-website-title", "branding-in-website-title"],
    callback: () => refreshProgress()
  },
  {
    id: "track-first-in-website-title",
    name: "Track Title First",
    description: "Whether to display the track title before the artist name or vice versa",
    category: "Misc",
    default: false,
    protected: true,
    callback: () => refreshProgress()
  },
  {
    id: "branding-in-website-title",
    name: `"${WEBSITE_TITLE_BRANDING}"`,
    description: `If enabled, suffixes the website title with ' | ${WEBSITE_TITLE_BRANDING}'`,
    category: "Misc",
    default: true,
    protected: true,
    callback: () => refreshProgress()
  },

  // Debugging Tools
  {
    id: "prerender-background",
    name: "Prerender Background",
    description: "[Keep this option enabled at all times if you don't know what it does!]",
    category: "Misc",
    subcategoryHeader: "Debugging Tools",
    default: true,
    protected: true,
    css: {
      "background-rendered": "!hide",
      "prerender-canvas": "!no-prerender"
    }
  }
];

const PREF_IDS_ALL = PREFERENCES.map(pref => pref.id);
const PREF_IDS_DEFAULT_ENABLED = PREFERENCES.filter(pref => !!pref.default).map(pref => pref.id);
const PREF_IDS_DEFAULT_DISABLED = PREFERENCES.filter(pref => !pref.default).map(pref => pref.id);
const PREF_IDS_PROTECTED = PREFERENCES.filter(pref => pref.protected).map(pref => pref.id);