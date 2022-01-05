let currentData = {
  album: "",
  albumTracks: [],
  albumTrackNumber: 0,
  albumView: false,
  artists: [],
  context: "",
  description: "",
  device: "",
  id: "",
  image: "",
  imageColors: {
    averageBrightness: 0.0,
    primary: {
      r: 0,
      g: 0,
      b: 0
    },
    secondary: {
      r: 0,
      g: 0,
      b: 0
    }
  },
  paused: true,
  release: "",
  repeat: "",
  shuffle: false,
  timeCurrent: 0,
  timeTotal: 0,
  title: "",
  type: "",
  deployTime: 0
};

let idle = false;


///////////////////////////////
// WEB STUFF
///////////////////////////////

const FLUX_URL = "/playback-info-flux";
const INFO_URL = "/playback-info";
const INFO_URL_FULL = INFO_URL + "?full=true";
const RETRY_TIMEOUT_MS = 5 * 1000;

window.addEventListener('load', init);

function init() {
  singleRequest(true);
  closeFlux();
  startFlux();
  createHeartbeatTimeout();
}

function singleRequest(forceFull) {
  let url = forceFull ? INFO_URL_FULL : INFO_URL;
  fetch(url)
      .then(response => response.json())
      .then(json => processJson(json))
      .catch(ex => {
        console.error("Single request", ex);
        setTimeout(() => singleRequest(forceFull), RETRY_TIMEOUT_MS);
      });
}

let flux;

function startFlux() {
  setTimeout(() => {
    try {
      closeFlux();
      flux = new EventSource(FLUX_URL);
      flux.onopen = () => {
        console.info("Flux connected!");
        singleRequest(true);
      };
      flux.onmessage = (event) => {
        try {
          createHeartbeatTimeout();
          if (idle) {
            singleRequest(true);
          } else {
            let data = event.data;
            let json = JSON.parse(data);
            processJson(json);
          }
        } catch (ex) {
          console.error("Flux onmessage", ex);
          startFlux();
        }
      };
      flux.onerror = (ex) => {
        console.error("Flux onerror", ex);
        startFlux();
      };
    } catch (ex) {
      console.error("Flux creation", ex);
      startFlux();
    }
  }, RETRY_TIMEOUT_MS);
}

function closeFlux() {
  if (flux) {
    flux.close();
  }
}

window.addEventListener('beforeunload', closeFlux);

function processJson(json) {
  if (json.type === "DATA") {
    if ('deployTime' in json && currentData.deployTime > 0 && json.deployTime > currentData.deployTime) {
      window.location.reload();
    } else {
      setDisplayData(json)
          .then(() => startTimers());
    }
  }
}

const HEARTBEAT_TIMEOUT_MS = 60 * 1000;
let heartbeatTimeout;

function createHeartbeatTimeout() {
  clearTimeout(heartbeatTimeout);
  heartbeatTimeout = setTimeout(() => {
    console.error("Heartbeat timeout")
    init();
  }, HEARTBEAT_TIMEOUT_MS);
}

///////////////////////////////
// MAIN DISPLAY STUFF
///////////////////////////////

async function setDisplayData(changes) {
  console.debug(changes);
  changeImage(changes)
      .then(() => setTextData(changes));
}

const MAX_ALBUM_VIEW_SONGS = 20; // TODO use a sliding window method instead, so that longer albums can also be fully displayed
function setTextData(changes) {
  // Main Info
  let titleContainer = document.getElementById("title");
  let trackListContainer = document.getElementById("track-list");
  if ('albumView' in changes || 'albumTracks' in changes) {
    let albumTrackCount = (changes.albumTracks || currentData.albumTracks).length
    let albumViewEnabled = ('albumView' in changes ? changes.albumView : currentData.albumView) && albumTrackCount <= MAX_ALBUM_VIEW_SONGS;
    showHide(titleContainer, !albumViewEnabled);
    showHide(trackListContainer, albumViewEnabled);
  }

  if (('title' in changes && changes.title !== currentData.title && !changes.albumView)
      || ('albumView' in changes && !changes.albumView && currentData.albumView)) {
    let titleBase = changes.title || currentData.title;
    let normalizedEmoji = convertToTextEmoji(titleBase);
    let titleNoFeat = removeFeaturedArtists(normalizedEmoji);
    let splitTitle = separateUnimportantTitleInfo(titleNoFeat);
    let titleMain = splitTitle[0];
    let titleExtra = splitTitle[1];
    document.getElementById("title-main").innerHTML = titleMain;
    document.getElementById("title-extra").innerHTML = titleExtra;

    fadeIn(titleContainer);
  }

  if ('albumTracks' in changes) {
    trackListContainer.innerHTML = "";
    let albumTracks = changes.albumTracks || currentData.albumTracks;
    let trackNumPadLength = albumTracks.length.toString().length;
    for (let trackItem of albumTracks) {
      let trackElem = document.createElement("div");
      trackElem.className = "track-elem";

      let trackNumberContainer = document.createElement("div");
      trackNumberContainer.innerHTML = padToLength(trackItem.albumTrackNumber, trackNumPadLength);
      trackNumberContainer.className = "track-number"

      let trackName = document.createElement("div");
      trackName.innerHTML = trackItem.title;
      trackName.className = "track-name"

      let trackLength = document.createElement("div");
      trackName.className = "track-length"
      trackLength.innerHTML = formatTime(0, trackItem.length).total;

      trackElem.append(trackNumberContainer, trackName, trackLength);
      trackListContainer.append(trackElem);
    }
    fadeIn(trackListContainer);
  }

  if ('albumTrackNumber' in changes || currentData.albumView) {
    let trackNumber = changes.albumTrackNumber || currentData.albumTrackNumber;
    let currentlyPlayingElem = [...trackListContainer.childNodes].find(node => node.classList.contains("current"));
    if (trackNumber !== currentData.albumTrackNumber || !currentlyPlayingElem) {
      let currentlyPlayingTrackElem = trackListContainer.childNodes[trackNumber - 1];
      if (currentlyPlayingTrackElem) {
        trackListContainer.childNodes.forEach(node => node.classList.remove("current"));
        currentlyPlayingTrackElem.classList.add("current");
        fadeIn(currentlyPlayingTrackElem);
      }
    }
  }

  if ('artists' in changes && JSON.stringify(changes.artists) !== JSON.stringify(currentData.artists)) {
    let artists = changes.artists;
    let artistsString = artists[0];
    if (artists.length > 1) {
      let featuredArtists = artists.slice(1).join(" & ");
      artistsString += ` (feat. ${featuredArtists})`;
    }
    document.getElementById("artists").innerHTML = convertToTextEmoji(artistsString);

    fadeIn(document.getElementById("artists"));
  }

  if (('album' in changes && changes.album !== currentData.album) || ('release' in changes && changes.release !== currentData.release)) {
    let album = 'album' in changes ? changes.album : currentData.album;
    let normalizedEmoji = convertToTextEmoji(album);
    let splitTitle = separateUnimportantTitleInfo(normalizedEmoji);
    let albumTitleMain = splitTitle[0];
    let albumTitleExtra = splitTitle[1];
    document.getElementById("album-title-main").innerHTML = albumTitleMain;
    document.getElementById("album-title-extra").innerHTML = albumTitleExtra;

    document.getElementById("album-release").innerHTML = 'release' in changes ? changes.release : currentData.release;

    fadeIn(document.getElementById("album"));
  }

  if ('description' in changes && changes.description !== currentData.description) {
    let descriptionElem = document.getElementById("description");
    let isPodcast = changes.description !== "BLANK";
    descriptionElem.innerHTML = isPodcast ? changes.description : "";
    fadeIn(descriptionElem);
  }

  // Meta Info
  if ('context' in changes && changes.context !== currentData.context) {
    document.getElementById("context").innerHTML = convertToTextEmoji(changes.context);
    fadeIn(document.getElementById("context"));
  }

  if ('device' in changes && changes.device !== currentData.device) {
    document.getElementById("device").innerHTML = convertToTextEmoji(changes.device);
    fadeIn(document.getElementById("device"));
  }

  // Time
  if ('timeCurrent' in changes || 'timeTotal' in changes) {
    updateProgress(changes, true);
    if ('id' in changes) {
      finishAnimations(document.getElementById("progress-current"));
    }
  }

  // States
  if ('paused' in changes && changes.paused !== currentData.paused) {
    let paused = changes.paused != null ? changes.paused : currentData.paused;
    let pauseElem = document.getElementById("play-pause");
    setClass(pauseElem, "paused", paused);
    fadeIn(pauseElem);
  }

  if ('shuffle' in changes && changes.shuffle !== currentData.shuffle) {
    let shuffle = changes.shuffle != null ? changes.shuffle : currentData.shuffle;
    let shuffleElem = document.getElementById("shuffle");
    setClass(shuffleElem, "show", shuffle);
    fadeIn(shuffleElem);
  }

  if ('repeat' in changes && changes.repeat !== currentData.repeat) {
    let repeat = changes.repeat != null ? changes.repeat : currentData.repeat;
    let repeatElem = document.getElementById("repeat");
    setClass(repeatElem, "show", repeat !== "off");
    if (changes.repeat === "track") {
      repeatElem.classList.add("once");
    } else {
      repeatElem.classList.remove("once");
    }
    fadeIn(repeatElem);
    handleAlternateDarkModeToggle();
  }

  // Color
  if ('imageColors' in changes) {
    setTextColor(changes.imageColors.primary);
  }

  // Update properties in local storage
  for (let prop in changes) {
    currentData[prop] = changes[prop];
  }

  // Re-balance all updated texts
  balanceText.updateWatched();
}

function setClass(elem, className, state) {
  if (state) {
    elem.classList.add(className);
  } else {
    elem.classList.remove(className);
  }
}

function showHide(elem, show, useInvisibility) {
  if (show) {
    elem.classList.remove("invisible");
    elem.classList.remove("hidden");
  } else {
    if (useInvisibility) {
      elem.classList.add("invisible");
      elem.classList.remove("hidden");
    } else {
      elem.classList.add("hidden");
      elem.classList.remove("invisible");
    }
  }
}

const USELESS_WORDS = ["radio", "anniversary", "bonus", "deluxe", "special", "remaster", "explicit", "extended", "expansion", "expanded", "cover", "original", "motion\\spicture", "re.?issue", "re.?record", "\\d{4}"];
const WHITELISTED_WORDS = ["instrumental", "orchestral", "symphonic"];

// Two regexes for readability, cause otherwise it'd be a nightmare to decipher brackets from hyphens
const USELESS_WORDS_REGEX_BRACKETS = new RegExp("\\s(\\(|\\[).*?(" + USELESS_WORDS.join("|") + ").*?(\\)|\\])", "ig");
const USELESS_WORDS_REGEX_HYPHEN = new RegExp("\\s-\\s.*?(" + USELESS_WORDS.join("|") + ").*", "ig");
const WHITELISTED_WORDS_REGEXP = new RegExp(".*(" + WHITELISTED_WORDS.join("|") + ").*", "ig");

function separateUnimportantTitleInfo(title) {
  if (title.search(WHITELISTED_WORDS_REGEXP) < 0) {
    let index = title.search(USELESS_WORDS_REGEX_BRACKETS);
    if (index < 0) {
      index = title.search(USELESS_WORDS_REGEX_HYPHEN);
    }
    if (index >= 0) {
      let mainTitle = title.substring(0, index);
      let extra = title.substring(index, title.length);
      return [mainTitle, extra];
    }
  }
  return [title, ""];
}

function convertToTextEmoji(text) {
  return [...text]
      .map((char) => char.codePointAt(0) > 127 ? `&#${char.codePointAt(0)};&#xFE0E;` : char)
      .join('');
}

function removeFeaturedArtists(title) {
  return title.replace(/[(|\[](f(ea)?t|with).+?[)|\]]/ig, "").trim();
}

function finishAnimations(elem) {
  elem.getAnimations().forEach(ani => ani.finish());
}

function fadeIn(elem) {
  finishAnimations(elem);
  elem.classList.add("transparent", "text-glow");
  finishAnimations(elem);
  elem.classList.remove("transparent", "text-glow");
}

const BALANCED_ELEMENTS_TO_WATCH = ["artists", "title", "description", "album", "context", "device"];
window.addEventListener('load', registerWatchedBalanceTextElements);
function registerWatchedBalanceTextElements() {
  for (let id of BALANCED_ELEMENTS_TO_WATCH) {
    let textElem = document.getElementById(id);
    balanceText(textElem, {watch: true});
  }
}


///////////////////////////////
// IMAGE
///////////////////////////////

const EMPTY_IMAGE_DATA = "https://i.scdn.co/image/ab67616d0000b273f292ec02a050dd8a6174cd4e"; // 640x640 black square
const DEFAULT_IMAGE = 'design/img/idle.png';
const DEFAULT_RGB = {
  r: 255,
  g: 255,
  b: 255
};

function changeImage(changes) {
  return new Promise(async (resolve) => {
    if ('image' in changes || 'imageColors' in changes) {
      if (changes.image === "BLANK") {
        changes.image = DEFAULT_IMAGE;
        changes.imageColors = {primary: DEFAULT_RGB, secondary: DEFAULT_RGB};
      }
      let newImage = changes.image != null ? changes.image : currentData.image;
      let colors = changes.imageColors != null ? changes.imageColors : currentData.imageColors;
      if (newImage) {
        let oldImage = document.getElementById("artwork-img").src;
        if (!oldImage.includes(newImage)) {
          await prerenderAndSetArtwork(newImage, colors, true);
        }
      }
    }
    resolve();
  });
}

function prerenderAndSetArtwork(newImage, colors, refreshArtwork) {
  return new Promise((resolve) => {
    loadBackground(newImage, colors)
        .then(() => renderAndShow())
        .then(() => loadArtwork(newImage, refreshArtwork))
        .then(resolve);
  });
}


function loadArtwork(newImage, refreshArtwork) {
  return new Promise((resolve) => {
    if (!refreshArtwork) {
      resolve();
      return;
    }
    let artwork = document.getElementById("artwork-img");
    setClass(artwork, "transparent", true);
    finishAnimations(artwork);
    artwork.onload = () => {
      setClass(artwork, "transparent", false);
      resolve();
    }
    artwork.src = newImage;
  });
}


function loadBackground(newImage, colors) {
  return new Promise((resolve) => {
    let backgroundCanvasImg = document.getElementById("background-canvas-img");
    backgroundCanvasImg.onload = () => {
      let rgbOverlay = colors.secondary;
      let averageBrightness = colors.averageBrightness;
      let prerenderCanvas = document.getElementById("prerender-canvas");
      let backgroundCanvasOverlay = document.getElementById("background-canvas-overlay");

      setClass(prerenderCanvas, "show", true);
      let backgroundColorOverlay = `rgb(${rgbOverlay.r}, ${rgbOverlay.g}, ${rgbOverlay.b})`;
      backgroundCanvasOverlay.style.setProperty("--background-color", backgroundColorOverlay);
      backgroundCanvasOverlay.style.setProperty("--background-brightness", averageBrightness);
      setClass(backgroundCanvasOverlay, "boost", averageBrightness < 0.2);
      setClass(backgroundCanvasOverlay, "soften", averageBrightness > 0.7);
      resolve();
    };
    backgroundCanvasImg.src = newImage;
  });
}

function renderAndShow() {
  return new Promise((resolve, reject) => {
    let backgroundImg = document.getElementById("background-img");
    let backgroundCrossfade = document.getElementById("background-img-crossfade");
    let prerenderCanvas = document.getElementById("prerender-canvas");

    // While PNG produces the by far largest Base64 image data, the actual conversion process
    // is significantly faster than with JPEG or SVG (still not perfect though)
    let pngData;
    domtoimage
        .toPng(prerenderCanvas, {width: window.innerWidth / 2.0, height: window.innerHeight / 2.0})
        .then((imgDataBase64) => {
          if (imgDataBase64.length < 10) {
            throw 'Rendered image data is invalid';
          }
          pngData = imgDataBase64;
        })
        .catch((error) => {
          pngData = EMPTY_IMAGE_DATA;
          console.warn("Failed to render background, using black square instead", error);
        })
        .finally(() => {
          setClass(backgroundCrossfade, "show", true);
          backgroundCrossfade.onload = () => {
            finishAnimations(backgroundCrossfade);
            backgroundImg.onload = () => {
              setClass(backgroundCrossfade, "show", false);
              setClass(prerenderCanvas, "show", false);
              resolve();
            };
            backgroundImg.src = pngData;
          };
          backgroundCrossfade.src = backgroundImg.src ? backgroundImg.src : EMPTY_IMAGE_DATA;
        });
  });
}

function refreshBackgroundRender() {
  if (currentData.image && currentData.imageColors && findPreference("prerender").state) {
    prerenderAndSetArtwork(currentData.image, currentData.imageColors, false).then();
  }
}

function setTextColor(rgbText) {
  document.documentElement.style.setProperty("--color", `rgb(${rgbText.r}, ${rgbText.g}, ${rgbText.b})`);
}


///////////////////////////////
// PROGRESS
///////////////////////////////

function updateProgress(changes, updateProgressBar) {
  let current = 'timeCurrent' in changes ? changes.timeCurrent : currentData.timeCurrent;
  let total = 'timeTotal' in changes ? changes.timeTotal : currentData.timeTotal;
  let paused = 'paused' in changes ? changes.paused : currentData.paused;

  // Text
  let formattedTimes = formatTime(current, total)
  let formattedCurrentTime = formattedTimes.current;
  let formattedTotalTime = formattedTimes.total;

  let elemTimeCurrent = document.getElementById("time-current");
  elemTimeCurrent.innerHTML = formattedCurrentTime;

  let elemTimeTotal = document.getElementById("time-total");
  if (formattedTotalTime !== elemTimeTotal.innerHTML) {
    elemTimeTotal.innerHTML = formattedTotalTime;
  }

  // Title
  let newTitle = "Spotify Big Picture";
  if (!idle && currentData.artists && currentData.title) {
    newTitle = `[${formattedCurrentTime} / ${formattedTotalTime}] ${currentData.artists[0]} - ${removeFeaturedArtists(currentData.title)} | ${newTitle}`;
  }
  document.title = newTitle;

  // Progress Bar
  if (updateProgressBar) {
    setProgressBarTarget(current, total, paused);
  }
}

function setProgressBarTarget(current, total, paused) {
  let progressBarElem = document.getElementById("progress-current");

  let progressPercent = Math.min(1, ((current / total))) * 100;
  if (isNaN(progressPercent)) {
    progressPercent = 0;
  }
  progressBarElem.style.width = progressPercent + "%";

  finishAnimations(progressBarElem);
  if (!paused) {
    let remainingTimeMs = total - current;
    progressBarElem.style.setProperty("--progress-speed", remainingTimeMs + "ms");
    requestAnimationFrame(() => {
      progressBarElem.style.width = "100%";
    });
  }
}

function formatTime(current, total) {
  let currentHMS = calcHMS(current);
  let totalHMS = calcHMS(total);

  let formattedCurrent = `${pad2(currentHMS.seconds)}`;
  let formattedTotal = `${pad2(totalHMS.seconds)}`;
  if (totalHMS.minutes >= 10 || totalHMS.hours >= 1) {
    formattedCurrent = `${pad2(currentHMS.minutes)}:${formattedCurrent}`;
    formattedTotal = `${pad2(totalHMS.minutes)}:${formattedTotal}`;
    if (totalHMS.hours > 0) {
      formattedCurrent = `${currentHMS.hours}:${formattedCurrent}`;
      formattedTotal = `${totalHMS.hours}:${formattedTotal}`;
    }
  } else {
    formattedCurrent = `${currentHMS.minutes}:${formattedCurrent}`;
    formattedTotal = `${totalHMS.minutes}:${formattedTotal}`;
  }

  return {
    current: formattedCurrent,
    total: formattedTotal
  };
}

function calcHMS(ms) {
  let s = Math.round(ms / 1000) % 60;
  let m = Math.floor((Math.round(ms / 1000)) / 60) % 60;
  let h = Math.floor((Math.floor((Math.round(ms / 1000)) / 60)) / 60);
  return {
    hours: h,
    minutes: m,
    seconds: s
  };
}

function pad2(num) {
  return padToLength(num, 2);
}

function padToLength(num, length) {
  return num.toString().padStart(length, '0');
}


///////////////////////////////
// TIMERS
///////////////////////////////

const ADVANCE_CURRENT_TIME_MS = 1000;
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const REQUEST_ON_SONG_END_MS = 2 * 1000;

let autoTimer;
let idleTimeout;

function startTimers() {
  clearTimers();

  startTime = Date.now();
  autoTimer = setInterval(() => advanceCurrentTime(), ADVANCE_CURRENT_TIME_MS);

  idleTimeout = setTimeout(() => setIdleModeState(true), IDLE_TIMEOUT_MS);
  setIdleModeState(false);
}

function clearTimers() {
  clearInterval(autoTimer);
  clearTimeout(idleTimeout);
}

let startTime;

function advanceCurrentTime() {
  if (currentData != null && currentData.timeCurrent != null && !currentData.paused) {
    let now = Date.now();
    let elapsedTime = now - startTime;
    startTime = now;
    let newTime = currentData.timeCurrent + elapsedTime;
    if (newTime > currentData.timeTotal && currentData.timeCurrent < currentData.timeTotal) {
      setTimeout(() => singleRequest(true), REQUEST_ON_SONG_END_MS);
    }
    currentData.timeCurrent = Math.min(currentData.timeTotal, newTime);
    updateProgress(currentData, false);
  }
}

function setIdleModeState(state) {
  let content = document.getElementById("main");
  if (state) {
    if (!idle) {
      idle = true;
      clearTimers();
      showHide(content, false);
      currentData = {};
    }
  } else {
    idle = false;
    showHide(content, true);
  }
}



///////////////////////////////
// VISUAL PREFERENCES
///////////////////////////////

const PREFERENCES = [
  {
    id: "fullscreen",
    name: "Fullscreen",
    hotkey: "f",
    description: "Toggles fullscreen on and off (can also be toggled by double clicking anywhere on the screen). " +
        "This setting is not persisted between sessions due to browser security limitations",
    state: false,
    callback: () => toggleFullscreen(),
    volatile: true // don't add fullscreen in the URL params, as it won't work (browser security shenanigans)
  },
  {
    id: "bg-artwork",
    name: "Background Artwork",
    hotkey: "b",
    description: "If enabled, uses the release artwork for the background as a blurry, darkened version. Otherwise, only a gradient color will be displayed",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("background-canvas-img"), "color-only", !state);
      refreshBackgroundRender();
    }
  },
  {
    id: "colored-text",
    name: "Colored Text",
    hotkey: "c",
    description: "If enabled, the dominant color of the current artwork will be used as color for all texts and symbols. Otherwise, plain white will be used",
    state: true,
    callback: (state) => setClass(document.body, "no-colored-text", !state)
  },
  {
    id: "transitions",
    name: "Transitions",
    hotkey: "t",
    description: "Smoothly fade from one song to another. Otherwise, song switches will be displayed immediately",
    state: true,
    callback: (state) => setTransitions(state)
  },
  {
    id: "strip-titles",
    name: "Strip Titles",
    hotkey: "s",
    description: "Hides any kind of unnecessary extra information from song tiles and release names " +
        `(such as 'Remastered Version', 'Anniversary Edition', '${new Date().getFullYear()} Re-Issue', etc.)`,
    state: true,
    callback: (state) => {
      setClass(document.getElementById("title-extra"), "hide", state);
      setClass(document.getElementById("album-title-extra"), "hide", state);
    }
  },
  {
    id: "prerender",
    name: "Prerender Background",
    hotkey: "p",
    description: "Captures a screenshot of the background image and displays that instead of the live background. " +
        "This will save on resources for low-end PCs due to the nature of complex CSS, but it will increase the delay between song switches",
    state: true,
    callback: (state) => {
      showHide(document.getElementById("background-rendered"), state);
      setClass(document.getElementById("prerender-canvas"), "no-prerender", !state);
      refreshBackgroundRender();
    }
  },
  {
    id: "show-clock",
    name: "Clock",
    hotkey: "w",
    description: "Displays a clock in the bottom center of the page",
    state: true,
    callback: (state) => setClass(document.getElementById("clock"), "hide", !state)
  },
  {
    id: "dark-mode",
    name: "Dark Mode",
    hotkey: "d",
    description: "Darkens the entire screen by 50%. This setting will be automatically disabled after 8 hours",
    state: false,
    callback: (state) => {
      const DARK_MODE_AUTOMATIC_DISABLE_TIMEOUT = 8 * 60 * 60 * 1000;
      setClass(document.getElementById("dark-overlay"), "show", state);
      clearTimeout(darkModeTimeout);
      if (this.state) {
        darkModeTimeout = setTimeout(() => {
          refreshPreference(id, false);
          refreshPrefsQueryParam();
        }, DARK_MODE_AUTOMATIC_DISABLE_TIMEOUT);
      }
    }
  },
];

function findPreference(id) {
  return PREFERENCES.find(pref => pref.id === id);
}

const PREFS_URL_PARAM = "p";

window.addEventListener('load', initVisualPreferences);

function initVisualPreferences() {
  const settingsWrapper = document.getElementById("settings-buttons");
  const settingsDescriptionWrapper = document.getElementById("settings-description");
  const urlParams = new URLSearchParams(window.location.search);
  const urlPrefs = urlParams.has(PREFS_URL_PARAM)
      ? unescape(urlParams.get(PREFS_URL_PARAM)).split(" ")
      : null;
  for (let prefIndex in PREFERENCES) {
    let pref = PREFERENCES[prefIndex];

    // Set state on site load
    let state = pref.state;
    if (urlPrefs) {
      state = urlPrefs.includes(pref.id);
    }
    pref.state = state;

    // Create button element
    let prefElem = document.createElement("div");
    prefElem.id = pref.id;
    prefElem.classList.add("setting");
    prefElem.innerHTML = `${pref.name} (${pref.hotkey})`;
    prefElem.onclick = () => toggleVisualPreference(pref);
    settingsWrapper.appendChild(prefElem);

    // Create description element
    let descElem = document.createElement("div");
    descElem.id = pref.id + "-description";
    descElem.innerHTML = pref.description;
    settingsDescriptionWrapper.appendChild(descElem);

    // Init setting
    refreshPreference(pref, state);
  }
  document.querySelector("#fullscreen").onclick = toggleFullscreen;

  refreshPrefsQueryParam();
}

function refreshPrefsQueryParam() {
  let urlPrefs = [];
  for (let pref of PREFERENCES) {
    if (!pref.volatile && pref.state) {
      urlPrefs.push(pref.id);
    }
  }

  const url = new URL(window.location);
  url.searchParams.set(PREFS_URL_PARAM, urlPrefs.join("+"));
  window.history.replaceState({}, 'Spotify Big Picture', unescape(url.toString()));
}

function toggleVisualPreference(pref) {
  if (pref.volatile) {
    pref.callback();
  } else {
    let newState = !pref.state;
    refreshPreference(pref, newState);
    refreshPrefsQueryParam();
  }
}

let darkModeTimeout;

function refreshPreference(preference, state) {
  if (!preference.volatile) {
    preference.state = state;
    preference.callback(state);

    // Toggle Checkmark
    let classList = document.getElementById(preference.id).classList;
    if (state) {
      classList.add("on");
    } else {
      classList.remove("on");
    }
  }
}

function setTransitions(state) {
  setClass(document.body, "transition", state);
  showHide(document.getElementById("background-img-crossfade"), state, true);
}

function toggleFullscreen() {
  if (document.fullscreenEnabled) {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then();
    } else {
      document.exitFullscreen().then();
    }
  }
}

const TOGGLE_DARK_MODE_COUNT = 3;
let toggleDarkModeCount = 0;
let toggleDarkModeTimeout;

function handleAlternateDarkModeToggle() {
  clearTimeout(toggleDarkModeTimeout);
  toggleDarkModeCount++;
  if (toggleDarkModeCount >= TOGGLE_DARK_MODE_COUNT) {
    let darkModePref = findPreference("dark-mode");
    if (darkModePref) {
      toggleVisualPreference(darkModePref);
    }
    toggleDarkModeCount = 0;
  } else {
    toggleDarkModeTimeout = setTimeout(() => toggleDarkModeCount = 0, TOGGLE_DARK_MODE_COUNT * 1000 * 2);
  }
}


///////////////////////////////
// REFRESH IMAGE ON RESIZE
///////////////////////////////

const REFRESH_BACKGROUND_ON_RESIZE_DELAY = 250;
let refreshBackgroundEvent;
window.onresize = () => {
  clearTimeout(refreshBackgroundEvent);
  refreshBackgroundEvent = setTimeout(() => {
    refreshBackgroundRender();
  }, REFRESH_BACKGROUND_ON_RESIZE_DELAY);
};


///////////////////////////////
// HOTKEYS
///////////////////////////////

document.onkeydown = (e) => {
  let pref = PREFERENCES.find(element => element.hotkey === e.key);
  if (pref) {
    toggleVisualPreference(pref);
  }
};


///////////////////////////////
// MOUSE EVENTS
///////////////////////////////

document.addEventListener("mousemove", handleMouseEvent);
document.addEventListener("click", handleMouseEvent);
let cursorTimeout;
const MOUSE_MOVE_HIDE_TIMEOUT_MS = 500;

function setMouseVisibility(state) {
  setClass(document.documentElement, "hide-cursor", !state);
}

function handleMouseEvent() {
  clearTimeout(cursorTimeout);
  setMouseVisibility(true)
  cursorTimeout = setTimeout(() => {
    setMouseVisibility(false);
  }, MOUSE_MOVE_HIDE_TIMEOUT_MS);
}

window.addEventListener('load', initSettingsMouseMove);
function initSettingsMouseMove() {
  setMouseVisibility(false);
  let settings = document.getElementById("settings-buttons");
  let settingsWrapper = document.getElementById("settings-wrapper");
  let content = document.getElementById("content");
  settings.onmouseenter = (event) => {
    setClass(settingsWrapper, "show", true);
    setClass(content, "blur", true);
  };
  settings.onmouseleave = (event) => {
    setClass(settingsWrapper, "show", false);
    setClass(content, "blur", false);
  }
  settings.onmousemove = (event) => {
    requestAnimationFrame(() => clearTimeout(cursorTimeout));
    document.getElementById("settings-description").childNodes
        .forEach(elem => setClass(elem, "show", false));
    if (event.target.classList.contains("setting")) {
      let targetLabel = document.getElementById(event.target.id + "-description");
      setClass(targetLabel, "show", true);
    }
  }
}

document.addEventListener("dblclick", toggleFullscreen);

///////////////////////////////
// CLOCK
///////////////////////////////

const DATE_OPTIONS = {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23'
};
let prevTime;
setInterval(() => {
  let date = new Date();
  let time = date.toLocaleDateString('en-UK', DATE_OPTIONS);
  if (time !== prevTime) {
    prevTime = time;
    let clock = document.querySelector("#clock");
    clock.innerHTML = time;
  }
}, 1000);
