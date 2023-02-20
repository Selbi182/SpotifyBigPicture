let currentData = {
  type: "",
  deployTime: 0,
  versionId: 0,
  settingsToToggle: [],
  currentlyPlaying: {
    id: "",
    artists: [],
    title: "",
    description: "",
    album: "",
    year: "",
    trackNumber: 0,
    timeCurrent: 0,
    timeTotal: 0,
    imageData: {
      imageUrl: "",
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
      }
    }
  },
  trackData: {
    discNumber: 0,
    totalDiscCount: 0,
    trackCount: 0,
    totalTime: 0,
    listTracks: [],
    queue: [],
    trackListView: "",
    nextImageData: {
      imageUrl: "",
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
      }
    }
  },
  playbackContext: {
    context: "",
    device: "",
    paused: true,
    repeat: "",
    shuffle: false,
    volume: -1,
    thumbnailUrl: ""
  }
};

let idle = false;


///////////////////////////////
// WEB STUFF - General
///////////////////////////////

const INFO_URL = "/playback-info";

window.addEventListener('load', entryPoint);

function entryPoint() {
  submitVisualPreferencesToBackend();
  initPolling();
}

function submitVisualPreferencesToBackend() {
  fetch("/settings/list", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([...PREFERENCES_PRESETS, ...PREFERENCES])
  })
    .then(response => {
      if (response.status >= 400) {
        console.warn("Failed to transmit settings to backend");
      }
    })
}

function singleRequest() {
  let url = `${INFO_URL}?v=${currentData.versionId}`;
  fetch(url)
    .then(response => {
      if (response.status >= 200 && response.status < 300) {
        return response.json()
      } else {
        return {
          type: "EMPTY"
        }
      }
    })
    .then(json => processJson(json))
    .catch(ex => {
      console.error(ex);
    });
}

///////////////////////////////
// WEB STUFF - Polling
///////////////////////////////

let pollingInterval;
const POLLING_INTERVAL_MS = 2 * 1000;
const POLLING_INTERVAL_IDLE_MS = 60 * 1000;

function initPolling(pollingIntervalMs = POLLING_INTERVAL_MS) {
  clearTimeout(pollingInterval);
  pollingInterval = setInterval(() => {
    singleRequest();
  }, pollingIntervalMs);
}

///////////////////////////////
// MAIN DISPLAY STUFF
///////////////////////////////

const BLANK = "BLANK";

function processJson(json) {
  if (json && json.type !== "EMPTY") {
    console.info(json);
    if (json.type === "DATA") {
      if (currentData.deployTime > 0 && getChange(json, "deployTime").wasChanged) {
        window.location.reload(true);
      } else {
        updateExternallyToggledPreferences(json)
          .then(() => changeImage(json))
          .then(() => prerenderNextImage(json))
          .then(() => setTextData(json))
          .then(() => refreshTimers());
      }
    }
  }
}

function getChange(changes, path) {
  let properties = path.split(".")
  let reduceOld = properties.reduce((prev, curr) => prev?.[curr], currentData);
  let reduceNew = properties.reduce((prev, curr) => prev?.[curr], changes);
  if (Array.isArray(reduceNew)) {
    reduceNew = JSON.stringify(reduceOld) !== JSON.stringify(reduceNew) ? reduceNew : null;
  } else {
    reduceNew = reduceOld !== reduceNew ? reduceNew : null;
  }
  return {
    wasChanged: reduceNew != null,
    value: reduceNew !== null && reduceNew !== undefined ? reduceNew : reduceOld
  }
}

function setTextData(changes) {
  // Main Info
  let titleContainer = document.getElementById("title");

  let artists = getChange(changes, "currentlyPlaying.artists");
  if (artists.wasChanged) {
    let artistsNew = artists.value;
    let artistContainer = document.getElementById("artists");
    let artistsString = artistsNew[0] + buildFeaturedArtistsString(artistsNew);
    artistContainer.innerHTML = convertToTextEmoji(artistsString);

    balanceTextClamp(artistContainer);
    fadeIn(artistContainer);
  }

  let title = getChange(changes, "currentlyPlaying.title");
  if (title.wasChanged) {
    let normalizedEmoji = convertToTextEmoji(title.value);
    let titleNoFeat = removeFeaturedArtists(normalizedEmoji);
    let splitTitle = separateUnimportantTitleInfo(titleNoFeat);
    let titleMain = splitTitle.main;
    let titleExtra = splitTitle.extra;
    document.getElementById("title-main").innerHTML = titleMain;
    document.getElementById("title-extra").innerHTML = titleExtra;

    balanceTextClamp(titleContainer);
    fadeIn(titleContainer);
  }

  let album = getChange(changes, "currentlyPlaying.album");
  let year = getChange(changes, "currentlyPlaying.year");
  if (album.wasChanged || year.wasChanged) {
    let normalizedEmoji = convertToTextEmoji(album.value);
    let splitTitle = separateUnimportantTitleInfo(normalizedEmoji);
    let albumTitleMain = splitTitle.main;
    let albumTitleExtra = splitTitle.extra;
    document.getElementById("album-title-main").innerHTML = albumTitleMain;
    document.getElementById("album-title-extra").innerHTML = albumTitleExtra;

    document.getElementById("album-release").innerHTML = year.value;

    let albumMainContainer = document.getElementById("album-title");
    balanceTextClamp(albumMainContainer);
    let albumContainer = document.getElementById("album");
    fadeIn(albumContainer);
  }

  let description = getChange(changes, "currentlyPlaying.description");
  if (description.wasChanged) {
    let descriptionContainer = document.getElementById("description");
    let isPodcast = description.value !== BLANK;
    descriptionContainer.innerHTML = isPodcast ? description.value : "";
    balanceTextClamp(descriptionContainer);
    fadeIn(descriptionContainer);
  }

  // Context
  let context = getChange(changes, "playbackContext.context");
  if (context.wasChanged) {
    let contextMain = document.getElementById("context-main");
    let contextExtra = document.getElementById("context-extra");

    // Context name
    contextMain.innerHTML = convertToTextEmoji(context.value);

    // Track count / total duration
    let trackCount = getChange(changes, "trackData.trackCount").value;
    if (trackCount > 0) {
      let trackCountFormatted = numberWithCommas(trackCount);

      let numericDescription;
      if (context.value.startsWith("ARTIST: ")) {
        numericDescription = "follower";
      } else if (context.value.startsWith("PODCAST: ")) {
        numericDescription = "episode"
      } else {
        numericDescription = "track"
      }
      let lengthInfo = `${trackCountFormatted} ${numericDescription}${trackCount !== 1 ? "s" : ""}`;

      let totalTime = getChange(changes, "trackData.totalTime").value;
      if (totalTime > 0) {
        let totalTimeFormatted = formatTimeVerbose(totalTime);
        lengthInfo += ` (${totalTimeFormatted})`;
      }
      contextExtra.innerHTML = lengthInfo;
    } else {
      contextExtra.innerHTML = "";
    }

    // Thumbnail
    let thumbnailWrapperContainer = document.getElementById("thumbnail-wrapper");
    let thumbnailContainer = document.getElementById("thumbnail");
    let thumbnailUrl = getChange(changes, "playbackContext.thumbnailUrl").value;
    if (thumbnailUrl === BLANK) {
      thumbnailContainer.src = "";
      setClass(thumbnailWrapperContainer, "show", false);
    } else {
      setClass(thumbnailWrapperContainer, "show", true);
      thumbnailContainer.src = thumbnailUrl;
      fadeIn(thumbnailContainer);
    }

    let contextContainer = document.getElementById("context");
    fadeIn(contextContainer);
  }

  // Time
  let timeCurrent = getChange(changes, "currentlyPlaying.timeCurrent");
  let timeTotal = getChange(changes, "currentlyPlaying.timeTotal");
  if (timeCurrent.wasChanged || timeTotal.wasChanged) {
    updateProgress(changes, true);
    if (getChange(changes, "currentlyPlaying.id").value) {
      finishAnimations(document.getElementById("progress-current"));
    }
  }

  // States
  let paused = getChange(changes, "playbackContext.paused");
  if (paused.wasChanged) {
    let pauseElem = document.getElementById("play-pause");
    setClass(pauseElem, "paused", paused.value);
    fadeIn(pauseElem);
  }

  let shuffle = getChange(changes, "playbackContext.shuffle");
  if (shuffle.wasChanged) {
    let shuffleElem = document.getElementById("shuffle");
    setClass(shuffleElem, "show", shuffle.value);
    fadeIn(shuffleElem);
  }

  let repeat = getChange(changes, "playbackContext.repeat");
  if (repeat.wasChanged) {
    let repeatElem = document.getElementById("repeat");
    setClass(repeatElem, "show", repeat.value !== "off");
    if (repeat.value === "track") {
      repeatElem.classList.add("once");
    } else {
      repeatElem.classList.remove("once");
    }
    fadeIn(repeatElem);
    handleAlternateDarkModeToggle();
  }

  let volume = getChange(changes, "playbackContext.volume");
  let device = getChange(changes, "playbackContext.device");
  if (volume.wasChanged || device.wasChanged) {
    handleVolumeChange(volume.value, device.value);
  }

  if (device.wasChanged) {
    document.getElementById("device").innerHTML = convertToTextEmoji(device.value);
    handleDeviceChange(device.value);
  }

  // Color
  let textColor = getChange(changes, "currentlyPlaying.imageData.imageColors.primary")
  if (textColor.wasChanged) {
    setTextColor(textColor.value);
  }

  // Playlist View
  setCorrectTracklistView(changes);

  // Update properties in local storage
  for (let prop in changes) {
    currentData[prop] = changes[prop];
  }
}

function setCorrectTracklistView(changes) {
  let mainContainer = document.getElementById("center-info");
  let titleContainer = document.getElementById("title");
  let trackListContainer = document.getElementById("track-list");
  let listViewType = getChange(changes, "trackData.trackListView").value;
  let listTracks = getChange(changes, "trackData.listTracks").value;
  let currentId = getChange(changes, "currentlyPlaying.id").value;
  let trackNumber = getChange(changes, "trackData.trackNumber").value;
  let currentDiscNumber =  getChange(changes, "trackData.discNumber").value;
  let totalDiscCount =  getChange(changes, "trackData.totalDiscCount").value;
  let shuffle = getChange(changes, "playbackContext.shuffle").value;

  let specialQueue = getChange(changes, "playbackContext.context").value.startsWith("Queue >> ");
  let titleDisplayed = specialQueue || listViewType !== "ALBUM";
  let queueMode = (specialQueue || listViewType === "QUEUE" || listTracks.length === 0 || trackNumber === 0) && findPreference("show-queue").state;
  let wasPreviouslyInQueueMode = mainContainer.classList.contains("queue");

  showHide(titleContainer, titleDisplayed);

  setClass(mainContainer, "queue", queueMode);

  let displayTrackNumbers = listViewType === "ALBUM" && !shuffle && !queueMode;
  setClass(trackListContainer, "show-tracklist-numbers", displayTrackNumbers)
  setClass(trackListContainer, "show-discs", !queueMode && totalDiscCount > 1)

  ///////////

  let oldQueue = (queueMode ? currentData.trackData.queue : currentData.trackData.listTracks) || [];
  let newQueue = (queueMode ? changes.trackData.queue : changes.trackData.listTracks) || [];

  let refreshPrintedList =
       (queueMode !== wasPreviouslyInQueueMode)
    || (oldQueue.length !== newQueue.length || !trackListEquals(oldQueue, newQueue));

  if (refreshPrintedList) {
    if (queueMode) {
      if (isExpectedNextSongInQueue(currentId, currentData.trackData.queue)) {
        // Special animation when the expected next song comes up
        let trackListContainer = printTrackList([currentData.trackData.queue[0], ...changes.trackData.queue], false);
        requestAnimationFrame(() => {
          let currentTrackListTopElem = trackListContainer.querySelector(".track-elem:first-child");
          currentTrackListTopElem.querySelector(".track-name").ontransitionend = (e) => {
            let parent = e.target.parentNode;
            if (e.target.classList.contains("shrink")) {
              if (parent.classList.contains("track-elem")) {
                parent.remove();
              }
            }
          }
          currentTrackListTopElem.childNodes.forEach(node => node.classList.add("shrink"));
        });
      } else {
        printTrackList(changes.trackData.queue, false);
      }
    } else {
      let isMultiDisc = listTracks.find(t => 'discNumber' in t && t.discNumber > 1);
      printTrackList(listTracks, listViewType === "ALBUM" && isMultiDisc && !shuffle);
    }

    trackListContainer.style.setProperty("--scale", "0");
    finishAnimations(trackListContainer);
    if (newQueue.length < 20) {
      scaleTrackList(trackListContainer, 1);
    }
  }

  let updateHighlightedTrack = (refreshPrintedList) || getChange(changes, "trackData.trackNumber").wasChanged;

  if (updateHighlightedTrack) {
    if (queueMode) {
      updateScrollPositions(1);
    } else {
      let targetTrackNumber = trackNumber + (totalDiscCount > 1 ? currentDiscNumber : 0);
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

function scaleTrackList(trackListContainer, scaleIteration) {
  trackListContainer.classList.add("scaling");
  requestAnimationFrame(() => {
    if (scaleIteration < 10) {
      let visibleHeight = trackListContainer.offsetHeight;
      let realHeight = trackListContainer.scrollHeight;
      if (realHeight > visibleHeight) {
        if (scaleIteration > 0) {
          trackListContainer.style.setProperty("--scale", (scaleIteration - 1).toString());
        }
        trackListContainer.classList.remove("scaling");
      } else {
        trackListContainer.style.setProperty("--scale", (scaleIteration + 1).toString());
        scaleTrackList(trackListContainer, scaleIteration + 1)
      }
    } else {
      trackListContainer.classList.remove("scaling");
    }
  });
}

function balanceTextClamp(elem) {
  // balanceText doesn't take line-clamping into account, unfortunately
  elem.style.setProperty("-webkit-line-clamp", "initial", "important");
  balanceText(elem);
  elem.style.removeProperty("-webkit-line-clamp");
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
  elem.classList.add("transparent", "text-grow");
  finishAnimations(elem);
  elem.classList.remove("transparent", "text-grow");
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

function updateScrollPositions(trackNumber) {
  requestAnimationFrame(() => {
    let trackListContainer = document.getElementById("track-list");
    let previouslyPlayingRow = [...trackListContainer.childNodes].find(node => node.classList.contains("current"));
    if (trackNumber) {
      let currentlyPlayingRow = trackListContainer.childNodes[trackNumber - 1];
      if (currentlyPlayingRow && previouslyPlayingRow !== currentlyPlayingRow) {
        trackListContainer.childNodes.forEach(node => node.classList.remove("current"));
        currentlyPlayingRow.classList.add("current");

        let scrollUnit = trackListContainer.scrollHeight / trackListContainer.childNodes.length;
        let scrollMiddleApproximation = Math.round((trackListContainer.offsetHeight / scrollUnit) / 2);
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

const DEFAULT_IMAGE = 'design/img/blank-cd.png';
const DEFAULT_IMAGE_COLORS = {
  primary: {
    r: 255,
    g: 255,
    b: 255
  },
  secondary: {
    r: 255,
    g: 255,
    b: 255
  },
  averageBrightness: 1.0
}

let defaultPrerender = {
  imageUrl: DEFAULT_IMAGE,
  pngData: null
};
refreshDefaultPrerender().then();

let nextImagePrerenderPngData;
unsetNextImagePrerender();

function changeImage(changes) {
  return new Promise(resolve => {
    let imageUrl = getChange(changes, "currentlyPlaying.imageData.imageUrl");
    if (imageUrl.wasChanged) {
      if (imageUrl.value === BLANK) {
        setRenderedBackground(defaultPrerender.pngData)
          .then(() => resolve());
      } else {
        let oldImageUrl = currentData.currentlyPlaying.imageData.imageUrl;
        let newImageUrl = getChange(changes, "currentlyPlaying.imageData.imageUrl").value;
        let colors = getChange(changes, "currentlyPlaying.imageData.imageColors").value;
        if (!oldImageUrl.includes(newImageUrl)) {
          if (nextImagePrerenderPngData.imageUrl === newImageUrl) {
            setRenderedBackground(nextImagePrerenderPngData.pngData)
              .then(() => resolve());
          } else {
            setArtworkAndPrerender(newImageUrl, colors)
              .then(pngData => setRenderedBackground(pngData))
              .then(() => resolve());
          }
        } else {
          resolve();
        }
      }
    } else {
      resolve();
    }
  });
}

const PRERENDER_DELAY_MS = 1000;
function prerenderNextImage(changes, delay = PRERENDER_DELAY_MS) {
  return new Promise(resolve => {
    let prerenderEnabled = findPreference("prerender-background").state;
    if (prerenderEnabled) {
      let currentImageUrl = getChange(changes, "currentlyPlaying.imageData.imageUrl").value;
      let nextImageUrl = getChange(changes, "trackData.nextImageData.imageUrl").value;
      if (currentImageUrl !== nextImageUrl && nextImagePrerenderPngData.imageUrl !== nextImageUrl) {
        setTimeout(() => {
          let nextImageColors = getChange(changes, "trackData.nextImageData.imageColors").value;
          setArtworkAndPrerender(nextImageUrl, nextImageColors)
              .then(pngData => {
                nextImagePrerenderPngData = {
                  imageUrl: nextImageUrl,
                  pngData: pngData
                };
              });
        }, delay)
      }
    }
    resolve();
  });
}

function setRenderedBackground(pngData) {
  return new Promise((resolve) => {
    let backgroundImg = document.getElementById("background-img");
    let backgroundCrossfade = document.getElementById("background-img-crossfade");
    setClass(backgroundCrossfade, "show", true);
    backgroundCrossfade.onload = () => {
      finishAnimations(backgroundCrossfade);
      backgroundImg.onload = () => {
        setClass(backgroundCrossfade, "show", false);
        resolve();
      };
      backgroundImg.src = pngData;
    };
    backgroundCrossfade.src = backgroundImg.src ? backgroundImg.src : defaultPrerender.pngData;
  });
}

function setArtworkAndPrerender(newImageUrl, colors) {
  return new Promise((resolve) => {
    if (!newImageUrl) {
      newImageUrl = DEFAULT_IMAGE;
      colors = DEFAULT_IMAGE_COLORS;
    }
    Promise.all([
      loadArtwork(newImageUrl),
      loadBackground(newImageUrl, colors)
    ])
    .then(() => prerenderBackground())
    .then(pngData => resolve(pngData));
  });
}


function loadArtwork(newImage) {
  return new Promise((resolve) => {
    let artwork = document.getElementById("artwork-img");
    artwork.onload = () => {
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
      let backgroundCanvasOverlay = document.getElementById("background-canvas-overlay");
      let grainOverlay = document.getElementById("grain");

      let backgroundColorOverlay = `rgb(${rgbOverlay.r}, ${rgbOverlay.g}, ${rgbOverlay.b})`;
      backgroundCanvasOverlay.style.setProperty("--background-color", backgroundColorOverlay);
      backgroundCanvasOverlay.style.setProperty("--background-brightness", averageBrightness);
      setClass(backgroundCanvasOverlay, "brighter", averageBrightness < 0.2);
      setClass(backgroundCanvasOverlay, "darker", averageBrightness > 0.4);
      grainOverlay.style.setProperty("--intensity", averageBrightness);
      resolve();
    };
    backgroundCanvasImg.src = newImage;
  });
}

function prerenderBackground() {
  return new Promise((resolve) => {
    let prerenderCanvas = document.getElementById("prerender-canvas");
    setClass(prerenderCanvas, "show", true);

    // While PNG produces the by far largest Base64 image data, the actual conversion process
    // is significantly faster than with JPEG or SVG (still not perfect though)
    let pngData;
    domtoimage
      .toPng(prerenderCanvas, {
        width: window.innerWidth,
        height: window.innerHeight
      })
      .then((imgDataBase64) => {
        if (imgDataBase64.length < 10) {
          throw 'Rendered image data is invalid';
        }
        pngData = imgDataBase64;
      })
      .catch((error) => {
        console.warn("Failed to render background", error);
      })
      .finally(() => {
        setClass(prerenderCanvas, "show", false);
        resolve(pngData);
      });
  });
}

function refreshBackgroundRender() {
  unsetNextImagePrerender();
  refreshDefaultPrerender()
    .then(() => {
      let imageUrl = currentData.currentlyPlaying.imageData.imageUrl;
      if (imageUrl === BLANK) {
        setRenderedBackground(defaultPrerender.pngData).then();
      } else {
        let imageColors = currentData.currentlyPlaying.imageData.imageColors;
        if (imageUrl && imageColors) {
          setArtworkAndPrerender(imageUrl, imageColors)
            .then(pngData => setRenderedBackground(pngData));
        }
      }
    });
}

function unsetNextImagePrerender() {
  nextImagePrerenderPngData = {
    imageUrl: null,
    pngData: null
  };
}

function refreshDefaultPrerender() {
  return new Promise((resolve) => {
    setArtworkAndPrerender(DEFAULT_IMAGE, DEFAULT_IMAGE_COLORS)
      .then(pngData => defaultPrerender.pngData = pngData)
      .then(resolve);
  });
}

function setTextColor(rgbText) {
  document.documentElement.style.setProperty("--color", `rgb(${rgbText.r}, ${rgbText.g}, ${rgbText.b})`);
}


///////////////////////////////
// PROGRESS
///////////////////////////////

function updateProgress(changes, updateProgressBar) {
  let current = getChange(changes, "currentlyPlaying.timeCurrent").value;
  let total = getChange(changes, "currentlyPlaying.timeTotal").value;
  let paused = getChange(changes, "playbackContext.paused").value;

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
  let artists = getChange(changes, "currentlyPlaying.artists").value;
  let title = getChange(changes, "currentlyPlaying.title").value;
  if (!idle && artists && title) {
    newTitle = `${artists[0]} - ${removeFeaturedArtists(title)} | ${newTitle}`;
  }
  if (document.title !== newTitle) {
    document.title = newTitle;
  }

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

let autoTimer;
let idleTimeout;

function refreshTimers() {
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
  let timeCurrent = currentData.currentlyPlaying.timeCurrent;
  let timeTotal = currentData.currentlyPlaying.timeTotal;
  if (timeCurrent != null && timeTotal != null && !currentData.playbackContext.paused) {
    let now = Date.now();
    let elapsedTime = now - startTime;
    startTime = now;
    let newTime = timeCurrent + elapsedTime;
    if (newTime > timeTotal && timeCurrent < timeTotal) {
      singleRequest();
    }
    currentData.currentlyPlaying.timeCurrent = Math.min(timeTotal, newTime);
    updateProgress(currentData, updateProgressBar);
  }
}

function setIdleModeState(state) {
  let content = document.getElementById("main");
  let settingsMenuToggleButton = document.getElementById("settings-menu-toggle-button"); // just to avoid a COMPLETELY black screen
  if (state) {
    if (!idle) {
      console.info("No music was played in 2 hours. Enabling idle mode...");
      settingsMenuToggleButton.classList.add("show");
      idle = true;
      clearTimers();
      initPolling(POLLING_INTERVAL_IDLE_MS);
      showHide(content, false);
    }
  } else {
    if (idle) {
      idle = false;
      settingsMenuToggleButton.classList.remove("show");
      initPolling(POLLING_INTERVAL_MS);
      showHide(content, true);
    }
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
    description: "Toggles full screen on or off. Can also be toggled by double clicking anywhere on the screen. " +
        "(This setting is not persisted between sessions due to browser security limitations)",
    state: false,
    callback: () => toggleFullscreen(),
    volatile: true // don't add fullscreen in the URL params, as it won't work (browser security shenanigans)
  },
  {
    id: "show-queue",
    name: "Queue",
    description: "If enabled, show the queue of upcoming tracks for playlists and albums. Otherwise, only the current song is displayed",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("title"), "force-display", !state);
      let trackListContainer = document.getElementById("track-list");
      setClass(trackListContainer, "hidden", !state);
      setCorrectTracklistView(currentData);
    }
  },
  {
    id: "display-artwork",
    name: "Artwork",
    description: "Whether to display the artwork of the current track or not. If disabled, the layout will be centered",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("artwork"), "hide", !state);
      setClass(document.getElementById("content"), "full-content", !state);
      setClass(document.getElementById("xxl-artwork"), "overridden", !state);
      refreshBackgroundRender();
    }
  },
  {
    id: "xxl-artwork",
    name: "XXL Artwork",
    description: "When enabled, the artwork is stretched to its maximum possible size. Do note that this leaves less room for all the other information",
    state: false,
    callback: (state) => {
      setClass(document.getElementById("main"), "maximum-artwork", state);
      refreshBackgroundRender();
    }
  },
  {
    id: "bg-artwork",
    name: "Background Artwork",
    description: "If enabled, uses the release artwork for the background as a blurry, darkened version. Otherwise, only a gradient will be displayed",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("background-canvas"), "color-only", !state);
      refreshBackgroundRender();
    }
  },
  {
    id: "bg-tint",
    name: "Background Overlay Color",
    description: "Add a subtle layer of one of the artwork's most dominant colors to the background",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("background-canvas-overlay"), "no-tint", !state);
      refreshBackgroundRender();
    }
  },
  {
    id: "bg-grain",
    name: "Background Film Grain",
    description: "Adds a subtle layer of film grain/noise to the background to increase contrast and prevent color banding for dark images",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("grain"), "show", state);
      refreshBackgroundRender();
    }
  },
  {
    id: "bg-black",
    name: "Black Background",
    description: "If enabled, the background stays permanently black and overrides any other background-related settings",
    state: false,
    callback: (state) => {
      setClass(document.getElementById("bg-artwork"), "overridden", state);
      setClass(document.getElementById("bg-tint"), "overridden", state);
      setClass(document.getElementById("bg-grain"), "overridden", state);
      setClass(document.getElementById("background-canvas"), "black", state);
      refreshBackgroundRender();
    }
  },
  {
    id: "xxl-text",
    name: "XXL Text",
    description: "If enabled, the font size for the current song's title, artist, and release is doubled. " +
        "This setting is intended to be used with disabled artwork, as there isn't a lot of space available otherwise",
    state: false,
    callback: (state) => setClass(document.getElementById("center-info-main"), "big-text", state)
  },
  {
    id: "colored-text",
    name: "Colored Text",
    description: "If enabled, the dominant color of the current artwork will be used as color for all texts and some symbols. Otherwise, plain white will be used",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("colored-symbols"), "overridden", !state);
      setClass(document.body, "no-colored-text", !state);
    }
  },
  {
    id: "show-release",
    name: "Release Name/Date",
    description: "Displays the release name with its release date (usually the year of the currently playing song's album)",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("album"), "hide", !state);
    }
  },
  {
    id: "show-context",
    name: "Context",
    description: "Displays the playlist/artist/album name along with some additional information at the top of the page. " +
        "Also displays a thumbnail, if available",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("swap-top"), "overridden-1", !state);
      setClass(document.getElementById("colored-symbols"), "overridden-1", !state);
      setClass(document.getElementById("meta-left"), "hide", !state)
    }
  },
  {
    id: "show-logo",
    name: "Spotify Logo",
    description: "Whether to display the Spotify logo in the top right",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("swap-top"), "overridden-2", !state);
      setClass(document.getElementById("colored-symbols"), "overridden-2", !state);
      setClass(document.getElementById("meta-right"), "hide", !state)
    }
  },
  {
    id: "swap-top",
    name: "Swap Top Bar",
    description: "If enabled, the Context and Spotify Logo swap positions",
    state: false,
    callback: (state) => {
      setClass(document.getElementById("top-info"), "swap", state)
    }
  },
  {
    id: "colored-symbols",
    name: "Colored Top Bar",
    description: "If enabled, the dominant color of the current artwork will be used as color for the for the Spotify logo and the playlist thumbnail",
    state: false,
    callback: (state) => {
      setClass(document.getElementById("logo"), "colored", state);
      setClass(document.getElementById("thumbnail"), "colored", state);
    }
  },
  {
    id: "transitions",
    name: "Smooth Transitions",
    description: "Smoothly fade from one song to another. Otherwise, song switches will be displayed instantaneously",
    state: true,
    callback: (state) => setTransitions(state)
  },
  {
    id: "strip-titles",
    name: "Strip Titles",
    description: "Hides any kind of potentially unnecessary extra information from song tiles and release names " +
        `(such as 'Remastered Version', 'Anniversary Edition', '${new Date().getFullYear()} Re-Issue', etc.)`,
    state: true,
    callback: (state) => {
      setClass(document.getElementById("title-extra"), "hide", state);
      setClass(document.getElementById("album-title-extra"), "hide", state);
      setClass(document.getElementById("track-list"), "strip", state);
    }
  },
  {
    id: "show-progress-bar",
    name: "Progress Bar",
    description: "Displays a bar of that spans the entire screen, indicating how far along the currently played track is",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("progress"), "hide", !state);
      refreshBackgroundRender();
    }
  },
  {
    id: "show-timestamps",
    name: "Timestamps",
    description: "Displays the current and total timestamps of the currently playing track as numeric values",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("artwork"), "hide-timestamps", !state);
      setClass(document.getElementById("bottom-meta-container"), "hide-timestamps", !state);
      setClass(document.getElementById("spread-timestamps"), "overridden", !state);
      refreshBackgroundRender();
    }
  },
  {
    id: "spread-timestamps",
    name: "Spread-out Timestamps",
    description: "When enabled, the current timestamp is separated from the total timestamp and displayed on the left",
    state: true,
    callback: (state) => {
      let timeCurrent = document.getElementById("time-current");
      let bottomMetaContainer = document.getElementById("bottom-meta-container");
      let bottomLeft = document.getElementById("bottom-left");
      let bottomRight = document.getElementById("bottom-right");
      if (state) {
        bottomLeft.insertBefore(timeCurrent, bottomLeft.firstChild);
      } else {
        bottomRight.insertBefore(timeCurrent, bottomRight.firstChild);
      }
      setClass(bottomMetaContainer, "spread-timestamps", state);
    }
  },
  {
    id: "show-info-icons",
    name: "Play/Pause/Shuffle/Repeat",
    description: "Display the state icons for play/pause as well as shuffle and repeat in the bottom left",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("info-symbols"), "hide", !state);
    }
  },
  {
    id: "show-volume",
    name: "Volume",
    description: "Display the current volume in the bottom left",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("volume"), "hide", !state);
    }
  },
  {
    id: "show-device",
    name: "Device",
    description: "Display the name of the current playback device in the bottom left",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("device"), "hide", !state);
    }
  },
  {
    id: "reverse-bottom",
    name: "Invert Bottom",
    description: "If enabled, the progress bar and the timestamps/playback state info swap positions",
    state: false,
    callback: (state) => {
      setClass(document.getElementById("content-bottom"), "reverse", state);
    }
  },
  {
    id: "show-clock",
    name: "Clock",
    description: "Displays a clock at the bottom center of the page",
    state: false,
    callback: (state) => setClass(document.getElementById("clock"), "hide", !state)
  },
  {
    id: "dark-mode",
    name: "Dark Mode",
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
    id: "vertical-mode",
    name: "Vertical Mode",
    description: "Convert the two-panel layout into a vertical, centered layout. This will disable the queue, clock, and release, but it results in a more minimalistic appearance",
    state: false,
    callback: (state) => {
      setClass(document.getElementById("xxl-text"), "overridden", state);
      setClass(document.getElementById("xxl-artwork"), "overridden", state);
      setClass(document.getElementById("show-queue"), "overridden", state);
      setClass(document.getElementById("main"), "vertical", state);
      refreshBackgroundRender();
    }
  },
  {
    id: "show-fps",
    name: "FPS Counter",
    description: "Display the frames-per-second in the top right of the screen (intended for performance debugging)",
    state: false,
    callback: (state) => {
      setClass(document.getElementById("fps-counter"), "show", state);
    }
  },
  {
    id: "prerender-background",
    name: "Prerender Background",
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

const PREFERENCES_PRESETS = [
  {
    id: "preset-advanced",
    name: "Preset: Balanced Mode",
    image: "/design/img/presets/preset-advanced.png",
    description: "The default mode. This preset displays as much information as possible about the current song, along with its artwork on the right, without compromising on readability. " +
        "Shows the upcoming songs in the queue (or the currently playing album), and the playback state (shuffle, current device name, etc.)",
    enabled: [
      "show-queue",
      "display-artwork",
      "bg-artwork",
      "bg-tint",
      "bg-grain",
      "colored-text",
      "colored-symbols",
      "show-release",
      "show-context",
      "show-logo",
      "transitions",
      "strip-titles",
      "show-timestamps",
      "show-info-icons",
      "show-volume",
      "show-device",
      "show-progress-bar",
      "show-clock",
      "prerender-background"
    ],
    disabled: [
      "bg-black",
      "reverse-bottom",
      "vertical-mode",
      "xxl-artwork",
      "xxl-text",
      "swap-top",
      "spread-timestamps",
      "dark-mode",
      "show-fps"
    ]
  },
  {
    id: "preset-minimalistic",
    name: "Preset: Minimalistic Mode",
    image: "/design/img/presets/preset-minimalistic.png",
    description: "A minimalistic design preset only containing the most relevant information about the currently playing song. Inspired by the original Spotify fullscreen interface for Chromecast",
    enabled: [
      "display-artwork",
      "bg-grain",
      "bg-tint",
      "show-context",
      "show-logo",
      "transitions",
      "vertical-mode",
      "reverse-bottom",
      "spread-timestamps",
      "show-progress-bar",
      "strip-titles",
      "prerender-background"
    ],
    disabled: [
      "show-queue",
      "bg-artwork",
      "bg-black",
      "xxl-artwork",
      "xxl-text",
      "swap-top",
      "colored-text",
      "colored-symbols",
      "show-release",
      "show-timestamps",
      "show-info-icons",
      "show-volume",
      "show-device",
      "show-clock",
      "dark-mode",
      "show-fps"
    ]
  },
  {
    id: "preset-background",
    name: "Preset: Queue Mode",
    image: "/design/img/presets/preset-background.png",
    description: "Similar to Balanced Mode, but the artwork is disabled and instead only dimly shown in the background. This opens up more room for the queue. Also disables some lesser useful information",
    enabled: [
      "show-queue",
      "bg-artwork",
      "bg-grain",
      "colored-text",
      "colored-symbols",
      "show-release",
      "show-context",
      "show-logo",
      "transitions",
      "strip-titles",
      "show-progress-bar",
      "show-timestamps",
      "spread-timestamps",
      "reverse-bottom",
      "prerender-background"
    ],
    disabled: [
      "bg-black",
      "bg-tint",
      "display-artwork",
      "xxl-artwork",
      "xxl-text",
      "swap-top",
      "show-info-icons",
      "show-volume",
      "show-device",
      "show-clock",
      "vertical-mode",
      "dark-mode",
      "show-fps"
    ]
  },
  {
    id: "preset-big-text",
    name: "Preset: Big-Text Mode",
    image: "/design/img/presets/preset-big-text.png",
    description: "Only shows the current song's title, artist and release. Queue is disabled, artwork is moved to the background. Font size is doubled",
    enabled: [
      "bg-artwork",
      "bg-tint",
      "bg-grain",
      "colored-text",
      "colored-symbols",
      "xxl-text",
      "show-release",
      "show-context",
      "show-logo",
      "transitions",
      "strip-titles",
      "show-progress-bar",
      "show-timestamps",
      "spread-timestamps",
      "reverse-bottom",
      "prerender-background"
    ],
    disabled: [
      "show-queue",
      "bg-black",
      "display-artwork",
      "xxl-artwork",
      "swap-top",
      "show-info-icons",
      "show-clock",
      "show-volume",
      "show-device",
      "vertical-mode",
      "dark-mode",
      "show-fps"
    ]
  },
  {
    id: "preset-big-artwork",
    name: "Preset: XXL-Artwork Mode",
    image: "/design/img/presets/preset-big-artwork.png",
    description: "Functionally similar to Balanced Mode, but with the artwork stretched to the maximum possible size. Everything else is crammed into the right",
    enabled: [
      "show-queue",
      "display-artwork",
      "xxl-artwork",
      "bg-artwork",
      "bg-tint",
      "bg-grain",
      "colored-text",
      "colored-symbols",
      "show-release",
      "show-context",
      "show-logo",
      "transitions",
      "strip-titles",
      "show-timestamps",
      "show-info-icons",
      "show-progress-bar",
      "prerender-background"
    ],
    disabled: [
      "bg-black",
      "reverse-bottom",
      "vertical-mode",
      "xxl-text",
      "swap-top",
      "spread-timestamps",
      "show-volume",
      "show-device",
      "show-clock",
      "dark-mode",
      "show-fps"
    ]
  },
]

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
    prefElem.innerHTML = pref.name;
    prefElem.onclick = () => toggleVisualPreference(pref);
    settingsWrapper.appendChild(prefElem);

    // Create description element
    let descElem = document.createElement("div");
    descElem.id = pref.id + "-description";

    let descHeader = document.createElement("div");
    descHeader.innerHTML = pref.name;

    let descContent = document.createElement("div");
    descContent.innerHTML = pref.description;

    descElem.append(descHeader, descContent);
    settingsDescriptionWrapper.appendChild(descElem);

  }
  document.getElementById("fullscreen").onclick = toggleFullscreen;

  // Init setting states
  PREFERENCES.forEach(pref => {
    refreshPreference(pref, pref.state);
  });

  // Preset buttons
  const settingsPresetsWrapper = document.getElementById("settings-presets");
  for (let presetIndex in PREFERENCES_PRESETS) {
    let preset = PREFERENCES_PRESETS[presetIndex];

    // Integrity check for preset
    let unmatchedPrefIds = PREFERENCES
        .filter(pref => !pref.volatile)
        .map(pref => pref.id)
        .filter(prefId => ![...preset.enabled, ...preset.disabled].includes(prefId));
    if (unmatchedPrefIds.length > 0) {
      console.warn(`"${preset.name}" lacks configuration information for these preferences: ${unmatchedPrefIds}`);
    }

    let presetElem = document.createElement("div");
    presetElem.id = preset.id;
    presetElem.classList.add("preset");
    presetElem.style.setProperty("--image", `url("${preset.image}")`);

    presetElem.onclick = () => {
      applyPreset(preset);
    };

    settingsPresetsWrapper.append(presetElem);

    // Create description element
    let descElem = document.createElement("div");
    descElem.id = preset.id + "-description";

    let descHeader = document.createElement("div");
    descHeader.innerHTML = preset.name;

    let descContent = document.createElement("div");
    descContent.innerHTML = preset.description;

    descElem.append(descHeader, descContent);
    settingsDescriptionWrapper.appendChild(descElem);
  }

  // If this is the first load, force settings menu opening
  if (!urlParams.has(PREFS_URL_PARAM)) {
    requestAnimationFrame(() => {
      setSettingsMenuState(true);
    });
  }

  // Finally, update the URL
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
    setVisualPreference(pref, !pref.state);
  }
}

function setVisualPreference(pref, newState) {
  if (pref) {
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

function applyPreset(preset) {
  [...preset.enabled]
    .map(settingId => findPreference(settingId))
    .forEach(pref => setVisualPreference(pref, true));

  [...preset.disabled]
    .map(settingId => findPreference(settingId))
    .forEach(pref => setVisualPreference(pref, false));
}

function updateExternallyToggledPreferences(changes) {
  return new Promise(resolve => {
    let reload = false;
    if (changes.settingsToToggle && changes.settingsToToggle.length > 0) {
      for (let setting of changes.settingsToToggle) {
        if (setting === "reload") {
          reload = true;
        } else {
          let preference = findPreference(setting);
          if (preference) {
            toggleVisualPreference(preference);
          } else {
            let preset = PREFERENCES_PRESETS.find(preset => preset.id === setting);
            if (preset) {
              applyPreset(preset);
              requestAnimationFrame(() => {
                setMouseVisibility(false);
              });
            }
          }
        }
      }
      if (reload) {
        window.location.reload(true);
      }
    }
    resolve();
  });
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
  // Toggle settings menu with space bar
  // Toggle expert settings mode with Ctrl
  if (e.key === ' ') {
    toggleSettingsMenu();
  } else if (e.key === 'Control') {
    toggleSettingsExpertMode();
  }
};


///////////////////////////////
// MOUSE EVENTS FOR SETTINGS
///////////////////////////////

let settingsVisible = false;
let settingsExpertMode = false;
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
  let settingsWrapper = document.getElementById("settings-wrapper");

  let settingsMenuToggleButton = document.getElementById("settings-menu-toggle-button");
  settingsMenuToggleButton.onclick = () => {
    requestAnimationFrame(() => toggleSettingsMenu());
  };

  let settingsMenuExpertModeToggleButton = document.getElementById("settings-expert-mode-toggle");
  settingsMenuExpertModeToggleButton.onclick = () => {
    toggleSettingsExpertMode();
  };
  setExpertModeToggleButtonText(settingsExpertMode);

  document.body.onclick = (e) => {
    if (settingsVisible && !isSettingControlElem(e)) {
      setSettingsMenuState(false);
    }
  }

  document.addEventListener("dblclick", (e) => {
    if (!settingsVisible && !isSettingControlElem(e)) {
      toggleFullscreen();
    }
  });

  settingsWrapper.onmousemove = (event) => {
    requestAnimationFrame(() => clearTimeout(cursorTimeout));
    document.getElementById("settings-description").childNodes
      .forEach(elem => setClass(elem, "show", false));
    let target = event.target;
    if (target.classList.contains("setting") || target.classList.contains("preset")) {
      let targetLabel = document.getElementById(target.id + "-description");
      setClass(targetLabel, "show", true);
    }
  }
}

function isSettingControlElem(e) {
  let settingsMenuToggleButton = document.getElementById("settings-menu-toggle-button");
  let settingsMenuExpertModeToggleButton = document.getElementById("settings-expert-mode-toggle");
  return e.target === settingsMenuToggleButton
      || e.target === settingsMenuExpertModeToggleButton
      || e.target.classList.contains("setting")
      || e.target.classList.contains("preset");
}

function toggleSettingsMenu() {
  setSettingsMenuState(!settingsVisible);
}

function setSettingsMenuState(state) {
  settingsVisible = state;

  let settingsMenuToggleButton = document.getElementById("settings-menu-toggle-button");
  setClass(settingsMenuToggleButton, "show", settingsVisible);
  setMouseVisibility(settingsVisible)

  let settingsWrapper = document.getElementById("settings-wrapper");
  let mainBody = document.getElementById("main");
  setClass(settingsWrapper, "show", settingsVisible);
  setClass(mainBody, "blur", settingsVisible);
}

function toggleSettingsExpertMode() {
  settingsExpertMode = !settingsExpertMode;
  let settingsWrapper = document.getElementById("settings-wrapper");
  setClass(settingsWrapper, "expert", settingsExpertMode);
  setExpertModeToggleButtonText(settingsExpertMode);
}

function setExpertModeToggleButtonText(state) {
  let settingsMenuExpertModeToggleButton = document.getElementById("settings-expert-mode-toggle");
  settingsMenuExpertModeToggleButton.innerHTML = state ? "Preset Mode" : "Expert Mode";
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


///////////////////////////////
// FPS Counter
///////////////////////////////

let fps = document.getElementById("fps-counter");
let fpsStartTime = Date.now();
let fpsFrame = 0;

function fpsTick() {
  let time = Date.now();
  fpsFrame++;
  if (time - fpsStartTime > 100) {
    if (fps.classList.contains("show")) {
      fps.innerHTML = (fpsFrame / ((time - fpsStartTime) / 1000)).toFixed(1);
    }
    fpsStartTime = time;
    fpsFrame = 0;
  }
  requestAnimationFrame(fpsTick);
}
fpsTick();
