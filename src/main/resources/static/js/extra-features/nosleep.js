"nosleep-lock-button".select().onclick = () => {
  toggleNoSleepMode();
};

// noinspection JSUnresolvedFunction
let noSleep = new NoSleep();
let noSleepActive = false;
function toggleNoSleepMode() {
  noSleepActive = !noSleepActive;
  if (noSleepActive) {
    noSleep.enable();
    showToast("No-sleep mode enabled!")
  } else {
    noSleep.disable();
    showToast("No-sleep mode disabled!")
  }
  setClass("nosleep-lock-button".select(), "enabled", noSleepActive);
}

addEventListener("beforeunload", () => {
  noSleep.disable();
});