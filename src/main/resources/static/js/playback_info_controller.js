var currentData = {};
var idle = false;


///////////////////////////////
// WEB STUFF
///////////////////////////////

const FLUX_URL = "/playbackinfoflux";
const INFO_URL = "/playbackinfo";
const INFO_URL_FULL = INFO_URL + "?full=true";
const RETRY_TIMEOUT_MS = 5 * 1000;

window.addEventListener('load', init);

function init() {
	console.info("Init");
	singleRequest(true);
	closeFlux();
	startFlux();
	createHeartbeatTimeout();
}

function singleRequest(forceFull) {
	let url = forceFull ? INFO_URL_FULL : INFO_URL;
	fetch(url)
		.then(response => response.json())
		.then(json => processJson(json))
		.catch(ex => {
			console.error("Single request", ex);
			setTimeout(() => singleRequest(forceFull), RETRY_TIMEOUT_MS);
		});
}

var flux;

function startFlux() {
	setTimeout(() => {
		try {
			closeFlux();
			flux = new EventSource(FLUX_URL);
			flux.onopen = () => {
				console.info("Flux connected!");
				singleRequest(true);
			};
			flux.onmessage = (event) => {
				try {
					createHeartbeatTimeout();
					if (idle) {
						singleRequest(true);
					} else {
						let data = event.data;
						let json = JSON.parse(data);
						processJson(json);
					}
				} catch (ex) {
					console.error("Flux onmessage", ex);
					startFlux();
				}
			};
			flux.onerror = (ex) => {
				console.error("Flux onerror", ex);
				startFlux();
			};
		} catch (ex) {
			console.error("Flux creation", ex);
			startFlux();
		}
	}, RETRY_TIMEOUT_MS);
}

function closeFlux() {
	if (flux) {
		flux.close();
	}
}

window.addEventListener('beforeunload', closeFlux);

function processJson(json) {
	if (json.type == "DATA") {
		setDisplayData(json);
		startTimers();
	}
}

const HEARTBEAT_TIMEOUT_MS = 60 * 1000;
var heartbeatTimeout;

function createHeartbeatTimeout() {
	clearTimeout(heartbeatTimeout);
	heartbeatTimeout = setTimeout(() => {
		console.error("Heartbeat timeout")
		init();
	}, HEARTBEAT_TIMEOUT_MS);
}

///////////////////////////////
// MAIN DISPLAY STUFF
///////////////////////////////

async function setDisplayData(changes) {
	console.debug(changes);
	changeImage(changes)
		.then(() => setTextData(changes));
}

function setTextData(changes) {
	// Main Info
	if ('title' in changes && changes.title != currentData.title) {
		let normalizedEmoji = convertToTextEmoji(changes.title);
		let titleNoFeat = removeFeaturedArtists(normalizedEmoji);
		let splitTitle = separateUnimportantTitleInfo(titleNoFeat);
		let titleMain = splitTitle[0];
		let titleExtra = splitTitle[1];
		document.getElementById("title-main").innerHTML = titleMain;
		document.getElementById("title-extra").innerHTML = titleExtra;
		
		fadeIn(document.getElementById("title"));
	}
	
	if ('artists' in changes && JSON.stringify(changes.artists) != JSON.stringify(currentData.artists)) {
		let artists = changes.artists;
		let artistsString = artists[0];
		if (artists.length > 1) {
			let featuredArtists = artists.slice(1).join(" & ");
			artistsString += ` (feat. ${featuredArtists})`;
		}
		let normalizedEmoji = convertToTextEmoji(artistsString);
		document.getElementById("artists").innerHTML = normalizedEmoji;
		
		fadeIn(document.getElementById("artists"));
	}
	
	if (('album' in changes && changes.album != currentData.album) || ('release' in changes && changes.release != currentData.release)) {
		let album = 'album' in changes ? changes.album : currentData.album;
		let normalizedEmoji = convertToTextEmoji(album);
		let splitTitle = separateUnimportantTitleInfo(normalizedEmoji);
		let albumTitleMain = splitTitle[0];
		let albumTitleExtra = splitTitle[1];
		document.getElementById("album-title-main").innerHTML = albumTitleMain;
		document.getElementById("album-title-extra").innerHTML = albumTitleExtra;

		let release = 'release' in changes ? changes.release : currentData.release;
		document.getElementById("album-release").innerHTML = release;
		
		fadeIn(document.getElementById("album"));
	}
	
	if ('description' in changes) {
		let isPodcast = changes.description != "BLANK";
		if (isPodcast) {
			document.getElementById("album-title-main").innerHTML = changes.description;
		}
		setClass(document.getElementById("album"), "podcast", isPodcast);
	}

	// Meta Info
	if ('context' in changes && changes.context != currentData.context) {
		let normalizedEmoji = convertToTextEmoji(changes.context);
		document.getElementById("context").innerHTML = normalizedEmoji;
		fadeIn(document.getElementById("context"));
	}
	
	if ('device' in changes && changes.device != currentData.device) {
		let normalizedEmoji = convertToTextEmoji(changes.device);
		document.getElementById("device").innerHTML = normalizedEmoji;
		fadeIn(document.getElementById("device"));
	}

	// Time
	if ('timeCurrent' in changes || 'timeTotal' in changes) {
		updateProgress(changes, true);
		if ('id' in changes) {
			finishAnimations(document.querySelector("#progress-current"));
		}
	}

	// States
	if ('paused' in changes && changes.paused != currentData.paused) {
		let paused = changes.paused != null ? changes.paused : currentData.paused;
		let pauseElem = document.getElementById("playpause");
		setClass(pauseElem, "play", !paused);
		fadeIn(pauseElem);
	}
	
	if ('shuffle' in changes && changes.shuffle != currentData.shuffle) {
		let shuffle = changes.shuffle != null ? changes.shuffle : currentData.shuffle;
		let shuffleElem = document.getElementById("shuffle");
		showHide(shuffleElem, shuffle, true);
		fadeIn(shuffleElem);
	}
	
	if ('repeat' in changes && changes.repeat != currentData.repeat) {
		let repeat = changes.repeat != null ? changes.repeat : currentData.repeat;
		let repeatElem = document.getElementById("repeat");
		showHide(repeatElem, repeat != "off", true);
		if (changes.repeat == "track") {
			repeatElem.classList.add("once");
		} else {
			repeatElem.classList.remove("once");
		}
		fadeIn(repeatElem);
		handleAlternateDarkModeToggle();
	}
	
	// Color
	if ('imageColors' in changes) {
		setTextColor(changes.imageColors.primary);
	}
	
	// Update properties in local storage
	for (let prop in changes) {
		currentData[prop] = changes[prop];
	}
}

function setClass(elem, className, state) {
	if (state) {
		elem.classList.add(className);
	} else {
		elem.classList.remove(className);
	}
}

function showHide(elem, show, useInvisibility) {
	if (show) {
		elem.classList.remove("invisible");
		elem.classList.remove("hidden");
	} else {
		if (useInvisibility) {
			elem.classList.add("invisible");
			elem.classList.remove("hidden");
		} else {
			elem.classList.add("hidden");
			elem.classList.remove("invisible");
		}
	}
}

const USELESS_WORDS = ["radio", "anniversary", "bonus", "deluxe", "special", "remaster", "explicit", "extended", "expansion", "expanded", "cover", "original", "motion\\spicture", "re.?issue", "re.?record", "\\d{4}"];
const WHITELISTED_WORDS = ["instrumental", "orchestral", "symphonic"];

// Two regexes for readability, cause otherwise it'd be a nightmare to decipher brackets from hyphens
const USELESS_WORDS_REGEX_BRACKETS = new RegExp("\\s(\\(|\\[).*?(" + USELESS_WORDS.join("|") + ").*?(\\)|\\])", "ig");
const USELESS_WORDS_REGEX_HYPHEN = new RegExp("\\s-\\s.*?(" + USELESS_WORDS.join("|") + ").*", "ig");
const WHITELISTED_WORDS_REGEXP = new RegExp(".*(" + WHITELISTED_WORDS.join("|") + ").*", "ig");

function separateUnimportantTitleInfo(title) {
	if (title.search(WHITELISTED_WORDS_REGEXP) < 0) {
		let index = title.search(USELESS_WORDS_REGEX_BRACKETS);
		if (index < 0) {
			index = title.search(USELESS_WORDS_REGEX_HYPHEN);
		}
		if (index >= 0) {
			let mainTitle = title.substring(0, index);
			let extra = title.substring(index, title.length);
			return [mainTitle, extra];
		}
	}
	return [title, ""];
}

function convertToTextEmoji(text) {
	return [...text]
		.map((char) => char.codePointAt() > 127 ? `&#${char.codePointAt()};&#xFE0E;` : char)
		.join('');
}

function removeFeaturedArtists(title) {
	return title.replace(/[\(|\[](f(ea)?t|with).+?[\)|\]]/ig, "").trim();
}

function finishAnimations(elem) {
	elem.getAnimations().forEach(ani => ani.finish());
}

function fadeIn(elem) {
	elem.classList.add("transparent");
	finishAnimations(elem);
	elem.classList.remove("transparent");
}


///////////////////////////////
// IMAGE
///////////////////////////////

const EMPTY_IMAGE_DATA = "https://i.scdn.co/image/ab67616d0000b273f292ec02a050dd8a6174cd4e"; // 640x640 black square
const DEFAULT_IMAGE = 'design/img/idle.png';
const DEFAULT_RGB = {
	r: 255,
	g: 255,
	b: 255
};

function changeImage(changes) {
	return new Promise(async (resolve, reject) => {
		if ('image' in changes || 'imageColors' in changes) {
			if (changes.image == "BLANK") {
				changes.image = DEFAULT_IMAGE;
				changes.imageColors = { primary: DEFAULT_RGB, secondary: DEFAULT_RGB };
			}
			let newImage = changes.image != null ? changes.image : currentData.image;
			let colors = changes.imageColors != null ? changes.imageColors : currentData.imageColors;
			if (newImage) {
				let oldImage = document.getElementById("artwork-img").src;
				if (!oldImage.includes(newImage)) {
					await prerenderAndSetArtwork(newImage, colors);
				}
			}
		}
		resolve();
	});
}

function prerenderAndSetArtwork(newImage, colors) {
	return new Promise((resolve, reject) => {
		loadBackground(newImage, colors)
			.then(() => renderAndShow())
			.then(() => loadArtwork(newImage))
			.then(resolve);
	});
}


function loadArtwork(newImage) {
	return new Promise((resolve, reject) => {
		let artwork = document.getElementById("artwork-img");
		setClass(artwork, "transparent", true);
		finishAnimations(artwork);
		artwork.onload = () => {
			setClass(artwork, "transparent", false);
			resolve();
		}
		artwork.src = newImage;
	});
}


function loadBackground(newImage, colors) {
	return new Promise((resolve, reject) => {
		let backgroundCanvasImg = document.getElementById("background-canvas-img");
		backgroundCanvasImg.onload = () => {
			let rgbOverlay = colors.secondary;
			let averageBrightness = colors.averageBrightness;
			let prerenderCanvas = document.getElementById("prerender-canvas");
			let backgroundCanvasOverlay = document.getElementById("background-canvas-overlay");

			setClass(prerenderCanvas, "show", true);
			let backgroundColorOverlay = `rgb(${rgbOverlay.r}, ${rgbOverlay.g}, ${rgbOverlay.b})`;
			backgroundCanvasOverlay.style.setProperty("--background-color", backgroundColorOverlay);
			backgroundCanvasOverlay.style.setProperty("--background-brightness", averageBrightness);
			setClass(backgroundCanvasOverlay, "boost", averageBrightness < 0.2);
			setClass(backgroundCanvasOverlay, "soften", averageBrightness > 0.7);
			resolve();
		};
		backgroundCanvasImg.src = newImage;
	});
}

function renderAndShow() {
	return new Promise((resolve, reject) => {
		let backgroundImg = document.getElementById("background-img");
		let backgroundCrossfade = document.getElementById("background-img-crossfade");
		let prerenderCanvas = document.getElementById("prerender-canvas");

		// While PNG produces the by far largest Base64 image data, the actual conversion process
		// is significantly faster than with JPEG or SVG (still not perfect though)
		domtoimage.toPng(prerenderCanvas, { width: window.innerWidth / 2.0, height: window.innerHeight / 2.0 })
			.then((imgDataBase64) => {
				if (imgDataBase64.length < 10) {
					throw 'Rendered image data is invalid';
				}
				setClass(backgroundCrossfade, "show", true);
				backgroundCrossfade.src = backgroundImg.src ? backgroundImg.src : EMPTY_IMAGE_DATA;
				backgroundCrossfade.onload = () => {
					finishAnimations(backgroundCrossfade);
					backgroundImg.onload = () => {
						setClass(backgroundCrossfade, "show", false);
						resolve();
					};
					backgroundImg.src = imgDataBase64;
				};
			})
			.catch((error) => reject(error))
			.finally(() => setClass(prerenderCanvas, "show", false));
	});
}

function refreshArtworkRender() {
	if (currentData.image && currentData.imageColors && visualPreferences[PARAM_PRERENDER]) {
		prerenderAndSetArtwork(currentData.image, currentData.imageColors);
	}
}

function setTextColor(rgbText) {
	document.documentElement.style.setProperty("--color", `rgb(${rgbText.r}, ${rgbText.g}, ${rgbText.b})`);
}

function extractUrl(url) {
	return url.slice(4, -1).replace(/"/g, "");
}

function makeUrl(url) {
	return `url(${url})`;
}


///////////////////////////////
// PROGRESS
///////////////////////////////

function updateProgress(changes, updateProgressBar) {
	let current = 'timeCurrent' in changes ? changes.timeCurrent : currentData.timeCurrent;
	let total = 'timeTotal' in changes ? changes.timeTotal : currentData.timeTotal;

	// Text
	let formattedTimes = formatTime(current, total)
	let formattedCurrentTime = formattedTimes.current;
	let formattedTotalTime = formattedTimes.total;

	let elemTimeCurrent = document.getElementById("time-current");
	elemTimeCurrent.innerHTML = formattedCurrentTime;
	
	let elemTimeTotal = document.getElementById("time-total");	
	if (formattedTotalTime != elemTimeTotal.innerHTML) {
		elemTimeTotal.innerHTML = formattedTotalTime;
	}
	
	// Title
	let newTitle = "Spotify Big Picture";
	if (!idle && currentData.artists && currentData.title) {
		newTitle = `[${formattedCurrentTime} / ${formattedTotalTime}] ${currentData.artists[0]} - ${removeFeaturedArtists(currentData.title)} | ${newTitle}`;
	}
	document.title = newTitle;
	
	// Progress Bar
	if (updateProgressBar) {
		setProgressBarTarget(current, total);
	}
}

function setProgressBarTarget(current, total) {
	let progressBarElem = document.getElementById("progress-current");
	
	let progressPercent = Math.min(1, ((current / total))) * 100;
	if (isNaN(progressPercent)) {
		progressPercent = 0;
	}
	progressBarElem.style.width = progressPercent + "%";
	finishAnimations(progressBarElem);
	
	let remainingTimeMs = total - current;
	progressBarElem.style.setProperty("--progress-speed", remainingTimeMs + "ms");
	requestAnimationFrame(() => {
		progressBarElem.style.width = "100%";
	});
}

function formatTime(current, total) {	
	let currentHMS = calcHMS(current);
	let totalHMS = calcHMS(total);

	let formattedCurrent = `${pad2(currentHMS.seconds)}`;
	let formattedTotal = `${pad2(totalHMS.seconds)}`;
	if (totalHMS.minutes >= 10 || totalHMS.hours >= 1) {
		formattedCurrent = `${pad2(currentHMS.minutes)}:${formattedCurrent}`;
		formattedTotal = `${pad2(totalHMS.minutes)}:${formattedTotal}`;
		if (totalHMS.hours > 0) {
			formattedCurrent = `${currentHMS.hours}:${formattedCurrent}`;
			formattedTotal = `${totalHMS.hours}:${formattedTotal}`;
		} 
	} else {
		formattedCurrent = `${currentHMS.minutes}:${formattedCurrent}`;
		formattedTotal = `${totalHMS.minutes}:${formattedTotal}`;
	}

	return {
		current: formattedCurrent,
		total: formattedTotal
	};
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

function pad2(time) {
	return time.toString().padStart(2, '0');
}


///////////////////////////////
// TIMERS
///////////////////////////////

const ADVANCE_CURRENT_TIME_MS = 1000;
const IDLE_TIMEOUT_MS = 1 * 60 * 60 * 1000;
const REQUEST_ON_SONG_END_MS = 200;

var autoTimer;
var idleTimeout;
var postSongEndRequestCount = 0;


function startTimers() {
	clearTimers();

	startTime = Date.now();
	autoTimer = setInterval(() => advanceCurrentTime(), ADVANCE_CURRENT_TIME_MS);

	idleTimeout = setTimeout(() => setIdle(), IDLE_TIMEOUT_MS);
	this.idle = false;
	showHide(document.body, true);
}

function clearTimers() {
	clearInterval(autoTimer);
	clearTimeout(idleTimeout);
}

var startTime;
function advanceCurrentTime() {
	if (currentData != null && currentData.timeCurrent != null && !currentData.paused) {
		let now = Date.now();
		let elapsedTime = now - startTime;
		startTime = now;
		let newTime = currentData.timeCurrent + elapsedTime;
		if (newTime > currentData.timeTotal && currentData.timeCurrent < currentData.timeTotal) {
			setTimeout(() => singleRequest(false), REQUEST_ON_SONG_END_MS);
		}
		currentData.timeCurrent = Math.min(currentData.timeTotal, newTime);
		updateProgress(currentData, false);
	}
}

function setIdle() {
	if (!idle) {
		this.idle = true;
		clearTimers();
		showHide(document.body, false);
		this.currentData = {};
	}
}


///////////////////////////////
// VISUAL PREFERENCES
///////////////////////////////

const PARAM_DARK_MODE = "darkmode";
const PARAM_TRANSITIONS = "transitions";
const PARAM_COLORED_TEXT = "coloredtext";
const PARAM_CLOCK = "showclock";
const PARAM_BG_ARTWORK = "bgartwork";
const PARAM_PRERENDER = "prerender";
const PARAM_STRIP_TITLES = "striptitles";

const SETTINGS_ORDER = [
	PARAM_DARK_MODE,
	PARAM_TRANSITIONS,
	PARAM_COLORED_TEXT,
	PARAM_CLOCK,
	PARAM_BG_ARTWORK,
	PARAM_PRERENDER,
	PARAM_STRIP_TITLES
];

const DEFAULT_SETTINGS = [
	PARAM_TRANSITIONS,
	PARAM_COLORED_TEXT,
	PARAM_CLOCK,
	PARAM_BG_ARTWORK,
	PARAM_PRERENDER,
	PARAM_STRIP_TITLES
];

const PREFS_URL_PARAM = "prefs";

// Settings with defaults
var visualPreferences = {};

window.addEventListener('load', initVisualPreferencesFromUrlParams);
function initVisualPreferencesFromUrlParams() {
	const urlParams = new URLSearchParams(window.location.search);
	let prefs = urlParams.get(PREFS_URL_PARAM);
	for (let prefIndex in SETTINGS_ORDER) {
		let pref = SETTINGS_ORDER[prefIndex];
		
		// Set state on site load
		let state = DEFAULT_SETTINGS.includes(pref);
		if (prefs) {
			let fromSettings = !!parseInt(prefs[parseInt(prefIndex)]);
			state = fromSettings;
		}
		visualPreferences[pref] = state;
		
		// Attach event listener when clicking it
		document.getElementById(pref).firstChild.onclick = () => toggleVisualPreference(pref);
		
		// Init setting
		refreshPreference(pref, state);
	}	
	document.querySelector("#fullscreen > a").onclick = toggleFullscreen;
	
	refreshPrefsQueryParam();
}

function refreshPrefsQueryParam() {
	var prefsString = "";
	for (let pref of SETTINGS_ORDER) {
		let prefBool = visualPreferences[pref] ? "1" : "0";
		prefsString += prefBool;
	}
	
	const url = new URL(window.location);
	url.searchParams.set(PREFS_URL_PARAM, prefsString);
	window.history.replaceState({}, 'Spotify Big Picture', url.toString());
}

function toggleVisualPreference(key) {
	if (visualPreferences.hasOwnProperty(key)) {
		let newState = !visualPreferences[key];
		refreshPreference(key, newState);
		refreshPrefsQueryParam();
	}
}

var darkModeTimeout;
const DARK_MODE_AUTOMATIC_DISABLE_TIMEOUT = 8 * 60 * 60 * 1000;

function refreshPreference(preference, state) {
	visualPreferences[preference] = state;

	// Refresh Preference
	switch (preference) {
		case PARAM_DARK_MODE:
			setClass(document.getElementById("dark-overlay"), "show", state);
			clearTimeout(darkModeTimeout);
			if (state) {
				darkModeTimeout = setTimeout(() => {
					refreshPreference(PARAM_DARK_MODE, false);
					refreshPrefsQueryParam();
				}, DARK_MODE_AUTOMATIC_DISABLE_TIMEOUT);
			}
			break;
		case PARAM_TRANSITIONS:
			setTransitions(state);
			break;
		case PARAM_BG_ARTWORK:
			setClass(document.getElementById("background-canvas-img"), "coloronly", !state);
			refreshArtworkRender();
			break;
		case PARAM_PRERENDER:
			showHide(document.getElementById("background-rendered"), state);
			setClass(document.getElementById("prerender-canvas"), "noprerender", !state);
			break;
		case PARAM_CLOCK:
			setClass(document.getElementById("clock"), "hide", !state);
			break;
		case PARAM_COLORED_TEXT:
			setClass(document.body, "nocoloredtext", !state);
			break;
		case PARAM_STRIP_TITLES:
			setClass(document.getElementById("title-extra"), "hide", state);
			setClass(document.getElementById("album-title-extra"), "hide", state);
			break;
	}
	
	// Toggle Checkmark
	let classList = document.getElementById(preference).classList;
	if (state) {
		classList.add("preference-on");
	} else {
		classList.remove("preference-on");
	}
}

function setTransitions(state) {
	setClass(document.body, "transition", state);
	showHide(document.getElementById("background-img-crossfade"), state, true);
}

function toggleFullscreen() {
	if (document.fullscreenEnabled) {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen();
		} else {
			document.exitFullscreen();
		}
	}
}

const TOGGLE_DARK_MODE_COUNT = 3;
var toggleDarkModeCount = 0;
var toggleDarkModeTimeout;
function handleAlternateDarkModeToggle() {
	clearTimeout(toggleDarkModeTimeout);
	toggleDarkModeCount++;
	if (toggleDarkModeCount >= TOGGLE_DARK_MODE_COUNT) {
		toggleVisualPreference(PARAM_DARK_MODE);
		toggleDarkModeCount = 0;
	} else {
		toggleDarkModeTimeout = setTimeout(() => toggleDarkModeCount = 0, TOGGLE_DARK_MODE_COUNT * 1000 * 2);
	}
}


///////////////////////////////
// REFRESH IMAGE ON RESIZE
///////////////////////////////

const REFRESH_BACKGROUND_ON_RESIZE_DELAY = 1000;
var refreshBackgroundEvent;
window.onresize = () => {
	clearTimeout(refreshBackgroundEvent);
	refreshBackgroundEvent = setTimeout(() => {
		refreshArtworkRender();
	}, REFRESH_BACKGROUND_ON_RESIZE_DELAY);
};

///////////////////////////////
// HOTKEYS
///////////////////////////////

document.onkeydown = (e) => {
	switch (e.key) {
		case "d":
			toggleVisualPreference(PARAM_DARK_MODE);
			break;
		case "t":
			toggleVisualPreference(PARAM_TRANSITIONS);
			break;
		case "c":
			toggleVisualPreference(PARAM_COLORED_TEXT);
			break;
		case "w":
			toggleVisualPreference(PARAM_CLOCK);
			break;
		case "b":
			toggleVisualPreference(PARAM_BG_ARTWORK);
			break;
		case "p":
			toggleVisualPreference(PARAM_PRERENDER);
			break;
		case "s":
			toggleVisualPreference(PARAM_STRIP_TITLES);
			break;
		case "f":
			toggleFullscreen();
			break;
	}
};


///////////////////////////////
// MOUSE HIDE
///////////////////////////////

document.addEventListener("mousemove", handleMouseEvent);
document.addEventListener("click", handleMouseEvent);
var cursorTimeout;
const MOUSE_MOVE_HIDE_TIMEOUT_MS = 1000;
function handleMouseEvent() {
	setClass(document.querySelector("html"), "hidecursor", false);
	setClass(document.getElementById("settings"), "show", true);
	clearTimeout(cursorTimeout);
	cursorTimeout = setTimeout(() => {
		setClass(document.querySelector("html"), "hidecursor", true);
		setClass(document.getElementById("settings"), "show", false);
	}, MOUSE_MOVE_HIDE_TIMEOUT_MS);
}


///////////////////////////////
// CLOCK
///////////////////////////////

const DATE_OPTIONS = {
	weekday: 'short',
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
  hourCycle: 'h23'
};
var prevTime;
setInterval(() => {
	let date = new Date();
	let time = date.toLocaleDateString('en-UK', DATE_OPTIONS);
	if (time != prevTime) {
		prevTime = time;
		let clock = document.querySelector("#clock");
		clock.innerHTML = time;
	}
}, 1000);
