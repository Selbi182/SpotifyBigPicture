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