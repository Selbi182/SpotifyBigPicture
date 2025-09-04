const PREFERENCES_PRESETS = [
  {
    id: "preset-default",
    name: "Default Mode",
    category: "Presets",
    description: "The default mode. A balanced design that aims to present as much information as possible about the current track (along with its artwork) without compromising on visual appeal",
    enabled: [],
    disabled: []
  },
  {
    id: "preset-split-text",
    name: "Split-Panel Mode",
    category: "Presets",
    description: "Puts the current track information on the left and the tracklist on the right. "
      + "Disables the artwork and instead only dimly displays it in the background",
    enabled: [
      "swap-top",
      "center-lr-margins",
      "reverse-bottom",
      "split-main-panels",
      "separate-release-line",
      "featured-artists-new-line",
      "progress-bar-gradient"
    ],
    disabled: [
      "main-content-centered",
      "bg-tint",
      "display-artwork"
    ]
  },
  {
    id: "preset-tracklist",
    name: "Tracklist Mode",
    category: "Presets",
    description: "Disables the artwork and instead only dimly displays it in the background, as well as the main content. "
      + "Doing this opens up more room for the tracklist, which becomes centered. Also disables some lesser useful information",
    enabled: [
      "increase-min-track-list-scaling",
      "spread-timestamps",
      "reverse-bottom"
    ],
    disabled: [
      "enable-center-content",
      "show-clock",
      "show-device",
      "show-volume",
      "show-volume-bar",
      "show-info-icons",
      "display-artwork",
      "bg-tint"
    ]
  },
  {
    id: "preset-compact",
    name: "Compact Mode",
    category: "Presets",
    description: "Similar to the default mode, but the artwork is on the right and a little smaller, opening up slightly more room for the main content",
    enabled: [
      "artwork-right",
      "center-lr-margins"
    ],
    disabled: [
      "artwork-expand-top",
      "main-content-centered"
    ]
  },
  {
    id: "preset-sandwich",
    name: "Space Sandwich Mode",
    category: "Presets",
    description: "A pretty unique design that puts style over legibility. Text is dynamically influenced by the background image, giving it a 'space-like' appearance. " +
      "Additionally, the layout is more tightly arranged, like a sandwich",
    enabled: [
      "color-dodge-skin",
      "text-shadows",
      "slow-transitions",
      "split-main-panels",
      "swap-artist-title",
      "center-lr-margins",
      "progress-bar-gradient",
      "reverse-bottom",
      "progress-bar-gradient",
      "extra-wide-mode"
    ],
    disabled: [
      "show-featured-artists",
      "show-featured-artists-track-list",
      "artwork-expand-top",
      "show-release-name",
      "show-release-date",
      "show-timestamps-track-list",
      "show-volume",
      "show-device",
      "bg-tint",
      "bg-blur",
      "bg-zoom"
    ]
  },
  {
    id: "preset-xl-artwork",
    name: "XL-Artwork Mode",
    category: "Presets",
    description: "The artwork is stretched to its maximum possible size. Apart from that, only the current track, the tracklist, and the progress bar are displayed",
    enabled: [
      "artwork-expand-bottom",
      "decreased-margins"
    ],
    disabled: [
      "enable-top-content",
      "show-timestamps",
      "show-info-icons",
      "show-volume",
      "show-volume-bar",
      "show-device",
      "show-clock"
    ]
  },
  {
    id: "preset-vintage",
    name: "Vintage Mode",
    category: "Presets",
    description: "A preset inspired by the original Spotify layout on Chromecast. The main content will be displayed below the artwork, the tracklist is disabled, the background is only a gradient color",
    enabled: [
      "artwork-above-content",
      "spread-timestamps",
      "reduced-center-margins",
      "show-next-track",
    ],
    disabled: [
      "show-queue",
      "show-release-name",
      "show-release-date",
      "show-info-icons",
      "show-device",
      "show-volume",
      "bg-artwork",
      "show-clock"
    ]
  },
  {
    id: "preset-big-current-song",
    name: "Big Current-Track Mode",
    category: "Presets",
    description: "Only shows the current track's title, artist, and release in an extra large manner. The tracklist is disabled, the artwork is moved to the background",
    enabled: [
      "xl-text",
      "split-main-panels",
      "separate-release-line",
      "spread-timestamps",
      "reverse-bottom",
      "show-next-track",
      "featured-artists-new-line"
    ],
    disabled: [
      "album-view",
      "show-device",
      "show-volume",
      "show-volume-bar",
      "show-info-icons",
      "show-queue",
      "display-artwork",
      "show-timestamps-track-list",
      "show-clock"
    ]
  },
  {
    id: "preset-wallpaper-mode",
    name: "Wallpaper Mode",
    category: "Presets",
    description: "Just displays the background and a clock, to be used as some sort of wallpaper",
    enabled: [
      "color-dodge-skin",
      "text-shadows",
      "progress-bar-gradient",
      "reverse-bottom"
    ],
    disabled: [
      "enable-top-content",
      "enable-center-content",
      "display-artwork",
      "show-progress-bar",
      "show-info-icons",
      "show-volume",
      "show-device",
      "show-timestamps",
      "bg-tint",
      "show-queue"
    ]
  },
  {
    id: "preset-artwork-only",
    name: "Artwork-Only Mode",
    category: "Presets",
    description: "Just displays the artwork on a gradient background, literally nothing else",
    enabled: [
      "artwork-expand-bottom"
    ],
    disabled: [
      "enable-center-content",
      "show-queue",
      "album-view",
      "show-timestamps-track-list",
      "show-podcast-descriptions",
      "show-artists",
      "show-titles",
      "show-release-name",
      "show-release-date",
      "enable-top-content",
      "enable-bottom-content",
      "show-context",
      "show-context-summary",
      "show-context-thumbnail",
      "show-logo",
      "show-timestamps",
      "show-info-icons",
      "show-volume",
      "show-volume-bar",
      "show-device",
      "show-progress-bar",
      "show-clock",
      "bg-artwork"
    ]
  },
  {
    id: "preset-vertical",
    name: "Vertical Mode",
    category: "Presets",
    description: "A preset optimized (only) for portrait mode. The main content will be displayed below the artwork. "
      + "Don't use this preset on widescreen monitors, as it will likely break everything",
    enabled: [
      "artwork-above-content",
      "spread-timestamps",
      "reverse-bottom",
      "center-info-icons"
    ],
    disabled: [
      "artwork-expand-top",
      "show-info-icons",
      "show-device",
      "show-volume"
    ]
  }
];