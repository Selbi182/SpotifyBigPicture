const DEV_MODE = new URLSearchParams(document.location.search).has("dev");
if (DEV_MODE) {
  console.info("Developer Mode enabled!");
}

let currentData = {
  type: "",
  deployTime: 0,
  versionId: 0,
  customVolumeSettings: [
    {
      device: "",
      baseDb: 0
    }
  ],
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
    context: {
      contextName: "",
      contextType: ""
    },
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
  portraitModePresetSwitchPrompt();
  pollingLoop();
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
        if (remainingTime < POLLING_INTERVAL_MS * 2) {
          clearTimeout(fakeSongTransition);
          if (isPrefEnabled("fake-song-transition")) {
            fakeSongTransition = setTimeout(() => simulateNextSongTransition(), remainingTime);
            return remainingTime + POLLING_INTERVAL_MS;
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

String.prototype.select = function() {
  return document.getElementById(this);
}

const BLANK = "BLANK";
const transitionFromCss = parseFloat(getComputedStyle(document.body).getPropertyValue("--transition").slice(0, -1)) * 1000;

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
          .then(() => setCorrectTracklistView(json))
          .then(() => refreshTimers())
          .finally(() => {
            // Update properties in local storage
            for (let prop in json) {
              currentData[prop] = json[prop];
            }
            unlockPlaybackControls();
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
  // Main Content
  let titleContainer = "title".select();

  let artists = getChange(changes, "currentlyPlaying.artists");
  if (artists.wasChanged) {
    let artistsNew = artists.value;
    let mainArtist = artistsNew[0];
    let artistContainer = "artists".select();
    let artistsString = mainArtist + buildFeaturedArtistsSpan(artistsNew);
    artistContainer.innerHTML = convertToTextEmoji(artistsString);

    if (isPrefEnabled("show-featured-artists") || currentData.currentlyPlaying.artists[0] !== mainArtist) {
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
    "title-main".select().innerHTML = titleMain;
    "title-extra".select().innerHTML = titleExtra;

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
    "album-title-main".select().innerHTML = albumTitleMain;
    "album-title-extra".select().innerHTML = albumTitleExtra;

    let release = releaseDate.value;
    if (release !== BLANK) {
      let year = release.slice(0, 4);
      "release-year".select().innerHTML = year;
      "release-full".select().innerHTML = release.length > year.length && !release.endsWith("-01-01") ? formatReleaseDate(release) : year;
      setClass("album-release".select(), "hide", false);
    } else {
      "release-year".select().innerHTML = "";
      "release-full".select().innerHTML = "";
      setClass("album-release".select(), "hide", true);
    }

    let albumMainContainer = "album-title".select();
    balanceTextClamp(albumMainContainer);
    let albumContainer = "album".select();
    fadeIn(albumContainer);
  }

  let description = getChange(changes, "currentlyPlaying.description");
  if (description.wasChanged) {
    let descriptionContainer = "description".select();
    setClass("content-center".select(), "podcast", description.value && description.value !== BLANK);
    descriptionContainer.innerHTML = description.value;
    balanceTextClamp(descriptionContainer);
    fadeIn(descriptionContainer);
  }

  // Context
  let contextName = getChange(changes, "playbackContext.context.contextName");
  let contextType = getChange(changes, "playbackContext.context.contextType");
  if (contextName.wasChanged || contextType.wasChanged) {
    let contextMain = "context-main".select();
    let contextExtra = "context-extra".select();

    // Context name
    let contextTypePrefix = "";
    if (contextType.value !== "PLAYLIST") {
      if (contextType.value === "QUEUE_IN_ALBUM") {
        contextTypePrefix = "QUEUE &#x00BB; "
      } else if (contextType.value === "FAVORITE_TRACKS") {
        contextTypePrefix = "LIKED SONGS: ";
      } else {
        contextTypePrefix = contextType.value + ": ";
      }
    }
    contextMain.innerHTML = `${contextTypePrefix}${convertToTextEmoji(contextName.value)}`;

    // Track count / total duration
    let trackCount = getChange(changes, "trackData.trackCount").value;
    if (trackCount > 0) {
      let trackCountFormatted = numberWithCommas(trackCount);

      let numericDescription;
      if (contextType.value === "ARTIST") {
        numericDescription = "follower";
      } else if (contextType.value === "PODCAST") {
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
    let thumbnailWrapperContainer = "thumbnail-wrapper".select();
    let thumbnailContainer = "thumbnail".select();
    let thumbnailUrl = getChange(changes, "playbackContext.thumbnailUrl").value;
    let circularThumbnail = ["ALBUM", "EP", "SINGLE", "COMPILATION", "ARTIST", "SEARCH", "FAVORITE_TRACKS"].includes(contextType.value);
    setClass(thumbnailWrapperContainer, "circular", circularThumbnail);

    thumbnailContainer.src = thumbnailUrl !== BLANK ? thumbnailUrl : "";
    fadeIn(thumbnailContainer);

    fadeIn("context".select());
  }

  // Time
  let timeCurrent = getChange(changes, "currentlyPlaying.timeCurrent");
  let timeTotal = getChange(changes, "currentlyPlaying.timeTotal");
  if (timeCurrent.wasChanged || timeTotal.wasChanged) {
    updateProgress(changes);
    if (getChange(changes, "currentlyPlaying.id").value) {
      finishAnimations("progress-current".select());
    }
  }

  // States
  let paused = getChange(changes, "playbackContext.paused");
  if (paused.wasChanged) {
    let pauseElem = "play-pause".select();
    setClass(pauseElem, "paused", paused.value);
    fadeIn(pauseElem);
  }

  let shuffle = getChange(changes, "playbackContext.shuffle");
  if (shuffle.wasChanged) {
    let shuffleElem = "shuffle".select();
    setClass(shuffleElem, "show", shuffle.value);
    setClass(shuffleElem, "on", shuffle.value);
    fadeIn(shuffleElem);
  }

  let repeat = getChange(changes, "playbackContext.repeat");
  if (repeat.wasChanged) {
    let repeatElem = "repeat".select();
    setClass(repeatElem, "show", repeat.value !== "off");

    setClass(repeatElem, "context", repeat.value === "context");
    setClass(repeatElem, "track", repeat.value === "track");

    fadeIn(repeatElem);
  }

  let volume = getChange(changes, "playbackContext.volume");
  let device = getChange(changes, "playbackContext.device");
  let customVolumeSettings = getChange(changes, "customVolumeSettings");
  if (volume.wasChanged || device.wasChanged || customVolumeSettings.wasChanged) {
    handleVolumeChange(volume.value, device.value, customVolumeSettings.value);
  }

  if (device.wasChanged) {
    "device".select().innerHTML = convertToTextEmoji(device.value);
    handleDeviceChange(device.value);
  }

  // Color
  let textColor = getChange(changes, "currentlyPlaying.imageData.imageColors.primary")
  if (textColor.wasChanged) {
    setTextColor(textColor.value);
  }
}

function refreshTrackList() {
  setCorrectTracklistView(currentData);
}

function setCorrectTracklistView(changes) {
  let mainContainer = "content-center".select();
  let trackListContainer = "track-list".select();
  let listViewType = getChange(changes, "trackData.trackListView").value;
  let listTracks = getChange(changes, "trackData.listTracks").value;
  let currentId = getChange(changes, "currentlyPlaying.id").value;
  let trackNumber = getChange(changes, "trackData.trackNumber").value;
  let currentDiscNumber = getChange(changes, "trackData.discNumber").value;
  let totalDiscCount = getChange(changes, "trackData.totalDiscCount").value;
  let shuffle = getChange(changes, "playbackContext.shuffle").value;

  let specialQueue = getChange(changes, "playbackContext.context").value.contextType === "QUEUE_IN_ALBUM";
  let titleDisplayed = specialQueue || (listViewType !== "ALBUM" && listViewType !== "PLAYLIST_ALBUM");
  let queueMode = (specialQueue || listViewType === "QUEUE" || listTracks.length === 0 || trackNumber === 0 || !isPrefEnabled("album-view")) && isPrefEnabled("show-queue");
  let wasPreviouslyInQueueMode = mainContainer.classList.contains("queue");

  setClass(mainContainer, "title-duplicate", !titleDisplayed && !queueMode);
  setClass(mainContainer, "queue", queueMode);

  let displayTrackNumbers = listViewType === "ALBUM" && !shuffle && !queueMode;
  setClass(trackListContainer, "show-tracklist-numbers", displayTrackNumbers)
  setClass(trackListContainer, "show-discs", !queueMode && totalDiscCount > 1)

  ///////////

  let oldQueue = (queueMode ? currentData.trackData.queue : currentData.trackData.listTracks) || [];
  let newQueue = (queueMode ? changes.trackData.queue : changes.trackData.listTracks) || [];

  let refreshPrintedList = newQueue.length > 0 &&
      ((queueMode !== wasPreviouslyInQueueMode) || !trackListEquals(oldQueue, newQueue));

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
  }

  // Scale track list to fit container
  let previousFontSizeScale = trackListContainer.style.getPropertyValue("--font-size-scale") || 1;

  let contentCenterContainer = trackListContainer.parentElement;
  let contentCenterHeight = contentCenterContainer.offsetHeight;
  let trackListContainerHeight = trackListContainer.scrollHeight;
  let trackListSize = trackListContainerHeight / previousFontSizeScale;
  let splitMode = isPrefEnabled("split-main-panels");

  let trackListScaleRatio;
  if (splitMode) {
    trackListScaleRatio = Math.max(2, contentCenterHeight / trackListSize);
  } else {
    let contentInfoSize = "center-info-main".select().offsetHeight;
    let contentCenterGap = parseFloat(window.getComputedStyle(contentCenterContainer).gap);
    trackListScaleRatio = Math.max(2, (contentCenterHeight - contentInfoSize - contentCenterGap) / trackListSize);
    trackListScaleRatio = Math.floor(trackListScaleRatio * 10) /  10;
  }
  if (!isNaN(trackListScaleRatio) && isFinite(trackListScaleRatio)) {
    trackListContainer.style.setProperty("--font-size-scale", trackListScaleRatio.toString());

    // Make sure the tracklist is at the correct position after the scaling transition.
    // This is a bit of a hackish solution, but a proper ontransitionend is gonna be too tricky on a grid.
    refreshScrollPositions(queueMode, trackNumber, totalDiscCount, currentDiscNumber);
    setTimeout(() => {
      refreshScrollPositions(queueMode, trackNumber, totalDiscCount, currentDiscNumber);
      refreshTextBalance();
    }, transitionFromCss);
  } else if (refreshPrintedList || getChange(changes, "trackData.trackNumber").wasChanged) {
    refreshScrollPositions(queueMode, trackNumber, totalDiscCount, currentDiscNumber);
  }
}

function isExpectedNextSongInQueue(newSongId, previousQueue) {
  if (newSongId && previousQueue?.length > 1) {
    let expectedNextSong = previousQueue[0];
    return newSongId === expectedNextSong.id;
  }
  return false;
}

function trackListEquals(trackList1, trackList2) {
  if (trackList1.length !== trackList2.length) {
    return false;
  }
  for (let i = trackList1.length - 1; i > 0; i--) {
    if (trackList1[i].id !== trackList2[i].id) {
      return false;
    }
  }
  return true;
}

function balanceTextClamp(elem) {
  // balanceText is too stupid to stop itself when in portrait mode.
  // To prevent freezes, disallow balancing in those cases.
  if (!isPortraitMode()) {
    // balanceText doesn't take line-clamping into account, unfortunately.
    // So we gotta temporarily remove it, balance the text, then add it again.
    elem.style.setProperty("-webkit-line-clamp", "initial", "important");
    balanceText(elem);
    elem.style.removeProperty("-webkit-line-clamp");
  }
}

function refreshTextBalance() {
  isPortraitMode(true);
  for (let id of ["artists", "title", "album-title", "description"]) {
    balanceTextClamp(id.select());
  }
}

function setClass(elem, className, state) {
  if (state) {
    elem.classList.add(className);
  } else {
    elem.classList.remove(className);
  }
  return elem;
}

const USELESS_WORDS = [
  "radio",
  "anniversary",
  "bonus",
  "deluxe",
  "special",
  "remaster",
  "edition",
  "explicit",
  "extended",
  "expansion",
  "expanded",
  "version",
  "cover",
  "original",
  "single",
  "ep",
  "motion\\spicture",
  "re.?issue",
  "re.?record",
  "re.?imagine",
  "\\d{4}"
];
const WHITELISTED_WORDS = [
  "instrumental",
  "orchestral",
  "symphonic",
  "live",
  "classic",
  "demo"
];

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

const RELEASE_FULL_FORMAT = {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
};
const RELEASE_FULL_LOCALE = "en-US";

function formatReleaseDate(release) {
  let formattedDateBase = new Date(Date.parse(release)).toLocaleDateString(RELEASE_FULL_LOCALE, RELEASE_FULL_FORMAT);
  let match = formattedDateBase.match(/\d+/);
  if (match) {
    let day = match[0];
    let dayOfMonthTh = day + (day > 0 ? ['th', 'st', 'nd', 'rd'][(day > 3 && day < 21) || day % 10 > 3 ? 0 : day % 10] : '');
    return formattedDateBase.replace(day, dayOfMonthTh);
  }
  return formattedDateBase;
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
  let trackListContainer = "track-list".select();
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
  let trackList = "track-list".select();
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
    let trackListContainer = "track-list".select();
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
        behavior: isPrefEnabled("transitions") ? 'smooth' : 'auto'
      });
      updateScrollGradients();
    }
  });
}

const SCROLL_GRADIENTS_TOLERANCE = 10;
function updateScrollGradients() {
  let trackList = "track-list".select();
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

let nextImagePrerenderCanvasData;
unsetNextImagePrerender().then();

function changeImage(changes) {
  return new Promise(resolve => {
    let imageUrl = getChange(changes, "currentlyPlaying.imageData.imageUrl");
    if (imageUrl.wasChanged) {
      if (imageUrl.value === BLANK) {
        imageUrl.value = DEFAULT_IMAGE;
      }
      let oldImageUrl = currentData.currentlyPlaying.imageData.imageUrl;
      let newImageUrl = imageUrl.value;
      let colors = getChange(changes, "currentlyPlaying.imageData.imageColors").value;
      if (!oldImageUrl.includes(newImageUrl)) {
        if (nextImagePrerenderCanvasData.imageUrl === newImageUrl) {
          setRenderedBackground(nextImagePrerenderCanvasData.canvasData)
            .then(() => resolve());
        } else {
          setArtworkAndPrerender(newImageUrl, colors)
            .then(pngData => setRenderedBackground(pngData))
            .then(() => resolve());
        }
      } else {
        resolve();
      }
    } else {
      resolve();
    }
  });
}

let nextPrerenderInProgress = false;
function prerenderNextImage(changes) {
  return new Promise(resolve => {
    if (!nextPrerenderInProgress) {
      nextPrerenderInProgress = true;
      let prerenderEnabled = isPrefEnabled("prerender-background");
      if (prerenderEnabled) {
        let currentImageUrl = getChange(changes, "currentlyPlaying.imageData.imageUrl").value;
        let nextImageUrl = getChange(changes, "trackData.nextImageData.imageUrl").value;
        if (currentImageUrl !== nextImageUrl && nextImagePrerenderCanvasData.imageUrl !== nextImageUrl) {
          setTimeout(() => {
            let nextImageColors = getChange(changes, "trackData.nextImageData.imageColors").value;
            setArtworkAndPrerender(nextImageUrl, nextImageColors)
              .then(canvasData => {
                nextImagePrerenderCanvasData = {
                  imageUrl: nextImageUrl,
                  canvasData: canvasData
                };
                nextPrerenderInProgress = false;
              });
          }, transitionFromCss)
        }
      }
    }
    resolve();
  });
}

function setRenderedBackground(canvas) {
  return new Promise((resolve) => {
    // Set old background to fade out and then delete it
    // (In theory, should only ever be one, but just in case, do it for all children)
    let transitionsEnabled = isPrefEnabled("transitions");
    let backgroundRenderedWrapper = "background-rendered".select();
    backgroundRenderedWrapper.childNodes.forEach(child => {
      if (transitionsEnabled) {
        child.ontransitionend = () => child.remove();
        child.classList.add("crossfade");
      } else {
        child.remove();
      }
    });

    // Add the new canvas
    backgroundRenderedWrapper.append(canvas);
    resolve();
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
    .then(canvasData => resolve(canvasData));
  });
}

function loadArtwork(newImage) {
  return new Promise((resolve) => {
    calculateAndRefreshArtworkSize();
    let artwork = "artwork-img".select();
    artwork.onload = () => {
      resolve();
    }
    artwork.src = newImage;
  });
}

function calculateAndRefreshArtworkSize() {
  let main = "main".select();
  let artwork = "artwork".select();

  artwork.style.removeProperty("margin-top");
  artwork.style.removeProperty("--margin-multiplier");

  let settingsEnabled = settingsVisible;
  if (settingsEnabled) {
    main.style.transform = "unset";
    main.style.transition = "unset";
  }

  let artworkSize = 0;
  if (isPrefEnabled("display-artwork")) {
    let centerRect = "content-center".select().getBoundingClientRect();
    let centerTop = centerRect.top;
    let centerBottom = centerRect.bottom;

    let topRect = "content-top".select().getBoundingClientRect();
    let bottomRect = "content-bottom".select().getBoundingClientRect();
    let topEnabled = isPrefEnabled("enable-top-content");
    let contentTop = topEnabled ? topRect.top : centerRect.top;
    let bottomEnabled = isPrefEnabled("enable-bottom-content");
    let contentBottom = bottomEnabled ? bottomRect.bottom : centerRect.bottom;

    let swapTopBottom = isPrefEnabled("swap-top-bottom");
    if (swapTopBottom) {
      contentTop = bottomEnabled ? bottomRect.top : centerRect.top;
      contentBottom = topEnabled ? topRect.bottom : centerRect.bottom;
    }

    artworkSize = centerBottom - centerTop;

    let expandTop = !topEnabled || isPrefEnabled("artwork-expand-top");
    let expandBottom = !bottomEnabled || isPrefEnabled("artwork-expand-bottom");
    if (swapTopBottom) {
      [expandTop, expandBottom] = [expandBottom, expandTop];
    }
    if (expandTop && expandBottom) {
      artworkSize = contentBottom - contentTop;
    } else if (expandTop) {
      artworkSize = centerBottom - contentTop;
    } else if (expandBottom) {
      artworkSize = contentBottom - centerTop;
    }

    artworkSize = Math.min(centerRect.width, artworkSize);

    let topMargin = expandTop ? contentTop : centerTop;
    artwork.style.marginTop = topMargin + "px";

    setClass(artwork, "double-margins", !expandTop && !expandBottom && isPrefEnabled("center-lr-margins"));
  }

  main.style.setProperty("--artwork-size", artworkSize + "px");

  if (settingsEnabled) {
    main.style.removeProperty("transform");
    main.style.removeProperty("transition");
    finishAnimations(main);
  }
}

function loadBackground(newImage, colors) {
  return new Promise((resolve) => {
    let backgroundCanvasImg = "background-canvas-img".select();
    backgroundCanvasImg.onload = () => {
      let rgbOverlay = colors.secondary;
      let averageBrightness = colors.averageBrightness;
      let backgroundCanvasOverlay = "background-canvas-overlay".select();
      let grainOverlay = "grain".select();

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
    let prerenderCanvas = "prerender-canvas".select();
    setClass(prerenderCanvas, "show", true);

    domtoimage
      .toCanvas(prerenderCanvas, {
        width: window.innerWidth,
        height: window.innerHeight
      })
      .then(canvas => {
        setClass(prerenderCanvas, "show", false);
        resolve(canvas);
      })
  });
}

let refreshBackgroundRenderInProgress = false;
function refreshBackgroundRender() {
  if (!refreshBackgroundRenderInProgress) {
    refreshBackgroundRenderInProgress = true;
    unsetNextImagePrerender()
      .then(() => {
        let imageUrl = currentData.currentlyPlaying.imageData.imageUrl;
        let imageColors = currentData.currentlyPlaying.imageData.imageColors;
        if (imageUrl === BLANK) {
          imageUrl = DEFAULT_IMAGE;
          imageColors = DEFAULT_IMAGE_COLORS;
        }
        if (imageUrl && imageColors) {
          setArtworkAndPrerender(imageUrl, imageColors)
            .then(pngData => setRenderedBackground(pngData));
        }
      })
      .finally(() => {
        refreshBackgroundRenderInProgress = false;
      });
  }
}

function unsetNextImagePrerender() {
  return new Promise((resolve) => {
    nextImagePrerenderCanvasData = {
      imageUrl: null,
      pngData: null
    };
    resolve();
  });
}

function setTextColor(rgbText) {
  document.documentElement.style.setProperty("--color", `rgb(${rgbText.r}, ${rgbText.g}, ${rgbText.b})`);
}


///////////////////////////////
// PROGRESS
///////////////////////////////

let smoothProgressBarPref;
window.addEventListener('load', () => smoothProgressBarPref = findPreference("smooth-progress-bar"));

function refreshProgress() {
  updateProgress(currentData);
}

function updateProgress(changes) {
  let current = getChange(changes, "currentlyPlaying.timeCurrent").value;
  let total = getChange(changes, "currentlyPlaying.timeTotal").value;
  let paused = getChange(changes, "playbackContext.paused").value;

  // Text
  let formattedTimes = formatTime(current, total);
  let formattedCurrentTime = formattedTimes.current;
  let formattedTotalTime = formattedTimes.total;

  let elemTimeCurrent = "time-current".select();
  let timeCurrentUpdated = formattedCurrentTime !== elemTimeCurrent.innerHTML;
  if (timeCurrentUpdated) {
    elemTimeCurrent.innerHTML = formattedCurrentTime;
  }

  let elemTimeTotal = "time-total".select();
  let timeTotalUpdated = formattedTotalTime !== elemTimeTotal.innerHTML;
  if (timeTotalUpdated) {
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

  // Update Progress Bar
  if (smoothProgressBarPref.state || timeCurrentUpdated || timeTotalUpdated) {
    setProgressBarTarget(current, total, paused);
  }
}

const progressBarElem = getById("progress-current");
function setProgressBarTarget(current, total) {
  let percent = (current / (total || 1)) * 100;
  progressBarElem.style.setProperty("--progress-percent", percent + "%");
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
    if (seconds > 0) {
      return `${minutes} min ${seconds} sec`;
    }
    return `${minutes} min`;
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

const ADVANCE_CURRENT_TIME_MS = 1000 / 60;
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

let autoTimer;
let idleTimeout;

function refreshTimers() {
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
  let timeCurrent = currentData.currentlyPlaying.timeCurrent;
  let timeTotal = currentData.currentlyPlaying.timeTotal;
  if (timeCurrent != null && timeTotal != null && !currentData.playbackContext.paused) {
    let now = Date.now();
    let elapsedTime = now - startTime;
    startTime = now;
    let newTime = timeCurrent + elapsedTime;
    currentData.currentlyPlaying.timeCurrent = Math.min(timeTotal, newTime);
    refreshProgress();
  }
}

function setIdleModeState(state) {
  if (state) {
    if (!idle) {
      console.info("No music was played in 2 hours. Enabling idle mode...");
      idle = true;
      clearTimers();
      setClass(document.body, "hide", true);
    }
  } else {
    if (idle) {
      idle = false;
      reloadPage();
    }
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    advanceCurrentTime();
  }
});


///////////////////////////////
// VISUAL PREFERENCES
///////////////////////////////

const PREFERENCES = [
  {
    id: "playback-control",
    name: "Enable Playback Controls",
    description: "If enabled, the interface can be used to directly control some basic playback functions of Spotify: " +
        "play, pause, next track, previous track, shuffle, repeat. Otherwise, the icons are purely cosmetic",
    category: "General",
    css: {"main": "playback-control"},
    callback: (state) => {
      let infoSymbolsContainer = "info-symbols".select();
      let shuffleButton = "shuffle".select();
      let repeatButton = "repeat".select();
      if (state) {
        infoSymbolsContainer.insertBefore(shuffleButton, infoSymbolsContainer.firstChild);
      } else {
        infoSymbolsContainer.insertBefore(shuffleButton, repeatButton);
      }
    }
  },
  {
    id: "transitions",
    name: "Smooth Transitions",
    description: "Smoothly fade from one track to another. Otherwise, track switches will be displayed instantaneously. " +
        "Disabling this will save on a lot of CPU resources",
    category: "General",
    css: {
      "main": "transitions"
    }
  },
  {
    id: "colored-text",
    name: "Colored Text",
    description: "If enabled, the dominant color of the current artwork will be used as the color for all texts and some symbols. Otherwise, plain white will be used",
    category: "General",
    css: {"main": "!no-colored-text"}
  },
  {
    id: "show-queue",
    name: "Enable Track List",
    description: "If enabled, show the queue/tracklist for playlists and albums. Otherwise, only the current track is displayed",
    category: "Track List",
    requiredFor: ["scrollable-track-list", "album-view", "hide-title-album-view", "show-timestamps-track-list", "xl-tracklist", "xl-main-info-scrolling"],
    css: {
      "title": "!force-display",
      "track-list": "!hide"
    },
    callback: () => refreshTrackList()
  },
  {
    id: "scrollable-track-list",
    name: "Scrollable Track List",
    description: "If enabled, the track list can be scrolled through with the mouse wheel. Otherwise it can only scroll on its own",
    category: "Track List",
    css: {"track-list": "scrollable"}
  },
  {
    id: "full-track-list",
    name: "Show Full Titles",
    description: "If enabled, longer titles will always be displayed fully (line breaks). " +
        "Otherwise, the line count will be limited to 1 and overflowing text will be cut off with ...",
    category: "Track List",
    css: {"track-list": "no-clamp"}
  },
  {
    id: "show-timestamps-track-list",
    name: "Show Time Stamps",
    description: "Show the timestamps for each track in the track list. If disabled, the track names are right-aligned",
    category: "Track List",
    css: {"track-list": "show-timestamps"}
  },
  {
    id: "album-view",
    name: "Enable Album View",
    description: "If enabled, while playing an album with shuffle DISABLED, the track list is replaced by an alternate design that displays the surrounding tracks in an automatically scrolling list. " +
        "(Only works for 200 tracks or fewer, for performance reasons)",
    category: "Track List",
    requiredFor: ["hide-title-album-view", "xl-main-info-scrolling"],
    callback: () => refreshTrackList()
  },
  {
    id: "hide-title-album-view",
    name: "Album View: Hide Duplicate Track Name",
    description: "If 'Album View' is enabled, the current track's name will not be displayed in the main content container " +
        "(since it's already visible in the track list)",
    category: "Track List",
    requiredFor: ["xl-main-info-scrolling"],
    css: {"center-info-main": "hide-title-in-album-view"}
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
    id: "bg-enable",
    name: "Enable Background",
    description: "Enable the background. Otherwise, plain black will be displayed at all times",
    category: "Background",
    requiredFor: ["bg-artwork", "bg-tint", "bg-gradient", "bg-grain"],
    css: {"background-canvas": "!hide"}
  },
  {
    id: "bg-artwork",
    name: "Background Artwork",
    description: "If enabled, uses the release artwork for the background as a blurry, darkened version",
    category: "Background",
    css: {"background-canvas": "!color-only"}
  },
  {
    id: "bg-tint",
    name: "Background Overlay Color",
    description: "Add a subtle layer of one of the artwork's most dominant colors to the background. This helps to increase the contrast for very dark artworks",
    category: "Background",
    css: {"background-canvas-overlay": "!no-tint"}
  },
  {
    id: "bg-gradient",
    name: "Background Gradient",
    description: "Add a subtle gradient to the background that gets steadily darker towards the bottom",
    category: "Background",
    css: {"background-canvas-overlay": "!no-gradient"}
  },
  {
    id: "bg-grain",
    name: "Background Dithering",
    description: "Adds a subtle layer of film grain to the background to increase contrast and prevent color banding for dark images",
    category: "Background",
    css: {"grain": "show"}
  },
  {
    id: "display-artwork",
    name: "Enable Artwork",
    description: "Whether to display the artwork of the current track or not. If disabled, the layout will be centered",
    category: "Main Content",
    requiredFor: ["artwork-shadow", "artwork-expand-top", "artwork-expand-bottom", "artwork-right"],
    css: {
      "artwork": "!hide",
      "content": "!full-content"
    }
  },
  {
    id: "artwork-shadow",
    name: "Artwork Shadow",
    description: "Show a subtle shadow underneath the artwork",
    category: "Main Content",
    css: {"artwork": "shadow"}
  },
  {
    id: "enable-center-content",
    name: "Enable Main Content",
    description: "Enable the main content, the container for the current track data and the track list",
    category: "Main Content",
    requiredFor: ["show-queue", "show-artists", "show-titles", "strip-titles", "xl-text", "show-release", "show-podcast-descriptions",
      "main-content-centered", "split-main-panels", "reduced-center-margins"],
    css: {
      "content-center": "!hide",
      "artwork": "!center-disabled"
    }
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
    category: "General",
    css: {"content-center": "!no-feat"}
  },
  {
    id: "show-titles",
    name: "Show Titles",
    description: "Show the title of the currently playing track",
    category: "Main Content",
    requiredFor: ["hide-title-album-view"],
    css: {"title": "!hide"}
  },
  {
    id: "strip-titles",
    name: "Strip Titles",
    description: "Hides any kind of potentially unnecessary extra information from track tiles and release names " +
        `(such as 'Remastered Version', 'Anniversary Edition', '${new Date().getFullYear()} Re-Issue', etc.)`,
    category: "General",
    css: {
      "title-extra": "hide",
      "album-title-extra": "hide",
      "track-list": "strip"
    }
  },
  {
    id: "show-release",
    name: "Show Release Name/Date",
    description: "Displays the release name with its release date (usually the year of the currently playing track's album)",
    category: "Main Content",
    requiredFor: ["separate-release-line", "full-release-date"],
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
    id: "full-release-date",
    name: "Full Release Date",
    description: "If enabled, the whole release date is shown (including month and day). Otherwise, only the year is shown. " +
        "Note that some releases on Spotify only have the year (usually older releases)",
    category: "Main Content",
    requiredFor: ["full-release-date-podcasts"],
    css: {"album-release": "full"}
  },
  {
    id: "full-release-date-podcasts",
    name: "Full Release Date only for Podcasts",
    description: "Limit full release dates only for podcasts. Normal songs will continue to only display the year",
    category: "Main Content",
    css: {"album-release": "podcasts-only"}
  },
  {
    id: "show-podcast-descriptions",
    name: "Show Podcast Descriptions",
    description: "While listening to a podcast episode, displays the description of that episode underneath the title",
    category: "Main Content",
    css: {"description": "!hide"}
  },
  {
    id: "xl-text",
    name: "XL Main Content",
    description: "If enabled, the font size for the current track's title, artist, and release is doubled. " +
        "This setting is intended to be used with disabled artwork, as there isn't a lot of space available otherwise",
    category: "Main Content",
    requiredFor: ["xl-main-info-scrolling"],
    css: {"center-info-main": "big-text"}
  },
  {
    id: "xl-main-info-scrolling",
    name: "Conditional XL Main Content",
    description: "Limit 'XL Main Content' to only kick into effect when the title is hidden by 'Album View: Hide Duplicate Track Name'",
    category: "Main Content",
    css: {"center-info-main": "big-text-scrolling"}
  },
  {
    id: "enable-top-content",
    name: "Enable Top Content",
    description: "Enable the top content, the container for the context and the Spotify logo. " +
        "Disabling this will increase the available space for the main content",
    category: "Top Content",
    requiredFor: ["show-context", "show-logo", "swap-top", "artwork-expand-top"],
    css: {
      "content-top": "!hide",
      "artwork": "!top-disabled"
    }
  },
  {
    id: "show-context",
    name: "Show Context",
    description: "Displays the playlist/artist/album name along with some additional information at the top of the page",
    category: "Top Content",
    requiredFor: ["show-context-thumbnail", "show-context-summary"],
    css: {"meta-left": "!hide"}
  },
  {
    id: "show-context-summary",
    name: "Context Summary",
    description: "Show a small summary of the current context (total track count and total time). " +
        "Do note that total time cannot be displayed for playlists above 200 tracks for performance reasons",
    category: "Top Content",
    css: {"context-extra": "!hide"}
  },
  {
    id: "show-context-thumbnail",
    name: "Context Image",
    description: "Display a small image (thumbnail) of the current context. " +
        "For playlists, it's the playlist image and for anything else it's the first artist",
    category: "Top Content",
    requiredFor: ["colored-symbol-context"],
    css: {"thumbnail-wrapper": "!hide"}
  },
  {
    id: "colored-symbol-context",
    name: "Colored Context Image",
    description: "If enabled, the dominant color of the current artwork will be used as the color for the context image",
    category: "Top Content",
    css: {"thumbnail-wrapper": "colored"}
  },
  {
    id: "show-logo",
    name: "Spotify Logo",
    description: "Whether to display the Spotify logo in the top right",
    category: "Top Content",
    requiredFor: ["colored-symbol-spotify"],
    css: {"meta-right": "!hide"}
  },
  {
    id: "colored-symbol-spotify",
    name: "Colored Spotify Logo",
    description: "If enabled, the dominant color of the current artwork will be used as the color for the Spotify logo",
    category: "Top Content",
    css: {"logo": "colored"}
  },
  {
    id: "fake-song-transition",
    name: "Guess Next Track",
    description: "If enabled, simulate the transition to the expected next track in the queue. Otherwise, wait for the actual data to arrive. " +
        "Enabling this will make the transitions feel much smoother, but it may be inconsistent at times",
    category: "General",
    callback: (state) => {
      if (!state) {
        clearTimeout(fakeSongTransition);
      }
    }
  },
  {
    id: "enable-bottom-content",
    name: "Enable Bottom Content",
    description: "Enable the bottom content, the container for the progress bar and various meta information. " +
        "Disabling this will increase the available space for the main content",
    category: "Bottom Content",
    requiredFor: ["show-progress-bar", "show-timestamps", "show-info-icons", "show-volume", "show-device", "reverse-bottom", "show-clock", "artwork-expand-bottom"],
    css: {
      "content-bottom": "!hide",
      "artwork": "!bottom-disabled"
    }
  },
  {
    id: "show-progress-bar",
    name: "Progress Bar",
    description: "Displays a progress bar, indicating how far along the currently played track is",
    category: "Bottom Content",
    requiredFor: ["smooth-progress-bar"],
    css: {"progress": "!hide"}
  },
  {
    id: "smooth-progress-bar",
    name: "Smooth Progress Bar",
    description: "If enabled, the progress bar will get updated at 60 FPS, rather than only once per second. " +
        "This setting is not recommended for low-power hardware, like a Raspberry Pi",
    category: "Bottom Content",
    callback: () => refreshProgress()
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
    }
  },
  {
    id: "spread-timestamps",
    name: "Spread-out Timestamps",
    description: "When enabled, the current timestamp is separated from the total timestamp and displayed on the left",
    category: "Bottom Content",
    css: {"bottom-meta-container": "spread-timestamps"},
    callback: (state) => {
      let timeCurrent = "time-current".select();
      let bottomLeft = "bottom-left".select();
      let bottomRight = "bottom-right".select();
      if (state) {
        bottomLeft.insertBefore(timeCurrent, bottomLeft.firstChild);
      } else {
        bottomRight.insertBefore(timeCurrent, bottomRight.firstChild);
      }
    }
  },
  {
    id: "show-info-icons",
    name: "Show Play/Pause/Shuffle/Repeat Icons",
    description: "Display the state icons for play/pause as well as shuffle and repeat in the bottom left. " +
        "This setting is required for the playback controls to work",
    category: "Bottom Content",
    requiredFor: ["playback-control"],
    css: {"info-symbols": "!hide"}
  },
  {
    id: "center-info-icons",
    name: "Center Icons",
    description: "If enabled, the play/pause/shuffle/repeat icons are centered in the bottom content (like it's the case on the default Spotify player). " +
        "Enabling this will disable the clock",
    category: "Bottom Content",
    overrides: ["show-clock"],
    css: {"bottom-meta-container": "centered-controls"},
    callback: (state) => {
      let infoSymbols = "info-symbols".select();
      let bottomLeft = "bottom-left".select();
      let bottomMetaContainer = "bottom-meta-container".select();
      let clockWrapper = "clock-wrapper".select();
      let volume = "volume".select();
      if (state) {
        bottomMetaContainer.insertBefore(infoSymbols, clockWrapper);
      } else {
        bottomLeft.insertBefore(infoSymbols, volume);
      }
    }
  },
  {
    id: "show-volume",
    name: "Show Volume",
    description: "Display the current volume in the bottom left",
    category: "Bottom Content",
    requiredFor: ["show-volume-bar"],
    css: {"volume": "!hide"}
  },
  {
    id: "show-volume-bar",
    name: "Show Volume Bar",
    description: "Show an additional bar underneath the volume",
    category: "Bottom Content",
    css: {"volume-bar": "!hide"}
  },
  {
    id: "show-device",
    name: "Show Device Name",
    description: "Display the name of the current playback device in the bottom left",
    category: "Bottom Content",
    css: {"device": "!hide"}
  },
  {
    id: "show-clock",
    name: "Show Clock",
    description: "Displays a clock at the bottom center of the page",
    category: "Bottom Content",
    requiredFor: ["clock-full"],
    css: {"clock-wrapper": "!hide"}
  },
  {
    id: "clock-full",
    name: "Show Full Date in Clock",
    description: "If enabled, the clock displays the full date, weekday, and current time. Otherwise, only displays the current time",
    category: "Bottom Content"
  },
  {
    id: "dark-mode",
    name: "Dark Mode",
    description: "Darkens the entire screen by 50%",
    category: "General",
    css: {"dark-overlay": "show"}
  },
  {
    id: "artwork-expand-top",
    name: "Expand Artwork to Top",
    description: "If enabled, expand the artwork to the top content and push that content to the side",
    category: "Layout: Main Content",
    css: {"main": "artwork-expand-top"}
  },
  {
    id: "artwork-expand-bottom",
    name: "Expand Artwork to Bottom",
    description: "If enabled, expand the artwork to the bottom content and push that content to the side",
    category: "Layout: Main Content",
    css: {"main": "artwork-expand-bottom"}
  },
  {
    id: "main-content-centered",
    name: "Center-Align",
    description: "Center the main content (current track information and track list). Otherwise, the text will be aligned to the border",
    category: "Layout: Main Content",
    css: {"content-center": "centered"}
  },
  {
    id: "split-main-panels",
    name: "Split Mode",
    description: "Separate the main content from the track list and display both in their own panel. "
      + "This setting is intended to be used with disabled artwork, as there isn't a lot of space available otherwise",
    category: "Layout: Main Content",
    css: {"content-center": "split-main-panels"}
  },
  {
    id: "center-lr-margins",
    name: "Left/Right Margins",
    description: "This adds margins to the left and right of the main content. " +
        "This setting has minimum effect if Split Main Content isn't enabled",
    category: "Layout: Main Content",
    css: {"content-center": "extra-margins"}
  },
  {
    id: "reduced-center-margins",
    name: "Reduced Top/Bottom Margins",
    description: "Halves the top/bottom margins of the center container",
    category: "Layout: Main Content",
    css: {"content": "decreased-margins"}
  },
  {
    id: "artwork-right",
    name: "Swap Main Content",
    description: "If enabled, the main content swaps positions with the artwork",
    category: "Layout: Swap",
    css: {
      "main": "artwork-right"
    }
  },
  {
    id: "swap-top",
    name: "Swap Top Content",
    description: "If enabled, the Context and Spotify Logo swap positions",
    category: "Layout: Swap",
    css: {"content-top": "swap"}
  },
  {
    id: "reverse-bottom",
    name: "Swap Bottom Content",
    description: "If enabled, the progress bar and the timestamps/playback state info swap positions",
    category: "Layout: Swap",
    css: {"content-bottom": "reverse"}
  },
  {
    id: "swap-top-bottom",
    name: "Swap Top with Bottom Content",
    description: "If enabled, the top content swaps position with the bottom content",
    category: "Layout: Swap",
    css: {"content": "swap-top-bottom"}
  },
  {
    id: "artwork-above-content",
    name: "Artwork Above Track Info",
    description: "If enabled, the artwork is played above the track info, rather than next to it. " +
        "This mode is intended for portrait mode (it will break everything in landscape mode)",
    category: "Layout: Misc",
    css: {"main": "artwork-above-content"}
  },
  {
    id: "decreased-margins",
    name: "Decreased Margins",
    description: "If enabled, all margins are halved. " +
        "This allows for more content to be displayed on screen, but will make everything look slightly crammed",
    category: "Layout: Misc",
    css: {"main": "decreased-margins"},
  },
  {
    id: "show-fps",
    name: "FPS Counter",
    description: "Display the frames-per-second in the top right of the screen (intended for performance debugging)",
    category: "Developer Tools",
    css: {"fps-counter": "show"},
    callback: () => fpsTick()
  },
  {
    id: "prerender-background",
    name: "Prerender Background",
    description: "[Keep this option enabled if you're unsure what it does!]",
    category: "Developer Tools",
    css: {
      "background-rendered": "!hide",
      "prerender-canvas": "!no-prerender"
    }
  }
];

const PREFERENCES_CATEGORY_ORDER = [
  "General",
  "Main Content",
  "Top Content",
  "Bottom Content",
  "Track List",
  "Layout: Main Content",
  "Layout: Swap",
  "Layout: Misc",
  "Background",
  "Developer Tools"
];

const PREFERENCES_DEFAULT = {
  enabled: [
    "enable-center-content",
    "show-queue",
    "album-view",
    "hide-title-album-view",
    "show-timestamps-track-list",
    "show-podcast-descriptions",
    "display-artwork",
    "artwork-shadow",
    "artwork-expand-top",
    "bg-enable",
    "bg-artwork",
    "bg-tint",
    "bg-gradient",
    "bg-grain",
    "show-artists",
    "show-featured-artists",
    "show-titles",
    "colored-text",
    "colored-symbol-spotify",
    "show-release",
    "enable-top-content",
    "enable-bottom-content",
    "main-content-centered",
    "show-context",
    "show-context-summary",
    "show-context-thumbnail",
    "show-logo",
    "transitions",
    "strip-titles",
    "show-timestamps",
    "show-info-icons",
    "show-volume",
    "show-volume-bar",
    "show-device",
    "show-progress-bar",
    "smooth-progress-bar",
    "show-clock",
    "clock-full",
    "prerender-background",
    "fake-song-transition"
  ],
  disabled: [
    "swap-top-bottom",
    "decreased-margins",
    "xl-text",
    "separate-release-line",
    "full-release-date",
    "full-release-date-podcasts",
    "split-main-panels",
    "center-lr-margins",
    "reduced-center-margins",
    "xl-main-info-scrolling",
    "xl-tracklist",
    "swap-top",
    "colored-symbol-context",
    "spread-timestamps",
    "reverse-bottom",
    "artwork-expand-bottom",
    "artwork-right",
    "artwork-above-content",
    "full-track-list"
  ],
  ignore: [
    "playback-control",
    "center-info-icons",
    "scrollable-track-list",
    "dark-mode",
    "show-fps"
  ]
}

const PREFERENCES_PRESETS = [
  {
    id: "preset-default",
    name: "Default Mode (Reset)",
    category: "Presets",
    description: "The default mode. A balanced design that aims to present as much information as possible about the current track (along with its artwork) without compromising on visual appeal. " +
        "Clicking this behaves like a reset button for all settings",
    enabled: [],
    disabled: []
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
    id: "preset-xl-artwork",
    name: "XL-Artwork Mode",
    category: "Presets",
    description: "The artwork is stretched to its maximum possible size. Apart from that, only the current track, the track list, and the progress bar are displayed",
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
    id: "preset-tracklist",
    name: "Track-List Mode",
    category: "Presets",
    description: "Disables the artwork and instead only dimly displays it in the background. " +
        "Doing this opens up more room for the track list, which becomes centered. Also disables some lesser useful information",
    enabled: [
      "xl-main-info-scrolling",
      "spread-timestamps",
      "reverse-bottom"
    ],
    disabled: [
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
    id: "preset-split-text",
    name: "Split-Panel Mode",
    category: "Presets",
    description: "A combination of the default preset and Track-List Mode that puts the current track information on the left and the track list on the right. " +
        "Disables the artwork and instead only dimly displays it in the background",
    enabled: [
      "swap-top",
      "xl-text",
      "xl-main-info-scrolling",
      "center-lr-margins",
      "reduced-center-margins",
      "reverse-bottom",
      "split-main-panels",
      "separate-release-line",
      "full-release-date",
      "full-release-date-podcasts"
    ],
    disabled: [
      "show-featured-artists",
      "main-content-centered",
      "bg-tint",
      "display-artwork"
    ]
  },
  {
    id: "preset-big-current-song",
    name: "Big Current-Track Mode",
    category: "Presets",
    description: "Only shows the current track's title, artist, and release in an extra large manner. The track list is disabled, the artwork is moved to the background",
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
      "album-view",
      "show-device",
      "show-volume",
      "show-volume-bar",
      "show-podcast-descriptions",
      "show-info-icons",
      "hide-title-album-view",
      "show-queue",
      "display-artwork",
      "show-timestamps-track-list"
    ]
  },
  {
    id: "preset-minimalistic",
    name: "Minimalistic Mode",
    category: "Presets",
    description: "A minimalistic design preset only containing the most relevant information about the currently playing track. The background only displays a plain color. Inspired by the original Spotify fullscreen interface for Chromecast",
    enabled: [
      "spread-timestamps",
      "reverse-bottom",
      "reduced-center-margins"
    ],
    disabled: [
      "artwork-expand-top",
      "main-content-centered",
      "show-clock",
      "clock-full",
      "show-featured-artists",
      "album-view",
      "bg-artwork",
      "bg-gradient",
      "bg-grain",
      "show-device",
      "show-volume",
      "show-volume-bar",
      "show-podcast-descriptions",
      "show-release",
      "show-info-icons",
      "hide-title-album-view",
      "show-queue",
      "colored-text",
      "colored-symbol-spotify",
      "show-timestamps",
      "show-timestamps-track-list"
    ]
  },
  {
    id: "preset-artwork-only",
    name: "Artwork-Only Mode",
    category: "Presets",
    description: "Just displays the artwork on a background, literally nothing else",
    enabled: [
      "decreased-margins",
      "display-artwork",
      "artwork-expand-bottom"
    ],
    disabled: [
      "enable-center-content",
      "show-queue",
      "album-view",
      "hide-title-album-view",
      "show-timestamps-track-list",
      "show-podcast-descriptions",
      "show-artists",
      "show-featured-artists",
      "show-titles",
      "colored-text",
      "colored-symbol-spotify",
      "show-release",
      "enable-top-content",
      "enable-bottom-content",
      "show-context",
      "show-context-summary",
      "show-context-thumbnail",
      "show-logo",
      "strip-titles",
      "show-timestamps",
      "show-info-icons",
      "show-volume",
      "show-volume-bar",
      "show-device",
      "show-progress-bar",
      "smooth-progress-bar",
      "show-clock"
    ]
  }
];

function findPreference(id) {
  return PREFERENCES.find(pref => pref.id === id);
}

function findPreset(id) {
  return PREFERENCES_PRESETS.find(preset => preset.id === id);
}

function isPrefEnabled(id) {
  let pref = findPreference(id);
  return pref.state; // needs to be new line so the IDE doesn't complain about "state" not existing for some reason
}

window.addEventListener('load', initVisualPreferences);

function initVisualPreferences() {
  const settingsWrapper = "settings-categories".select();

  // Integrity check
  if (DEV_MODE) {
    let allDefaultSettings = [PREFERENCES_DEFAULT.enabled, PREFERENCES_DEFAULT.disabled, PREFERENCES_DEFAULT.ignore].flat();
    if (allDefaultSettings.length > [...new Set(allDefaultSettings)].length) {
      console.warn("Default settings contain duplicates!");
    }
    let unclassifiedSettings = PREFERENCES
        .map(pref => pref.id)
        .filter(prefId => !allDefaultSettings.includes(prefId));
    if (unclassifiedSettings.length > 0) {
      console.warn("The following settings don't have any defaults specified: " + unclassifiedSettings);
    }
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
  }

  // Hide developer tools when not in dev mode
  if (!DEV_MODE) {
    settingsWrapper.lastElementChild.remove();
  }

  // Create preset buttons
  const settingsPresetsWrapper = "settings-presets".select();
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
  }

  if (isLocalStorageAvailable()) {
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

  submitVisualPreferencesToBackend();
}

const FILTERED_AND_ORDERED_PREFS = [...PREFERENCES_PRESETS, ...PREFERENCES]
  .sort((a, b) => PREFERENCES_CATEGORY_ORDER.indexOf(a.category) - PREFERENCES_CATEGORY_ORDER.indexOf(b.category))
  .filter(pref => DEV_MODE || pref.category !== "Developer Tools");

function submitVisualPreferencesToBackend() {
  let simplifiedPrefs = FILTERED_AND_ORDERED_PREFS.map(pref => {
    return {
      id: pref.id,
      name: pref.name,
      category: pref.category,
      description: pref.description,
      state: pref.state
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

const LOCAL_STORAGE_KEY_SETTINGS = "visual_preferences";
const LOCAL_STORAGE_SETTINGS_SPLIT_CHAR = "+";
function getVisualPreferencesFromLocalStorage() {
  let storedVisualPreferences = localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS);
  return storedVisualPreferences?.split(LOCAL_STORAGE_SETTINGS_SPLIT_CHAR);
}

function refreshPrefsLocalStorage() {
  if (isLocalStorageAvailable()) {
    let enabledPreferences = PREFERENCES
      .filter(pref => pref.state)
      .map(pref => pref.id)
      .join(LOCAL_STORAGE_SETTINGS_SPLIT_CHAR);
    localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, enabledPreferences);
  }
}

let localStorageAvailable = null;
function isLocalStorageAvailable() {
  if (localStorageAvailable === null) {
    let test = "localStorageAvailabilityTest";
    try {
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      localStorageAvailable = true;
    } catch (e) {
      localStorageAvailable = false;
    }
  }
  return localStorageAvailable;
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

let refreshContentTimeout;

function isRenderingPreferenceChange() {
  return !!refreshContentTimeout;
}

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
      setClass(id.select(), targetClass, targetState)
    }
  }

  // Refresh Background and Tracklist, but only do it once per preset application
  clearTimeout(refreshContentTimeout);
  refreshContentTimeout = setTimeout(() => {
    refreshAll();
    refreshContentTimeout = null;
  }, transitionFromCss);

  // Update the settings that are invalidated
  updateOverridden(preference);

  // Toggle Checkmark
  let prefElem = preference.id.select();
  if (prefElem) {
    setClass(prefElem, "on", state);
  }
}

function updateOverridden(preference) {
  let prefElem = preference.id.select();
  if (prefElem) {
    let state = preference.state && !prefElem.classList.toString().includes("overridden-");
    if ('requiredFor' in preference) {
      preference.requiredFor.forEach(override => {
        setClass(override.select(), `overridden-${preference.id}`, !state);
        updateOverridden(findPreference(override));
      });
    }
    if ('overrides' in preference) {
      preference.overrides.forEach(override => {
        setClass(override.select(), `overridden-${preference.id}`, state);
        updateOverridden(findPreference(override));
      });
    }
  }
}

let activePreset = PREFERENCES_PRESETS[0]; // used for thumbnail generation
function applyPreset(preset) {
  activePreset = preset;

  [PREFERENCES_DEFAULT.enabled, preset.enabled].flat()
    .filter(prefId => !preset.disabled.includes(prefId))
    .forEach(prefId => setVisualPreferenceFromId(prefId, true));

  [PREFERENCES_DEFAULT.disabled, preset.disabled].flat()
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
            let preset = findPreset(setting);
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
        reloadPage();
      }
    }
    resolve();
  });
}

function reloadPage() {
  window.location.reload(true);
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

const OPACITY_TIMEOUT = 2 * 1000;
let volumeTimeout;
function handleVolumeChange(volume, device, customVolumeSettings) {
  let volumeContainer = "volume".select();
  let volumeTextContainer = "volume-text".select();

  let volumeWithPercent = volume + "%";

  let customVolumeSetting = customVolumeSettings.find(setting => setting.device === device);
  if (customVolumeSetting) {
    let baseDb = customVolumeSetting.baseDb;
    let db = (volume - baseDb).toFixed(1).replace("-", "&#x2212;");
    volumeTextContainer.innerHTML = db + " dB";
  } else {
    volumeTextContainer.innerHTML = volumeWithPercent;
  }
  volumeContainer.style.setProperty("--volume", volumeWithPercent);

  volumeContainer.classList.add("active");
  clearTimeout(volumeTimeout);
  volumeTimeout = setTimeout(() => {
    volumeContainer.classList.remove("active");
  }, OPACITY_TIMEOUT);
}

let deviceTimeout;
function handleDeviceChange(device) {
  let deviceContainer = "device".select();
  deviceContainer.innerHTML = device;

  deviceContainer.classList.add("active");
  clearTimeout(deviceTimeout);
  deviceTimeout = setTimeout(() => {
    deviceContainer.classList.remove("active");
  }, OPACITY_TIMEOUT);
}

function refreshAll() {
  refreshTextBalance();
  refreshBackgroundRender(true);
  refreshProgress();
  updateScrollGradients();
  submitVisualPreferencesToBackend();
}

///////////////////////////////
// REFRESH IMAGE ON RESIZE
///////////////////////////////

let mobileView = null;
function isPortraitMode(refresh = false) {
  if (refresh || mobileView === null) {
    mobileView = window.matchMedia("screen and (max-aspect-ratio: 3/2)").matches;
  }
  return mobileView;
}

let wasPreviouslyInPortraitMode = false;
let refreshBackgroundEvent;

function portraitModePresetSwitchPrompt() {
  let portraitMode = isPortraitMode(true);
  if (!wasPreviouslyInPortraitMode && portraitMode) {
    if (confirm("It seems like you're using the app in portrait mode. Would you like to switch to the design optimized for vertical aspect ratios?")) {
      // TODO enable vertical mode and also somehow prevent this message from getting spammed on page refresh
      alert("enabled")
    }
  }
  wasPreviouslyInPortraitMode = portraitMode;
}

window.onresize = () => {
  clearTimeout(refreshBackgroundEvent);
  refreshBackgroundEvent = setTimeout(() => {
    portraitModePresetSwitchPrompt();
    refreshAll();
  }, transitionFromCss);
};

///////////////////////////////
// PLAYBACK CONTROLS
///////////////////////////////

window.addEventListener('load', initPlaybackControls);
function initPlaybackControls() {
  "play-pause".select().onclick = () => fireControl("PLAY_PAUSE");
  "shuffle".select().onclick = () => fireControl("SHUFFLE");
  "repeat".select().onclick = () => fireControl("REPEAT");
  "prev".select().onclick = () => fireControl("PREV");
  "next".select().onclick = () => fireControl("NEXT");
  "volume".select().onclick = () => {
    let newVolume = prompt("Enter new volume in % (0-100):");
    if (newVolume !== null) {
      if (newVolume >= 0 && newVolume <= 100) {
        fireControl("VOLUME", newVolume);
      } else {
        alert("Invalid volume (must be a number between 0-100)")
      }
    }
  };
}

const CONTROL_RESPONSE_DELAY = 100;
let playbackControlPref = findPreference("playback-control");
let waitingForResponse = false;
function fireControl(control, param) {
  if (!waitingForResponse && playbackControlPref.state) {
    waitingForResponse = true;
    setClass("main".select(), "waiting-for-control", true);
    fetch(`/modify-playback/${control}${param ? `?param=${param}` : ""}`, {method: 'POST'})
      .then(response => {
        if (response.status >= 200 && response.status < 300) {
          setTimeout(() => {
            singleRequest().then();
          }, CONTROL_RESPONSE_DELAY);
        }
        if (response.status >= 400) {
          console.warn("Failed to transmit control");
          unlockPlaybackControls();
        }
      });
  }
}

function unlockPlaybackControls() {
  if (waitingForResponse) {
    waitingForResponse = false;
    setClass("main".select(), "waiting-for-control", false);
  }
}


///////////////////////////////
// HOTKEYS
///////////////////////////////

document.onkeydown = (e) => {
  switch (e.key) {
    case ' ':
      toggleSettingsMenu();
      break;
    case 'Control':
      if (settingsVisible) {
        toggleSettingsExpertMode();
      }
      break;
    case 'f':
      toggleFullscreen();
      break;
  }
};


///////////////////////////////
// MOUSE EVENTS FOR SETTINGS
///////////////////////////////

let settingsVisible = false;
let settingsExpertMode = false;
document.addEventListener("mousemove", (e) => handleMouseEvent(e));
document.addEventListener("click", (e) => handleMouseEvent(e));
document.addEventListener("wheel", (e) => handleMouseEvent(e));
let cursorTimeout;
const MOUSE_MOVE_HIDE_TIMEOUT_MS = 1000;

function setMouseVisibility(state) {
  setClass(document.documentElement, "hide-cursor", !state);
}

function handleMouseEvent(e) {
  clearTimeout(cursorTimeout);
  setMouseVisibility(true)

  let settingsMenuToggleButton = "settings-menu-toggle-button".select();
  setClass(settingsMenuToggleButton, "show", true);

  if (!isHoveringControlElem(e.target)) {
    cursorTimeout = setTimeout(() => {
      setMouseVisibility(false);
      setClass(settingsMenuToggleButton, "show", false);
    }, MOUSE_MOVE_HIDE_TIMEOUT_MS);
  }
}

window.addEventListener('load', initSettingsMouseMove);

function printSettingDescription(event) {
  let settingsDescriptionContainer = getById("settings-description");
  let header = getById("settings-description-header");
  let description = getById("settings-description-description");
  let unaffected = getById("settings-description-unaffected");
  let overridden = getById("settings-description-overridden");

  let target = event.target;
  if (target.parentNode.classList.contains("preset")) {
    target = target.parentNode;
  }
  if (target.classList.contains("setting") || target.classList.contains("preset")) {
    let pref = findPreference(target.id) || findPreset(target.id);
    if (pref) {
      header.innerHTML = (pref.category === "Presets" ? "Preset: " : "") + pref.name;
      description.innerHTML = pref.description;

      overridden.innerHTML = [...target.classList]
        .filter(className => className.startsWith("overridden-"))
        .map(className => findPreference(className.replace("overridden-", "")))
        .map(pref => pref.category + " &#x00BB; " + pref.name)
        .join(" // ");

      setClass(settingsDescriptionContainer, "show", true);
    }
  } else {
    setClass(settingsDescriptionContainer, "show", false);
  }
}

function initSettingsMouseMove() {
  setMouseVisibility(false);
  let settingsWrapper = "settings-wrapper".select();

  let settingsMenuToggleButton = "settings-menu-toggle-button".select();
  settingsMenuToggleButton.onclick = (e) => {
    if (DEV_MODE && e.shiftKey) {
      generatePresetThumbnail();
    } else {
      requestAnimationFrame(() => toggleSettingsMenu());
    }
  };

  let settingsMenuExpertModeToggleButton = "settings-expert-mode-toggle".select();
  settingsMenuExpertModeToggleButton.onclick = () => {
    toggleSettingsExpertMode();
  };

  document.body.onclick = (e) => {
    if (settingsVisible && !isSettingControlElem(e) && !isRenderingPreferenceChange()) {
      setSettingsMenuState(false);
    }
  }

  document.addEventListener("dblclick", (e) => {
    if (!settingsVisible && !isSettingControlElem(e) && !window.getSelection().toString() && !isHoveringControlElem(e.target)) {
      toggleFullscreen();
    }
  });

  settingsWrapper.onmousemove = (event) => {
    requestAnimationFrame(() => clearTimeout(cursorTimeout));

    let settingsDescriptionContainer = "settings-description".select();
    let header = "settings-description-header".select();
    let description = "settings-description-description".select();
    let overridden = "settings-description-overridden".select();

    let target = event.target;
    if (target.parentNode.classList.contains("preset")) {
      target = target.parentNode;
    }
    if (target.classList.contains("setting") || target.classList.contains("preset")) {
      let pref = findPreference(target.id) || findPreset(target.id);
      if (pref) {
        header.innerHTML = (pref.category === "Presets" ? "Preset: " : "") + pref.name;
        description.innerHTML = pref.description;

        overridden.innerHTML = [...target.classList]
}

function isSettingControlElem(e) {
  let settingsMenuToggleButton = "settings-menu-toggle-button".select();
  let settingsMenuExpertModeToggleButton = "settings-expert-mode-toggle".select();
  return e.target === settingsMenuToggleButton
      || e.target === settingsMenuExpertModeToggleButton
      || e.target.classList.contains("setting")
      || e.target.classList.contains("setting-category")
      || e.target.classList.contains("preset")
      || e.target.parentNode.classList.contains("preset");
}

const CONTROL_PREF = findPreference("playback-control");
const CONTROL_ELEM_IDS = ["prev", "play-pause", "next", "shuffle", "repeat"];
function isHoveringControlElem(target) {
  return target && CONTROL_PREF.state && CONTROL_ELEM_IDS.includes(target.id);
}

function toggleSettingsMenu() {
  setSettingsMenuState(!settingsVisible);
}

function setSettingsMenuState(state) {
  settingsVisible = state;

  let settingsMenuToggleButton = "settings-menu-toggle-button".select();
  setClass(settingsMenuToggleButton, "show", settingsVisible);
  setMouseVisibility(settingsVisible)

  let settingsWrapper = "settings-wrapper".select();
  let mainBody = "main".select();
  setClass(settingsWrapper, "show", settingsVisible);
  setClass(mainBody, "scale-down", settingsVisible);
}

function toggleSettingsExpertMode() {
  settingsExpertMode = !settingsExpertMode;
  let settingsWrapper = "settings-wrapper".select();
  setClass(settingsWrapper, "expert", settingsExpertMode);
}

function generatePresetThumbnail() {
  let thumbnailGenerationEnabled = "main".select().classList.toggle("preset-thumbnail-generator");
  if (thumbnailGenerationEnabled) {
    let prerenderCanvas = setClass("prerender-canvas".select(), "show", true); // needed because rect would return all 0px otherwise

    let artworkBoundingBox = "artwork-img".select().getBoundingClientRect();

    let fakeArtwork = document.createElement("div");
    fakeArtwork.id = "fake-artwork";
    fakeArtwork.style.top = artworkBoundingBox.top + "px";
    fakeArtwork.style.left = artworkBoundingBox.left + "px";
    fakeArtwork.style.width = artworkBoundingBox.width + "px";
    fakeArtwork.style.height = artworkBoundingBox.width + "px";

    let contentMain = "content".select();
    contentMain.insertBefore(fakeArtwork, contentMain.firstChild);

    let content = "content".select();
    let presetThumbnailGeneratorCanvas = "preset-thumbnail-generator-canvas".select();
    domtoimage.toPng(content, {
      width: window.innerWidth,
      height: window.innerHeight
    })
      .then(imgDataBase64 => {
        setClass(presetThumbnailGeneratorCanvas, "show", true);
        let downloadLink = document.createElement('a');
        downloadLink.href = `${imgDataBase64}`;
        downloadLink.download = `${activePreset.id}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        fakeArtwork.remove();
        "main".select().classList.remove("preset-thumbnail-generator");
        setClass(presetThumbnailGeneratorCanvas, "show", false);

        setClass(prerenderCanvas, "show", isPrefEnabled("prerender-background"));
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
const TIME_OPTIONS = {
  hour12: false,
  hour: "numeric",
  minute: "2-digit"
}
const clockLocale = "en-US";
const clockFormatPref = findPreference("clock-full");

let prevTime;
let clockPref;
setInterval(() => {
  if (!clockPref) {
    clockPref = findPreference("show-clock");
  }
  if (clockPref.state) {
    let date = new Date();
    let time = clockFormatPref.state ? date.toLocaleDateString(clockLocale, DATE_OPTIONS) : date.toLocaleTimeString(clockLocale, TIME_OPTIONS);
    if (time !== prevTime) {
      prevTime = time;
      let clock = "clock".select();
      clock.innerHTML = time;
    }
  }
}, 1000);


///////////////////////////////
// FPS Counter
///////////////////////////////

let fps = "fps-counter".select();
let fpsStartTime = Date.now();
let fpsFrame = 0;
let fpsPref = findPreference("show-fps");
function fpsTick() {
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
