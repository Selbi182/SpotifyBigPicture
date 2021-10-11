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
	// Update properties in local storage
	for (let prop in changes) {
		currentData[prop] = changes[prop];
	}
	
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
	let repeat = document.getElementById("repeat");
	let prevRepeatState = repeat.classList;
	if ('paused' in changes || 'shuffle' in changes || 'repeat' in changes) {
		let paused = changes.paused != null ? changes.paused : currentData.paused;
		let shuffle = changes.shuffle != null ? changes.shuffle : currentData.shuffle;
		let repeat = changes.repeat != null ? changes.repeat : currentData.repeat;

		setClass(document.getElementById("playpause"), "play", !paused);
		showHide(document.getElementById("shuffle"), shuffle, true);
		showHide(document.getElementById("repeat"), repeat != "off", true);
	}
	if ('repeat' in changes) {
		if (changes.repeat == "track") {
			repeat.classList.add("once");
		} else {
			repeat.classList.remove("once");
		}
		if (!prevRepeatState.contains(changes.repeat)) {
			handleAlternateDarkModeToggle();
		}
	}
	
	// Color
	if ('imageColors' in changes) {
		setTextColor(changes.imageColors.primary);
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

// Two regexes for readability, cause otherwise it'd be a nightmare to decypher brackets from hyphens
const USELESS_WORDS_REGEX_BRACKETS = new RegExp("\\s(\\(|\\[).*?(" + USELESS_WORDS.join("|") + ").*?(\\)|\\])", "ig");
const USELESS_WORDS_REGEX_HYPHEN = new RegExp("\\s-\\s.*?(" + USELESS_WORDS.join("|") + ").*", "ig");
const WHITELISTED_WORDS_REGEXP = new RegExp(".*(" + WHITELISTED_WORDS.join("|") + ").*", "ig");

function separateUnimportantTitleInfo(title) {
	if (title.search(WHITELISTED_WORDS_REGEXP) < 0) {
		let index = title.search(USELESS_WORDS_REGEX_BRACKETS);
		if (index < 0)  {
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

function removeFeatures(title) {
	return title.replace(/[\(|\[](f(ea)?t|with).+?[\)|\]]/ig, "").trim();
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
const DEFAULT_IMAGE = 'design/img/idle.png';
const DEFAULT_RGB = {
	r: 255,
	g: 255,
	b: 255
};

function changeImage(changes) {
	return new Promise((resolve, reject) => {
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
					prerenderAndSetArtwork(newImage, colors)
						.then(resolve('Image changed'));
				}
			}
		} else {
			resolve('No new image to load')
		}
	});
}

function prerenderAndSetArtwork(newImage, colors) {
	return new Promise((resolve, reject) => {
		let rgbOverlay = colors.secondary;
		let borderBrightness = colors.borderBrightness;

		let artwork = document.getElementById("artwork-img");
		artwork.src = newImage;
		
		let prerenderCanvas = document.getElementById("prerender-canvas");
		let backgroundCanvasOverlay = document.getElementById("background-canvas-overlay");
		let backgroundCanvasImg = document.getElementById("background-canvas-img");
		backgroundCanvasImg.onload = () => {
			setClass(prerenderCanvas, "show", true);
			let backgroundColorOverlay = `rgb(${rgbOverlay.r}, ${rgbOverlay.g}, ${rgbOverlay.b})`;
			backgroundCanvasOverlay.style.setProperty("--background-color", backgroundColorOverlay);
			backgroundCanvasOverlay.style.setProperty("--background-brightness", borderBrightness);
			
			domtoimage.toPng(prerenderCanvas, { width: window.innerWidth, height: window.innerHeight })
				.then((dataBase64Png) => {
					if (dataBase64Png.length < 10) {
						throw 'Rendered image data is invalid';
					}
					let backgroundImg = document.getElementById("background-img");
					let backgroundCrossfade = document.getElementById("background-img-crossfade");
					setClass(backgroundCrossfade, "skiptransition", true);
					setClass(backgroundCrossfade, "show", true);
					backgroundCrossfade.onload = () => {
						window.requestAnimationFrame(() => {
							backgroundImg.onload = () => {
								setClass(backgroundCrossfade, "skiptransition", false);
								setClass(backgroundCrossfade, "show", false);
								resolve('Image updated');
							};
							backgroundImg.src = dataBase64Png;
						});
					};
					backgroundCrossfade.src = backgroundImg.src ? backgroundImg.src : EMPTY_IMAGE_DATA;
			    })
			    .catch((error) => {
					reject(error);
			    })
				.finally(() => {
					setClass(prerenderCanvas, "show", false);
				});
		};
		backgroundCanvasImg.src = newImage;
	});
}

function refreshArtworkRender() {
	if (currentData.image && currentData.imageColors) {		
		prerenderAndSetArtwork(currentData.image, currentData.imageColors);
	}
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

	let elemTimeCurrent = document.getElementById("time-current");
	elemTimeCurrent.innerHTML = formattedCurrentTime;
	
	let elemTimeTotal = document.getElementById("time-total");	
	if (formattedTotalTime != elemTimeTotal.innerHTML) {
		elemTimeTotal.innerHTML = formattedTotalTime;
	}

	// Progress Bar
	let progressPercent = Math.min(1, ((current / total))) * 100;
	if (isNaN(progressPercent)) {
		progressPercent = 0;
	}
	document.getElementById("progress-current").style.width = progressPercent + "%";
	
	// Title
	let newTitle = "Spotify Big Picture";
	if (!idle && currentData.artists && currentData.title) {
		newTitle = `[${formattedCurrentTime} / ${formattedTotalTime}] ${currentData.artists[0]} - ${removeFeatures(currentData.title)} | ${newTitle}`;
	}
	document.title = newTitle;
}

function formatTime(current, total) {
	let progressBar = document.getElementById("progress");
	
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

const PROGRESS_BAR_UPDATE_MS = 250;
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
const PARAM_CLOCK = "showclock";
const PARAM_BG_ARTWORK = "bgartwork";
const PARAM_STRIP_TITLES = "striptitles";

const SETTINGS_ORDER = [
	PARAM_DARK_MODE,
	PARAM_TRANSITIONS,
	PARAM_COLORED_TEXT,
	PARAM_CLOCK,
	PARAM_BG_ARTWORK,
	PARAM_STRIP_TITLES
];

const DEFAULT_SETTINGS = [
	PARAM_TRANSITIONS,
	PARAM_COLORED_TEXT,
	PARAM_CLOCK,
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
		case PARAM_CLOCK:
			showHide(document.getElementById("clock"), state);
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
		if (!document.fullscreen) {
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

const REFRESH_BACKGROUND_ON_RESIZE_DELAY = 500;
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
		case "a":
			toggleVisualPreference(PARAM_BG_ARTWORK);
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
	setClass(document.querySelector("body"), "hidecursor", false);
	setClass(document.getElementById("settings"), "show", true);
	clearTimeout(cursorTimeout);
	cursorTimeout = setTimeout(() => {
		setClass(document.querySelector("body"), "hidecursor", true);
		setClass(document.getElementById("settings"), "show", false);
	}, MOUSE_MOVE_HIDE_TIMEOUT_MS);
}


///////////////////////////////
// CLOCK
///////////////////////////////

var prevTime;
setInterval(() => {
	let date = new Date();
	let hh = date.getHours();
	let mm = date.getMinutes();
	let time = `${pad2(hh)}:${pad2(mm)}`;
	if (time != prevTime) {
		prevTime = time;
		let clock = document.querySelector("#clock");
		clock.innerHTML = time;
	}
}, 1000);
