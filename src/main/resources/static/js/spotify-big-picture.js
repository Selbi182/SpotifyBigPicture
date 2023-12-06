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
  startPollingLoop();
}

function singleRequest(forceUpdate) {
  return new Promise(resolve => {
    let url = `${INFO_URL}?v=${forceUpdate ? -1 : currentData.versionId}`;
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
        if (!ex.message.startsWith("NetworkError")) {
          console.error(ex);
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
      if (pollingMs > 0 && pollingMs !== POLLING_INTERVAL_MS && isPrefEnabled("guess-next-track")) {
        fakeSongTransition = setTimeout(() => simulateNextSongTransition(), pollingMs);
      }
      pollTimeout = setTimeout(pollingLoop, parseInt(pollingMs.toString()))
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

let fakeSongTransition;
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


function isTabVisible() {
  return document.visibilityState === "visible";
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

function refreshCurrentTextData() {
  setTextData(currentData);
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

    let albumContainer = "album".select();
    fadeIn(albumContainer);
  }

  let description = getChange(changes, "currentlyPlaying.description");
  if (description.wasChanged) {
    let descriptionContainer = "description".select();
    setClass("content-center".select(), "podcast", description.value && description.value !== BLANK);
    descriptionContainer.innerHTML = description.value.toString();
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

    const validContextTypesForYearDisplay = ["ALBUM", "EP", "SINGLE", "COMPILATION"];
    if (validContextTypesForYearDisplay.includes(contextType.value)) {
      let year = getChange(changes, "currentlyPlaying.releaseDate").value.slice(0, 4);
      contextTypePrefix += `, ${year}`;
    }

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

  // Next track (if enabled)
  if (isPrefEnabled("next-track-replacing-clock")) {
    let nextTrackInQueue = changes.trackData.queue[0];
    let nextArtist = nextTrackInQueue?.artists[0];
    let nextTrackName = nextTrackInQueue?.title;
    "clock".select().innerHTML = nextArtist && nextTrackName
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

  let displayTrackNumbers = !shuffle && !queueMode && (listViewType === "ALBUM" || listViewType === "PLAYLIST_ALBUM" && isPrefEnabled("always-show-track-numbers-album-view"));
  setClass(trackListContainer, "show-tracklist-numbers", displayTrackNumbers)
  setClass(trackListContainer, "show-discs", !queueMode && totalDiscCount > 1)

  ///////////

  let oldQueue = (queueMode ? currentData.trackData.queue : currentData.trackData.listTracks) || [];
  let newQueue = (queueMode ? changes.trackData.queue : changes.trackData.listTracks) || [];

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

  if (refreshPrintedList || getChange(changes, "trackData.trackNumber").wasChanged) {
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

function toggleLyrics() {
  toggleVisualPreference(findPreference("show-lyrics"));
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
    removeTags(elem);
  }
}

// TODO rework this using a data attr or something
// copy-pasted from the balanceText library because removeTags(el) isn't accessible from the outside
function removeTags(el) {
  [...el.querySelectorAll('br[data-owner="balance-text-hyphen"]')].forEach(br => br.outerHTML = "");
  [...el.querySelectorAll('br[data-owner="balance-text"]')].forEach(br => br.outerHTML = " ");
  [...el.querySelectorAll('span[data-owner="balance-text-softhyphen"]')].forEach(span => {
    const textNode = document.createTextNode("\u00ad");
    span.parentNode.insertBefore(textNode, span);
    span.parentNode.removeChild(span);
  });
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
  "theme",
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
  "session"
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
  return title.replace(/[(|\[](f(ea)?t|with|by|w)\b.+?[)|\]]/ig, "").trim();
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
  if (isPrefEnabled("text-balancing")) {
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
    let spacer = previousAlbum !== trackItem.album;
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
    let imageUrl = getChange(changes, "currentlyPlaying.imageData.imageUrl");
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
  let rgbCss = `rgb(${rgbText.r}, ${rgbText.g}, ${rgbText.b})`;
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
    if (formattedCurrentTime === formattedTotalTime) {
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

function getAllSettings() {
  return [PREFERENCES_DEFAULT.enabled, PREFERENCES_DEFAULT.disabled, PREFERENCES_DEFAULT.ignoreDefaultOn, PREFERENCES_DEFAULT.ignoreDefaultOff].flat();
}

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

  // Developer integrity check
  let allSettings = getAllSettings();
  if (DEV_MODE) {
    if (allSettings.length > [...new Set(allSettings)].length) {
      console.warn("Default settings contain duplicates!");
    }
    let unclassifiedSettings = PREFERENCES
      .map(pref => pref.id)
      .filter(prefId => !allSettings.includes(prefId));
    if (unclassifiedSettings.length > 0) {
      console.warn("The following settings don't have any defaults specified: " + unclassifiedSettings);
    }
  }

  // User integrity check (reset settings after update)
  if (isLocalStorageAvailable()) {
    let storedVersionHash = getVersionHashFromLocalStorage();
    let newVersionHash = calculateVersionHash();
    setVersionHashInLocalStorage(newVersionHash);
    if (!storedVersionHash) {
      showModal("Welcome to SpotifyBigPicture", "Please select a preset to proceed...")
      clearVisualPreferencesInLocalStorage();
    } else if (storedVersionHash !== newVersionHash) {
      showModal(
        "New Version Detected",
        "It looks like you've installed a new version of SpotifyBigPicture. To prevent conflicts arising from the changes in the new version, it is strongly recommended to reset your settings. Reset settings now?",
        () => clearVisualPreferencesInLocalStorage(),
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
    let totalOptionsInCategoryCount = PREFERENCES.filter(pref => pref.category === category).length;
    categoryElemHeader.innerHTML = `${category} <span class="count">${totalOptionsInCategoryCount}</span>`;
    categoryElemHeader.onclick = () => {
      categoryElem.classList.toggle("collapse");
    }
    categoryElem.appendChild(categoryElemHeader);
    settingsWrapper.appendChild(categoryElem);
    categories[category] = categoryElem;
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
    if (PREFERENCES_IGNORED_SETTINGS.includes(pref.id)) {
      prefElem.classList.add("unaffected");
    }

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
      // On first load, apply the default preset and enable the ignoreDefaultOn settings. Then force-open the settings menu
      applyPreset(PREFERENCES_PRESETS.find(preset => preset.id === "preset-default"));
      PREFERENCES_DEFAULT.ignoreDefaultOn.forEach(prefId => {
        setVisualPreferenceFromId(prefId, true);
      });
      requestAnimationFrame(() => {
        setSettingsMenuState(true);
      });
    }
  }

  submitVisualPreferencesToBackend();
}

function submitVisualPreferencesToBackend() {
   let simplifiedPrefs = [...PREFERENCES_PRESETS, ...PREFERENCES]
     .sort((a, b) => PREFERENCES_CATEGORY_ORDER.indexOf(a.category) - PREFERENCES_CATEGORY_ORDER.indexOf(b.category))
     .filter(pref => DEV_MODE || pref.category !== "Developer Tools")
     .map(pref => {
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

function clearVisualPreferencesInLocalStorage() {
  console.warn("Visual preferences have been reset!")
  localStorage.removeItem(LOCAL_STORAGE_KEY_SETTINGS);
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
  let allSettings = getAllSettings();
  return [...allSettings].reduce((totalLength, str) => totalLength + str.length, 0).toString(); // hash is really just the total length of all setting IDs
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
  "play-pause".select().onclick = () => fireControl("PLAY_PAUSE");
  "shuffle".select().onclick = () => fireControl("SHUFFLE");
  "repeat".select().onclick = () => fireControl("REPEAT");
  "prev".select().onclick = () => fireControl("PREV");
  "next".select().onclick = () => fireControl("NEXT");
}

const CONTROL_RESPONSE_DELAY = 100;
let waitingForResponse = false;

function fireControl(control, param) {
  if (!waitingForResponse && isPrefEnabled("playback-control")) {
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
          showModal("Playback Control", "ERROR: Failed to transmit control to backend!");
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
      case 's':
        toggleVisualPreference(findPreference("album-spacers"));
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
  setClass("main".select(), "hide-cursor", !state);
}

function handleMouseEvent(e) {
  clearTimeout(cursorTimeout);
  setMouseVisibility(true)

  if (!modalActive) {
    let mouseMoveButtons = "mouse-move-buttons".select();
    setClass(mouseMoveButtons, "show", true);

    if (!settingsVisible && e.target.parentNode !== mouseMoveButtons && !isHoveringControlElem(e.target)) {
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
    let header = "settings-description-header".select();
    let description = "settings-description-description".select();
    let unaffected = "settings-description-unaffected".select();
    let overridden = "settings-description-overridden".select();

    if (target.parentNode.classList.contains("preset")) {
      target = target.parentNode;
    }
    if (target.classList.contains("setting") || target.classList.contains("preset")) {
      let pref = findPreference(target.id) || findPreset(target.id);
      if (pref) {
        header.innerHTML = (pref.category === "Presets" ? "Preset: " : "") + pref.name;
        description.innerHTML = pref.description;
        unaffected.innerHTML = PREFERENCES_IGNORED_SETTINGS.includes(pref.id) ? "This setting is unaffected by changing presets" : "";

        overridden.innerHTML = [...target.classList]
          .filter(className => className.startsWith("overridden-"))
          .map(className => findPreference(className.replace("overridden-", "")))
          .map(pref => pref.category + " &#x00BB; " + pref.name)
          .join(" // ");

        setDescriptionVisibility(true);
      }
    } else {
      setDescriptionVisibility(false);
    }
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

  let nosleepButton = "nosleep-lock-button".select();
  nosleepButton.onclick = () => {
    toggleNoSleepMode();
  };


  "settings-expert-mode-toggle".select().onclick = () => {
    toggleSettingsExpertMode();
  };

  "settings-reset".select().onclick = () => {
    resetAllSettings();
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
    if (!settingsVisible && !isSettingControlElem(e) && !window.getSelection().toString() && !isHoveringControlElem(e.target)) {
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

const CONTROL_ELEM_IDS = ["prev", "play-pause", "next", "shuffle", "repeat"];

function isHoveringControlElem(target) {
  return target && isPrefEnabled("playback-control") && CONTROL_ELEM_IDS.includes(target.id);
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
  let settingsWrapper = "settings-wrapper".select();
  setClass(settingsWrapper, "expert", settingsExpertMode);
}

function resetAllSettings() {
  showModal("Reset", "Do you really want to reset all settings to their default state?",
    () => {
      [PREFERENCES_DEFAULT.enabled, PREFERENCES_DEFAULT.ignoreDefaultOn].flat().forEach(id => setVisualPreferenceFromId(id, true));
      [PREFERENCES_DEFAULT.disabled, PREFERENCES_DEFAULT.ignoreDefaultOff].flat().forEach(id => setVisualPreferenceFromId(id, false));
      clearLocalStoragePortraitModePresetPromptPreference();
    },
    null,
    "Reset Settings",
    "Cancel");
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

let nosleep = new NoSleep();
let nosleepActive = false;
function toggleNoSleepMode() {
  nosleepActive = !nosleepActive;
  if (nosleepActive) {
    nosleep.enable();
    console.info("No-sleep mode enabled!")
  } else {
    nosleep.disable();
    console.info("No-sleep mode disabled!")
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
  if (isPrefEnabled("show-clock") && !isPrefEnabled("next-track-replacing-clock")) {
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
    setClass(document.body, "modal", true);
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
  setClass(document.body, "modal", false);
}


///////////////////////////////
// FPS Counter
///////////////////////////////

let fps = "fps-counter".select();
let fpsStartTime = Date.now();
let fpsFrame = 0;

function fpsTick() {
  if (isPrefEnabled("show-fps")) {
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
      + "play, pause, next track, previous track, shuffle, repeat. Otherwise, the icons are purely cosmetic",
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
    id: "colored-text",
    name: "Colored Text",
    description: "If enabled, the dominant color of the current artwork will be used as the color for all texts and some symbols. Otherwise, plain white will be used",
    category: "General",
    css: {"main": "!no-colored-text"}
  },
  {
    id: "text-shadows",
    name: "Text Shadows",
    description: "Adds shadows to all texts and symbols",
    category: "General",
    css: {"content": "text-shadows"}
  },
  {
    id: "strip-titles",
    name: "Strip Titles",
    description: "Hides any kind of potentially unnecessary extra information from track tiles and release names "
      + "(such as 'Remastered Version', 'Anniversary Edition', '2023 Re-Release', etc.)",
    category: "General",
    css: {
      "title-extra": "hide",
      "album-title-extra": "hide",
      "track-list": "strip"
    }
  },
  {
    id: "dark-mode",
    name: "Dark Mode (D)",
    description: "Darkens the entire screen by 50%<br>[Hotkey: D]",
    category: "General",
    css: {"dark-overlay": "show"}
  },
  {
    id: "allow-user-select",
    name: "Allow Text Selection",
    description: "If enabled, text on can be selected/copied. Otherwise it's all read-only",
    category: "General",
    css: {"main": "allow-user-select"}
  },
  {
    id: "hide-mouse",
    name: "Hide Mouse Cursor",
    description: "Hides the mouse cursor after a short duration of no movement",
    category: "General",
    css: {"main": "hide-cursor-enabled"}
  },
  {
    id: "hide-top-buttons",
    name: "Hide Top Buttons",
    description: "Hide the settings/keep screen awake icons at the top when moving the mouse. Note: If you disable this, the settings menu can only be accessed by pressing Space!",
    category: "General",
    css: {"mouse-move-buttons": "hide"}
  },

  ///////////////////////////////
  // Lyrics
  {
    id: "show-lyrics",
    name: "Enable Lyrics (L)",
    description: "Searches for and displays the lyrics of the current song from Genius.com<br>[Hotkey: L]",
    category: "Lyrics",
    requiredFor: ["lyrics-simulated-scroll", "lyrics-hide-tracklist", "xl-lyrics", "dim-lyrics", "max-width-lyrics"],
    css: {"lyrics": "!hide"},
    callback: (state) => {
      if (state) {
        refreshLyrics(currentData)
      } else {
        setClass("content-center".select(), "lyrics", false);
      }
    }
  },
  {
    id: "lyrics-simulated-scroll",
    name: "Automatic Scrolling",
    description: "Automatically scrolls the lyrics container as the current song progresses after a short delay (pseudo-synchronization). " +
      "Won't always be flawless, unfortunately",
    category: "Lyrics",
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
    css: {"track-list": "hide-for-lyrics"}
  },
  {
    id: "xl-lyrics",
    name: "XL Lyrics",
    description: "Increases the font size of the lyrics",
    category: "Lyrics",
    css: {"lyrics": "xl"}
  },
  {
    id: "dim-lyrics",
    name: "Dim Lyrics",
    description: "When enabled, dims the opacity down to 65% (same as the tracklist)",
    category: "Lyrics",
    css: {"lyrics": "dim"}
  },
  {
    id: "max-width-lyrics",
    name: "Max Width Lyrics",
    description: "When enabled, the lyrics container is always at 100% width",
    category: "Lyrics",
    css: {"lyrics": "max-width"}
  },

  ///////////////////////////////
  // Tracklist
  {
    id: "show-queue",
    name: "Enable Tracklist",
    description: "If enabled, show the queue/tracklist for playlists and albums. Otherwise, only the current track is displayed",
    category: "Tracklist",
    requiredFor: ["scrollable-track-list", "album-view", "always-show-track-numbers-album-view", "album-spacers", "hide-single-item-album-view", "show-timestamps-track-list",
      "show-featured-artists-track-list", "full-track-list", "increase-min-track-list-scaling", "increase-max-track-list-scaling", "xl-main-info-scrolling", "hide-tracklist-podcast-view"],
    css: {
      "title": "!force-display",
      "track-list": "!hide"
    },
    callback: () => refreshTrackList()
  },
  {
    id: "scrollable-track-list",
    name: "Scrollable Tracklist",
    description: "If enabled, the tracklist can be scrolled through with the mouse wheel. Otherwise it can only scroll on its own",
    category: "Tracklist",
    css: {"track-list": "scrollable"}
  },
  {
    id: "show-featured-artists-track-list",
    name: "Show Featured Artists",
    description: "Display any potential featured artists in the tracklist. Otherwise, only show the song name",
    category: "Tracklist",
    css: {"track-list": "!no-feat"}
  },
  {
    id: "full-track-list",
    name: "Show Full Titles",
    description: "If enabled, longer titles will always be fully displayed (with line breaks). "
      + "Otherwise, the line count will be limited to 1 and overflowing text will be cut off with ellipsis",
    category: "Tracklist",
    css: {"track-list": "no-clamp"}
  },
  {
    id: "show-timestamps-track-list",
    name: "Show Time Stamps",
    description: "Displays the timestamps for each track in the tracklist. If disabled, the track names are right-aligned",
    category: "Tracklist",
    css: {"track-list": "show-timestamps"}
  },
  {
    id: "increase-min-track-list-scaling",
    name: "Increase Minimum Text Scaling Limit",
    description: "If enabled, the minimum font size for the tracklist is drastically increased (factor 3 instead of 2)",
    category: "Tracklist",
    css: {"track-list": "increase-min-scale"}
  },
  {
    id: "increase-max-track-list-scaling",
    name: "Increase Maximum Text Scaling Limit",
    description: "If enabled, the maximum font size for the tracklist is drastically increased (factor 5 instead of 3)",
    category: "Tracklist",
    css: {"track-list": "increase-max-scale"}
  },
  {
    id: "hide-tracklist-podcast-view",
    name: "Hide Tracklist for Podcasts",
    description: "If the currently playing track is a podcast, hides the tracklist. This opens up more room for the episode description",
    category: "Tracklist",
    css: {"track-list": "hide-for-podcasts"}
  },
  {
    id: "album-spacers",
    name: "Margin Between Albums",
    description: "If enabled, after each album in the tracklist, some margin is added to visually separate them. " +
      "This setting is intended to be used for playlists that have multiple albums in chunks<br>[Hotkey: S]",
    category: "Tracklist",
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
    requiredFor: ["always-show-track-numbers-album-view", "hide-single-item-album-view", "xl-main-info-scrolling"],
    callback: () => refreshTrackList()
  },
  {
    id: "hide-single-item-album-view",
    name: "Hide Tracklist for Single Song",
    description: "If 'Album View' is enabled and the current context only has one track (such as a single), don't render the tracklist at all",
    category: "Tracklist",
    callback: () => refreshTrackList()
  },
  {
    id: "always-show-track-numbers-album-view",
    name: "Always Show Everything",
    description: "If 'Album View' is enabled, the track numbers and artists are always displayed as well (four columns). " +
      "Otherwise, track numbers are hidden for playlists and artists are hidden for albums",
    category: "Tracklist",
    css: {"track-list": "always-show-track-numbers-album-view"},
    callback: () => refreshTrackList()
  },

  // Queue View
  {
    id: "queue-big-gradient",
    name: "Large Gradient",
    description: "If enabled and while in queue mode, use a larger gradient that covers the entire tracklist",
    category: "Tracklist",
    subcategoryHeader: "Queue View",
    css: {"track-list": "queue-big-gradient"}
  },

  ///////////////////////////////
  // Artwork
  {
    id: "display-artwork",
    name: "Enable Artwork",
    description: "Whether to display the artwork of the current track or not. If disabled, the layout will be centered",
    category: "Artwork",
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
    css: {"artwork": "shadow"}
  },
  {
    id: "artwork-expand-top",
    name: "Expand Artwork to Top",
    description: "If enabled, expand the artwork to the top content and push that content to the side",
    category: "Artwork",
    css: {"main": "artwork-expand-top"}
  },
  {
    id: "artwork-expand-bottom",
    name: "Expand Artwork to Bottom",
    description: "If enabled, expand the artwork to the bottom content and push that content to the side",
    category: "Artwork",
    css: {"main": "artwork-expand-bottom"}
  },

  ///////////////////////////////
  // Main Content
  {
    id: "enable-center-content",
    name: "Enable Main Content",
    description: "Enable the main content, the container for the current track data",
    category: "Main Content",
    requiredFor: ["show-artists", "show-titles", "strip-titles", "xl-text", "show-release-name", "show-release-date",
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
    requiredFor: ["show-featured-artists"],
    css: {"artists": "!hide"}
  },
  {
    id: "show-featured-artists",
    name: "Show Featured Artists",
    description: "Display any potential featured artists. Otherwise, only show the main artist",
    category: "Main Content",
    css: {"artists": "!no-feat"}
  },
  {
    id: "show-titles",
    name: "Show Titles",
    description: "Displays the title of the currently playing track",
    category: "Main Content",
    css: {"title": "!hide"}
  },
  {
    id: "swap-artist-title",
    name: "Swap Artist with Title",
    description: "If enabled, the artist(s) are displayed underneath the title (this mimics the layout of Spotify's own interface)",
    category: "Main Content",
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
    id: "show-podcast-descriptions",
    name: "Show Podcast Descriptions",
    description: "While listening to a podcast episode, displays the description of that episode underneath the title",
    category: "Main Content",
    css: {"description": "!hide"}
  },
  {
    id: "xl-text",
    name: "XL Main Content",
    description: "If enabled, the font size for the current track's title, artist, and release is doubled. "
      + "This setting is intended to be used with disabled artwork, as there isn't a lot of space available otherwise",
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

  // Release
  {
    id: "show-release-name",
    name: "Show Release Name",
    description: "Displays the release name (e.g. album title)",
    category: "Main Content",
    subcategoryHeader: "Release",
    requiredFor: ["separate-release-line"],
    css: {"album": "!hide-name"}
  },
  {
    id: "show-release-date",
    name: "Show Release Date",
    description: "Displays the release date (usually the year of the currently playing track's album)",
    category: "Main Content",
    requiredFor: ["separate-release-line", "full-release-date"],
    css: {"album": "!hide-date"}
  },
  {
    id: "separate-release-line",
    name: "Release Date on New Line",
    description: "Displays the release date in a new line, rather than right next to the release name",
    category: "Main Content",
    css: {"album": "separate-date"}
  },
  {
    id: "full-release-date",
    name: "Full Release Date",
    description: "If enabled, the whole release date is shown (including month and day). Otherwise, only the year is shown. "
      + "Note that some releases on Spotify only have the year (usually older releases)",
    category: "Main Content",
    requiredFor: ["full-release-date-podcasts"],
    css: {"album-release": "full"}
  },
  {
    id: "full-release-date-podcasts",
    name: "Full Release Date only for Podcasts",
    description: "Limit full release dates to only be displayed for podcasts. Normal songs will continue to only display the year",
    category: "Main Content",
    css: {"album-release": "podcasts-only"}
  },

  ///////////////////////////////
  // Top Content
  {
    id: "enable-top-content",
    name: "Enable Top Content",
    description: "Enable the top content, the container for the context and the Spotify logo. "
      + "Disabling this will increase the available space for the main content",
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
    description: "Displays the playlist/artist/album name along with some additional information",
    category: "Top Content",
    requiredFor: ["show-context-thumbnail", "show-context-summary"],
    css: {"meta-left": "!hide"}
  },
  {
    id: "show-context-summary",
    name: "Context Summary",
    description: "Displays a small summary of the current context (context type, total track count, and total time). "
      + "Do note that total time cannot be displayed for playlists above 200 tracks for performance reasons",
    category: "Top Content",
    css: {"context-extra": "!hide"}
  },
  {
    id: "show-context-thumbnail",
    name: "Context Image",
    description: "Displays a small image (thumbnail) of the current context. "
      + "For playlists, it's the playlist's image and for anything else the artist's thumbnail",
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
    description: "Whether to display the Spotify logo",
    category: "Top Content",
    requiredFor: ["colored-symbol-spotify"],
    css: {"meta-right": "!hide"}
  },
  {
    id: "colored-symbol-spotify",
    name: "Colored Spotify Logo",
    description: "If enabled, the dominant color of the current artwork will be used as the color for the Spotify logo instead of the default Spotify green",
    category: "Top Content",
    css: {"logo": "colored"}
  },

  ///////////////////////////////
  // Bottom Content
  {
    id: "enable-bottom-content",
    name: "Enable Bottom Content",
    description: "Enable the bottom content, the container for the progress bar and various meta information. "
      + "Disabling this will increase the available space for the main content",
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
    id: "show-info-icons",
    name: "Show Play/Pause/Shuffle/Repeat Icons",
    description: "Displays the state icons for play/pause as well as shuffle and repeat. "
      + "This setting is required for the playback controls to work",
    category: "Bottom Content",
    requiredFor: ["playback-control"],
    css: {"info-symbols": "!hide"}
  },
  {
    id: "center-info-icons",
    name: "Center Icons",
    description: "If enabled, the play/pause/shuffle/repeat icons are centered (like it's the case on the default Spotify player). "
      + "Enabling this will disable the clock",
    category: "Bottom Content",
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
    requiredFor: ["show-volume-bar"],
    css: {"volume": "!hide"}
  },
  {
    id: "show-volume-bar",
    name: "Show Volume Bar",
    description: "Displays an additional bar underneath the volume",
    category: "Bottom Content",
    css: {"volume-bar": "!hide"}
  },
  {
    id: "show-device",
    name: "Show Device Name",
    description: "Displays the name of the current playback device",
    category: "Bottom Content",
    css: {"device": "!hide"}
  },

  // Timestamps
  {
    id: "show-timestamps",
    name: "Show Timestamps",
    description: "Displays the current and total timestamps of the currently playing track",
    category: "Bottom Content",
    subcategoryHeader: "Timestamps",
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
    id: "remaining-time-timestamp",
    name: "Replace Current Time with Remaining Time",
    description: "When enabled, the current timestamp of the current track instead displays the remaining time",
    category: "Bottom Content",
    callback: () => updateProgress(currentData)
  },

  // Clock
  {
    id: "show-clock",
    name: "Show Clock",
    description: "Displays the current time",
    category: "Bottom Content",
    subcategoryHeader: "Clock",
    requiredFor: ["clock-full", "clock-24", "next-track-replacing-clock"],
    css: {"clock": "!hide"}
  },
  {
    id: "clock-full",
    name: "Show Full Date in Clock",
    description: "If enabled, the clock displays the full date, weekday, and current time. Otherwise, only displays the current time",
    category: "Bottom Content"
  },
  {
    id: "clock-24",
    name: "Use 24-Hour Format for Clock",
    description: "If enabled, the clock uses the 24-hour format. Otherwise, the 12-hour format",
    category: "Bottom Content"
  },
  {
    id: "next-track-replacing-clock",
    name: "Replace Clock with Next Track",
    description: "If enabled, the clock is replaced by the artist and name of the next track in the queue",
    overrides: ["clock-full", "clock-24"],
    category: "Bottom Content",
    css: {"clock": "next-track"},
    callback: () => refreshCurrentTextData()
  },

  ///////////////////////////////
  // Background
  {
    id: "bg-enable",
    name: "Enable Background",
    description: "Enable the background. Otherwise, plain black will be displayed at all times",
    category: "Background",
    requiredFor: ["bg-artwork", "bg-tint", "bg-gradient", "bg-grain", "bg-blur"],
    css: {"background-canvas": "!hide"}
  },
  {
    id: "bg-artwork",
    name: "Artwork",
    description: "If enabled, uses the release artwork for the background as a darkened version",
    category: "Background",
    requiredFor: ["bg-blur", "bg-fill-screen"],
    css: {"background-canvas": "!color-only"}
  },
  {
    id: "bg-fill-screen",
    name: "Fill Screen",
    description: "If enabled, the artwork is zoomed in to cover the screen. Otherwise, it will be contained within the borders and fill the remaining " +
      "background with a plain color",
    category: "Background",
    css: {"background-canvas-img": "fill-screen"}
  },
  {
    id: "bg-blur",
    name: "Blur",
    description: "Blurs the background. Note that disabling this will result in low-quality background images, as the pictures provided by Spotify are limited to " +
      "a resolution of 640x640",
    category: "Background",
    css: {"background-canvas-img": "!no-blur"}
  },
  {
    id: "bg-zoom",
    name: "Zoom",
    description: "Zooms the background image slightly in (intended to hide darkened edges when the image is blurred)",
    category: "Background",
    css: {"background-canvas": "!no-zoom"}
  },
  {
    id: "bg-gradient",
    name: "Gradient",
    description: "Adds a subtle gradient to the background that gets steadily darker towards the bottom",
    category: "Background",
    css: {"background-canvas-overlay": "!no-gradient"}
  },
  {
    id: "bg-grain",
    name: "Dithering",
    description: "Adds a subtle layer of film grain/noise to the background to increase contrast and prevent color banding for dark images",
    category: "Background",
    css: {"grain": "show"}
  },

  // Overlay Color
  {
    id: "bg-tint",
    name: "Overlay Color",
    description: "Add a subtle layer of one of the artwork's most dominant colors to the background. This helps to increase the contrast between the background and foreground",
    category: "Background",
    subcategoryHeader: "Overlay Color",
    requiredFor: ["bg-tint-dark-compensation", "bg-tint-bright-compensation"],
    css: {"background-canvas-overlay": "!no-tint"}
  },
  {
    id: "bg-tint-dark-compensation",
    name: "Darkness Compensation",
    description: "Increases the overlay color's brightness for very dark artworks",
    category: "Background",
    css: {"background-canvas-overlay": "dark-compensation"}
  },
  {
    id: "bg-tint-bright-compensation",
    name: "Brightness Compensation",
    description: "Decreases the overlay color's brightness for very bright artworks",
    category: "Background",
    css: {"background-canvas-overlay": "bright-compensation"}
  },

  ///////////////////////////////
  // Layout: Main Content
  {
    id: "main-content-centered",
    name: "Center-Align",
    description: "Center the main content (current track information and tracklist). Otherwise, the text will be aligned to the border",
    category: "Layout: Main Content",
    css: {"content-center": "centered"}
  },
  {
    id: "split-main-panels",
    name: "Split Mode",
    description: "Separate the main content from the tracklist and display both in their own panel. "
      + "This setting is intended to be used with disabled artwork, as there isn't a lot of space available otherwise",
    category: "Layout: Main Content",
    css: {"content-center": "split-main-panels"}
  },
  {
    id: "center-lr-margins",
    name: "Left/Right Margins",
    description: "This adds margins to the left and right of the main content. "
      + "This setting has minimum effect if Split Main Content isn't enabled",
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

  ///////////////////////////////
  // Layout: Swap
  {
    id: "artwork-right",
    name: "Swap Main Content",
    description: "If enabled, the main content swaps positions with the artwork",
    category: "Layout: Swap",
    css: {"main": "artwork-right"}
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

  ///////////////////////////////
  // Layout: Experimental
  {
    id: "artwork-above-content",
    name: "Artwork Above Track Info",
    description: "If enabled, the artwork is placed above the track info, rather than next to it. "
      + "Use this setting with caution!",
    category: "Layout: Experimental",
    css: {"main": "artwork-above-content"}
  },
  {
    id: "decreased-margins",
    name: "Decreased Margins",
    description: "If enabled, all margins are halved. " +
      "This allows for more content to be displayed on screen, but will make everything look slightly crammed",
    category: "Layout: Experimental",
    css: {"main": "decreased-margins"},
  },
  {
    id: "extra-wide-mode",
    name: "Extra-wide Mode",
    description: "If enabled, the top and bottom margins will be doubled, resulting in a wider and more compact view",
    category: "Layout: Experimental",
    css: {"content": "extra-wide"},
  },

  ///////////////////////////////
  // Performance
  {
    id: "guess-next-track",
    name: "Guess Next Track",
    description: "If enabled, simulate the transition to the expected next track in the queue before the actual data is returned from Spotify. "
      + "Enabling this will reduce the delay between songs, but it may be inconsistent at times",
    category: "Performance",
    callback: (state) => {
      if (!state) {
        clearTimeout(fakeSongTransition);
      }
    }
  },
  {
    id: "transitions",
    name: "Smooth Transitions",
    description: "Smoothly fade from one track to another. Otherwise, track switches will be displayed instantaneously. "
      + "It is recommended to disable this setting for low-power hardware to save on resources",
    category: "Performance",
    requiredFor: ["slow-transitions"],
    css: {"main": "transitions"}
  },
  {
    id: "slow-transitions",
    name: "Slower Transitions",
    description: "If enabled, the transition speed is halved (increased to 1s, up from 0.5s)",
    category: "Performance",
    css: {"main": "slow-transitions"},
    callback: () => {
      requestAnimationFrame(() => { // to avoid race conditions
        getTransitionFromCss(true);
      });
    }
  },
  {
    id: "smooth-progress-bar",
    name: "Smooth Progress Bar",
    description: "If enabled, the progress bar will get updated smoothly, rather than only once per second. "
      + "It is STRONGLY recommended keep this setting disabled for low-power hardware to save on resources!",
    category: "Performance",
    callback: () => refreshProgress()
  },
  {
    id: "text-balancing",
    name: "Text Balancing",
    description: "If enabled, multiline text is balanced to have roughly the same amount of width per line. Disable this to save on some resources",
    category: "Performance",
    callback: () => refreshTextBalance()
  },
  {
    id: "allow-idle-mode",
    name: "Allow Idle Mode",
    description: "If enabled and no music has been played for the past 60 minutes, the screen will go black to save on resources. "
      + "Once playback resumes, the page will refresh automatically. Recommended for 24/7 hosting of this app",
    category: "Performance",
    callback: () => refreshIdleTimeout(currentData, true)
  },

  ///////////////////////////////
  // Website Title
  {
    id: "current-track-in-website-title",
    name: "Display Current Track in Website Title",
    description: "If enabled, displays the current track's name and artist in the website title. "
      + `Otherwise, only show '${WEBSITE_TITLE_BRANDING}'`,
    category: "Website Title",
    requiredFor: ["track-first-in-website-title", "branding-in-website-title"],
    callback: () => refreshProgress()
  },
  {
    id: "track-first-in-website-title",
    name: "Track Title First",
    description: "Whether to display the track title before the artist name or vice versa",
    category: "Website Title",
    callback: () => refreshProgress()
  },
  {
    id: "branding-in-website-title",
    name: `"${WEBSITE_TITLE_BRANDING}"`,
    description: `If enabled, suffixes the website title with ' | ${WEBSITE_TITLE_BRANDING}'`,
    category: "Website Title",
    callback: () => refreshProgress()
  },

  ///////////////////////////////
  // Developer Tools
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
  "Lyrics",
  "Tracklist",
  "Artwork",
  "Main Content",
  "Top Content",
  "Bottom Content",
  "Background",
  "Layout: Main Content",
  "Layout: Swap",
  "Layout: Experimental",
  "Performance",
  "Website Title",
  "Developer Tools"
];

const PREFERENCES_DEFAULT = {
  enabled: [
    "enable-center-content",
    "show-queue",
    "album-view",
    "queue-big-gradient",
    "hide-tracklist-podcast-view",
    "show-timestamps-track-list",
    "show-podcast-descriptions",
    "display-artwork",
    "artwork-shadow",
    "artwork-expand-top",
    "bg-enable",
    "bg-artwork",
    "bg-blur",
    "bg-fill-screen",
    "bg-zoom",
    "bg-tint",
    "bg-tint-dark-compensation",
    "bg-tint-bright-compensation",
    "bg-gradient",
    "bg-grain",
    "show-artists",
    "show-titles",
    "show-release-name",
    "show-release-date",
    "enable-top-content",
    "enable-bottom-content",
    "main-content-centered",
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
    "show-clock"
  ],
  disabled: [
    "swap-top-bottom",
    "decreased-margins",
    "extra-wide-mode",
    "xl-text",
    "separate-release-line",
    "full-release-date",
    "full-release-date-podcasts",
    "split-main-panels",
    "center-lr-margins",
    "reduced-center-margins",
    "xl-main-info-scrolling",
    "increase-min-track-list-scaling",
    "increase-max-track-list-scaling",
    "swap-top",
    "spread-timestamps",
    "remaining-time-timestamp",
    "reverse-bottom",
    "artwork-expand-bottom",
    "artwork-right",
    "artwork-above-content",
    "swap-artist-title",
    "full-track-list",
    "center-info-icons",
    "next-track-replacing-clock"
  ],
  ignoreDefaultOn: [
    "lyrics-simulated-scroll",
    "colored-text",
    "hide-mouse",
    "transitions",
    "strip-titles",
    "current-track-in-website-title",
    "branding-in-website-title",
    "clock-full",
    "clock-24",
    "text-balancing",
    "hide-single-item-album-view",
    "allow-idle-mode",
    "show-featured-artists",
    "show-featured-artists-track-list",
    "colored-symbol-spotify",
    "prerender-background"
  ],
  ignoreDefaultOff: [
    "show-lyrics",
    "lyrics-hide-tracklist",
    "xl-lyrics",
    "dim-lyrics",
    "max-width-lyrics",
    "text-shadows",
    "guess-next-track",
    "slow-transitions",
    "allow-user-select",
    "track-first-in-website-title",
    "always-show-track-numbers-album-view",
    "album-spacers-in-album-view",
    "smooth-progress-bar",
    "playback-control",
    "scrollable-track-list",
    "colored-symbol-context",
    "dark-mode",
    "hide-top-buttons",
    "show-fps"
  ]
}

const PREFERENCES_IGNORED_SETTINGS = [PREFERENCES_DEFAULT.ignoreDefaultOn, PREFERENCES_DEFAULT.ignoreDefaultOff].flat()

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
      "full-release-date",
      "full-release-date-podcasts"
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
      "next-track-replacing-clock"
    ],
    disabled: [
      "show-queue",
      "show-release-name",
      "show-release-date",
      "show-info-icons",
      "show-device",
      "show-volume",
      "bg-artwork"
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
      "next-track-replacing-clock"
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
      "show-timestamps-track-list"
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
  // Anomaly check for presets
  for (let pref of PREFERENCES_PRESETS) {
    const checkForAnomaly = (enabled, type) => {
      if (PREFERENCES_DEFAULT[type].includes(enabled)) {
        console.warn(`${pref.name}: ${enabled} is already ${type} and included in the default preferences`);
      }
    };
    pref.enabled.forEach((enabled) => {
      checkForAnomaly(enabled, "enabled");
      checkForAnomaly(enabled, "ignoreDefaultOn");
      checkForAnomaly(enabled, "ignoreDefaultOff");
    });
    pref.disabled.forEach((disabled) => {
      checkForAnomaly(disabled, "disabled");
      checkForAnomaly(disabled, "ignoreDefaultOn");
      checkForAnomaly(disabled, "ignoreDefaultOff");
    });
  }
}