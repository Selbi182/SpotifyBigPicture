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