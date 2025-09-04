let idle = false;

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

document.addEventListener("visibilitychange", () => {
  if (isTabVisible()) {
    startPollingLoop();
  } else {
    markWebsiteTitleAsIdle();
  }
});