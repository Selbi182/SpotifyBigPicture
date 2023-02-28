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
    releaseDate: "",
    discNumber: 0,
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
    combinedTime: 0,
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
  pollingLoop();
}

function submitVisualPreferencesToBackend() {
  let simplifiedPrefs = [...PREFERENCES_PRESETS, ...PREFERENCES]
    .sort((a, b) => PREFERENCES_CATEGORY_ORDER.indexOf(a.category) - PREFERENCES_CATEGORY_ORDER.indexOf(b.category))
    .map(pref => {
        return {
          id: pref.id,
          name: pref.name,
          category: pref.category,
          description: pref.description
        }
      });

  fetch("/settings/list", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(simplifiedPrefs)
  })
    .then(response => {
      if (response.status >= 400) {
        console.warn("Failed to transmit settings to backend");
      }
    })
}

function singleRequest() {
  return new Promise(resolve => {
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
      .then(() => resolve(true))
      .catch(ex => {
        console.error(ex);
        resolve(false);
      });
  });
}

///////////////////////////////
// WEB STUFF - Polling
///////////////////////////////

const POLLING_INTERVAL_MS = 2 * 1000;
const POLLING_INTERVAL_IDLE_MS = 60 * 1000;

let pollingRetryAttempt = 0;
const MAX_POLLING_RETRY_ATTEMPT = 5;

function pollingLoop() {
  singleRequest()
    .then(success => calculateNextPollingTimeout(success))
    .then(pollingMs => setTimeout(pollingLoop, parseInt(pollingMs.toString())));
}

let fakeSongTransition;
function calculateNextPollingTimeout(success) {
  if (success) {
    pollingRetryAttempt = 0;
    if (!idle) {
      if (!currentData.playbackContext.paused) {
        let timeCurrent = currentData.currentlyPlaying.timeCurrent;
        let timeTotal = currentData.currentlyPlaying.timeTotal;
        let remainingTime = timeTotal - timeCurrent;
        if (timeCurrent && timeTotal && remainingTime > 0 && remainingTime < POLLING_INTERVAL_MS) {
          clearTimeout(fakeSongTransition);
          if (findPreference("fake-song-transition").state) {
            fakeSongTransition = setTimeout(() => simulateNextSongTransition(), remainingTime);
            return POLLING_INTERVAL_MS * 2;
          } else {
            return remainingTime;
          }
        }
      }
      return POLLING_INTERVAL_MS;
    }
    return POLLING_INTERVAL_IDLE_MS;
  }
  let retryTimeoutMs = POLLING_INTERVAL_MS * (2 << Math.min(pollingRetryAttempt, MAX_POLLING_RETRY_ATTEMPT));
  pollingRetryAttempt++;
  return retryTimeoutMs;
}


function simulateNextSongTransition() {
  if (currentData.trackData.queue.length > 0) {
    let newTrackData = cloneObject(currentData.trackData);

    let expectedSong = newTrackData.queue.shift();
    expectedSong.timeCurrent = 0;
    expectedSong.imageData = newTrackData.nextImageData;

    newTrackData.trackNumber = newTrackData.listTracks.findIndex(track => track.id === expectedSong.id) + 1;
    newTrackData.discNumber = expectedSong.discNumber;
    delete newTrackData.nextImageData;

    let fakeNextData = {
      type: "SIMULATED_TRANSITION",
      currentlyPlaying: expectedSong,
      trackData: newTrackData
    };

    processJson(fakeNextData);
  }
}

function cloneObject(object) {
  return JSON.parse(JSON.stringify(object));
}

///////////////////////////////
// MAIN DISPLAY STUFF
///////////////////////////////

function getById(id) {
  return document.getElementById(id);
}

const BLANK = "BLANK";

function processJson(json) {
  if (json && json.type !== "EMPTY") {
    console.info(json);
    if (json.type === "DATA" || json.type === "SIMULATED_TRANSITION") {
      if (currentData.deployTime > 0 && getChange(json, "deployTime").wasChanged) {
        window.location.reload(true);
      } else {
        updateExternallyToggledPreferences(json)
          .then(() => changeImage(json))
          .then(() => prerenderNextImage(json))
          .then(() => setTextData(json))
          .then(() => refreshTimers())
          .finally(() => {
            // Update properties in local storage
            for (let prop in json) {
              currentData[prop] = json[prop];
            }
          });
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
  let titleContainer = getById("title");

  let artists = getChange(changes, "currentlyPlaying.artists");
  if (artists.wasChanged) {
    let artistsNew = artists.value;
    let mainArtist = artistsNew[0];
    let artistContainer = getById("artists");
    let artistsString = mainArtist + buildFeaturedArtistsSpan(artistsNew);
    artistContainer.innerHTML = convertToTextEmoji(artistsString);

    if (findPreference("show-featured-artists").state || currentData.currentlyPlaying.artists[0] !== mainArtist) {
      balanceTextClamp(artistContainer);
      fadeIn(artistContainer);
    }
  }

  let title = getChange(changes, "currentlyPlaying.title");
  if (title.wasChanged) {
    let normalizedEmoji = convertToTextEmoji(title.value);
    let titleNoFeat = removeFeaturedArtists(normalizedEmoji);
    let splitTitle = separateUnimportantTitleInfo(titleNoFeat);
    let titleMain = splitTitle.main;
    let titleExtra = splitTitle.extra;
    getById("title-main").innerHTML = titleMain;
    getById("title-extra").innerHTML = titleExtra;

    balanceTextClamp(titleContainer);
    fadeIn(titleContainer);
  }

  let album = getChange(changes, "currentlyPlaying.album");
  let releaseDate = getChange(changes, "currentlyPlaying.releaseDate");
  if (album.wasChanged || releaseDate.wasChanged) {
    let normalizedEmoji = convertToTextEmoji(album.value);
    let splitTitle = separateUnimportantTitleInfo(normalizedEmoji);
    let albumTitleMain = splitTitle.main;
    let albumTitleExtra = splitTitle.extra;
    getById("album-title-main").innerHTML = albumTitleMain;
    getById("album-title-extra").innerHTML = albumTitleExtra;

    getById("album-release").innerHTML = releaseDate.value;

    let albumMainContainer = getById("album-title");
    balanceTextClamp(albumMainContainer);
    let albumContainer = getById("album");
    fadeIn(albumContainer);
  }

  let description = getChange(changes, "currentlyPlaying.description");
  if (description.wasChanged) {
    let descriptionContainer = getById("description");
    let isPodcast = description.value !== BLANK;
    descriptionContainer.innerHTML = isPodcast ? description.value : "";
    balanceTextClamp(descriptionContainer);
    fadeIn(descriptionContainer);
  }

  // Context
  let context = getChange(changes, "playbackContext.context");
  if (context.wasChanged) {
    let contextMain = getById("context-main");
    let contextExtra = getById("context-extra");

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

      let combinedTime = getChange(changes, "trackData.combinedTime").value;
      if (combinedTime > 0) {
        let totalTimeFormatted = formatTimeVerbose(combinedTime);
        lengthInfo += ` (${totalTimeFormatted})`;
      }
      contextExtra.innerHTML = lengthInfo;
    } else {
      contextExtra.innerHTML = "";
    }

    // Thumbnail
    let thumbnailWrapperContainer = getById("thumbnail-wrapper");
    let thumbnailContainer = getById("thumbnail");
    let thumbnailUrl = getChange(changes, "playbackContext.thumbnailUrl").value;
    if (thumbnailUrl === BLANK) {
      thumbnailContainer.src = "";
      setClass(thumbnailWrapperContainer, "show", false);
    } else {
      setClass(thumbnailWrapperContainer, "show", true);
      let circularThumbnail = context.value.startsWith("ARTIST: ") || context.value.startsWith("ALBUM: ");
      setClass(thumbnailWrapperContainer, "circular", circularThumbnail);
      thumbnailContainer.src = thumbnailUrl;
      fadeIn(thumbnailContainer);
    }

    let contextContainer = getById("context");
    fadeIn(contextContainer);
  }

  // Time
  let timeCurrent = getChange(changes, "currentlyPlaying.timeCurrent");
  let timeTotal = getChange(changes, "currentlyPlaying.timeTotal");
  if (timeCurrent.wasChanged || timeTotal.wasChanged) {
    updateProgress(changes, true);
    if (getChange(changes, "currentlyPlaying.id").value) {
      finishAnimations(getById("progress-current"));
    }
  }

  // States
  let paused = getChange(changes, "playbackContext.paused");
  if (paused.wasChanged) {
    let pauseElem = getById("play-pause");
    setClass(pauseElem, "paused", paused.value);
    fadeIn(pauseElem);
  }

  let shuffle = getChange(changes, "playbackContext.shuffle");
  if (shuffle.wasChanged) {
    let shuffleElem = getById("shuffle");
    setClass(shuffleElem, "show", shuffle.value);
    fadeIn(shuffleElem);
  }

  let repeat = getChange(changes, "playbackContext.repeat");
  if (repeat.wasChanged) {
    let repeatElem = getById("repeat");
    setClass(repeatElem, "show", repeat.value !== "off");
    if (repeat.value === "track") {
      repeatElem.classList.add("once");
    } else {
      repeatElem.classList.remove("once");
    }
    fadeIn(repeatElem);
  }

  let volume = getChange(changes, "playbackContext.volume");
  let device = getChange(changes, "playbackContext.device");
  if (volume.wasChanged || device.wasChanged) {
    handleVolumeChange(volume.value, device.value);
  }

  if (device.wasChanged) {
    getById("device").innerHTML = convertToTextEmoji(device.value);
    handleDeviceChange(device.value);
  }

  // Color
  let textColor = getChange(changes, "currentlyPlaying.imageData.imageColors.primary")
  if (textColor.wasChanged) {
    setTextColor(textColor.value);
  }

  // Playlist View
  setCorrectTracklistView(changes);
}

function refreshTrackList() {
  setCorrectTracklistView(currentData, true);
}

function setCorrectTracklistView(changes, force = false) {
  let mainContainer = getById("content-center");
  let trackListContainer = getById("track-list");
  let listViewType = getChange(changes, "trackData.trackListView").value;
  let listTracks = getChange(changes, "trackData.listTracks").value;
  let currentId = getChange(changes, "currentlyPlaying.id").value;
  let trackNumber = getChange(changes, "trackData.trackNumber").value;
  let currentDiscNumber = getChange(changes, "trackData.discNumber").value;
  let totalDiscCount = getChange(changes, "trackData.totalDiscCount").value;
  let shuffle = getChange(changes, "playbackContext.shuffle").value;

  let specialQueue = getChange(changes, "playbackContext.context").value.startsWith("Queue >> ");
  let titleDisplayed = specialQueue || listViewType !== "ALBUM";
  let queueMode = (specialQueue || listViewType === "QUEUE" || listTracks.length === 0 || trackNumber === 0 || !findPreference("scrolling-track-list").state) && findPreference("show-queue").state;
  let wasPreviouslyInQueueMode = mainContainer.classList.contains("queue");

  setClass(mainContainer, "hide-title", !titleDisplayed);
  setClass(mainContainer, "queue", queueMode);

  let displayTrackNumbers = listViewType === "ALBUM" && !shuffle && !queueMode;
  setClass(trackListContainer, "show-tracklist-numbers", displayTrackNumbers)
  setClass(trackListContainer, "show-discs", !queueMode && totalDiscCount > 1)

  ///////////

  let oldQueue = (queueMode ? currentData.trackData.queue : currentData.trackData.listTracks) || [];
  let newQueue = (queueMode ? changes.trackData.queue : changes.trackData.listTracks) || [];

  let refreshPrintedList = newQueue.length > 0 &&
      (force || (queueMode !== wasPreviouslyInQueueMode)
    || (oldQueue.length !== newQueue.length || !trackListEquals(oldQueue, newQueue)));

  if (refreshPrintedList) {
    if (queueMode) {
      if (isExpectedNextSongInQueue(currentId, currentData.trackData.queue)) {
        // Special animation when the expected next song comes up
        let trackListContainer = printTrackList([currentData.trackData.queue[0], ...changes.trackData.queue], false);
        requestAnimationFrame(() => requestAnimationFrame(() => { // double requestAnimationFrame to avoid race conditions...
          let currentTrackListTopElem = trackListContainer.firstElementChild;
          let currentTrackListBottomElem = trackListContainer.lastElementChild;
          currentTrackListTopElem.querySelector(".track-name").ontransitionend = (e) => {
            let parent = e.target.parentNode;
            if (parent.classList.contains("track-elem") && parent.classList.contains("shrink")) {
              parent.remove();
            }
          }
          currentTrackListTopElem.classList.add("shrink");
          currentTrackListBottomElem.classList.add("grow");
        }));
      } else {
        let trackListContainer = printTrackList(changes.trackData.queue, false);
        trackListContainer.lastElementChild.classList.add("grow");
      }
    } else {
      let isMultiDisc = listTracks.find(t => 'discNumber' in t && t.discNumber > 1);
      printTrackList(listTracks, listViewType === "ALBUM" && isMultiDisc && !shuffle);
    }

    // Scale track list to fit container
    let previousFontSizeScale = trackListContainer.style.getPropertyValue("--font-size-scale") || 1;

    let contentCenterContainer = trackListContainer.parentElement;
    let contentCenterHeight = contentCenterContainer.offsetHeight;
    let trackListSize = trackListContainer.scrollHeight / previousFontSizeScale;
    let splitMode = findPreference("split-main-panels").state;

    let trackListScaleRatio;
    if (splitMode) {
      trackListScaleRatio = Math.max(2, contentCenterHeight / trackListSize);
    } else {
      let contentInfoSize = getById("center-info-main").offsetHeight;
      let contentCenterGap = parseFloat(window.getComputedStyle(contentCenterContainer).gap);
      trackListScaleRatio = Math.max(2, (contentCenterHeight - contentInfoSize - contentCenterGap) / trackListSize);
    }
    if (!isNaN(trackListScaleRatio) && isFinite(trackListScaleRatio)) {
      trackListContainer.style.setProperty("--font-size-scale", trackListScaleRatio.toString());

      // Make sure the tracklist is at the correct position after the scaling transition.
      // This is a bit of a hackish solution, but a proper ontransitionend is gonna be too tricky on a grid.
      let transitionFromCss = getComputedStyle(document.body).getPropertyValue("--transition");
      setTimeout(() => {
        refreshScrollPositions(queueMode, trackNumber, totalDiscCount, currentDiscNumber);
        refreshTextBalance();
      }, parseFloat(transitionFromCss.slice(0, -1)) * 1000);
    }
  }

  if (refreshPrintedList || getChange(changes, "trackData.trackNumber").wasChanged) {
    refreshScrollPositions(queueMode, trackNumber, totalDiscCount, currentDiscNumber);
  }
}

function isExpectedNextSongInQueue(newSongId, previousQueue) {
  if (newSongId && previousQueue?.length > 1) {
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

function balanceTextClamp(elem) {
  // balanceText doesn't take line-clamping into account, unfortunately.
  // So we gotta temporarily remove it, balance the text, then add it again.
  elem.style.setProperty("-webkit-line-clamp", "initial", "important");
  balanceText(elem);
  elem.style.removeProperty("-webkit-line-clamp");
}

function refreshTextBalance() {
  for (let id of ["artists", "title", "album-title", "description"]) {
    balanceTextClamp(getById(id));
  }
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

function buildFeaturedArtistsSpan(artists) {
  if (artists.length > 1) {
    let featuredArtists = artists.slice(1).join(" & ");
    return `<span class="feat"> (feat. ${featuredArtists})</span>`;
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
  let trackListContainer = getById("track-list");
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
    trackNameMain.innerHTML = removeFeaturedArtists(splitTitle.main) + buildFeaturedArtistsSpan(trackItem.artists);
    let trackNameExtra = document.createElement("span");
    trackNameExtra.className = "extra";
    trackNameExtra.innerHTML = splitTitle.extra;
    trackName.append(trackNameMain, trackNameExtra);
  }

  // Length
  let trackLength = document.createElement("div");
  trackLength.className = "track-length"
  if ('timeTotal' in trackItem) {
    trackLength.innerHTML = formatTime(0, trackItem.timeTotal).total;
  }

  // Append
  trackElem.append(trackNumberContainer, trackArtist, trackName, trackLength);
  return trackElem;
}

window.addEventListener('load', setupScrollGradients);
function setupScrollGradients() {
  let trackList = getById("track-list");
  trackList.onscroll = () => updateScrollGradients();
}


function refreshScrollPositions(queueMode, trackNumber, totalDiscCount, currentDiscNumber) {
  if (queueMode) {
    updateScrollPositions(1);
  } else {
    let targetTrackNumber = trackNumber + (totalDiscCount > 1 ? currentDiscNumber : 0);
    updateScrollPositions(targetTrackNumber);
  }
}

function updateScrollPositions(trackNumber) {
  requestAnimationFrame(() => {
    let trackListContainer = getById("track-list");
    let previouslyPlayingRow = [...trackListContainer.childNodes].find(node => node.classList.contains("current"));
    if (trackNumber) {
      let currentlyPlayingRow = trackListContainer.childNodes[trackNumber - 1];
      if (currentlyPlayingRow && previouslyPlayingRow !== currentlyPlayingRow) {
        trackListContainer.childNodes.forEach(node => node.classList.remove("current"));
        currentlyPlayingRow.classList.add("current");
      }

      let scrollUnit = trackListContainer.scrollHeight / trackListContainer.childNodes.length;
      let scrollMiddleApproximation = Math.round((trackListContainer.offsetHeight / scrollUnit) / 2);
      let scroll = Math.max(0, scrollUnit * (trackNumber - scrollMiddleApproximation));
      trackListContainer.scroll({
        top: scroll,
        left: 0,
        behavior: findPreference("transitions").state ? 'smooth' : 'auto'
      });
      updateScrollGradients();
    }
  });
}

const SCROLL_GRADIENTS_TOLERANCE = 10;
function updateScrollGradients() {
  let trackList = getById("track-list");
  let topGradient = trackList.scrollTop > SCROLL_GRADIENTS_TOLERANCE;
  let bottomGradient = (trackList.scrollHeight - trackList.clientHeight) > (trackList.scrollTop + SCROLL_GRADIENTS_TOLERANCE);
  setClass(trackList, "gradient-top", topGradient);
  setClass(trackList, "gradient-bottom", bottomGradient);
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
    let backgroundImg = getById("background-img");
    let backgroundCrossfade = getById("background-img-crossfade");
    setClass(backgroundCrossfade, "show", true);
    backgroundCrossfade.onload = () => {
      finishAnimations(backgroundCrossfade);
      backgroundImg.onload = () => {
        setClass(backgroundCrossfade, "show", false);
        resolve();
      };
      backgroundImg.src = pngData;
    };
    backgroundCrossfade.src = backgroundImg.src || defaultPrerender.pngData;
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
    let artwork = getById("artwork-img");
    artwork.onload = () => {
      resolve();
    }
    artwork.src = newImage;
  });
}


function loadBackground(newImage, colors) {
  return new Promise((resolve) => {
    let backgroundCanvasImg = getById("background-canvas-img");
    backgroundCanvasImg.onload = () => {
      let rgbOverlay = colors.secondary;
      let averageBrightness = colors.averageBrightness;
      let backgroundCanvasOverlay = getById("background-canvas-overlay");
      let grainOverlay = getById("grain");

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
    let prerenderCanvas = getById("prerender-canvas");
    setClass(prerenderCanvas, "show", true);

    // While PNG produces the by far largest Base64 image data, the actual conversion process
    // is significantly faster than with JPEG or SVG for some reason (still not perfect though)
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

let refreshBackgroundRenderInProgress = false;
function refreshBackgroundRender() {
  if (!refreshBackgroundRenderInProgress) {
    refreshBackgroundRenderInProgress = true;
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
        })
        .finally(() => {
          refreshBackgroundRenderInProgress = false;
        });
  }
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

  let elemTimeCurrent = getById("time-current");
  elemTimeCurrent.innerHTML = formattedCurrentTime;

  let elemTimeTotal = getById("time-total");
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
  let progressBarElem = getById("progress-current");

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
    currentData.currentlyPlaying.timeCurrent = Math.min(timeTotal, newTime);
    updateProgress(currentData, updateProgressBar);
  }
}

function setIdleModeState(state) {
  let content = getById("main");
  let settingsMenuToggleButton = getById("settings-menu-toggle-button"); // just to avoid a COMPLETELY black screen
  if (state) {
    if (!idle) {
      console.info("No music was played in 2 hours. Enabling idle mode...");
      settingsMenuToggleButton.classList.add("show");
      idle = true;
      clearTimers();
      showHide(content, false);
    }
  } else {
    if (idle) {
      idle = false;
      settingsMenuToggleButton.classList.remove("show");
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
    id: "fake-song-transition",
    name: "Simulate Song Transition (Beta)",
    description: "If enabled, simulate the transition to the expected next song in the queue. Otherwise, wait for the actual data to arrive. " +
        "Enabling this will make the transitions feel much smoother, but it may be inconsistent at times",
    category: "General",
    callback: (state) => {
      if (!state) {
        clearTimeout(fakeSongTransition);
      }
    }
  },
  {
    id: "show-queue",
    name: "Show Tracklist/Queue",
    description: "If enabled, show the queue/tracklist for playlists and albums. Otherwise, only the current song is displayed",
    category: "Track List",
    requiredFor: ["scrolling-track-list", "enlarge-scrolling-track-list", "hide-title-scrolling-track-list", "show-timestamps-track-list", "xl-tracklist", "xl-main-info-scrolling"],
    css: {
      "title": "!force-display",
      "track-list": "!hidden"
    },
    triggers: [refreshTrackList]
  },
  {
    id: "scrolling-track-list",
    name: "Scrolling Track List",
    description: "If enabled, the track list is replaced by an alternate design that displays the surrounding songs in an automatically scrolling list. " +
        "Do note that this only works when shuffle is disabled and the playlist has less than 200 songs (for performance reasons)",
    category: "Track List",
    requiredFor: ["enlarge-scrolling-track-list", "hide-title-scrolling-track-list", "xl-main-info-scrolling"],
    triggers: [refreshTrackList]
  },
  {
    id: "enlarge-scrolling-track-list",
    name: "Enlarge Current (Scrolling)",
    description: "If Scrolling Track List is enabled, the font size of the current song in the track list is slightly increased",
    category: "Track List",
    css: {"track-list": "enlarge-current"},
    triggers: [refreshTrackList]
  },
  {
    id: "hide-title-scrolling-track-list",
    name: "Hide Current Song Name (Scrolling)",
    description: "If Scrolling Track List is enabled, the current song's name will not be displayed in the main info container " +
        "(since it's already visible in the track list)",
    category: "Track List",
    requiredFor: ["xl-main-info-scrolling"],
    css: {"center-info-main": "hide-title-in-album-view"},
    triggers: [refreshTrackList]
  },
  {
    id: "xl-main-info-scrolling",
    name: "XL Main Info (Scrolling)",
    description: "If Hide Current Song Name (Scrolling) is enabled, the font size of the main content will automatically be doubled",
    category: "Track List",
    css: {"center-info-main": "big-text-scrolling"},
    triggers: [refreshTrackList]
  },
  {
    id: "show-timestamps-track-list",
    name: "Show Time Stamps",
    description: "Show the timestamps for each song in the track list",
    category: "Track List",
    css: {"track-list": "show-timestamps"},
    triggers: [refreshTrackList]
  },
  {
    id: "display-artwork",
    name: "Artwork",
    description: "Whether to display the artwork of the current track or not. If disabled, the layout will be centered",
    category: "Artwork",
    requiredFor: ["xl-artwork"],
    css: {
      "artwork": "!hide",
      "content": "!full-content"
    },
    triggers: [refreshBackgroundRender]
  },
  {
    id: "xl-artwork",
    name: "XL Artwork",
    description: "When enabled, the artwork is stretched to its maximum possible size. Do note that this leaves less room for all the other information",
    category: "Artwork",
    css: {"main": "maximum-artwork"},
    triggers: [refreshBackgroundRender]
  },
  {
    id: "bg-artwork",
    name: "Background Artwork",
    description: "If enabled, uses the release artwork for the background as a blurry, darkened version",
    category: "Background",
    css: {"background-canvas": "!color-only"},
    triggers: [refreshBackgroundRender]
  },
  {
    id: "bg-tint",
    name: "Background Overlay Color",
    description: "Add a subtle layer of one of the artwork's most dominant colors to the background. This helps increasing the contrast for very dark artworks",
    category: "Background",
    css: {"background-canvas-overlay": "!no-tint"},
    triggers: [refreshBackgroundRender]
  },
  {
    id: "bg-gradient",
    name: "Background Gradient",
    description: "Add a subtle gradient to the background that gets steadily darker towards the bottom",
    category: "Background",
    css: {"background-canvas-overlay": "!no-gradient"},
    triggers: [refreshBackgroundRender]
  },
  {
    id: "bg-grain",
    name: "Background Film Grain",
    description: "Adds a subtle layer of film grain/noise to the background to increase contrast and prevent color banding for dark images",
    category: "Background",
    css: {"grain": "show"},
    triggers: [refreshBackgroundRender]
  },
  {
    id: "show-artists",
    name: "Show Artists",
    description: "Display the artist(s)",
    category: "Main Content",
    requiredFor: ["show-featured-artists"],
    css: {"artists": "!hide"}
  },
  {
    id: "show-featured-artists",
    name: "Show Featured Artists",
    description: "Display any potential featured artists. Otherwise, only show the main artist",
    category: "Main Content",
    css: {"content-center": "!no-feat"}
  },
  {
    id: "xl-text",
    name: "XL Main Text",
    description: "If enabled, the font size for the current song's title, artist, and release is doubled. " +
        "This setting is intended to be used with disabled artwork, as there isn't a lot of space available otherwise",
    category: "Main Content",
    css: {"center-info-main": "big-text"}
  },
  {
    id: "xl-tracklist",
    name: "XL Track List",
    description: "If enabled, the font size for the track list is doubled. " +
        "This setting is intended to be used with disabled artwork, as there isn't a lot of space available otherwise",
    category: "Track List",
    css: {"track-list": "big-text"}
  },
  {
    id: "colored-text",
    name: "Colored Text",
    description: "If enabled, the dominant color of the current artwork will be used as color for all texts and some symbols. Otherwise, plain white will be used",
    category: "General",
    requiredFor: ["colored-symbol-context", "colored-symbol-spotify"],
    css: {"main": "!no-colored-text"}
  },
  {
    id: "show-release",
    name: "Show Release Name/Date",
    description: "Displays the release name with its release date (usually the year of the currently playing song's album)",
    category: "Main Content",
    requiredFor: ["separate-release-line"],
    css: {"album": "!hide"}
  },
  {
    id: "separate-release-line",
    name: "Separate Release Date",
    description: "Displays the release date in a new line, rather than right next to the release name",
    category: "Main Content",
    css: {"album": "separate-date"}
  },
  {
    id: "show-podcast-descriptions",
    name: "Show Podcast Descriptions",
    description: "While listening to a podcast episode, displays the description of that episode underneath the title",
    category: "Main Content",
    css: {"description": "!hide"}
  },
  {
    id: "enable-top-content",
    name: "Enable Top Context",
    description: "Enable the top content, the container for the context and Spotify logo. " +
        "Disabling this will increase the available space for the main content",
    category: "Top Content",
    requiredFor: ["show-context", "show-logo", "swap-top"],
    css: {"content-top": "!hide"}
  },
  {
    id: "swap-top",
    name: "Swap Top Content",
    description: "If enabled, the Context and Spotify Logo swap positions",
    category: "Top Content",
    css: {"content-top": "swap"}
  },
  {
    id: "show-context",
    name: "Context",
    description: "Displays the playlist/artist/album name along with some additional information at the top of the page. " +
        "Also displays a thumbnail, if available",
    category: "Top Content",
    requiredFor: ["colored-symbol-context", "swap-top"],
    css: {"meta-left": "!hide"}
  },
  {
    id: "show-logo",
    name: "Spotify Logo",
    description: "Whether to display the Spotify logo in the top right",
    category: "Top Content",
    requiredFor: ["colored-symbol-spotify", "swap-top"],
    css: {"meta-right": "!hide"}
  },
  {
    id: "colored-symbol-context",
    name: "Colored Context Thumbnail",
    description: "If enabled, the dominant color of the current artwork will be used as color for the context thumbnail",
    category: "Top Content",
    css: {"thumbnail-wrapper": "colored"}
  },
  {
    id: "colored-symbol-spotify",
    name: "Colored Spotify Logo",
    description: "If enabled, the dominant color of the current artwork will be used as color for the Spotify logo",
    category: "Top Content",
    css: {"logo": "colored"}
  },
  {
    id: "transitions",
    name: "Smooth Transitions",
    description: "Smoothly fade from one song to another. Otherwise, song switches will be displayed instantaneously",
    category: "General",
    css: {
      "main": "!disable-transitions",
      "background-img-crossfade": "!hidden"
    }
  },
  {
    id: "decreased-margins",
    name: "Decreased Margins",
    description: "If enabled, all margins are halved. " +
        "This allows for more content to be displayed on screen, but will make everything look slightly crammed",
    category: "General",
    css: {"main": "decreased-margins"},
    triggers: [refreshBackgroundRender]
  },
  {
    id: "show-titles",
    name: "Show Titles",
    description: "Show the title of the currently playing song",
    category: "Main Content",
    requiredFor: ["hide-title-scrolling-track-list"],
    css: {"title": "!hide"}
  },
  {
    id: "strip-titles",
    name: "Strip Titles",
    description: "Hides any kind of potentially unnecessary extra information from song tiles and release names " +
        `(such as 'Remastered Version', 'Anniversary Edition', '${new Date().getFullYear()} Re-Issue', etc.)`,
    category: "Main Content",
    css: {
      "title-extra": "hide",
      "album-title-extra": "hide",
      "track-list": "strip"
    }
  },
  {
    id: "enable-bottom-content",
    name: "Enable Bottom Context",
    description: "Enable the bottom content, the container for the progress bar and various meta information. " +
        "Disabling this will increase the available space for the main content",
    category: "Bottom Content",
    requiredFor: ["show-progress-bar", "show-timestamps", "show-info-icons", "show-volume", "show-device", "reverse-bottom", "show-clock"],
    css: {"content-bottom": "!hide"}
  },
  {
    id: "show-progress-bar",
    name: "Progress Bar",
    description: "Displays a bar of that spans the entire screen, indicating how far along the currently played track is",
    category: "Bottom Content",
    css: {"progress": "!hide"},
    triggers: [refreshBackgroundRender]
  },
  {
    id: "show-timestamps",
    name: "Timestamps",
    description: "Displays the current and total timestamps of the currently playing track as numeric values",
    category: "Bottom Content",
    requiredFor: ["spread-timestamps"],
    css: {
      "artwork": "!hide-timestamps",
      "bottom-meta-container": "!hide-timestamps"
    },
    triggers: [refreshBackgroundRender]
  },
  {
    id: "spread-timestamps",
    name: "Spread-out Timestamps",
    description: "When enabled, the current timestamp is separated from the total timestamp and displayed on the left",
    category: "Bottom Content",
    css: {"bottom-meta-container": "spread-timestamps"},
    callback: (state) => {
      let timeCurrent = getById("time-current");
      let bottomLeft = getById("bottom-left");
      let bottomRight = getById("bottom-right");
      if (state) {
        bottomLeft.insertBefore(timeCurrent, bottomLeft.firstChild);
      } else {
        bottomRight.insertBefore(timeCurrent, bottomRight.firstChild);
      }
    }
  },
  {
    id: "show-info-icons",
    name: "Play/Pause/Shuffle/Repeat",
    description: "Display the state icons for play/pause as well as shuffle and repeat in the bottom left",
    category: "Bottom Content",
    css: {"info-symbols": "!hide"}
  },
  {
    id: "show-volume",
    name: "Volume",
    description: "Display the current volume in the bottom left",
    category: "Bottom Content",
    css: {"volume": "!hide"}
  },
  {
    id: "show-device",
    name: "Device",
    description: "Display the name of the current playback device in the bottom left",
    category: "Bottom Content",
    css: {"device": "!hide"}
  },
  {
    id: "reverse-bottom",
    name: "Swap Bottom Content",
    description: "If enabled, the progress bar and the timestamps/playback state info swap positions",
    category: "Bottom Content",
    css: {"content-bottom": "reverse"}
  },
  {
    id: "show-clock",
    name: "Clock",
    description: "Displays a clock at the bottom center of the page",
    category: "Bottom Content",
    css: {"clock": "!hide"}
  },
  {
    id: "dark-mode",
    name: "Dark Mode",
    description: "Darkens the entire screen. This mode will be automatically disabled after 8 hours",
    category: "General",
    css: {"dark-overlay": "show"},
    callback: (state) => {
      const DARK_MODE_AUTOMATIC_DISABLE_TIMEOUT = 8 * 60 * 60 * 1000;
      clearTimeout(darkModeTimeout);
      if (state) {
        darkModeTimeout = setTimeout(() => {
          toggleDarkMode();
        }, DARK_MODE_AUTOMATIC_DISABLE_TIMEOUT);
      }
    }
  },
  {
    id: "main-content-left",
    name: "Left-Align Main Info",
    description: "Left-align the main content (current song information), instead of centering it. "
      + "This setting is intended to be used with disabled artwork",
    category: "Main Content",
    css: {"center-info-main": "left"}
  },
  {
    id: "main-content-bottom",
    name: "Bottom-Align Main Info",
    description: "Bottom-align the main content (current song information), instead of centering it. "
      + "This setting is intended to be used with disabled artwork",
    category: "Main Content",
    css: {"center-info-main": "bottom"}
  },
  {
    id: "split-main-panels",
    name: "Split Main Content",
    description: "Separate the main info from the track list and display both in their own panel. "
      + "This setting is intended to be used with disabled artwork, as there isn't a lot of space available otherwise",
    category: "Main Content",
    requiredFor: ["split-lr-center-margins"],
    css: {"content-center": "split-main-panels"},
    triggers: [refreshTrackList]
  },
  {
    id: "reduced-center-margins",
    name: "Reduced Center Margins",
    description: "Halves the margins of the center container",
    category: "Main Content",
    css: {"content": "decreased-margins"},
    triggers: [refreshTrackList]
  },
  {
    id: "split-lr-center-margins",
    name: "Left/Right Center Margins (Split Mode)",
    description: "If split mode is enabled, add margins to the left and right of the center content",
    category: "Main Content",
    css: {"content-center": "extra-margins"},
    triggers: [refreshTrackList]
  },
  {
    id: "vertical-mode",
    name: "Vertical Mode",
    description: "Convert the two-panel layout into a vertical, centered layout. This will disable the track list, but it results in a more minimalistic appearance",
    category: "Main Content",
    overrides: ["show-queue", "xl-text", "xl-artwork"],
    css: {"main": "vertical"},
    triggers: [refreshBackgroundRender]
  },
  {
    id: "show-fps",
    name: "FPS Counter",
    description: "Display the frames-per-second in the top right of the screen (intended for performance debugging)",
    category: "Developer Tools",
    css: {"fps-counter": "show"},
    triggers: [fpsTick]
  },
  {
    id: "prerender-background",
    name: "Prerender Background",
    description: "[Keep this option enabled if you're unsure what it does!] " +
        "Captures screenshots of the background images and displays those instead of the live backgrounds. " +
        "This will save on resources for low-end PCs due to the nature of complex CSS, but it will increase the delay between song switches",
    category: "Developer Tools",
    css: {
      "background-rendered": "!hidden",
      "prerender-canvas": "!no-prerender"
    },
    triggers: [refreshBackgroundRender]
  }
];

const PREFERENCES_CATEGORY_ORDER = [
  "General",
  "Main Content",
  "Track List",
  "Top Content",
  "Bottom Content",
  "Artwork",
  "Background",
  "Developer Tools"
];

const PREFERENCES_DEFAULT = {
  enabled: [
    "show-queue",
    "scrolling-track-list",
    "enlarge-scrolling-track-list",
    "hide-title-scrolling-track-list",
    "show-timestamps-track-list",
    "show-podcast-descriptions",
    "display-artwork",
    "bg-artwork",
    "bg-tint",
    "bg-gradient",
    "bg-grain",
    "show-artists",
    "show-featured-artists",
    "show-titles",
    "colored-text",
    "colored-symbol-context",
    "colored-symbol-spotify",
    "show-release",
    "enable-top-content",
    "enable-bottom-content",
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
    "decreased-margins",
    "xl-text",
    "separate-release-line",
    "main-content-left",
    "main-content-bottom",
    "split-main-panels",
    "split-lr-center-margins",
    "reduced-center-margins",
    "vertical-mode",
    "xl-main-info-scrolling",
    "xl-tracklist",
    "swap-top",
    "spread-timestamps",
    "reverse-bottom",
    "xl-artwork"
  ],
  ignore: [
    "fake-song-transition",
    "dark-mode",
    "show-fps"
  ]
}

const PREFERENCES_PRESETS = [
  {
    id: "preset-default",
    name: "Default",
    category: "Presets",
    description: "The default mode. A balanced mode that aims to present as much information as possible about the current song (along with its artwork) without compromising on appeal",
    enabled: [],
    disabled: []
  },
  {
    id: "preset-xl-artwork",
    name: "XL-Artwork Mode",
    category: "Presets",
    description: "Just the the artwork stretched to the maximum possible size. Apart from that, only the current song, the track list, and the progress bar are displayed",
    enabled: [
      "xl-artwork",
      "decreased-margins"
    ],
    disabled: [
      "enable-top-content",
      "show-timestamps",
      "show-info-icons",
      "show-volume",
      "show-device",
      "show-clock"
    ]
  },
  {
    id: "preset-tracklist",
    name: "Track-List Mode",
    category: "Presets",
    description: "Disables the artwork and instead only dimly displays it in the background. " +
        "This opens up more room for the track list, which becomes centered. Also disables some lesser useful information",
    enabled: [
      "xl-main-info-scrolling",
      "spread-timestamps",
      "reverse-bottom"
    ],
    disabled: [
      "show-clock",
      "show-device",
      "show-volume",
      "show-info-icons",
      "display-artwork",
      "bg-tint"
    ]
  },
  {
    id: "preset-split-text",
    name: "Split-Text Mode",
    category: "Presets",
    description: "A combination of the default preset and Track-List Mode that puts the current song information on the left and the track list on the right. " +
        "Disables the artwork and instead only dimly displays it in the background",
    enabled: [
      "swap-top",
      "xl-main-info-scrolling",
      "split-lr-center-margins",
      "reduced-center-margins",
      "main-content-left",
      "reverse-bottom",
      "split-main-panels",
      "separate-release-line"
    ],
    disabled: [
      "colored-symbol-context",
      "show-featured-artists",
      "bg-tint",
      "enlarge-scrolling-track-list",
      "display-artwork"
    ]
  },
  {
    id: "preset-big-current-song",
    name: "Big Current-Song Mode",
    category: "Presets",
    description: "Only shows the current song's title, artist and release in an extra large manner. Track list is disabled, artwork is moved to the background",
    enabled: [
      "xl-text",
      "split-main-panels",
      "separate-release-line",
      "spread-timestamps",
      "reverse-bottom"
    ],
    disabled: [
      "show-clock",
      "show-featured-artists",
      "scrolling-track-list",
      "enlarge-scrolling-track-list",
      "show-device",
      "show-volume",
      "show-podcast-descriptions",
      "show-info-icons",
      "hide-title-scrolling-track-list",
      "show-queue",
      "display-artwork",
      "show-timestamps-track-list"
    ]
  },
  {
    id: "preset-minimalistic",
    name: "Minimalistic Mode",
    category: "Presets",
    description: "A minimalistic design preset only containing the most relevant information about the currently playing song. The background only displays a plain color. Inspired by the original Spotify fullscreen interface for Chromecast",
    enabled: [
      "vertical-mode",
      "spread-timestamps",
      "reverse-bottom",
      "separate-release-line",
      "reduced-center-margins"
    ],
    disabled: [
      "show-clock",
      "show-featured-artists",
      "scrolling-track-list",
      "enlarge-scrolling-track-list",
      "bg-artwork",
      "bg-gradient",
      "show-device",
      "show-volume",
      "show-podcast-descriptions",
      "show-release",
      "show-info-icons",
      "hide-title-scrolling-track-list",
      "show-queue",
      "colored-text",
      "colored-symbol-spotify",
      "show-timestamps",
      "show-timestamps-track-list",
      "colored-symbol-context"
    ]
  }
];

function findPreference(id) {
  let pref = PREFERENCES.find(pref => pref.id === id);
  if (pref && !pref.hasOwnProperty('state')) {
    // Just to fix IDE warnings
    pref.state = false;
  }
  return pref;
}
window.addEventListener('load', initVisualPreferences);

function initVisualPreferences() {
  const settingsWrapper = getById("settings-categories");
  const settingsDescriptionWrapper = getById("settings-description");

  // Integrity check
  let allDefaultSettings = [PREFERENCES_DEFAULT.enabled, PREFERENCES_DEFAULT.disabled, PREFERENCES_DEFAULT.ignore].flat();
  let unclassifiedSettings = PREFERENCES
    .map(pref => pref.id)
    .filter(prefId => !allDefaultSettings.includes(prefId));
  if (unclassifiedSettings.length > 0) {
    console.warn("The following settings don't have any defaults specified: " + unclassifiedSettings);
  }

  // Create categories
  let categories = {};
  for (let category of PREFERENCES_CATEGORY_ORDER) {
    let categoryElem = document.createElement("div");
    categoryElem.classList.add("setting-category");
    let categoryElemHeader = document.createElement("div");
    categoryElemHeader.classList.add("setting-category-header");
    categoryElemHeader.innerHTML = category;
    categoryElem.appendChild(categoryElemHeader);
    settingsWrapper.appendChild(categoryElem);
    categories[category] = categoryElem;
  }

  // Create expert settings
  for (let prefIndex in PREFERENCES) {
    let pref = PREFERENCES[prefIndex];

    // Create button element
    let prefElem = document.createElement("div");
    prefElem.id = pref.id;
    prefElem.classList.add("setting");
    prefElem.innerHTML = pref.name;
    prefElem.onclick = () => toggleVisualPreference(pref);

    // Group to category
    let categoryElem = categories[pref.category];
    categoryElem.appendChild(prefElem);

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

  // Create preset buttons
  const settingsPresetsWrapper = getById("settings-presets");
  for (let presetIndex in PREFERENCES_PRESETS) {
    let preset = PREFERENCES_PRESETS[presetIndex];

    let presetElem = document.createElement("div");
    presetElem.id = preset.id;
    presetElem.classList.add("preset");
    presetElem.innerHTML = `<img src="/design/img/presets/${preset.id}.png">`;

    presetElem.onclick = () => {
      applyPreset(preset);
    };

    settingsPresetsWrapper.append(presetElem);

    // Create description element
    let descElem = document.createElement("div");
    descElem.id = preset.id + "-description";

    let descHeader = document.createElement("div");
    descHeader.innerHTML = "Preset: " + preset.name;

    let descContent = document.createElement("div");
    descContent.innerHTML = preset.description;

    descElem.append(descHeader, descContent);
    settingsDescriptionWrapper.appendChild(descElem);
  }

  let visualPreferencesFromLocalStorage = getVisualPreferencesFromLocalStorage();
  if (visualPreferencesFromLocalStorage) {
    // Init setting states from local storage
    for (let pref of PREFERENCES) {
      refreshPreference(pref, visualPreferencesFromLocalStorage.includes(pref.id));
    }
  } else {
    // On first load, apply first preset of the list
    applyPreset(PREFERENCES_PRESETS[0]);
    requestAnimationFrame(() => {
      setSettingsMenuState(true);
    });
  }
}

const LOCAL_STORAGE_KEY = "visual_preferences";
const LOCAL_STORAGE_SPLIT_CHAR = "+";
function getVisualPreferencesFromLocalStorage() {
  if (isLocalStorageAvailable()) {
    let storedVisualPreferences = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedVisualPreferences) {
      return storedVisualPreferences.split(LOCAL_STORAGE_SPLIT_CHAR);
    }
  }
  return "";
}

function refreshPrefsLocalStorage() {
  if (isLocalStorageAvailable()) {
    let enabledPreferences = PREFERENCES
        .filter(pref => pref.state)
        .map(pref => pref.id)
        .join(LOCAL_STORAGE_SPLIT_CHAR);
    localStorage.setItem(LOCAL_STORAGE_KEY, enabledPreferences);
  }
}

function isLocalStorageAvailable() {
  let test = "localStorageAvailabilityTest";
  try {
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

function toggleVisualPreference(pref) {
  setVisualPreference(pref, !pref.state);
}

function setVisualPreferenceFromId(prefId, newState) {
  setVisualPreference(PREFERENCES.find(pref => pref.id === prefId), newState);
}

function setVisualPreference(pref, newState) {
  if (pref) {
    refreshPreference(pref, newState);
    refreshPrefsLocalStorage();
    refreshTextBalance();
  }
}

let darkModeTimeout;

function refreshPreference(preference, state) {
  preference.state = state;

  if ('callback' in preference) {
    preference.callback(state);
  }
  if ('css' in preference) {
    for (let id in preference.css) {
      let targetClassRaw = preference.css[id].toString();
      let targetClass = targetClassRaw.replace("!", "");
      let targetState = targetClassRaw.startsWith("!") ? !state : state;
      setClass(getById(id), targetClass, targetState)
    }
  }
  if ('triggers' in preference) {
    for (let trigger of preference.triggers) {
      trigger.call();
    }
  }

  updateOverridden(preference);

  // Toggle Checkmark
  setClass(getById(preference.id), "on", state);
}

function updateOverridden(preference) {
  let byId = getById(preference.id);
  let state = preference.state && !byId.classList.toString().includes("overridden-");
  if ('requiredFor' in preference) {
    preference.requiredFor.forEach(override => {
      setClass(getById(override), `overridden-${preference.id}`, !state);
      updateOverridden(findPreference(override));
    });
  }
  if ('overrides' in preference) {
    preference.overrides.forEach(override => {
      setClass(getById(override), `overridden-${preference.id}`, state);
      updateOverridden(findPreference(override));
    });
  }
}

let activePreset = PREFERENCES_PRESETS[0]; // used for thumbnail generation
function applyPreset(preset) {
  activePreset = preset;

  [...PREFERENCES_DEFAULT.enabled, ...preset.enabled]
    .filter(prefId => !preset.disabled.includes(prefId))
    .forEach(prefId => setVisualPreferenceFromId(prefId, true));

  [...PREFERENCES_DEFAULT.disabled, ...preset.disabled]
    .filter(prefId => !preset.enabled.includes(prefId))
    .forEach(prefId => setVisualPreferenceFromId(prefId, false));
}

function updateExternallyToggledPreferences(changes) {
  return new Promise(resolve => {
    let reload = false;
    if (changes.settingsToToggle?.length > 0) {
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
      changes.settingsToToggle = [];
      if (reload) {
        window.location.reload(true);
      }
    }
    resolve();
  });
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

let volumeTimeout;
function handleVolumeChange(volume, device) {
  let volumeContainer = getById("volume");
  let volumeTextContainer = getById("volume-text");

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
  let deviceContainer = getById("device");
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
    refreshTextBalance();
    refreshBackgroundRender();
    updateScrollGradients();
  }, REFRESH_BACKGROUND_ON_RESIZE_DELAY);
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
document.addEventListener("wheel", handleWheelEvent);
let cursorTimeout;
const MOUSE_MOVE_HIDE_TIMEOUT_MS = 1000;

function setMouseVisibility(state) {
  setClass(document.documentElement, "hide-cursor", !state);
}

function handleMouseEvent() {
  clearTimeout(cursorTimeout);
  setMouseVisibility(true)

  let settingsMenuToggleButton = getById("settings-menu-toggle-button");
  setClass(settingsMenuToggleButton, "show", true);
  cursorTimeout = setTimeout(() => {
    setMouseVisibility(false);
    if (!settingsVisible) {
      setClass(settingsMenuToggleButton, "show", false);
    }
  }, MOUSE_MOVE_HIDE_TIMEOUT_MS);
}

function isMobileView() {
  return window.matchMedia("screen and (max-aspect-ratio: 3/2)").matches;
}

function handleWheelEvent(e) {
  if (!isMobileView()) {
    if (e.passive) {
      e.preventDefault();
    }
    let delta = e.deltaY;
    if (settingsVisible) {
      let settingsCategories = getById("settings-categories");
      settingsCategories.scroll({
        top: 0,
        left: (delta * 6) + settingsCategories.scrollLeft,
        behavior: 'smooth'
      });
    } else {
      let trackList = getById("track-list");
      trackList.scroll({
        top: delta + trackList.scrollTop,
        left: 0,
        behavior: 'smooth'
      });
      updateScrollPositions();
    }
  }
}

window.addEventListener('load', initSettingsMouseMove);
function initSettingsMouseMove() {
  setMouseVisibility(false);
  let settingsWrapper = getById("settings-wrapper");

  let settingsMenuToggleButton = getById("settings-menu-toggle-button");
  settingsMenuToggleButton.onclick = (e) => {
    if (e.shiftKey) {
      generatePresetThumbnail();
    } else {
      requestAnimationFrame(() => toggleSettingsMenu());
    }
  };

  let settingsMenuExpertModeToggleButton = getById("settings-expert-mode-toggle");
  settingsMenuExpertModeToggleButton.onclick = () => {
    toggleSettingsExpertMode();
  };

  document.body.onclick = (e) => {
    if (settingsVisible && !isSettingControlElem(e, true)) {
      setSettingsMenuState(false);
    }
  }

  document.addEventListener("dblclick", (e) => {
    if (!settingsVisible && !isSettingControlElem(e, true)) {
      toggleFullscreen();
    }
  });

  settingsWrapper.onmousemove = (event) => {
    requestAnimationFrame(() => clearTimeout(cursorTimeout));
    getById("settings-description").childNodes
      .forEach(elem => setClass(elem, "show", false));
    let target = event.target;
    if (target.parentNode.classList.contains("preset")) {
      target = target.parentNode;
    }
    if (target.classList.contains("setting") || target.classList.contains("preset")) {
      let targetLabel = getById(target.id + "-description");
      setClass(targetLabel, "show", true);
    }
  }
}

function isSettingControlElem(e) {
  let settingsMenuToggleButton = getById("settings-menu-toggle-button");
  let settingsMenuExpertModeToggleButton = getById("settings-expert-mode-toggle");
  return e.target === settingsMenuToggleButton
      || e.target === settingsMenuExpertModeToggleButton
      || e.target.classList.contains("setting")
      || e.target.classList.contains("preset")
      || e.target.parentNode.classList.contains("preset");
}

function toggleSettingsMenu() {
  setSettingsMenuState(!settingsVisible);
}

function setSettingsMenuState(state) {
  settingsVisible = state;

  let settingsMenuToggleButton = getById("settings-menu-toggle-button");
  setClass(settingsMenuToggleButton, "show", settingsVisible);
  setMouseVisibility(settingsVisible)

  let settingsWrapper = getById("settings-wrapper");
  let mainBody = getById("main");
  setClass(settingsWrapper, "show", settingsVisible);
  setClass(mainBody, "blur", settingsVisible);
}

function toggleSettingsExpertMode() {
  settingsExpertMode = !settingsExpertMode;
  let settingsWrapper = getById("settings-wrapper");
  setClass(settingsWrapper, "expert", settingsExpertMode);
}

function generatePresetThumbnail() {
  let thumbnailGenerationEnabled = getById("main").classList.toggle("preset-thumbnail-generator");
  if (thumbnailGenerationEnabled) {
    let artworkClone = getById("artwork").cloneNode(true);
    artworkClone.classList.add("fake");
    setClass(artworkClone, "center", findPreference("vertical-mode").state)

    let contentMain = getById("content");
    contentMain.insertBefore(artworkClone, contentMain.firstChild);

    let content = getById("content");
    let presetThumbnailGeneratorCanvas = getById("preset-thumbnail-generator-canvas");
    domtoimage.toPng(content)
      .then(imgDataBase64 => {
        setClass(presetThumbnailGeneratorCanvas, "show", true);
        let downloadLink = document.createElement('a');
        downloadLink.href = `${imgDataBase64}`;
        downloadLink.download = `${activePreset.id}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        document.querySelector("#artwork.fake").remove();
        getById("main").classList.remove("preset-thumbnail-generator");
        setClass(presetThumbnailGeneratorCanvas, "show", false);
      });
  }
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
let clockPref;
setInterval(() => {
  if (!clockPref) {
    clockPref = findPreference("show-clock");
  }
  if (clockPref.state) {
    let date = new Date();
    let time = date.toLocaleDateString('en-UK', DATE_OPTIONS);
    if (time !== prevTime) {
      prevTime = time;
      let clock = getById("clock");
      clock.innerHTML = time;
    }
  }
}, 1000);


///////////////////////////////
// FPS Counter
///////////////////////////////

let fps = getById("fps-counter");
let fpsStartTime = Date.now();
let fpsFrame = 0;
let fpsPref;
function fpsTick() {
  if (!fpsPref) {
    fpsPref = findPreference("show-fps");
  }
  if (fpsPref.state) {
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
}
