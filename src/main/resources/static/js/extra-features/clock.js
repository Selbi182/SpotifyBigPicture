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