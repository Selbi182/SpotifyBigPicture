/**
 * @typedef {Object} CurrentData
 * @property {string} type
 * @property {number} deployTime
 * @property {number} versionId
 * @property {Array<{device: string, baseDb: number}>} customVolumeSettings
 * @property {Array<string>} settingsToToggle
 * @property {{
 *    id: string,
 *    artists: Array<string>,
 *    title: string,
 *    description: string,
 *    album: string,
 *    releaseDate: string,
 *    discNumber: number,
 *    trackNumber: number,
 *    timeCurrent: number,
 *    timeTotal: number,
 *    imageData: {
 *      imageUrl: string,
 *      imageUrlHD: string,
 *      imageColors: {
 *        averageBrightness: number,
 *        primary: {r: number, g: number, b: number},
 *        secondary: {r: number, g: number, b: number}
 *      }
 *    }
 * }} currentlyPlaying
 * @property {{
 *    discNumber: number,
 *    totalDiscCount: number,
 *    trackCount: number,
 *    combinedTime: number,
 *    listTracks: Array<any>,
 *    queue: Array<any>,
 *    trackListView: string,
 *    nextImageData: {
 *      imageUrl: string,
 *      imageUrlHD: string,
 *      imageColors: {
 *        averageBrightness: number,
 *        primary: {r: number, g: number, b: number},
 *        secondary: {r: number, g: number, b: number}
 *      }
 *    }
 * }} trackData
 * @property {{
 *    context: {contextName: string, contextType: string, contextDescription: string},
 *    device: string,
 *    paused: boolean,
 *    repeat: string,
 *    shuffle: boolean,
 *    volume: number,
 *    thumbnailUrl: string
 * }} playbackContext
 */

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
      imageUrlHD: "",
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
      imageUrlHD: "",
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
      contextType: "",
      contextDescription: ""
    },
    device: "",
    paused: "",
    repeat: "",
    shuffle: "",
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
  startPollingLoop();
}

function singleRequest(forceUpdate) {
  return new Promise(resolve => {
    let url = `${INFO_URL}?v=${forceUpdate ? -1 : currentData.versionId}`;
    fetch(url)
      .then(response => response.json())
      .then(json => {
        if ('errorMessage' in json) {
          throw new Error(json.errorMessage);
        }
        return processJson(json);
      })
      .then(() => resolve(true))
      .catch(ex => {
        let networkError = ex.message.startsWith("NetworkError");
        if (!networkError) {
          console.error(ex);
        }
        if (isPrefEnabled("show-error-toasts")) {
          showToast(networkError ? "Failed to connect to Java service" : ex);
        }
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

let pollTimeout;

function startPollingLoop() {
  clearTimeout(pollTimeout);
  pollingLoop();
}

function pollingLoop() {
  singleRequest()
    .then(success => calculateNextPollingTimeout(success))
    .then(pollingMs => {
      let nextPollingMs = pollingMs;
      if (pollingMs > 0 && pollingMs !== POLLING_INTERVAL_MS && isPrefEnabled("guess-next-track")) {
        fakeSongTransition = setTimeout(() => simulateNextSongTransition(), pollingMs);
        nextPollingMs = pollingMs * 2;
      }
      pollTimeout = setTimeout(pollingLoop, parseInt(nextPollingMs.toString()))
    });
}

function calculateNextPollingTimeout(success) {
  if (success) {
    pollingRetryAttempt = 0;
    if (!idle && isTabVisible()) {
      if (!currentData.playbackContext.paused) {
        let timeCurrent = currentData.currentlyPlaying.timeCurrent;
        let timeTotal = currentData.currentlyPlaying.timeTotal;
        let remainingTime = timeTotal - timeCurrent;
        if (remainingTime < POLLING_INTERVAL_MS * 2) {
          return remainingTime === POLLING_INTERVAL_MS ? remainingTime + 1 : remainingTime;
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

let fakeSongTransitionCooldown = false;
let fakeSongTransition;
function simulateNextSongTransition(force = false) {
  if (fakeSongTransitionCooldown) {
    console.debug("Simulated song transition skipped!")
    return;
  }
  if (currentData.trackData.queue.length > 0
    && !currentData.playbackContext.paused
    && (force || (currentData.currentlyPlaying.timeTotal - currentData.currentlyPlaying.timeCurrent) < POLLING_INTERVAL_MS)
    && isTabVisible()) {
    fakeSongTransitionCooldown = true;
    setTimeout(() => {
      fakeSongTransitionCooldown = false;
    }, 5000);

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


function isTabVisible() {
  return document.visibilityState === "visible" || !isPrefEnabled("idle-when-hidden");
}


///////////////////////////////
// MAIN DISPLAY STUFF
///////////////////////////////

String.prototype.select = function () {
  return document.getElementById(this);
}

const BLANK = "BLANK";

let transitionFromCss = null;
function getTransitionFromCss(forceUpdate = false) {
  if (!transitionFromCss || forceUpdate) {
    transitionFromCss = parseFloat(getComputedStyle("main".select()).getPropertyValue("--transition").slice(0, -1)) * 1000;
  }
  return transitionFromCss || 0;
}


function processJson(changes) {
  if (changes && changes.type !== "EMPTY") {
    console.info(changes);
    if (changes.type === "DATA" || changes.type === "SIMULATED_TRANSITION") {
      if (currentData.deployTime > 0 && getChange(changes, "deployTime").wasChanged) {
        reloadPage();
      } else {
        if (isTabVisible()) {
          updateExternallyToggledPreferences(changes)
            .then(() => changeImage(changes))
            .then(() => prerenderNextImage(changes))
            .then(() => setTextData(changes))
            .then(() => setCorrectTracklistView(changes))
            .then(() => refreshIdleTimeout(changes))
            .finally(() => {
              updateCurrentData(changes);
              unlockPlaybackControls();
            });
        }
      }
    }
  }
}

function updateCurrentData(changes) {
  for (let prop in changes) {
    currentData[prop] = changes[prop];
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

const ATTR_DATA_RAW = "data-raw";
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
    artistContainer.setAttribute(ATTR_DATA_RAW, artistContainer.innerHTML);

    if (isPrefEnabled("show-featured-artists") || currentData.currentlyPlaying.artists[0] !== mainArtist) {
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
    titleContainer.setAttribute(ATTR_DATA_RAW, titleContainer.innerHTML);

    fadeIn(titleContainer);
  }

  let album = getChange(changes, "currentlyPlaying.album");
  let releaseDate = getChange(changes, "currentlyPlaying.releaseDate");
  if (album.wasChanged || releaseDate.wasChanged) {
    let normalizedEmoji = convertToTextEmoji(album.value);
    let splitTitle = separateUnimportantTitleInfo(removeFeaturedArtists(normalizedEmoji));
    let albumTitleMain = splitTitle.main;
    let albumTitleExtra = splitTitle.extra;
    "album-title-main".select().innerHTML = albumTitleMain;
    "album-title-extra".select().innerHTML = albumTitleExtra;
    let albumTitleContainer = "album-title".select();
    albumTitleContainer.setAttribute(ATTR_DATA_RAW, albumTitleContainer.innerHTML);

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

    let albumContainer = "album".select();
    fadeIn(albumContainer);
  }

  let description = getChange(changes, "currentlyPlaying.description");
  if (description.wasChanged) {
    let descriptionContainer = "description".select();
    setClass("content-center".select(), "podcast", description.value && description.value !== BLANK);
    descriptionContainer.innerHTML = description.value.toString();
    descriptionContainer.setAttribute(ATTR_DATA_RAW, descriptionContainer.innerHTML);

    fadeIn(descriptionContainer);
  }

  // Context
  let contextName = getChange(changes, "playbackContext.context.contextName");
  if (contextName.wasChanged) {
    // Context main
    let contextMain = "context-main".select();
    contextMain.innerHTML = convertToTextEmoji(contextName.value);

    // Context type / release year / track count / total duration
    let contextExtra = "context-extra".select();
    let contextType = getChange(changes, "playbackContext.context.contextType");
    let contextTypePrefix = contextType.value;
    if (contextType.value === "QUEUE_IN_ALBUM") {
      contextTypePrefix = "QUEUE"
    } else if (contextType.value === "FAVORITE_TRACKS") {
      contextTypePrefix = "LIKED SONGS";
    }

    // Check if year needs to be displayed
    const validContextTypesForYearDisplay = ["ALBUM", "EP", "SINGLE", "COMPILATION"];
    if (validContextTypesForYearDisplay.includes(contextType.value)) {
      let year = getChange(changes, "currentlyPlaying.releaseDate").value.slice(0, 4);
      contextTypePrefix += `, ${year}`;
    }

    // Format track count
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
        lengthInfo += `, ${totalTimeFormatted}`;
      }

      contextExtra.innerHTML = `${contextTypePrefix ? contextTypePrefix + ' \u2022 ' : ""}${lengthInfo}`;
    } else {
      contextExtra.innerHTML = "";
    }

    // Playlist description
    let contextDescription= getChange(changes, "playbackContext.context.contextDescription");
    let formattedDescription = contextDescription.value !== BLANK ? convertToTextEmoji(contextDescription.value) : "";
    contextExtra.innerHTML += `<span id="context-description"> \u2022 ${formattedDescription}</span>`;
    setClass(contextExtra, "has-description", !!formattedDescription);

    // Thumbnail
    let thumbnailWrapperContainer = "thumbnail-wrapper".select();
    let thumbnailContainer = "thumbnail".select();
    let thumbnailUrl = getChange(changes, "playbackContext.thumbnailUrl").value;
    let circularThumbnail = ["ALBUM", "EP", "SINGLE", "COMPILATION", "ARTIST", "SEARCH", "FAVORITE_TRACKS"].includes(contextType.value);
    setClass(thumbnailWrapperContainer, "circular", circularThumbnail);

    thumbnailContainer.src = thumbnailUrl !== BLANK ? thumbnailUrl : DEFAULT_IMAGE;
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

    let buttonPauseElem = "button-play-pause".select();
    setClass(buttonPauseElem, "paused", paused.value);
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

  // Next track
  let trackData = getChange(changes, "changes.trackData");
  if (trackData.wasChanged) {
    let nextTrackInQueue = trackData.value.queue[0];
    let nextArtist = nextTrackInQueue?.artists[0];
    let nextTrackName = nextTrackInQueue?.title;
    "next-track-info".select().innerHTML = nextArtist && nextTrackName
      ? `${nextArtist} \u2022 ${fullStrip(nextTrackName)}`
      : "";
  }

  // Color
  let textColor = getChange(changes, "currentlyPlaying.imageData.imageColors.primary")
  if (textColor.wasChanged) {
    setTextColor(textColor.value);
  }

  // Lyrics
  if (isPrefEnabled("show-lyrics") && (getChange(changes, "currentlyPlaying.artists").wasChanged || getChange(changes, "currentlyPlaying.title").wasChanged)) {
    refreshLyrics(changes);
  }

  // Text balance
  refreshTextBalance();
}


function refreshTrackList() {
  setCorrectTracklistView(currentData);
}

function setCorrectTracklistView(changes, forceScroll = false) {
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

  let oldQueue = (queueMode ? currentData.trackData.queue : currentData.trackData.listTracks) || [];
  let newQueue = (queueMode ? changes.trackData.queue : changes.trackData.listTracks) || [];

  let displayTrackNumbers = !shuffle && !queueMode && (listViewType === "ALBUM" || listViewType === "PLAYLIST_ALBUM" && isPrefEnabled("always-show-track-numbers-album-view") || hasOnlyOneArtist(newQueue));
  setClass(trackListContainer, "show-tracklist-numbers", displayTrackNumbers)
  setClass(trackListContainer, "show-discs", !queueMode && totalDiscCount > 1)

  ///////////

  let isSingleTrack = newQueue.length === 1 && isPrefEnabled("hide-single-item-album-view");
  setClass(trackListContainer, "single-track", isSingleTrack);

  let refreshPrintedList = newQueue.length > 0 &&
    ((queueMode !== wasPreviouslyInQueueMode) || !trackListEquals(oldQueue, newQueue));

  if (refreshPrintedList) {
    if (queueMode) {
      if (isExpectedNextSongInQueue(currentId, currentData.trackData.queue)) {
        // Shrink and remove the first item in the queue
        let first = trackListContainer.querySelector(".track-elem:first-child");
        first.classList.remove("current");
        first.classList.add("shrink");
        setTimeout(() => {
          first.remove();
        }, getTransitionFromCss());

        // Mark the second item as the current track
        let second = trackListContainer.querySelector(".track-elem:nth-child(2)");
        second.classList.add("current");

        // Insert and grow the new (last) song to the queue
        let last = trackListContainer.querySelector(".track-elem:last-child");
        last.classList.remove("grow");
        let newQueueElement = newQueue[newQueue.length - 1];
        let trackElem = createSingleTrackListItem(newQueueElement);
        trackListContainer.append(trackElem);
        trackElem.classList.add("grow");
      } else {
        // Complete refresh of the queue
        let trackListContainer = printTrackList([changes.currentlyPlaying, ...changes.trackData.queue], false);
        trackListContainer.firstElementChild.classList.add("current");
        trackListContainer.lastElementChild.classList.add("grow");
      }
    } else {
      // Album View
      let isMultiDisc = listTracks.find(t => 'discNumber' in t && t.discNumber > 1);
      printTrackList(listTracks, listViewType === "ALBUM" && isMultiDisc && !shuffle);
    }
  }

  scaleTrackList();

  if (forceScroll || refreshPrintedList || getChange(changes, "trackData.trackNumber").wasChanged) {
    // Make sure the tracklist is at the correct position after the scaling transition.
    // This is a bit of a hackish solution, but a proper ontransitionend would be too tricky on a grid.
    refreshScrollPositions(queueMode, trackNumber, totalDiscCount, currentDiscNumber);
    setTimeout(() => {
      refreshScrollPositions(queueMode, trackNumber, totalDiscCount, currentDiscNumber);
      refreshTextBalance();
    }, getTransitionFromCss());
  }
}

function scaleTrackList() {
  let trackListContainer = "track-list".select();
  let previousFontSizeScale = getComputedStyle(trackListContainer).getPropertyValue("--font-size-scale") || 1;
  let minScale = getComputedStyle(trackListContainer).getPropertyValue("--scale-min") || 2.2;
  let maxScale = getComputedStyle(trackListContainer).getPropertyValue("--scale-max") || 3;
  let minChange = getComputedStyle(trackListContainer).getPropertyValue("--min-change") || 0.1;
  previousFontSizeScale = Math.min(Math.max(previousFontSizeScale, minScale), maxScale);

  let contentCenterContainer = trackListContainer.parentElement;
  let contentCenterHeight = contentCenterContainer.offsetHeight;
  let trackListContainerHeight = trackListContainer.scrollHeight;
  let trackListSize = trackListContainerHeight / previousFontSizeScale;

  let marginForOtherVerticalElements = 0;
  if (!isPrefEnabled("split-main-panels")) {
    let contentInfoSize = "center-info-main".select().offsetHeight;
    let contentCenterGap = parseFloat(window.getComputedStyle(contentCenterContainer).gap);
    marginForOtherVerticalElements = contentInfoSize + contentCenterGap;
  }

  let trackListScaleRatio = (contentCenterHeight - marginForOtherVerticalElements) / trackListSize;
  if (Math.abs(previousFontSizeScale - trackListScaleRatio) < minChange) {
    return;
  }

  if (!isNaN(trackListScaleRatio) && isFinite(trackListScaleRatio)) {
    trackListContainer.style.setProperty("--font-size-scale", trackListScaleRatio.toString());
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

function hasOnlyOneArtist(tracks) {
  if (tracks.length === 0 || !isPrefEnabled("one-artist-numbers-album-view")) {
    return false;
  }
  let firstArtistName = tracks[0].artists[0];
  return tracks.every(track => track.artists[0] === firstArtistName);
}

"track-list".select().onclick = () => {
  setCorrectTracklistView(currentData, true);
}


function toggleLyrics() {
  toggleVisualPreference(findPreference("show-lyrics"));
}
"lyrics-toggle-button".select().onclick = () => {
  toggleLyrics();
  showToast(`Lyrics ${isPrefEnabled("show-lyrics") ? "enabled" : "disabled"}!`);
}

let lyricsContainer = "lyrics".select();
function refreshLyrics(changes) {
  stopLyricsScroll();
  lyricsContainer.innerHTML = "";
  lyricsContainer.scrollTop = 0;
  fetchAndPrintLyrics(changes);
}

let preloadedNextLyricsId;
let preloadedNextLyrics;
function fetchAndPrintLyrics(changes) {
  let artist = getChange(changes, "currentlyPlaying.artists").value[0];
  let song = fullStrip(getChange(changes, "currentlyPlaying.title").value);

  if (getChange(changes, "currentlyPlaying.id").value === preloadedNextLyricsId && preloadedNextLyrics) {
    printLyrics(preloadedNextLyrics);
    preloadNextLyrics(changes);
  } else if (artist && song) {
    fetchLyrics(artist, song)
      .then(lyrics => printLyrics(lyrics))
      .then(() => preloadNextLyrics(changes));
  }

  function fetchLyrics(artistName, songName) {
    return fetch(`/lyrics?artist=${artistName}&song=${songName}`)
      .then(response => response.text());
  }

  function printLyrics(lyrics) {
    let lyricsContainer = "lyrics".select();
    lyricsContainer.innerHTML = lyrics;

    let hasLyrics = !!lyrics;
    setClass("content-center".select(), "lyrics", hasLyrics);
    if (hasLyrics) {
      lyricsContainer.scrollTop = 0;
      fadeIn(lyricsContainer);
      if (isPrefEnabled("lyrics-simulated-scroll")) {
        scrollLyrics(changes);
      }
      setTimeout(() => {
        refreshTextBalance();
      }, getTransitionFromCss());
    } else {
      showToast("Lyrics not found for current track!");
    }
  }

  function preloadNextLyrics(changes) {
    let nextTrackInQueue = changes.trackData.queue[0];
    let nextArtist = nextTrackInQueue?.artists[0];
    let nextTrackName = nextTrackInQueue?.title;
    fetchLyrics(nextArtist, nextTrackName)
      .then(nextLyrics => {
        preloadedNextLyricsId = nextTrackInQueue.id;
        preloadedNextLyrics = nextLyrics;
      });
  }
}

const lyricsScrollInitialDelayPercentage = 0.25;
let lyricsScrollInterval;
let lyricsScrollIntervalMs = 10;
function scrollLyrics(changes, noDelay = false) {
  stopLyricsScroll();

  let timeCurrent = getChange(changes, "currentlyPlaying.timeCurrent").value;
  let timeTotal = getChange(changes, "currentlyPlaying.timeTotal").value;
  let remainingTime = timeTotal - timeCurrent;

  let visibleHeight = lyricsContainer.offsetHeight;
  let totalHeight = lyricsContainer.scrollHeight;
  let currentScrollPosition = lyricsContainer.scrollTop;

  let pixelsToScroll = totalHeight - visibleHeight - currentScrollPosition;
  let preAndPostBuffer = remainingTime * lyricsScrollInitialDelayPercentage;
  lyricsScrollIntervalMs = (remainingTime * (1 - (lyricsScrollInitialDelayPercentage * 2))) / pixelsToScroll;

  setTimeout(() => {
    startLyricsScroll();
  }, noDelay ? 0 : preAndPostBuffer);
}

function startLyricsScroll() {
  if (!lyricsScrollInterval) {
    lyricsScrollInterval = setInterval(() =>  {
      lyricsContainer.scrollBy(0, 1);
      if (lyricsContainer.scrollHeight - lyricsContainer.scrollTop <= lyricsContainer.clientHeight) {
        stopLyricsScroll();
      }
    }, lyricsScrollIntervalMs);
  }
}

function stopLyricsScroll() {
  clearInterval(lyricsScrollInterval);
  lyricsScrollInterval = null;
}

lyricsContainer.onclick = () => {
  if (!window.getSelection().toString()) {
    if (lyricsScrollInterval) {
      stopLyricsScroll();
    } else {
      scrollLyrics(currentData, true);
    }
  }
};

lyricsContainer.onkeydown = (e) => e.preventDefault();


const idsToBalance = ["artists", "title", "album-title", "description"];
function refreshTextBalance() {
  refreshPortraitModeState();
  for (let id of idsToBalance) {
    let elem = id.select();
    balanceTextClamp(elem).then();
  }
}

async function balanceTextClamp(elem) {
  if (isPrefEnabled("text-balancing")) {
    // balanceText doesn't take line-clamping into account, unfortunately.
    // So we got to temporarily remove it, balance the text, then add it again.
    elem.style.setProperty("-webkit-line-clamp", "initial", "important");
    try {
      // balanceText sometimes gets stuck and causes freezes.
      // Running it async with a timeout should prevent this from happening.
      await Promise.race([
        new Promise((resolve) => {
          // noinspection JSUnresolvedFunction
          balanceText(elem);
          resolve();
        }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('text-balancing timed out')), 1000);
        })
      ]);
    } catch (e) {
      console.warn(`text-balancing caused a deadlock (id: ${elem.id}) and was forcibly aborted`);
    } finally {
      elem.style.removeProperty("-webkit-line-clamp");
    }
  } else {
    let dataRaw = elem.getAttribute(ATTR_DATA_RAW);
    if (dataRaw && dataRaw.length > 0) {
      elem.innerHTML = dataRaw;
    }
  }
}

function setClass(elem, className, state) {
  elem.classList.toggle(className, state);
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
  "ver\.",
  "cover",
  "original",
  "single",
  "ep",
  "motion\\spicture",
  "ost",
  "sound.?track",
  "theme",
  "from",
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
  "demo",
  "session",
  "reprise",
  "edit"
];

// Two regexes for readability, cause otherwise it'd be a nightmare to decipher brackets from hyphens
const USELESS_WORDS_REGEX_BRACKETS = new RegExp("\\s(\\(|\\[)[^-]*?(" + USELESS_WORDS.join("|") + ").*?(\\)|\\])", "ig");
const USELESS_WORDS_REGEX_HYPHEN = new RegExp("\\s-\\s[^-]*?(" + USELESS_WORDS.join("|") + ").*", "ig");
const WHITELISTED_WORDS_REGEXP = new RegExp("(\\(|\\-|\\[)[^-]*?(" + WHITELISTED_WORDS.join("|") + ").*", "ig");

function separateUnimportantTitleInfo(title) {
  let aggressive = isPrefEnabled("strip-titles-aggressive");
  if (aggressive || title.search(WHITELISTED_WORDS_REGEXP) < 0) {
    let index = title.search(USELESS_WORDS_REGEX_BRACKETS);
    if (index < 0) {
      index = title.search(USELESS_WORDS_REGEX_HYPHEN);
    }
    if (aggressive && index < 0) {
      index = title.search(WHITELISTED_WORDS_REGEXP);
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
  return title
    .replace(/[(|\[](f(ea)?t|with|by|w)\b.+?[)|\]]/ig, "")
    .replace(/( feat\. ).+/ig, "") // special case for when the 'feat.' is not placed in brackets
    .trim();
}

function fullStrip(title) {
  return separateUnimportantTitleInfo(removeFeaturedArtists(title)).main;
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
  if (isPrefEnabled("text-balancing") && idsToBalance.includes(elem.id)) {
    finishAnimations(elem);
    elem.classList.add("transparent");
    elem.classList.remove("text-grow");
    finishAnimations(elem);
    balanceTextClamp(elem)
      .then(() => elem.classList.add("text-grow"))
      .then(() => finishAnimations(elem))
      .then(() => elem.classList.remove("transparent", "text-grow"));
  } else {
    finishAnimations(elem);
    elem.classList.add("transparent", "text-grow");
    finishAnimations(elem);
    elem.classList.remove("transparent", "text-grow");
  }
}

function printTrackList(trackList, printDiscs) {
  let trackListContainer = "track-list".select();
  trackListContainer.innerHTML = "";

  let previousDiscNumber = 0;
  let trackNumPadLength = Math.max(...trackList.map(t => t.trackNumber)).toString().length;

  let albumSwaps = 0;
  for (let i = 1; i < trackList.length; i++) {
    if (trackList[i].album !== trackList[i - 1].album) {
      albumSwaps++;
    }
  }
  let spacersEnabled = (trackList.length / 2) > albumSwaps;

  let previousAlbum = trackList[0].album;
  for (let trackItem of trackList) {
    if (printDiscs && 'discNumber' in trackItem) {
      let newDiscNumber = trackItem.discNumber;
      if (newDiscNumber > previousDiscNumber) {
        previousDiscNumber = newDiscNumber
        let discTrackElem = createDiscElement(newDiscNumber);
        trackListContainer.append(discTrackElem);
      }
    }
    let spacer = spacersEnabled && previousAlbum !== trackItem.album;
    if (previousAlbum !== trackItem.album) {
      previousAlbum = trackItem.album;
    }
    let trackElem = createSingleTrackListItem(trackItem, trackNumPadLength, spacer);
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

function createSingleTrackListItem(trackItem, trackNumPadLength = 2, spacer = false) {
  // Create new tracklist item
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

  // Insert spacers after a new album
  setClass(trackElem, "spacer", spacer);

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
    let trackListContainer = "track-list".select();
    trackListContainer.scroll({
      top: 0,
      left: 0,
      behavior: isPrefEnabled("transitions") ? 'smooth' : 'auto'
    });
    updateScrollGradients();
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

const SCROLL_GRADIENTS_TOLERANCE = 8;

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
    let imageUrl = isPrefEnabled("hd-artwork")
      ? getChange(changes, "currentlyPlaying.imageData.imageUrlHD")
      : getChange(changes, "currentlyPlaying.imageData.imageUrl");

    if (imageUrl.wasChanged) {
      if (imageUrl.value === BLANK) {
        imageUrl.value = DEFAULT_IMAGE;
      }
      let oldImageUrl = currentData.currentlyPlaying.imageData.imageUrl;
      let newImageUrl = imageUrl.value.toString();
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
            nextImageUrl = isPrefEnabled("hd-artwork")
              ? getChange(changes, "trackData.nextImageData.imageUrlHD").value
              : nextImageUrl;

            let nextImageColors = getChange(changes, "trackData.nextImageData.imageColors").value;
            setArtworkAndPrerender(nextImageUrl, nextImageColors)
              .then(canvasData => {
                nextImagePrerenderCanvasData = {
                  imageUrl: nextImageUrl,
                  canvasData: canvasData
                };
                nextPrerenderInProgress = false;
              });
          }, getTransitionFromCss())
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
    let contentCenterContainer = "content-center".select();
    let centerRect = contentCenterContainer.getBoundingClientRect();
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

    if (!expandTop || !expandBottom) {
      artworkSize = Math.min(centerRect.width, artworkSize);
    }

    contentCenterContainer.style.removeProperty("--bonus-padding");
    if (isPrefEnabled("artwork-above-content") && !isPrefEnabled("show-queue")) {
      contentCenterContainer.style.setProperty("padding-top", "0");
      let contentCenterMainHeight = "center-info-main".select().getBoundingClientRect().height;

      artworkSize -= contentCenterMainHeight;
      if (expandTop) {
        artworkSize -= contentTop;
        contentCenterContainer.style.setProperty("--bonus-padding", -(contentTop * 2) + "px");
      }
      contentCenterContainer.style.removeProperty("padding-top");
    }

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
      "background-canvas".select().style.setProperty("--background-color", backgroundColorOverlay);

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

    // noinspection JSUnresolvedFunction
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
        let imageUrl = isPrefEnabled("hd-artwork")
          ? currentData.currentlyPlaying.imageData.imageUrlHD
          : currentData.currentlyPlaying.imageData.imageUrl;

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

const MIN_PERCEIVED_BRIGHTNESS = 0.7;
function setTextColor(rgbText) {
  let r = rgbText.r;
  let g = rgbText.g;
  let b = rgbText.b;

  // Calculate perceived brightness of color and fall back to white if it's under a certain threshold
  // (Formula taken from: http://alienryderflex.com/hsp.html)
  let perceivedBrightness = Math.sqrt(0.299 * Math.pow(r, 2) + 0.587 * Math.pow(g, 2) + 0.114 * Math.pow(b, 2)) / 255;
  if (perceivedBrightness < MIN_PERCEIVED_BRIGHTNESS) {
    [r, g, b] = [255, 255, 255];
  }

  let rgbCss = `rgb(${r}, ${g}, ${b})`;
  document.documentElement.style.setProperty("--color", rgbCss);
}


///////////////////////////////
// PROGRESS
///////////////////////////////

function updateProgress(changes) {
  let current = getChange(changes, "currentlyPlaying.timeCurrent").value;
  let total = getChange(changes, "currentlyPlaying.timeTotal").value;
  let paused = getChange(changes, "playbackContext.paused").value;

  // Text
  let formattedTimes = formatTime(current, total);
  let formattedCurrentTime = formattedTimes.current;
  let formattedTotalTime = formattedTimes.total;
  let formattedRemainingTime = formattedTimes.remaining;

  let elemTimeCurrent = "time-current".select();

  let timeCurrentUpdated;
  if (isPrefEnabled("remaining-time-timestamp")) {
    timeCurrentUpdated = formattedRemainingTime !== elemTimeCurrent.innerHTML;
    if (timeCurrentUpdated) {
      elemTimeCurrent.innerHTML = formattedRemainingTime;
    }
  } else {
    timeCurrentUpdated = formattedCurrentTime !== elemTimeCurrent.innerHTML;
    if (timeCurrentUpdated) {
      elemTimeCurrent.innerHTML = formattedCurrentTime;
    }
  }

  let elemTimeTotal = "time-total".select();
  let timeTotalUpdated = formattedTotalTime !== elemTimeTotal.innerHTML;
  if (timeTotalUpdated) {
    elemTimeTotal.innerHTML = formattedTotalTime;
  }

  // Website Title
  updateWebsiteTitle(changes);

  // Update Progress Bar
  if (isPrefEnabled("smooth-progress-bar") || timeCurrentUpdated || timeTotalUpdated) {
    if (formattedCurrentTime === formattedTotalTime && !isPrefEnabled("smooth-progress-bar")) {
      // Snap to maximum on the last second
      current = total;
    }
    setProgressBarTarget(current, total, paused);
  }
}

const WEBSITE_TITLE_BRANDING = "SpotifyBigPicture";
function updateWebsiteTitle(changes) {
  let newTitle = WEBSITE_TITLE_BRANDING;
  if (isPrefEnabled("current-track-in-website-title")) {
    let artists = getChange(changes, "currentlyPlaying.artists").value;
    let title = getChange(changes, "currentlyPlaying.title").value;
    if (!idle && artists && title) {
      let mainArtist = artists[0];
      let trackStripped = fullStrip(title);
      let titleElements = [mainArtist, trackStripped];
      if (isPrefEnabled("track-first-in-website-title")) {
        titleElements.reverse();
      }
      newTitle = titleElements.join(" \u2022 ");
      if (isPrefEnabled("branding-in-website-title")) {
        newTitle += " | " + WEBSITE_TITLE_BRANDING;
      }
    }
  }
  if (isTabVisible() && document.title !== newTitle) {
    document.title = newTitle;
  }
}

const progressBarElem = "progress-current".select();

function setProgressBarTarget(current, total) {
  let percent = (current / (total || 1)) * 100;
  progressBarElem.style.setProperty("--progress-percent", percent + "%");
}

function formatTime(current, total) {
  let currentHMS = calcHMS(current);
  let totalHMS = calcHMS(total);
  let remainingHMS = calcHMS(total - current);

  let formattedCurrent = `${pad2(currentHMS.seconds)}`;
  let formattedTotal = `${pad2(totalHMS.seconds)}`;
  let formattedRemaining = `${pad2(remainingHMS.seconds)}`;
  if (totalHMS.minutes >= 10 || totalHMS.hours >= 1) {
    formattedCurrent = `${pad2(currentHMS.minutes)}:${formattedCurrent}`;
    formattedTotal = `${pad2(totalHMS.minutes)}:${formattedTotal}`;
    formattedRemaining = `-${pad2(remainingHMS.minutes)}:${formattedRemaining}`;
    if (totalHMS.hours > 0) {
      formattedCurrent = `${currentHMS.hours}:${formattedCurrent}`;
      formattedTotal = `${totalHMS.hours}:${formattedTotal}`;
      formattedRemaining = `-${remainingHMS.hours}:${formattedRemaining}`;
    }
  } else {
    formattedCurrent = `${currentHMS.minutes}:${formattedCurrent}`;
    formattedTotal = `${totalHMS.minutes}:${formattedTotal}`;
    formattedRemaining = `-${remainingHMS.minutes}:${formattedRemaining}`;
  }

  return {
    current: formattedCurrent,
    total: formattedTotal,
    remaining: formattedRemaining
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

window.addEventListener('load', recursiveProgressRefresh);

function recursiveProgressRefresh() {
  refreshProgress();
  if (!idle) {
    requestAnimationFrame(() => recursiveProgressRefresh());
  }
}

let startTime = Date.now();

function refreshProgress() {
  let timeCurrent = currentData.currentlyPlaying.timeCurrent;
  let timeTotal = currentData.currentlyPlaying.timeTotal;
  if (timeCurrent != null && timeTotal != null && !currentData.playbackContext.paused) {
    let now = Date.now();
    let elapsedTime = now - (startTime ?? now);
    startTime = now;
    let newTime = timeCurrent + elapsedTime;
    currentData.currentlyPlaying.timeCurrent = Math.min(timeTotal, newTime);
    updateProgress(currentData);
  } else {
    startTime = null;
  }
}

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
let idleTimeout;

function refreshIdleTimeout(changes, force = false) {
  let paused = getChange(changes, "playbackContext.paused");
  if (force || paused.wasChanged) {
    if (paused.value) {
      if (isPrefEnabled("allow-idle-mode")) {
        idleTimeout = setTimeout(() => enableIdleMode(), IDLE_TIMEOUT_MS);
      }
    } else {
      clearTimeout(idleTimeout);
      if (idle) {
        disableIdleMode();
      }
    }
  }
}

function enableIdleMode() {
  if (!idle) {
    console.info("No music was played in a long while. Enabling idle mode...");
    idle = true;
    markWebsiteTitleAsIdle();
    setClass(document.body, "idle", true);
  }
}

function disableIdleMode() {
  if (idle) {
    idle = false;
    reloadPage();
  }
}

function markWebsiteTitleAsIdle() {
  document.title = `${WEBSITE_TITLE_BRANDING} (Idle)`;
}


///////////////////////////////
// VISUAL PREFERENCES
///////////////////////////////

let prefSearchCache = {};

function findPreference(id) {
  if (id in prefSearchCache) {
    return prefSearchCache[id];
  }
  let pref = PREFERENCES.find(pref => pref.id === id);
  prefSearchCache[id] = pref;
  return pref;
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

  // User integrity check (reset settings after update)
  if (isLocalStorageAvailable()) {
    let storedVersionHash = getVersionHashFromLocalStorage();
    let newVersionHash = calculateVersionHash();
    setVersionHashInLocalStorage(newVersionHash);
    if (!storedVersionHash) {
      showModal(
        "Welcome to SpotifyBigPicture",
        "Please select a preset to proceed...",
        null,
        null,
        "Okay",
        "Okay"
      )
      resetSettings();
    } else if (storedVersionHash !== newVersionHash) {
      showModal(
        "New Version Detected",
        "It looks like you've installed a new version of SpotifyBigPicture. To prevent conflicts arising from the changes in the new version, it is recommended to reset your settings. Reset settings now?",
        () => resetSettings(),
        null,
        "Reset Settings",
        "Keep Settings")
    }
  }

  // Create categories
  let categories = {};
  for (let category of PREFERENCES_CATEGORY_ORDER) {
    let categoryElem = document.createElement("div");
    categoryElem.classList.add("setting-category");
    let categoryElemHeader = document.createElement("div");
    categoryElemHeader.classList.add("setting-category-header");
    categoryElemHeader.title = "Expand/collapse category..."
    categoryElemHeader.innerHTML = category;
    categoryElemHeader.onclick = () => {
      categoryElem.classList.toggle("collapse");
    }
    categoryElem.appendChild(categoryElemHeader);
    settingsWrapper.appendChild(categoryElem);
    categories[category] = categoryElem;
  }

  let quickJumpElem = "settings-quick-jump".select();
  for (let category of PREFERENCES_CATEGORY_ORDER) {
    let quickJumper = document.createElement("div");
    quickJumper.innerHTML = category;
    quickJumper.onclick = () => quickJump(category);
    quickJumpElem.append(quickJumper);
  }

  // Create settings
  for (let prefIndex in PREFERENCES) {
    let pref = PREFERENCES[prefIndex];

    // Subcategory Headers
    if (pref.subcategoryHeader) {
      let prefElem = document.createElement("div");
      prefElem.innerHTML = pref.subcategoryHeader;
      prefElem.classList.add("setting-subcategory-header");
      let categoryElem = categories[pref.category];
      categoryElem.appendChild(prefElem);
    }

    // Create button element
    let prefElem = document.createElement("div");
    prefElem.id = pref.id;
    prefElem.classList.add("setting");
    prefElem.innerHTML = pref.name;
    prefElem.onclick = () => toggleVisualPreference(pref);

    // Tag as unaffected-by-preset where applicable
    if (PREF_IDS_PROTECTED.includes(pref.id)) {
      prefElem.classList.add("unaffected");
    }

    // Group to category
    let categoryElem = categories[pref.category];
    categoryElem.appendChild(prefElem);
  }

  // Create preset buttons
  const settingsPresetsWrapper = "settings-presets".select();
  for (let presetIndex in PREFERENCES_PRESETS) {
    let preset = PREFERENCES_PRESETS[presetIndex];

    let presetElem = document.createElement("div");
    presetElem.id = preset.id;
    presetElem.classList.add("preset");
    presetElem.innerHTML = `<img src="/design/img/presets/${preset.id}.png" alt=${preset.name}>`;

    presetElem.onclick = () => {
      applyPreset(preset);
    };

    settingsPresetsWrapper.append(presetElem);
  }

  if (isLocalStorageAvailable()) {
    let visualPreferencesFromLocalStorage = getVisualPreferencesFromLocalStorage();
    if (visualPreferencesFromLocalStorage) {
      // Init setting states from local storage (dark mode is auto-disabled on page refresh)
      for (let pref of PREFERENCES) {
        let state = (pref.id !== "dark-mode")
          ? visualPreferencesFromLocalStorage.includes(pref.id)
          : false;
        refreshPreference(pref, state);
      }
    } else {
      // On first load, apply the default preset and enable the ignoreDefaultOn settings. Then force-open the settings menu
      applyDefaultPreset();
    }
  }

  submitVisualPreferencesToBackend();
}

function applyDefaultPreset() {
  applyPreset(PREFERENCES_PRESETS.find(preset => preset.id === "preset-default"));
  PREFERENCES.filter(pref => pref.default && pref.protected).forEach(pref => {
    setVisualPreferenceFromId(pref.id, true);
  });
  requestAnimationFrame(() => {
    setSettingsMenuState(true);
  });
}

function submitVisualPreferencesToBackend() {
   let simplifiedPrefs = [...PREFERENCES_PRESETS, ...PREFERENCES]
     .sort((a, b) => PREFERENCES_CATEGORY_ORDER.indexOf(a.category) - PREFERENCES_CATEGORY_ORDER.indexOf(b.category))
     .map(pref => {
       return {
         id: pref.id,
         name: pref.name,
         category: pref.category,
         subcategoryHeader: pref.subcategoryHeader,
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

const LOCAL_STORAGE_TEST_KEY = "local_storage_availability_test";
let localStorageAvailable = null;

function isLocalStorageAvailable() {
  if (localStorageAvailable === null) {
    try {
      localStorage.setItem(LOCAL_STORAGE_TEST_KEY, LOCAL_STORAGE_TEST_KEY);
      localStorage.removeItem(LOCAL_STORAGE_TEST_KEY);
      localStorageAvailable = true;
    } catch (e) {
      localStorageAvailable = false;
    }
  }
  return localStorageAvailable;
}

const LOCAL_STORAGE_KEY_SETTINGS = "visual_preferences";
const LOCAL_STORAGE_SETTINGS_SPLIT_CHAR = "+";
function getVisualPreferencesFromLocalStorage() {
  if (localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS)) {
    let storedVisualPreferences = localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS);
    return storedVisualPreferences?.split(LOCAL_STORAGE_SETTINGS_SPLIT_CHAR);
  }
  return null;
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

const LOCAL_STORAGE_KEY_VERSION_HASH = "version_hash";
function getVersionHashFromLocalStorage() {
  return localStorage.getItem(LOCAL_STORAGE_KEY_VERSION_HASH);
}

function setVersionHashInLocalStorage(newVersionHash) {
  return localStorage.setItem(LOCAL_STORAGE_KEY_VERSION_HASH, newVersionHash);
}

function calculateVersionHash() {
  // the generated hash is really just the total length of all setting IDs concatenated
  let pseudoHash = [...PREF_IDS_ALL].reduce((totalLength, str) => totalLength + str.length, 0);
  return pseudoHash.toString();
}

function toggleVisualPreference(pref) {
  setVisualPreference(pref, !pref.state);
}

function setVisualPreferenceFromId(prefId, newState) {
  setVisualPreference(findPreference(prefId), newState);
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
  }, getTransitionFromCss());

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

function applyPreset(preset) {
  "main".select().style.setProperty("--artwork-size", "0");

  [PREF_IDS_DEFAULT_ENABLED, preset.enabled].flat()
    .filter(prefId => !PREF_IDS_PROTECTED.includes(prefId))
    .filter(prefId => !preset.disabled.includes(prefId))
    .forEach(prefId => setVisualPreferenceFromId(prefId, true));

  [PREF_IDS_DEFAULT_DISABLED, preset.disabled].flat()
    .filter(prefId => !PREF_IDS_PROTECTED.includes(prefId))
    .filter(prefId => !preset.enabled.includes(prefId))
    .forEach(prefId => setVisualPreferenceFromId(prefId, false));
}

function updateExternallyToggledPreferences(changes) {
  return new Promise(resolve => {
    let reload = false;
    if (changes.settingsToToggle?.length > 0) {
      for (let setting of changes.settingsToToggle) {
        if (setting.startsWith("dark-mode-")) {
          setDarkModeIntensity(setting);
          setting = "dark-mode";
        }
        if (setting === "reload") {
          reload = true;
        } else {
          let preference = findPreference(setting);
          if (preference) {
            toggleVisualPreference(preference);
            showToast(`'${preference.name}' ${preference.state ? "enabled" : "disabled"} via remote`);
          } else {
            let preset = findPreset(setting);
            if (preset) {
              applyPreset(preset);
              showToast(`Preset ${preset.name} applied via remote`);
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
  // noinspection JSCheckFunctionSignatures
  window.location.reload(true); // hard-refresh to bypass cache
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
  toggleVisualPreference(findPreference("dark-mode"));
}

function setDarkModeIntensity(setting) {
  let intensity = parseInt(setting.replace("dark-mode-", "")) / 100;
  "dark-overlay".select().style.setProperty("--dark-intensity", intensity.toString());
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
  refreshBackgroundRender();
  refreshProgress();
  updateScrollGradients();
  submitVisualPreferencesToBackend();
}

function quickJump(targetCategoryName) {
  let settingsCategories = "settings-categories".select();
  let allCategories = settingsCategories.querySelectorAll(".setting-category-header");
  let jumpResult = [...allCategories].find(elem => elem.innerText.startsWith(targetCategoryName));
  if (jumpResult) {
    let settingsScroller = "settings-scroller".select();
    let y = jumpResult.offsetTop - settingsScroller.offsetTop - 35;
    settingsScroller.scroll({
      top: y,
      left: 0,
      behavior: 'smooth'
    });
  }
}


///////////////////////////////
// REFRESH IMAGE ON RESIZE
///////////////////////////////

let mobileView = null;

function refreshPortraitModeState() {
  mobileView = window.matchMedia("screen and (max-aspect-ratio: 3/2)").matches;
}

function isPortraitMode() {
  if (mobileView === null) {
    refreshPortraitModeState();
  }
  return mobileView;
}

let wasPreviouslyInPortraitMode = false;
let refreshBackgroundEvent;

const LOCAL_STORAGE_KEY_PORTRAIT_PROMPT_ENABLED = "portrait_mode_prompt_enabled";
let portraitModePresetSwitchPromptEnabled = true;
window.addEventListener('load', () => {
  let localStoragePortraitPromptEnabled = localStorage.getItem(LOCAL_STORAGE_KEY_PORTRAIT_PROMPT_ENABLED);
  if (localStoragePortraitPromptEnabled) {
    portraitModePresetSwitchPromptEnabled = localStoragePortraitPromptEnabled === "true";
  }
})

function portraitModePresetSwitchPrompt() {
  refreshPortraitModeState();
  let portraitMode = isPortraitMode();
  if (portraitModePresetSwitchPromptEnabled && !wasPreviouslyInPortraitMode && portraitMode && !isPrefEnabled("artwork-above-content")) {
    showModal(
      "Portrait Mode",
      "It seems like you're using the app in portrait mode. Would you like to switch to the design optimized for vertical aspect ratios?",
      () => applyPreset(PREFERENCES_PRESETS.find(preset => preset.id === "preset-vertical")),
      () => {
        showModal(
          "Portrait Mode",
          "No longer show this prompt when resizing windows?",
          () => {
            portraitModePresetSwitchPromptEnabled = false;
            localStorage.setItem(LOCAL_STORAGE_KEY_PORTRAIT_PROMPT_ENABLED, "false");
          },
          null,
          "Disable Prompts",
          "Keep Prompts"
        )
      },
      "Switch to Portrait Mode",
      "Cancel");
  }
  wasPreviouslyInPortraitMode = portraitMode;
}

function clearLocalStoragePortraitModePresetPromptPreference() {
  portraitModePresetSwitchPromptEnabled = true;
  localStorage.removeItem(LOCAL_STORAGE_KEY_PORTRAIT_PROMPT_ENABLED);
}

window.onresize = () => {
  clearTimeout(refreshBackgroundEvent);
  refreshBackgroundEvent = setTimeout(() => {
    if (isTabVisible()) {
      portraitModePresetSwitchPrompt();
    }
    refreshAll();
  }, getTransitionFromCss());
};


///////////////////////////////
// PLAYBACK CONTROLS
///////////////////////////////

window.addEventListener('load', initPlaybackControls);

function initPlaybackControls() {
  "button-play-pause".select().onclick = () => fireControl("PLAY_PAUSE");
  "button-prev".select().onclick = () => fireControl("PREV");
  "button-next".select().onclick = () => fireControl("NEXT");
}

let waitingForResponse = false;

function fireControl(control, param) {
  if (!waitingForResponse && isPrefEnabled("playback-control")) {
    waitingForResponse = true;
    setClass(document.body, "waiting-for-control", true);
    fetch(`/modify-playback/${control}${param ? `?param=${param}` : ""}`, {method: 'POST'})
      .then(response => {
        if (response.status >= 200 && response.status < 300) {
          response.json().then(response => processJson(response));
        } else if (response.status >= 400) {
          showModal("Playback Control", "ERROR: Failed to transmit control to backend!");
        }
      }).finally(() => unlockPlaybackControls());
  }
}

function unlockPlaybackControls() {
  if (waitingForResponse) {
    waitingForResponse = false;
    setClass(document.body, "waiting-for-control", false);
  }
}


///////////////////////////////
// HOTKEYS
///////////////////////////////

document.onkeydown = (e) => {
  if (modalActive) {
    switch (e.key) {
      case 'Escape':
        hideModal();
        break;
    }
  } else {
    switch (e.key) {
      case ' ':
        toggleSettingsMenu();
        break;
      case 'Escape':
        setSettingsMenuState(false);
        break;
      case 'Control':
        if (settingsVisible) {
          toggleSettingsExpertMode();
        }
        break;
      case 'f':
        toggleFullscreen();
        break;
      case 'd':
        toggleDarkMode();
        break;
      case 'l':
        toggleLyrics();
        break;
      case 'ArrowUp':
        scrollSettingsUpDown(-1);
        break;
      case 'ArrowDown':
        scrollSettingsUpDown(1);
        break;
    }
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
  setClass(document.body, "hide-cursor", !state);
}

function handleMouseEvent(e) {
  clearTimeout(cursorTimeout);
  setMouseVisibility(true)

  if (!modalActive) {
    let mouseMoveButtons = "mouse-move-buttons".select();
    setClass(mouseMoveButtons, "show", true);

    if (!settingsVisible && !isHoveringControlElem(e.target)) {
      cursorTimeout = setTimeout(() => {
        setMouseVisibility(false);
        setClass(mouseMoveButtons, "show", false);
      }, MOUSE_MOVE_HIDE_TIMEOUT_MS);
    }
  }
}

window.addEventListener('load', initSettingsMouseMove);

function printSettingDescription(event) {
  let target = event.target;
  if (target?.classList) {
    if (target.parentNode.classList.contains("preset")) {
      target = target.parentNode;
    }
    if (target.classList.contains("setting") || target.classList.contains("preset")) {
      let pref = findPreference(target.id) || findPreset(target.id);
      if (pref) {
        setSettingDescription(
          (pref.category === "Presets" ? "Preset: " : "") + pref.name,
          pref.description,
          PREF_IDS_PROTECTED.includes(pref.id)
        )
        setDescriptionVisibility(true);
      }
    } else {
      setDescriptionVisibility(false);
    }
  }
}

function setSettingDescription(headerText, descriptionText, isUnaffected, overriddenRootId) {
  let header = "settings-description-header".select();
  let description = "settings-description-description".select();
  let unaffected = "settings-description-unaffected".select();
  let overridden = "settings-description-overridden".select();

  header.innerHTML = headerText;
  description.innerHTML = descriptionText;
  unaffected.innerHTML = isUnaffected ? "Protected: This setting is unaffected by changing presets" : "";

  if (overriddenRootId) {
    overridden.innerHTML = [...overriddenRootId.classList]
      .filter(className => className.startsWith("overridden-"))
      .map(className => findPreference(className.replace("overridden-", "")))
      .map(pref => pref.category + " &#x00BB; " + pref.name)
      .join(" // ");
  }
}

function setDescriptionVisibility(state) {
  let settingsDescriptionContainer = "settings-description".select();
  setClass(settingsDescriptionContainer, "show", state);
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
  if (!DEV_MODE) {
    "preset-thumbnail-generator-canvas".select().remove();
  }

  "nosleep-lock-button".select().onclick = () => {
    toggleNoSleepMode();
  };

  "fullscreen-toggle-button".select().onclick = () => {
    toggleFullscreen();
  };

  "settings-expert-mode-toggle".select().onclick = () => {
    toggleSettingsExpertMode();
  };

  "settings-reset".select().onclick = () => {
    resetSettingsPrompt();
  };

  "settings-shutdown".select().onclick = () => {
    shutdownPrompt();
  };

  document.body.onclick = (e) => {
    if (modalActive && !"modal".select().contains(e.target)) {
      hideModal();
    } else if (settingsVisible && !isSettingControlElem(e) && !isRenderingPreferenceChange()) {
      setSettingsMenuState(false);
    }
  }

  document.addEventListener("dblclick", (e) => {
    if (isPrefEnabled("fullscreen-double-click") && !settingsVisible && !isSettingControlElem(e) && !window.getSelection().toString() && !isHoveringControlElem(e.target)) {
      toggleFullscreen();
    }
  });

  settingsWrapper.onmousemove = (event) => updateSettingDescription(event);
  settingsWrapper.onmousedown = (event) => updateSettingDescription(event);
  "settings-scroller".select().onscroll = () => setDescriptionVisibility(false); // to avoid mismatches
}

function updateSettingDescription(event) {
  requestAnimationFrame(() => clearTimeout(cursorTimeout));
  printSettingDescription(event);
}

function isSettingControlElem(e) {
  return !"main".select().contains(e.target);
}

function isHoveringControlElem(target) {
  return target && "mouse-move-buttons".select().contains(target) && !"playback-controller".select().contains(target);
}

function toggleSettingsMenu() {
  setSettingsMenuState(!settingsVisible);
}

function setSettingsMenuState(state) {
  settingsVisible = state;
  setMouseVisibility(settingsVisible)

  let mouseMoveButtons = "mouse-move-buttons".select();
  setClass(mouseMoveButtons, "settings-active", settingsVisible);

  let settingsWrapper = "settings-wrapper".select();
  let mainBody = "main".select();
  setClass(settingsWrapper, "show", settingsVisible);
  setClass(mainBody, "scale-down", settingsVisible);
}

function toggleSettingsExpertMode() {
  settingsExpertMode = !settingsExpertMode;
  setClass("settings-wrapper".select(), "expert", settingsExpertMode);
  setClass("settings-quick-jump".select(), "show", settingsExpertMode);
}

function resetSettingsPrompt() {
  showModal("Reset", "Do you really want to reset all settings to their default state?",
    () => resetSettings(),
    null,
    "Reset Settings",
    "Cancel");
}

function resetSettings() {
  PREFERENCES.filter(pref => pref.default).flat().forEach(id => setVisualPreferenceFromId(id, true));
  PREFERENCES.filter(pref => !pref.default).flat().forEach(id => setVisualPreferenceFromId(id, false));
  clearLocalStoragePortraitModePresetPromptPreference();
  localStorage.removeItem(LOCAL_STORAGE_KEY_SETTINGS);
  applyDefaultPreset();
  console.warn("Settings have been reset!")
}

function shutdownPrompt() {
  showModal("Shutdown", "Exit SpotifyBigPicture?", () => {
    showModal("Logout", "Do you also want to log out? You will have to re-enter your credentials on the next startup!",
      () => shutdown(true),
      () => shutdown(false),
      "Logout",
      "Cancel"
    )
  })
  
  function shutdown(logout) {
    fetch(`/shutdown?logout=${logout}`, {method: 'POST'})
      .then(response => {
        if (response.status === 200) {
          setSettingsMenuState(false);
          enableIdleMode();
          showModal("Shutdown", "Successfully shut down! You may close this tab now.");
        } else {
          showModal("Error", "Failed to shut down! Are the playback controls disabled?");
        }
      });
  }
}

function scrollSettingsUpDown(direction) {
  let settingsScroller = "settings-scroller".select();
  let velocity = settingsScroller.offsetHeight / 2;

  settingsScroller.scroll({
    top: settingsScroller.scrollTop + (velocity * direction),
    left: 0,
    behavior: isPrefEnabled("transitions") ? 'smooth' : 'auto'
  });
}

// noinspection JSUnresolvedFunction
let nosleep = new NoSleep();
let nosleepActive = false;
function toggleNoSleepMode() {
  nosleepActive = !nosleepActive;
  if (nosleepActive) {
    nosleep.enable();
    showToast("No-sleep mode enabled!")
  } else {
    nosleep.disable();
    showToast("No-sleep mode disabled!")
  }
  setClass("nosleep-lock-button".select(), "enabled", nosleepActive);
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

    // noinspection JSUnresolvedFunction
    domtoimage.toPng(content, {
      width: window.innerWidth,
      height: window.innerHeight
    })
    .then(imgDataBase64 => {
      setClass(presetThumbnailGeneratorCanvas, "show", true);
      let downloadLink = document.createElement('a');
      downloadLink.href = `${imgDataBase64}`;
      downloadLink.download = "preset-thumbnail.png";
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

document.addEventListener("visibilitychange", () => {
  if (isTabVisible()) {
    startPollingLoop();
  } else {
    markWebsiteTitleAsIdle();
  }
});


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
  hour12: false
};
const TIME_OPTIONS = {
  hour12: false,
  hour: "numeric",
  minute: "2-digit"
}
const clockLocale = "en-US";

let prevTime;
setInterval(() => {
  if (isPrefEnabled("show-clock")) {
    let date = new Date();

    let hour12 = !isPrefEnabled("clock-24");
    let time = isPrefEnabled("clock-full")
      ? date.toLocaleDateString(clockLocale, {...DATE_OPTIONS, hour12: hour12})
      : date.toLocaleTimeString(clockLocale, {...TIME_OPTIONS, hour12: hour12});

    if (time !== prevTime) {
      prevTime = time;
      let clock = "clock".select();
      clock.innerHTML = time;
      clock.style.setProperty("--clock-symbol", `"${getClosestClockTextEmoji(date)}"`);
    }
  } else {
    prevTime = null;
  }
}, 1000);

function getClosestClockTextEmoji(currentTime) {
  // half-hour clock emojis exist as well, but I chose to only have the full hours for simplicity
  let hours = currentTime.getHours() % 12 || 12;
  let hoursHex = (hours - 1).toString(16).toUpperCase();
  return `\\01F55${hoursHex}\uFE0E`;
}

let modalActive = false;
function showModal(title, content, onConfirm = null, onReject = null, okayButtonLabel = "Okay", closeButtonLabel = "Close") {
  requestAnimationFrame(() => {
    // Set content
    "modal-header".select().innerHTML = title;
    "modal-main".select().innerHTML = content;

    // Create buttons
    let modalButtons = "modal-buttons".select();
    modalButtons.innerHTML = ""; // Remove all old buttons to avoid conflicts
    createModalButton(closeButtonLabel, "close", onReject);

    // Set onConfirm logic if this is a confirmation modal
    setClass(modalButtons, "confirm", !!onConfirm);
    if (onConfirm) {
      createModalButton(okayButtonLabel, "okay", onConfirm);
    }

    // Display modal
    setClass("modal-overlay".select(), "show", true);
    setClass(document.body, "dark-blur", true);
    modalActive = true;

    // Modal button generator
    function createModalButton(text, className, customOnClick = null) {
      let modalButton = document.createElement("div");
      modalButton.innerHTML = text;
      modalButton.className = className;
      modalButtons.append(modalButton);
      modalButton.onclick = () => {
        if (customOnClick) {
          requestAnimationFrame(() => customOnClick.call(this));
        }
        hideModal();
      }
    }
  });
}

function hideModal() {
  modalActive = false;
  setClass("modal-overlay".select(), "show", false);
  setClass(document.body, "dark-blur", false);
}


///////////////////////////////
// Toast Notifications
///////////////////////////////

let toastTimeout;
function showToast(text) {
  clearTimeout(toastTimeout);
  let toastContainer = "toast".select();
  let toastTextContainer = "toast-text".select();
  toastTextContainer.innerHTML = text;
  setClass(toastContainer, "show", true);
  toastTimeout = setTimeout(() => {
    setClass(toastContainer, "show", false);
  }, 3000);
}


///////////////////////////////
// Preferences & Presets Data
///////////////////////////////

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
    callback: () => refreshTextBalance()
  },
  {
    id: "strip-titles",
    name: "Strip Titles",
    description: "Hides any kind of potentially unnecessary extra information from track tiles and release names "
      + "(such as 'Remastered Version', 'Anniversary Edition', '2023 Re-Release', etc.)",
    category: "General",
    default: true,
    protected: true,
    css: {
      "title-extra": "hide",
      "album-title-extra": "hide",
      "track-list": "strip"
    }
  },
  {
    id: "strip-titles-aggressive",
    name: "Aggressive Strip Titles",
    description: "When also enabled, whitelisted words such as 'live', 'demo', 'remix' are also stripped. " +
      "May require a page refresh",
    category: "General",
    default: false,
    protected: true
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
    id: "hd-artwork",
    name: "HD Artwork from iTunes",
    description: "Try to look for the artwork on iTunes instead of Spotify, which hosts uncompressed images. " +
      "Do note that this can make the application slower",
    category: "General",
    default: false,
    protected: true
  },
  {
    id: "fullscreen-double-click",
    name: "Toggle Fullscreen By Double Click",
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
    id: "smooth-progress-bar",
    name: "Smooth Progress Bar",
    description: "If enabled, the progress bar will get updated smoothly, rather than only once per second. "
      + "It is STRONGLY recommended keep this setting disabled for low-power hardware to save on resources!",
    category: "Bottom Content",
    default: false,
    protected: true,
    callback: () => refreshProgress()
  },
  {
    id: "reverse-bottom",
    name: "Progress Bar Underneath",
    description: "If enabled, the progress bar and the timestamps/playback state info swap positions",
    category: "Bottom Content",
    default: false,
    css: {"content-bottom": "reverse"}
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
      "show-podcast-descriptions",
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

if (DEV_MODE) {
  console.info(`${PREFERENCES.length} settings // ${PREFERENCES_PRESETS.length} presets // ${PREFERENCES_CATEGORY_ORDER.length} categories`)

  // Anomaly check for presets
  for (let preset of PREFERENCES_PRESETS) {
    preset.enabled.forEach(prefId => {
      if (PREF_IDS_DEFAULT_ENABLED.includes(prefId)) {
        console.warn(`${preset.name}: ${prefId} is redundantly set to enabled`);
      }
    });
    preset.disabled.forEach(prefId => {
      if (PREF_IDS_DEFAULT_DISABLED.includes(prefId)) {
        console.warn(`${preset.name}: ${prefId} is redundantly set to disabled`);
      }
    });

    [preset.enabled, preset.disabled].flat().forEach(prefId => {
      if (PREF_IDS_PROTECTED.includes(prefId)) {
        console.warn(`${preset.name}: ${prefId} is being used in a preset despite being marked as protected`);
      }
    });
  }
}