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
    body: JSON.stringify(PREFERENCES)
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
  let queueMode = specialQueue || listViewType === "QUEUE" || listTracks.length === 0 || trackNumber === 0;
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
        window.requestAnimationFrame(() => {
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
    scaleTrackList(trackListContainer, 1);
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
  window.requestAnimationFrame(() => {
    if (scaleIteration < 10) {
      let visibleHeight = trackListContainer.offsetHeight;
      let realHeight = trackListContainer.scrollHeight;
      if (realHeight > visibleHeight) {
        if (scaleIteration > 0) {
          trackListContainer.style.setProperty("--scale", (scaleIteration - 1).toString());
        }
      } else {
        trackListContainer.style.setProperty("--scale", (scaleIteration + 1).toString());
        scaleTrackList(trackListContainer, scaleIteration + 1)
      }
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
  window.requestAnimationFrame(() => {
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

let nextImagePrerenderPngData = {
  imageUrl: null,
  pngData: null
};

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
  nextImagePrerenderPngData = {
    imageUrl: null,
    pngData: null
  };
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
  if (state) {
    if (!idle) {
      console.info("No music was played in 2 hours. Enabling idle mode...");
      idle = true;
      clearTimers();
      initPolling(POLLING_INTERVAL_IDLE_MS);
      showHide(content, false);
    }
  } else {
    if (idle) {
      idle = false;
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
      let trackListContainer = document.getElementById("track-list");
      setClass(trackListContainer, "hidden", !state);
      if (state) {
        trackListContainer.style.setProperty("--scale", "0");
        finishAnimations(trackListContainer);
        scaleTrackList(trackListContainer, 1);
      }
    }
  },
  {
    id: "display-artwork",
    name: "Artwork",
    hotkey: "a",
    description: "Whether to display the artwork of the current track or not. If disabled, the layout will be centered",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("artwork"), "hide", !state);
      setClass(document.getElementById("info"), "full-width", !state);
      refreshBackgroundRender();
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
    id: "bg-grain",
    name: "Background Grain",
    hotkey: "g",
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
    hotkey: "k",
    description: "If enabled, the background stays permanently black and overrides any other background-related settings",
    state: false,
    callback: (state) => {
      setClass(document.getElementById("bg-artwork"), "overridden", state);
      setClass(document.getElementById("bg-grain"), "overridden", state);
      setClass(document.getElementById("background-canvas"), "black", state);
      refreshBackgroundRender();
    }
  },
  {
    id: "colored-text",
    name: "Colored Text",
    hotkey: "c",
    description: "If enabled, the dominant color of the current artwork will be used as color for all texts and some symbols. Otherwise, plain white will be used",
    state: true,
    callback: (state) => setClass(document.body, "no-colored-text", !state)
  },
  {
    id: "colored-symbols",
    name: "Colored Symbols",
    hotkey: "y",
    description: "If enabled, the dominant color of the current artwork will be used as color for the for the Spotify logo and the playlist thumbnail. Otherwise, keep them unchanged",
    state: false,
    callback: (state) => {
      setClass(document.getElementById("logo"), "colored", state);
      setClass(document.getElementById("thumbnail"), "colored", state);
    }
  },
  {
    id: "show-release",
    name: "Release",
    hotkey: "r",
    description: "Displays the release name with its release year (usually the album of the currently playing song)",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("album"), "hide", !state);
    }
  },
  {
    id: "show-context",
    name: "Playlist Info",
    hotkey: "p",
    description: "Displays the playlist/artist/album name along with some additional information the top of the page. " +
        "Also displays a thumbnail, if available",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("colored-symbols"), "overridden-1", !state);
      setClass(document.getElementById("meta-left"), "hide", !state)
    }
  },
  {
    id: "show-logo",
    name: "Spotify Logo",
    hotkey: "l",
    description: "Whether to display the Spotify logo in the top right or not. If it's disabled, the playlist name " +
        "is pulled right",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("colored-symbols"), "overridden-2", !state);
      setClass(document.getElementById("top-info"), "no-logo", !state)
    }
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
    id: "show-timestamps",
    name: "Timestamps",
    hotkey: "h",
    description: "If enabled, display the current and total timestamps of the currently playing track. " +
        "Otherwise, only the progress bar is visible",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("artwork"), "hide-timestamps", !state);
      setClass(document.getElementById("bottom-lr-container"), "hide-timestamps", !state);
      refreshBackgroundRender();
    }
  },
  {
    id: "show-info-icons",
    name: "Playback State Info",
    hotkey: "i",
    description: "Shows the playback state info at the bottom left of the page (play, shuffle, repeat, volume, device name)",
    state: true,
    callback: (state) => {
      setClass(document.getElementById("artwork"), "hide-info", !state);
      setClass(document.getElementById("bottom-lr-container"), "hide-info", !state);
      refreshBackgroundRender();
    }
  },
  {
    id: "show-clock",
    name: "Clock",
    hotkey: "w",
    description: "Displays a clock at the bottom center of the page",
    state: false,
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
    id: "vertical-mode",
    name: "Vertical Mode",
    hotkey: "v",
    description: "Convert the two-panel layout into a vertical, centered layout. This will disable the queue, but it results in a more minimalistic appearance",
    state: false,
    callback: (state) => {
      setClass(document.getElementById("show-clock"), "overridden", state);
      setClass(document.getElementById("show-queue"), "overridden", state);
      setClass(document.getElementById("show-release"), "overridden", state);
      setClass(document.getElementById("main"), "vertical", state);
      refreshBackgroundRender();
    }
  },
  {
    id: "show-fps",
    name: "FPS Counter",
    hotkey: "x",
    description: "Display the frames-per-second in the top right of the screen (intended for performance debugging)",
    state: false,
    callback: (state) => {
      setClass(document.getElementById("fps-counter"), "show", state);
    }
  }
];

const PREFERENCES_PRESETS = [
  {
    id: "preset-minimalistic",
    name: "Preset: Minimalistic Mode",
    hotkey: "1",
    image: "/design/img/symbols/preset-minimalistic.png",
    description: "A minimalistic design preset only containing the most relevant information about the current song.",
    enabled: [
      "display-artwork",
      "bg-grain",
      "show-context",
      "show-logo",
      "transitions",
      "vertical-mode",
      "strip-titles"
    ],
    disabled: [
      "show-queue",
      "bg-artwork",
      "bg-black",
      "colored-text",
      "colored-symbols",
      "show-release",
      "show-timestamps",
      "show-info-icons",
      "show-clock"
    ]
  },
  {
    id: "preset-advanced",
    name: "Preset: Advanced Mode",
    hotkey: "2",
    image: "/design/img/symbols/preset-advanced.png",
    description: "An advanced design preset that displays as much information as possible. Most notably: the queue of upcoming songs",
    enabled: [
      "show-queue",
      "display-artwork",
      "bg-artwork",
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
      "show-clock"
    ],
    disabled: [
      "bg-black",
      "vertical-mode"
    ]
  }
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
    prefElem.innerHTML = `${pref.name} (${pref.hotkey})`;
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

    // Init setting
    refreshPreference(pref, state);
  }
  document.getElementById("fullscreen").onclick = toggleFullscreen;

  // Preset buttons
  const settingsPresetsWrapper = document.getElementById("settings-presets");
  for (let presetIndex in PREFERENCES_PRESETS) {
    let preset = PREFERENCES_PRESETS[presetIndex];
    let presetElem = document.createElement("div");
    presetElem.id = preset.id;
    presetElem.classList.add("preset");
    presetElem.style.setProperty("--image", `url("${preset.image}")`);

    presetElem.onclick = () => {
      for (let settingId of preset.enabled) {
        let pref = PREFERENCES.find(pref => pref.id === settingId);
        if (pref) {
          setVisualPreference(pref, true)
        }
      }
      for (let settingId of preset.disabled) {
        let pref = PREFERENCES.find(pref => pref.id === settingId);
        if (pref) {
          setVisualPreference(pref, false)
        }
      }
    };

    settingsPresetsWrapper.append(presetElem);

    // Create description element
    let descElem = document.createElement("div");
    descElem.id = preset.id + "-description";

    let descHeader = document.createElement("div");
    descHeader.innerHTML = `${preset.name} (${preset.hotkey})`;

    let descContent = document.createElement("div");
    descContent.innerHTML = preset.description;

    descElem.append(descHeader, descContent);
    settingsDescriptionWrapper.appendChild(descElem);
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
  refreshPreference(pref, newState);
  refreshPrefsQueryParam();
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

function updateExternallyToggledPreferences(changes) {
  return new Promise(resolve => {
    let reload = false;
    if (changes.settingsToToggle && changes.settingsToToggle.length > 0) {
      for (let setting of changes.settingsToToggle) {
        if (setting === "reload") {
          reload = true;
        } else {
          let preference = PREFERENCES.find(pref => pref.id === setting);
          if (preference) {
            toggleVisualPreference(preference);
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
  if (e.key === ' ') {
    let settingsMenuToggleButton = document.getElementById("settings-menu-toggle-button");
    settingsMenuToggleButton.click();
  } else {
    let pref = PREFERENCES.find(element => element.hotkey === e.key);
    if (pref) {
      toggleVisualPreference(pref);
    } else {
      let preset = PREFERENCES_PRESETS.find(element => element.hotkey === e.key);
      if (preset) {
        document.getElementById(preset.id).click();
      }
    }
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
    if (settingsVisible && e.target !== settingsMenuToggleButton && !e.target.classList.contains("setting") && !e.target.classList.contains("preset")) {
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
    let target = event.target;
    if (target.classList.contains("setting") || target.classList.contains("preset")) {
      let targetLabel = document.getElementById(target.id + "-description");
      setClass(targetLabel, "show", true);
    }
  }
}

function toggleSettingsMenu() {
  settingsVisible = !settingsVisible;
  let settingsWrapper = document.getElementById("settings-wrapper");
  let mainBody = document.getElementById("main");
  setClass(settingsWrapper, "show", settingsVisible);
  setClass(mainBody, "blur", settingsVisible);
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
  window.requestAnimationFrame(fpsTick);
}
fpsTick();
