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
  if (formattedCurrentTime === formattedTotalTime && !isPrefEnabled("smooth-progress-bar")) {
    // Snap to maximum on the last second
    current = total;
  }
  setProgressBarTarget(current, total, paused);
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

window.addEventListener('load', recursiveProgressRefresh);
function recursiveProgressRefresh() {
  refreshProgress();
  if (!idle) {
    const delay = isPrefEnabled("smooth-progress-bar") ? 0 : 100;
    setTimeout(recursiveProgressRefresh, delay);
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