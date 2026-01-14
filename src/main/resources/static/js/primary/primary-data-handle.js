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
    let trackCount = getChange(changes, "trackData.trackCount").value;

    // Context type / release year / track count / total duration
    let contextExtra = "context-extra".select();
    let contextType = getChange(changes, "playbackContext.context.contextType");
    let contextTypePrefix = contextType.value;
    if (contextType.value === "QUEUE_IN_ALBUM") {
      contextTypePrefix = "QUEUE"
    } else if (contextType.value === "FAVORITE_TRACKS") {
      contextTypePrefix = "LIKED SONGS";
    } else if (trackCount === 50 && contextType.value === "PLAYLIST" && contextName.value.endsWith(" Radio")) {
      contextTypePrefix = "RADIO";
    }

    // Check if year needs to be displayed
    const validContextTypesForYearDisplay = ["ALBUM", "EP", "SINGLE", "COMPILATION"];
    if (validContextTypesForYearDisplay.includes(contextType.value)) {
      let year = getChange(changes, "currentlyPlaying.releaseDate").value.slice(0, 4);
      contextTypePrefix += `, ${year}`;
    }

    // Format track count
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
  let smartShuffle = getChange(changes, "playbackContext.smartShuffle");
  if (shuffle.wasChanged || smartShuffle.wasChanged) {
    let shuffleElem = "shuffle".select();
    setClass(shuffleElem, "show", shuffle.value || smartShuffle.value);
    setClass(shuffleElem, "on", shuffle.value);
    setClass(shuffleElem, "smart", smartShuffle.value)
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
  let trackData = getChange(changes, "trackData");
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
}

function refreshTextData() {
  let currentDataDuplicate = cloneObject(currentData);
  clearCurrentDataContainer();
  setTextData(currentDataDuplicate);
  setCorrectTracklistView(currentDataDuplicate);
}