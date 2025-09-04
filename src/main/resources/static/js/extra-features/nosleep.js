"nosleep-lock-button".select().onclick = () => {
  toggleNoSleepMode();
};

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