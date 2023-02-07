let currentData = {
  album: "",
  artists: [],
  context: "",
  deployTime: 0,
  description: "",
  device: "",
  discCount: 0,
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
  listTracks: [],
  paused: true,
  queue: [],
  release: "",
  repeat: "",
  shuffle: false,
  trackListView: "",
  trackNumber: 0,
  timeCurrent: 0,
  timeTotal: 0,
  title: "",
  type: "",
  volume: -1
};

let idle = false;


///////////////////////////////
// WEB STUFF - General
///////////////////////////////

const INFO_URL = "/playback-info";
const INFO_URL_FULL = INFO_URL + "?full=true";

window.addEventListener('load', entryPoint);

function entryPoint() {
  if (isPollingEnabled()) {
    initPolling();
  } else {
    initFlux();
  }
}

function isPollingEnabled() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has("polling")
      ? urlParams.get("polling") === "true"
      : false;
}

///////////////////////////////
// WEB STUFF - Polling
///////////////////////////////

let pollingInterval;
const POLLING_INTERVAL_MS = 1000;
function initPolling() {
  console.debug("Polling enabled!");
  clearTimeout(pollingInterval);
  pollingInterval = setInterval(() => {
    fetch(INFO_URL_FULL)
      .then(response => response.json())
      .then(json => {
        if (Math.abs(json.timeCurrent - currentData.timeCurrent) < 2000) {
          json.timeCurrent = currentData.timeCurrent;
        }
        return deepEqual(currentData, json) ? null : json;
      })
      .then(diffJson => processJson(diffJson))
      .catch(ex => {
        console.error("Single request", ex);
        clearTimeout(pollingInterval)
        initPolling();
      });
  }, POLLING_INTERVAL_MS);
}

///////////////////////////////
// WEB STUFF - Flux
///////////////////////////////

const FLUX_URL = "/playback-info-flux";
const RETRY_TIMEOUT_MS = 5 * 1000;
const FLUX_REFRESH_TIMEOUT_MS = 45 * 60 * 1000;

function initFlux() {
  singleRequest(true);
  closeFlux();
  startFlux();
  createHeartbeatTimeout();
}

function singleRequest(forceFull = true) {
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
let fluxRefresher;
function startFlux() {
  setTimeout(() => {
    try {
      closeFlux();
      flux = new EventSource(FLUX_URL);
      flux.onopen = () => {
        console.debug("Flux connected!");
        singleRequest();
      };
      flux.onmessage = (event) => {
        try {
          createHeartbeatTimeout();
          if (idle) {
            singleRequest();
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

  fluxRefresher = setInterval(() => {
    clearInterval(fluxRefresher);
    console.debug("Refreshing flux connection")
    closeFlux();
    startFlux();
  }, FLUX_REFRESH_TIMEOUT_MS)
}

function closeFlux() {
  if (flux) {
    flux.close();
  }
}

window.addEventListener('beforeunload', closeFlux);

const HEARTBEAT_TIMEOUT_MS = 60 * 1000;
let heartbeatTimeout;

function createHeartbeatTimeout() {
  clearTimeout(heartbeatTimeout);
  heartbeatTimeout = setTimeout(() => {
    console.error("Heartbeat timeout")
    initFlux();
  }, HEARTBEAT_TIMEOUT_MS);
}

///////////////////////////////
// MAIN DISPLAY STUFF
///////////////////////////////

function processJson(json) {
  if (json && json.type !== "HEARTBEAT" && json.type !== "EMPTY") {
    console.info(json);
    if (json.type === "DATA") {
      if ('deployTime' in json && currentData.deployTime > 0 && json.deployTime > currentData.deployTime) {
        window.location.reload(true);
      } else {
        if ('queue' in json && !('id' in json)) {
          // Handle weird edge-cases where the queue is updated before the other data
          // This is caused by race conditions within the Spotify API
          singleRequest(true);
          return;
        }
        setDisplayData(json)
          .then(() => startTimers());
      }
    } else if (json.type === "DARK_MODE") {
      toggleDarkMode();
    }
  }
}

async function setDisplayData(changes) {
  changeImage(changes)
    .then(() => setTextData(changes));
}

function setTextData(changes) {
  // Main Info
  let titleContainer = document.getElementById("title");
  let trackListContainer = document.getElementById("track-list");

  if (('title' in changes && JSON.stringify(changes.title) !== JSON.stringify(currentData.title))
      || ('trackListView' in changes && !changes.trackListView && currentData.trackListView)) {
    let titleBase = changes.title || currentData.title;
    let normalizedEmoji = convertToTextEmoji(titleBase);
    let titleNoFeat = removeFeaturedArtists(normalizedEmoji);
    let splitTitle = separateUnimportantTitleInfo(titleNoFeat);
    let titleMain = splitTitle.main;
    let titleExtra = splitTitle.extra;
    document.getElementById("title-main").innerHTML = titleMain;
    document.getElementById("title-extra").innerHTML = titleExtra;

    fadeIn(titleContainer);
  }

  if ('artists' in changes && JSON.stringify(changes.artists) !== JSON.stringify(currentData.artists)) {
    let artists = changes.artists;
    let artistsString = artists[0] + buildFeaturedArtistsString(artists);
    document.getElementById("artists").innerHTML = convertToTextEmoji(artistsString);

    fadeIn(document.getElementById("artists"));
  }

  if (('album' in changes && changes.album !== currentData.album) || ('release' in changes && changes.release !== currentData.release)) {
    let album = 'album' in changes ? changes.album : currentData.album;
    let normalizedEmoji = convertToTextEmoji(album);
    let splitTitle = separateUnimportantTitleInfo(normalizedEmoji);
    let albumTitleMain = splitTitle.main;
    let albumTitleExtra = splitTitle.extra;
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

  // Context
  if ('context' in changes && changes.context !== currentData.context) {
    let contextMain = document.getElementById("context-main");
    let contextExtra = document.getElementById("context-extra");

    let contextMainContent = convertToTextEmoji(changes.context);
    contextMain.innerHTML = contextMainContent.length > 80 ? contextMainContent.slice(0, 80) + "..." : contextMainContent; // TODO text-overflow with CSS

    let trackList = (changes.listTracks || currentData.listTracks || []);
    if (trackList.length > 0) {
      let trackCount = numberWithCommas(trackList.length);
      let totalDuration = formatTimeVerbose(trackList.reduce((a, b) => a + b.length, 0));
      let lengthInfo = `${trackCount} track${trackList.length !== 1 ? "s" : ""} (${totalDuration})`;
      if (contextMainContent.length > 0) {
        contextExtra.innerHTML = lengthInfo;
      } else {
        contextMain.innerHTML = totalDuration;
        contextExtra.innerHTML = trackCount + " track" + (trackList.length !== 1 ? "s" : "");
      }
    } else {
      contextExtra.innerHTML = "";
    }

    fadeIn(document.getElementById("context"));
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
  if ('volume' in changes && changes.volume !== currentData.volume) {
    let volume = changes.volume != null ? changes.volume : currentData.volume;
    let device = changes.device != null ? changes.device : currentData.device;
    handleVolumeChange(volume, device);
  }
  if ('device' in changes && changes.device !== currentData.device) {
    let device = changes.device;
    document.getElementById("device").innerHTML = convertToTextEmoji(device);
    handleDeviceChange(device);
  }

  // Color
  if ('imageColors' in changes) {
    setTextColor(changes.imageColors.primary);
  }

  // Playlist View
  setCorrectTracklistView(changes);

  // Update properties in local storage
  for (let prop in changes) {
    currentData[prop] = changes[prop];
  }

  // Re-balance all updated texts
  let scrollTopTrackListBackup = trackListContainer.scrollTop; // fix to keep scroll position in place
  balanceText.updateWatched();
  trackListContainer.scrollTop = scrollTopTrackListBackup;
}

function setCorrectTracklistView(changes) {
  let mainContainer = document.getElementById("center-info");
  let titleContainer = document.getElementById("title");
  let trackListContainer = document.getElementById("track-list");
  let listViewType = 'trackListView' in changes ? changes.trackListView : currentData.trackListView;
  let listTracks = (changes.listTracks || currentData.listTracks || [])
  let currentTrack = listTracks.find(t => t.id === (changes.id || currentData.id));
  let trackNumber = changes.trackNumber || currentData.trackNumber;
  let discCount = changes.discCount || currentData.discCount;
  let trackCount = listTracks.length;
  let shuffle = changes.shuffle != null ? changes.shuffle : currentData.shuffle;

  let specialQueue = (changes.context || currentData.context || "").startsWith("Queue >> ");
  let titleDisplayed = specialQueue || listViewType !== "ALBUM";
  let queueMode = specialQueue || listViewType === "QUEUE";
  let wasPreviouslyInQueueMode = mainContainer.classList.contains("queue");

  showHide(titleContainer, titleDisplayed);

  setClass(mainContainer, "queue", queueMode);

  let displayTrackNumbers = listViewType === "ALBUM" && !shuffle && !queueMode;
  setClass(trackListContainer, "show-tracklist-numbers", displayTrackNumbers)
  setClass(trackListContainer, "show-discs", !queueMode && discCount > 1)

  let displayTrackCount = titleDisplayed ? trackCount + 3 : trackCount;
  trackListContainer.style.setProperty("--track-count", displayTrackCount.toString());
  window.requestAnimationFrame(() => {
    let isOverflowing = trackListContainer.scrollHeight > trackListContainer.clientHeight;
    setClass(trackListContainer, "fit", isOverflowing);
  });

  ///////////

  let oldQueue = (queueMode ? currentData.queue : currentData.listTracks) || [];
  let newQueue = (queueMode ? changes.queue : changes.listTracks) || [];

  let refreshPrintedList =
       (queueMode !== wasPreviouslyInQueueMode)
    || (newQueue.length > 0 && (oldQueue.length !== newQueue.length || !trackListEquals(oldQueue, newQueue)));

  if (refreshPrintedList) {
    if (queueMode) {
      if (isExpectedNextSongInQueue(changes.id, currentData.queue)) {
        // Special animation when the expected next song comes up
        let trackListContainer = printTrackList([currentData.queue[0], ...changes.queue], false);
        window.requestAnimationFrame(() => {
          let currentTrackListTopElem = trackListContainer.querySelector(".track-elem:first-child");
          currentTrackListTopElem.querySelector(".track-name").ontransitionend = (e) => {
            let parent = e.target.parentNode;
            if (e.target.classList.contains("shrink")) {
              if (parent.classList.contains("track-elem")) {
                parent.remove();
              }
            } else {
              parent.childNodes.forEach(node => node.classList.add("shrink2"));
            }
          }
          currentTrackListTopElem.childNodes.forEach(node => node.classList.add("shrink"));
        });
      } else {
        printTrackList(changes.queue, false);
      }
    } else {
      let isMultiDisc = listTracks.find(t => 'discNumber' in t && t.discNumber > 1);
      printTrackList(listTracks, listViewType === "ALBUM" && isMultiDisc && !shuffle);
    }
  }

  let updateHighlightedTrack = (refreshPrintedList)
    || ('trackNumber' in changes && changes.trackNumber !== currentData.trackNumber);

  if (updateHighlightedTrack) {
    if (queueMode) {
      updateScrollPositions(1);
    } else {
      let targetTrackNumber = trackNumber + (discCount > 1 && 'discNumber' in currentTrack ? currentTrack.discNumber : 0);
      updateScrollPositions(targetTrackNumber);
    }
  }
}

function isExpectedNextSongInQueue(newSongId, previousQueue) {
  if (newSongId && previousQueue && previousQueue.length > 1) {
    let expectedNextSong = previousQueue[0];
    return newSongId === expectedNextSong.id;
  }
  return false
}

function trackListEquals(trackList1, trackList2) {
  let i = trackList1.length;
  while (i--) {
    if (trackList1[i].id !== trackList2[i].id) {
      return false;
    }
  }
  return true;
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

const USELESS_WORDS = ["radio", "anniversary", "bonus", "deluxe", "special", "remaster", "edition", "explicit", "extended", "expansion", "expanded", "version", "cover", "original", "motion\\spicture", "re.?issue", "re.?record", "re.?imagine", "\\d{4}"];
const WHITELISTED_WORDS = ["instrumental", "orchestral", "symphonic", "live", "classic", "demo"];

// Two regexes for readability, cause otherwise it'd be a nightmare to decipher brackets from hyphens
const USELESS_WORDS_REGEX_BRACKETS = new RegExp("\\s(\\(|\\[)[^-]*?(" + USELESS_WORDS.join("|") + ").*?(\\)|\\])", "ig");
const USELESS_WORDS_REGEX_HYPHEN = new RegExp("\\s-\\s[^-]*?(" + USELESS_WORDS.join("|") + ").*", "ig");
const WHITELISTED_WORDS_REGEXP = new RegExp("(\\(|\\-|\\[)[^-]*?(" + WHITELISTED_WORDS.join("|") + ").*", "ig");

function separateUnimportantTitleInfo(title) {
  if (title.search(WHITELISTED_WORDS_REGEXP) < 0) {
    let index = title.search(USELESS_WORDS_REGEX_BRACKETS);
    if (index < 0) {
      index = title.search(USELESS_WORDS_REGEX_HYPHEN);
    }
    if (index >= 0) {
      let mainTitle = title.substring(0, index);
      let extraTitle = title.substring(index, title.length);
      return {
        main: mainTitle,
        extra: extraTitle
      };
    }
  }
  return {
    main: title,
    extra: ""
  };
}

function convertToTextEmoji(text) {
  return [...text]
    .map((char) => char.codePointAt(0) > 127 ? `&#${char.codePointAt(0)};&#xFE0E;` : char)
    .join('');
}

function buildFeaturedArtistsString(artists) {
  if (artists.length > 1) {
    let featuredArtists = artists.slice(1).join(" & ");
    return ` (feat. ${featuredArtists})`;
  }
  return "";
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

const BALANCED_ELEMENTS_TO_WATCH = ["artists", "title", "description", "album-title"];
window.addEventListener('load', registerWatchedBalanceTextElements);
function registerWatchedBalanceTextElements() {
  for (let id of BALANCED_ELEMENTS_TO_WATCH) {
    let textElem = document.getElementById(id);
    balanceText(textElem, {watch: true});
  }
}

function printTrackList(trackList, printDiscs) {
  let trackListContainer = document.getElementById("track-list");
  trackListContainer.innerHTML = "";

  let previousDiscNumber = 0;
  let trackNumPadLength = Math.max(...trackList.map(t => t.trackNumber)).toString().length;

  for (let trackItem of trackList) {
    if (printDiscs && 'discNumber' in trackItem) {
      let newDiscNumber = trackItem.discNumber;
      if (newDiscNumber > previousDiscNumber) {
        previousDiscNumber = newDiscNumber
        let discTrackElem = createDiscElement(newDiscNumber);
        trackListContainer.append(discTrackElem);
      }
    }
    let trackElem = createSingleTrackListItem(trackItem, trackNumPadLength);
    trackListContainer.append(trackElem);
  }
  return trackListContainer;
}

function createDiscElement(discNumber) {
  let discTrackElem = document.createElement("div");
  discTrackElem.className = "track-elem disc";
  let discSymbolContainer = document.createElement("div");
  discSymbolContainer.className = "disc-symbol";
  discSymbolContainer.innerHTML = "&#x1F4BF;&#xFE0E;";
  let discNumberContainer = document.createElement("div");
  discNumberContainer.className = "disc-number";
  discNumberContainer.innerHTML = "Disc " + discNumber;
  discTrackElem.append(discSymbolContainer, discNumberContainer);
  return discTrackElem;
}

function createSingleTrackListItem(trackItem, trackNumPadLength) {
  // Create new track list item
  let trackElem = document.createElement("div");
  trackElem.className = "track-elem";

  // Track Number
  let trackNumberContainer = document.createElement("div");
  trackNumberContainer.className = "track-number";
  if ('trackNumber' in trackItem) {
    trackNumberContainer.innerHTML = padToLength(trackItem.trackNumber, trackNumPadLength);
  }

  // Artist
  let trackArtist = document.createElement("div");
  trackArtist.className = "track-artist";
  if ('artists' in trackItem) {
    trackArtist.innerHTML = trackItem.artists[0];
  }

  // Title
  let trackName = document.createElement("div");
  trackName.className = "track-name"
  if ('title' in trackItem) {
    let splitTitle = separateUnimportantTitleInfo(trackItem.title);
    let trackNameMain = document.createElement("span");
    trackNameMain.innerHTML = removeFeaturedArtists(splitTitle.main) + buildFeaturedArtistsString(trackItem.artists);
    let trackNameExtra = document.createElement("span");
    trackNameExtra.className = "extra";
    trackNameExtra.innerHTML = splitTitle.extra;
    trackName.append(trackNameMain, trackNameExtra);
  }

  // Length
  let trackLength = document.createElement("div");
  trackLength.className = "track-length"
  if ('length' in trackItem) {
    trackLength.innerHTML = formatTime(0, trackItem.length).total;
  }

  // Append
  trackElem.append(trackNumberContainer, trackArtist, trackName, trackLength);
  return trackElem;
}

window.addEventListener('load', setupScrollGradients);
function setupScrollGradients() {
  let trackList = document.getElementById("track-list");
  trackList.onscroll = () => updateScrollGradients();
}

const SCROLL_GRADIENTS_TOLERANCE = 4;
function updateScrollGradients() {
  let trackList = document.getElementById("track-list");
  let topGradient = trackList.scrollTop > SCROLL_GRADIENTS_TOLERANCE;
  let bottomGradient = (trackList.scrollHeight - trackList.clientHeight) > (trackList.scrollTop + SCROLL_GRADIENTS_TOLERANCE);
  setClass(trackList, "gradient-top", topGradient);
  setClass(trackList, "gradient-bottom", bottomGradient);
}

function updateScrollPositions(specificTrackNumber) {
  window.requestAnimationFrame(() => {
    let trackListContainer = document.getElementById("track-list");
    let trackNumber = specificTrackNumber ? specificTrackNumber : currentData.trackNumber;
    let previouslyPlayingRow = [...trackListContainer.childNodes].find(node => node.classList.contains("current"));
    if (specificTrackNumber || trackNumber !== currentData.trackNumber || !previouslyPlayingRow) {
      let currentlyPlayingRow = trackListContainer.childNodes[trackNumber - 1];
      if (currentlyPlayingRow && previouslyPlayingRow !== currentlyPlayingRow) {
        trackListContainer.childNodes.forEach(node => node.classList.remove("current"));
        currentlyPlayingRow.classList.add("current");

        let scrollUnit = trackListContainer.scrollHeight / trackListContainer.childNodes.length;
        let offsetDivider = currentData.trackListView === "PLAYLIST" ? 5 : 2;
        let scrollMiddleApproximation = Math.round((trackListContainer.offsetHeight / scrollUnit) / offsetDivider);
        let scroll = Math.max(0, scrollUnit * (trackNumber - scrollMiddleApproximation));
        trackListContainer.scroll({
          top: scroll,
          left: 0,
          behavior: 'smooth'
        });
      }
      updateScrollGradients();
    }
  });
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
      let grainOverlay = document.getElementById("grain");

      setClass(prerenderCanvas, "show", true);
      let backgroundColorOverlay = `rgb(${rgbOverlay.r}, ${rgbOverlay.g}, ${rgbOverlay.b})`;
      backgroundCanvasOverlay.style.setProperty("--background-color", backgroundColorOverlay);
      backgroundCanvasOverlay.style.setProperty("--background-brightness", averageBrightness);
      setClass(backgroundCanvasOverlay, "brighter", averageBrightness < 0.2);
      setClass(backgroundCanvasOverlay, "darker", averageBrightness > 0.7);
      grainOverlay.style.setProperty("--intensity", averageBrightness);
      resolve();
    };
    backgroundCanvasImg.src = newImage;
  });
}

const SCREENSHOT_SIZE_FACTOR = 0.5;
function renderAndShow() {
  return new Promise((resolve) => {
    let backgroundImg = document.getElementById("background-img");
    let backgroundCrossfade = document.getElementById("background-img-crossfade");
    let prerenderCanvas = document.getElementById("prerender-canvas");

    // While PNG produces the by far largest Base64 image data, the actual conversion process
    // is significantly faster than with JPEG or SVG (still not perfect though)
    let pngData;
    domtoimage
      .toPng(prerenderCanvas, {
        width: window.innerWidth * SCREENSHOT_SIZE_FACTOR,
        height: window.innerHeight * SCREENSHOT_SIZE_FACTOR
      })
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
  let formattedTimes = formatTime(current, total);
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

function formatTimeVerbose(timeInMs) {
  let hms = calcHMS(timeInMs);
  let hours = hms.hours;
  let minutes = hms.minutes;
  let seconds = hms.seconds;
  if (hours > 0) {
    return `${numberWithCommas(hours)} hr ${minutes} min`;
  } else {
    return `${minutes} min ${seconds} sec`;
  }
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

function numberWithCommas(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

///////////////////////////////
// TIMERS
///////////////////////////////

const ADVANCE_CURRENT_TIME_MS = 100;
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const REQUEST_ON_SONG_END_MS = 2 * 1000;

let autoTimer;
let idleTimeout;

function startTimers() {
  clearTimers();

  startTime = Date.now();
  autoTimer = setInterval(() => advanceCurrentTime(false), ADVANCE_CURRENT_TIME_MS);

  idleTimeout = setTimeout(() => setIdleModeState(true), IDLE_TIMEOUT_MS);
  setIdleModeState(false);
}

function clearTimers() {
  clearInterval(autoTimer);
  clearTimeout(idleTimeout);
}

let startTime;

function advanceCurrentTime(updateProgressBar) {
  if (currentData != null && currentData.timeCurrent != null && !currentData.paused) {
    let now = Date.now();
    let elapsedTime = now - startTime;
    startTime = now;
    let newTime = currentData.timeCurrent + elapsedTime;
    if (newTime > currentData.timeTotal && currentData.timeCurrent < currentData.timeTotal) {
      setTimeout(() => singleRequest(), REQUEST_ON_SONG_END_MS);
    }
    currentData.timeCurrent = Math.min(currentData.timeTotal, newTime);
    updateProgress(currentData, updateProgressBar);
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

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    advanceCurrentTime(true);
  }
});


///////////////////////////////
// VISUAL PREFERENCES
///////////////////////////////

const PREFERENCES = [
  {
    id: "fullscreen",
    name: "Full Screen",
    hotkey: "f",
    description: "Toggles full screen on and off (can also be toggled by double clicking anywhere on the screen). " +
        "This setting is not persisted between sessions due to browser security limitations",
    state: false,
    callback: () => toggleFullscreen(),
    volatile: true // don't add fullscreen in the URL params, as it won't work (browser security shenanigans)
  },
  {
    id: "show-queue",
    name: "Queue",
    hotkey: "q",
    description: "If enabled, show the queue of upcoming tracks for playlists and albums. Otherwise, only the current song is displayed",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("title"), "force-display", !state);
      setClass(document.getElementById("track-list"), "hidden", !state);
    }
  },
  {
    id: "bg-artwork",
    name: "Background Artwork",
    hotkey: "b",
    description: "If enabled, uses the release artwork for the background as a blurry, darkened version. Otherwise, only a gradient color will be displayed",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("background-canvas"), "color-only", !state);
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
      setClass(document.getElementById("track-list"), "strip", state);
    }
  },
  {
    id: "bg-grain",
    name: "Grain",
    hotkey: "g",
    description: "Adds a subtle layer of film grain/noise to the background to increase contrast and prevent color banding for dark images " +
        "(only works when Extended Background Rendering is enabled)",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("grain"), "show", state);
    }
  },
  {
    id: "show-context",
    name: "Playlist Info",
    hotkey: "p",
    description: "Displays the playlist name along with some information about it at the top right of the page",
    state: true,
    callback: (state) => setClass(document.getElementById("meta-left"), "hide", !state)
  },
  {
    id: "show-info-icons",
    name: "Playback Meta Info",
    hotkey: "m",
    description: "Shows the playback meta info at the bottom left of the page (play, shuffle, repeat, volume, device name)",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("bottom-left"), "hide", !state);
      setClass(document.getElementById("bottom-right"), "stretch", !state);
    }
  },
  {
    id: "show-clock",
    name: "Clock",
    hotkey: "w",
    description: "Displays a clock at the bottom center of the page",
    state: true,
    callback: (state) => setClass(document.getElementById("clock"), "hide", !state)
  },
  {
    id: "dark-mode",
    name: "Dark Mode",
    hotkey: "d",
    description: "Darkens the entire screen. This mode will be automatically disabled after 8 hours",
    state: false,
    callback: (state) => {
      const DARK_MODE_AUTOMATIC_DISABLE_TIMEOUT = 8 * 60 * 60 * 1000;
      setClass(document.getElementById("dark-overlay"), "show", state);
      clearTimeout(darkModeTimeout);
      if (state) {
        darkModeTimeout = setTimeout(() => {
          toggleDarkMode();
        }, DARK_MODE_AUTOMATIC_DISABLE_TIMEOUT);
      }
    }
  },
  {
    id: "prerender",
    name: "Extended Background Rendering",
    hotkey: "x",
    description: "[Keep this option enabled if you're unsure what it does!] " +
        "Captures screenshots of the background images and displays those instead of the live backgrounds. " +
        "This will save on resources for low-end PCs due to the nature of complex CSS, but it will increase the delay between song switches",
    state: true,
    callback: (state) => {
      showHide(document.getElementById("background-rendered"), state);
      setClass(document.getElementById("prerender-canvas"), "no-prerender", !state);
      refreshBackgroundRender();
    }
  }
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
  document.getElementById("fullscreen").onclick = toggleFullscreen;

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
  url.searchParams.set("polling", isPollingEnabled().toString());
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

function toggleDarkMode() {
  let darkModePref = findPreference("dark-mode");
  if (darkModePref) {
    toggleVisualPreference(darkModePref);
  }
}

const TOGGLE_DARK_MODE_COUNT = 3;
let toggleDarkModeCount = 0;
let toggleDarkModeTimeout;

function handleAlternateDarkModeToggle() {
  clearTimeout(toggleDarkModeTimeout);
  toggleDarkModeCount++;
  if (toggleDarkModeCount >= TOGGLE_DARK_MODE_COUNT) {
    toggleDarkMode();
    toggleDarkModeCount = 0;
  } else {
    toggleDarkModeTimeout = setTimeout(() => toggleDarkModeCount = 0, 1000 * 3);
  }
}

let volumeTimeout;
function handleVolumeChange(volume, device) {
  let volumeContainer = document.getElementById("volume");
  let volumeTextContainer = document.getElementById("volume-text");

  let volumeWithPercent = volume + "%";
  if (device === "Den") {
    // Display it as dB for my private AVR because I can do what I want lol
    const BASE_DB = 80;
    let db = (volume - BASE_DB).toFixed(1).replace("-", "&#x2212;");
    volumeTextContainer.innerHTML = db + " dB";
  } else {
    volumeTextContainer.innerHTML = volumeWithPercent;
  }
  volumeContainer.style.setProperty("--volume", volumeWithPercent);

  volumeContainer.classList.add("active");
  clearTimeout(volumeTimeout);
  volumeTimeout = setTimeout(() => {
    volumeContainer.classList.remove("active");
  }, 2000);
}

let deviceTimeout;
function handleDeviceChange(device) {
  let deviceContainer = document.getElementById("device");
  deviceContainer.innerHTML = device;

  deviceContainer.classList.add("active");
  clearTimeout(deviceTimeout);
  deviceTimeout = setTimeout(() => {
    deviceContainer.classList.remove("active");
  }, 2000);
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
  updateScrollGradients();
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
// MOUSE EVENTS FOR SETTINGS
///////////////////////////////

let settingsVisible = false;
document.addEventListener("mousemove", handleMouseEvent);
document.addEventListener("click", handleMouseEvent);
let cursorTimeout;
const MOUSE_MOVE_HIDE_TIMEOUT_MS = 1000;

function setMouseVisibility(state) {
  setClass(document.documentElement, "hide-cursor", !state);
}

function handleMouseEvent() {
  clearTimeout(cursorTimeout);
  setMouseVisibility(true)

  let settingsMenuToggleButton = document.getElementById("settings-menu-toggle-button");
  setClass(settingsMenuToggleButton, "show", true);
  cursorTimeout = setTimeout(() => {
    setMouseVisibility(false);
    if (!settingsVisible) {
      setClass(settingsMenuToggleButton, "show", false);
    }
  }, MOUSE_MOVE_HIDE_TIMEOUT_MS);
}

window.addEventListener('load', initSettingsMouseMove);
function initSettingsMouseMove() {
  setMouseVisibility(false);
  let settings = document.getElementById("settings-buttons");
  let settingsWrapper = document.getElementById("settings-wrapper");

  let settingsMenuToggleButton = document.getElementById("settings-menu-toggle-button");
  settingsMenuToggleButton.onclick = () => {
    requestAnimationFrame(() => toggleSettingsMenu());
  };

  document.body.onclick = (e) => {
    if (settingsVisible && e.target !== settingsMenuToggleButton && !settings.contains(e.target)) {
      toggleSettingsMenu();
    }
  }

  document.addEventListener("dblclick", (e) => {
    if (!settingsVisible && e.target !== settingsMenuToggleButton && !settings.contains(e.target)) {
      toggleFullscreen();
    }
  });

  settingsWrapper.onmousemove = (event) => {
    requestAnimationFrame(() => clearTimeout(cursorTimeout));
    document.getElementById("settings-description").childNodes
      .forEach(elem => setClass(elem, "show", false));
    if (event.target.classList.contains("setting")) {
      let targetLabel = document.getElementById(event.target.id + "-description");
      setClass(targetLabel, "show", true);
    }
  }
}

function toggleSettingsMenu() {
  settingsVisible = !settingsVisible;
  let settingsWrapper = document.getElementById("settings-wrapper");
  let content = document.getElementById("content");
  setClass(settingsWrapper, "show", settingsVisible);
  setClass(content, "blur", settingsVisible);
}


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
