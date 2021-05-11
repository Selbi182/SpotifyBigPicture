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
			flux.onopen = () => console.info("Flux connected!");
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
		for (let prop in json) {
			currentData[prop] = json[prop];
		}
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
	changeImage(changes);
	setTextData(changes);
}

function setTextData(changes) {
	// Main Info
	if ('title' in changes) {
		let titleNoFeat = removeFeatures(changes.title);
		let splitTitle = separateUnimportantTitleInfo(titleNoFeat);
		let titleMain = splitTitle[0];
		let titleExtra = splitTitle[1];
		document.getElementById("title-main").innerHTML = titleMain;
		document.getElementById("title-extra").innerHTML = titleExtra;
	}
	if ('artists' in changes) {
		updateArtists(changes.artists);
	}
	if ('album' in changes || 'release' in changes) {
		let album = 'album' in changes ? changes.album : currentData.album;
		let splitTitle = separateUnimportantTitleInfo(album);
		let albumTitleMain = splitTitle[0];
		let albumTitleExtra = splitTitle[1];
		document.getElementById("album-title-main").innerHTML = albumTitleMain;
		document.getElementById("album-title-extra").innerHTML = albumTitleExtra;

		let release = 'release' in changes ? changes.release : currentData.release;
		document.getElementById("album-release").innerHTML = release;
	}

	// Meta Info
	if ('context' in changes) {
		document.getElementById("context").innerHTML = changes.context;
	}
	if ('device' in changes) {
		document.getElementById("device").innerHTML = changes.device;
	}

	// Time
	if ('timeCurrent' in changes || 'timeTotal' in changes) {
		updateProgress(changes);
	}

	// States
	if ('paused' in changes || 'shuffle' in changes || 'repeat' in changes) {
		let paused = changes.paused != null ? changes.paused : currentData.paused;
		let shuffle = changes.shuffle != null ? changes.shuffle : currentData.shuffle;
		let repeat = changes.repeat != null ? changes.repeat : currentData.repeat;

		setClass(document.getElementById("playpause"), "play", !paused);
		setClass(document.getElementById("playpause"), "pause", paused);
		showHide(document.getElementById("shuffle"), shuffle, false);
		showHide(document.getElementById("repeat"), repeat != "off", false);
	}
	if ('repeat' in changes) {
		let repeat = document.getElementById("repeat");
		if (changes.repeat == "track") {
			repeat.classList.add("once");
		} else {
			repeat.classList.remove("once");
		}
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

function separateUnimportantTitleInfo(title) {
	let index = title.search(/\s?(\(|\[|\s\-\s).*?(radio|edit|anniversary|bonus|deluxe|special|remaster|extended|re.?issue|\d{4}).*/ig);
	if (index < 0) {
		return [title, ""];
	} else {
		let mainTitle = title.substring(0, index);
		let extra = title.substring(index, title.length);
		return [mainTitle, extra];
	}
}

function removeFeatures(title) {
	return title.replace(/[\(|\[]feat.+?[\)|\]]/g, "").trim();
}

function updateArtists(artists) {
	let artistsString = artists[0];
	if (artists.length > 1) {
		let featuredArtists = artists.slice(1).join(" & ");
		artistsString += ` (feat. ${featuredArtists})`;
	}
	document.getElementById("artists").innerHTML = artistsString;
}


///////////////////////////////
// IMAGE
///////////////////////////////

const EMPTY_IMAGE_DATA = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const DEFAULT_IMAGE = 'img/idle.png';
const DEFAULT_RGB = {
	r: 255,
	g: 255,
	b: 255
};

var preloadImg;
var fadeOutTimeout;

async function changeImage(changes, colors) {
	if ('image' in changes || 'imageColors' in changes) {
		if (changes.image == "BLANK") {
			changes.image = DEFAULT_IMAGE;
			changes.imageColors = {primary: DEFAULT_RGB, secondary: DEFAULT_RGB};
		}
		let newImage = changes.image != null ? changes.image : currentData.image;
		let colors = changes.imageColors != null ? changes.imageColors : currentData.imageColors;
		if (newImage) {
			let oldImage = document.getElementById("artwork-img").src;
			if (!oldImage.includes(newImage)) {
				clearTimeout(fadeOutTimeout);
		
				let artworkUrl = artwork.src;
				let rgbOverlay = colors.secondary;
		
				const promiseArtwork = setMainArtwork(oldImage, newImage, rgbOverlay);
				const promiseBackground = setBackgroundArtwork(oldImage, newImage, rgbOverlay);
				const promiseColor = setTextColor(colors.primary);
				await Promise.all([promiseArtwork, promiseBackground, promiseColor]);
			}
		}
	}
}

function setMainArtwork(oldImage, newImage, rgbGlow) {
	let artwork = document.getElementById("artwork-img");
	let artworkCrossfade = document.getElementById("artwork-img-crossfade");
	setArtworkVisibility(false);
	artworkCrossfade.onload = () => {
		setClass(artworkCrossfade, "skiptransition", true);
		window.requestAnimationFrame(() => {
			setClass(artworkCrossfade, "show", true);
			artwork.onload = () => {
				let brightness = calculateBrightness(rgbGlow);
				let glowAlpha = (1 - (brightness * 0.8)) / 2;
				let glow = `var(--artwork-shadow) rgba(${rgbGlow.r}, ${rgbGlow.g}, ${rgbGlow.b}, ${glowAlpha})`;
				artwork.style.boxShadow = glow;
				setArtworkVisibility(true);
			};
			artwork.src = newImage;
		});
	};
	artworkCrossfade.src = oldImage ? oldImage : EMPTY_IMAGE_DATA;
}

function setBackgroundArtwork(oldImage, newImage, rgbOverlay) {
	let backgroundWrapper = document.getElementById("background");
	let backgroundOverlay = document.getElementById("background-overlay");
	let backgroundImg = document.getElementById("background-img");
	let backgroundCrossfade = document.getElementById("background-img-crossfade");
	backgroundCrossfade.onload = () => {
		setClass(backgroundCrossfade, "skiptransition", true);
		window.requestAnimationFrame(() => {
			setClass(backgroundCrossfade, "show", true);
			backgroundImg.onload = () => {
				backgroundWrapper.style.setProperty("background-color", `rgb(${rgbOverlay.r}, ${rgbOverlay.g}, ${rgbOverlay.b})`);
				let brightness = calculateBrightness(rgbOverlay);
				let backgroundColorOverlay = `rgba(${rgbOverlay.r}, ${rgbOverlay.g}, ${rgbOverlay.b}, ${brightness})`;
				backgroundOverlay.style.setProperty("--background-overlay-color", backgroundColorOverlay);
				setClass(backgroundCrossfade, "skiptransition", false);
				setClass(backgroundCrossfade, "show", false);
			};
			backgroundImg.src = newImage;
		});
	};
	backgroundCrossfade.src = oldImage ? oldImage : EMPTY_IMAGE_DATA;
}

function setArtworkVisibility(state) {
	setClass(document.getElementById("artwork-img-crossfade"), "skiptransition", !state);
	setClass(document.getElementById("artwork-img-crossfade"), "show", !state);
}

function setTextColor(rgbText) {
	document.documentElement.style.setProperty("--color", `rgb(${rgbText.r}, ${rgbText.g}, ${rgbText.b})`);
}

function calculateBrightness(rgb) {
	// Very rough brightness calculation based on the HSP Color Model
	// Taken from: http://alienryderflex.com/hsp.html
	return Math.sqrt(0.299 * Math.pow(rgb.r, 2) + 0.587 * Math.pow(rgb.g, 2) + 0.114 * Math.pow(rgb.b, 2)) / 255;
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

function updateProgress(changes) {
	let current = 'timeCurrent' in changes ? changes.timeCurrent : currentData.timeCurrent;
	let total = 'timeTotal' in changes ? changes.timeTotal : currentData.timeTotal;

	// Text
	let formattedTimes = formatTime(current, total)
	let formattedCurrentTime = formattedTimes.current;
	let formattedTotalTime = formattedTimes.total;

	document.getElementById("time-current").innerHTML = formattedCurrentTime;
	if (total != currentData.timeTotal) {
		document.getElementById("time-total").innerHTML = formattedTotalTime;
	}

	// Progress Bar
	let progressPercent = Math.min(1, ((current / total))) * 100;
	if (isNaN(progressPercent)) {
		progressPercent = 0;
	}
	document.getElementById("progress-current").style.width = progressPercent + "%";
	
	// Title
	if (idle || !currentData.artists || !currentData.title) {
		document.title = "Spotify Playback Info";
	} else {
		document.title = `[${formattedCurrentTime} / ${formattedTotalTime}] ${currentData.artists[0]} - ${removeFeatures(currentData.title)}`;
	}
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

const PROGRESS_BAR_UPDATE_MS = 500;
const IDLE_TIMEOUT_MS = 1 * 60 * 60 * 1000;
const REQUEST_ON_SONG_END_MS = 200;
const MAX_POST_SONG_END_AUTO_REQUEST_COUNT = 4;

var autoTimer;
var idleTimeout;
var postSongEndRequestCount = 0;

function startTimers() {
	clearTimers();

	startTime = Date.now();
	autoTimer = setInterval(() => advanceProgressBar(), PROGRESS_BAR_UPDATE_MS);

	idleTimeout = setTimeout(() => setIdle(), IDLE_TIMEOUT_MS);
	this.idle = false;
	showHide(document.body, true);
}

function clearTimers() {
	clearInterval(autoTimer);
	clearTimeout(idleTimeout);
}

var startTime;
function advanceProgressBar() {
	if (currentData != null && currentData.timeCurrent != null && !currentData.paused) {
		let now = Date.now();
		let ellapsedTime = now - startTime;
		startTime = now;
		let newTime = currentData.timeCurrent + ellapsedTime;
		if (newTime > currentData.timeTotal) {
			postSongEndRequestCount++;
			if (postSongEndRequestCount > MAX_POST_SONG_END_AUTO_REQUEST_COUNT) {
				singleRequest(true);
			} else if (currentData.timeCurrent < currentData.timeTotal) {
				setTimeout(() => singleRequest(false), REQUEST_ON_SONG_END_MS);
			}
			newTime = currentData.timeTotal;
		} else {
			postSongEndRequestCount = 0;
		}
		currentData.timeCurrent = newTime;
		updateProgress(currentData);
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
const PARAM_ARTWORK_GLOW = "artworkglow";
const PARAM_BG_ARTWORK = "bgartwork";
const PARAM_STRIP_TITLES = "striptitles";

const SETTINGS_ORDER = [
	PARAM_DARK_MODE,
	PARAM_TRANSITIONS,
	PARAM_COLORED_TEXT,
	PARAM_ARTWORK_GLOW,
	PARAM_BG_ARTWORK,
	PARAM_STRIP_TITLES
];

const DEFAULT_SETTINGS = [
	PARAM_TRANSITIONS,
	PARAM_COLORED_TEXT,
	PARAM_ARTWORK_GLOW,
	PARAM_BG_ARTWORK,
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
	window.history.replaceState({}, 'Spotify Playback Info', url.toString());
}

function toggleVisualPreference(key) {
	if (visualPreferences.hasOwnProperty(key)) {
		let newState = !visualPreferences[key];
		refreshPreference(key, newState);
		refreshPrefsQueryParam();
	}
}

var darkModeTimeout;
const DARK_MODE_AUTOMATIC_DISABLE_TIMEOUT = 6 * 60 * 60 * 1000;

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
			setClass(document.getElementById("background"), "coloronly", !state);
			break;
		case PARAM_ARTWORK_GLOW:
			setClass(document.getElementById("artwork-img"), "noshadow", !state);
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
	showHide(document.getElementById("artwork-img-crossfade"), state, true);
	showHide(document.getElementById("background-img-crossfade"), state, true);
}

function toggleFullscreen() {
	if (document.fullscreenEnabled) {
		if (!document.fullscreen) {
			document.documentElement.requestFullscreen();
		} else {
			document.exitFullscreen();
		}
	}
}

///////////////////////////////
// HOTKEYS
///////////////////////////////

document.onkeydown = (e) => {
	switch (e.key) {
		case "f":
			toggleFullscreen();
			break;
		case "d":
			toggleVisualPreference(PARAM_DARK_MODE);
			break;
		case "t":
			toggleVisualPreference(PARAM_TRANSITIONS);
			break;
		case "a":
			toggleVisualPreference(PARAM_BG_ARTWORK);
			break;
		case "g":
			toggleVisualPreference(PARAM_ARTWORK_GLOW);
			break;
		case "s":
			toggleVisualPreference(PARAM_STRIP_TITLES);
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
	setClass(document.querySelector("body"), "hidecursor", false);
	setClass(document.getElementById("settings"), "show", true);
	clearTimeout(cursorTimeout);
	cursorTimeout = setTimeout(() => {
		setClass(document.querySelector("body"), "hidecursor", true);
		setClass(document.getElementById("settings"), "show", false);
	}, MOUSE_MOVE_HIDE_TIMEOUT_MS);
}
