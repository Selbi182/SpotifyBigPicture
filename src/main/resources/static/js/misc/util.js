String.prototype.select = function () {
  return document.getElementById(this);
}

function cloneObject(object) {
  return JSON.parse(JSON.stringify(object));
}

function setClass(elem, className, state) {
  elem.classList.toggle(className, state);
  return elem;
}

function isTabVisible() {
  return document.visibilityState === "visible" || !isPrefEnabled("idle-when-hidden");
}

const BLANK = "BLANK";

let transitionFromCss = null;
function getTransitionFromCss(forceUpdate = false) {
  if (!transitionFromCss || forceUpdate) {
    transitionFromCss = parseFloat(getComputedStyle("main".select()).getPropertyValue("--transition").slice(0, -1)) * 1000;
  }
  return transitionFromCss || 0;
}

///////////////

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
  "ver\.",
  "cover",
  "original",
  "single",
  "ep",
  "motion\\spicture",
  "ost",
  "sound.?track",
  "theme",
  "from",
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
  "session",
  "reprise",
  "re.?mix",
  "edit"
];

function buildUselessWordRegex(words) {
  const joined = words.join("|");
  return new RegExp(
    "\\s(?:" +
    "\\([^)]*?(" + joined + ")[^)]*?\\)|" +
    "\\[[^\\]]*?(" + joined + ")[^\\]]*?\\]|" +
    "-\\s[^-]*?(" + joined + ").*" +
    ")",
    "ig"
  );
}
const USELESS_WORDS_REGEX = buildUselessWordRegex(USELESS_WORDS);
const USELESS_WORDS_REGEX_WITH_WHITELIST = buildUselessWordRegex([...USELESS_WORDS, ...WHITELISTED_WORDS]);

function separateUnimportantTitleInfo(title) {
  const uselessWordRegex = isPrefEnabled("strip-titles-aggressive") ? USELESS_WORDS_REGEX_WITH_WHITELIST : USELESS_WORDS_REGEX;
  let index = title.search(uselessWordRegex);
  if (index >= 0) {
    let mainTitle = title.substring(0, index);
    let extraTitle = title.substring(index, title.length);
    return {
      main: mainTitle,
      extra: extraTitle
    };
  }
  return {
    main: title,
    extra: ""
  };
}

///////////////

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
  return title
    .replace(/[(|\[](f(ea)?t|with|by|w)\b.+?[)|\]]/ig, "")
    .replace(/( feat\. ).+/ig, "") // special case for when the 'feat.' is not placed in brackets
    .trim();
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
  finishAnimations(elem);
  elem.classList.add("transparent", "text-grow");
  finishAnimations(elem);
  elem.classList.remove("transparent", "text-grow");
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

function reloadPage() {
  // noinspection JSCheckFunctionSignatures
  window.location.reload(true); // hard-refresh to bypass cache
}

function refreshAll() {
  refreshBackgroundRender();
  refreshProgress();
  updateScrollGradients();
  submitVisualPreferencesToBackend();
}
