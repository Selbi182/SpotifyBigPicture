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

const POLLING_INTERVAL_MS = 2 * 1000;
const POLLING_INTERVAL_IDLE_MS = 60 * 1000;
const MAX_POLLING_RETRY_ATTEMPT = 5;
let pollingRetryAttempt = 0;
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