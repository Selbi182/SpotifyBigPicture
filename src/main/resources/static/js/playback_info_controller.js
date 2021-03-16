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
	} else if (json.type == "IDLE") {
		setIdle();
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

function setDisplayData(changes) {
	console.debug(changes);

	// Main Info
	if ('title' in changes) {
		document.getElementById("title").innerHTML = removeFeatures(changes.title);
	}
	if ('artists' in changes) {
		updateArtists(changes.artists);
	}
	if ('album' in changes || 'release' in changes) {
		let album = 'album' in changes ? changes.album : currentData.album;
		let release = 'release' in changes ? changes.release : currentData.release;
		if (release && release.length > 0) {
			release = "(" + release + ")";
		}
		document.getElementById("album").innerHTML = album + " " + release;
	}

	// Meta Info
	if ('context' in changes) {
		document.getElementById("context").innerHTML = changes.context;
	}
	if ('device' in changes) {
		document.getElementById("device").innerHTML = changes.device;
	}
	if ('volume' in changes) {
		updateVolume(changes.volume);
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

		showHide(document.getElementById("pause"), paused, paused);
		showHide(document.getElementById("shuffle"), shuffle, paused);
		showHide(document.getElementById("repeat"), repeat != "off", paused);
	}
	if ('repeat' in changes) {
		let repeat = document.getElementById("repeat");
		if (changes.repeat == "track") {
			repeat.classList.add("once");
		} else {
			repeat.classList.remove("once");
		}
	}

	// Image
	if (changes.type == "IDLE") {
		let artworkImg = document.getElementById("artwork-img");
		let backgroundImg = document.getElementById("background-img");
		artworkImg.src = "";
		backgroundImg.src = "";
		setArtworkVisibility(false);
	} else if ('image' in changes || 'imageColor' in changes) {
		if (changes.image == "BLANK") {
			changes.image = DEFAULT_IMAGE;
			changes.imageColor = DEFAULT_RGB;
		}
		let image = changes.image != null ? changes.image : currentData.image;
		let imageColor = changes.imageColor != null ? changes.imageColor : currentData.imageColor;
		changeImage(image, imageColor);
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

const HIDE_VOLUME_TIMEOUT_MS = 2 * 1000;
var volumeTimeout;

function updateVolume(volume, force) {
	if (force !== undefined || (volume != null && volume !== currentData.volume)) {
		let volumeBox = document.getElementById("volume");
		let state = force !== undefined ? force : visualPreferences[PARAM_SHOW_VOLUME];
		showHide(volumeBox, state);
		clearTimeout(volumeTimeout);
		volumeTimeout = setTimeout(() => showHide(volumeBox, false), HIDE_VOLUME_TIMEOUT_MS);

		document.getElementById("volume-current").style.height = volume + "%";
	}
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

function changeImage(newImage, rgb) {
	if (newImage) {
		let artwork = document.getElementById("artwork-img");
		let artworkCrossfade = document.getElementById("artwork-img-crossfade");

		let oldImg = document.getElementById("artwork-img").src;
		if (!oldImg.includes(newImage)) {
			clearTimeout(fadeOutTimeout);

			let artworkUrl = artwork.src;
			let brightness = calculateBrightness(rgb);

			// Main Artwork
			setArtworkVisibility(false);
			artworkCrossfade.onload = () => {
				setClass(artworkCrossfade, "transition", false);
				window.requestAnimationFrame(() => {
					setClass(artworkCrossfade, "show", true);
					artwork.onload = () => {
						let glowAlpha = (1 - (brightness * 0.8)) / 2;
						let glow = `var(--artwork-shadow) rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${glowAlpha})`;
						artwork.style.boxShadow = glow;
						setArtworkVisibility(true);
					};
					artwork.src = newImage;
				});
			};
			artworkCrossfade.src = oldImg ? oldImg : EMPTY_IMAGE_DATA;
			
			// Background Artwork
			let backgroundWrapper = document.getElementById("background");
			let backgroundOverlay = document.getElementById("background-overlay");
			let backgroundImg = document.getElementById("background-img");
			let backgroundCrossfade = document.getElementById("background-img-crossfade");
			backgroundCrossfade.onload = () => {
				setClass(backgroundCrossfade, "transition", false);
				window.requestAnimationFrame(() => {
					setClass(backgroundCrossfade, "show", true);
					backgroundImg.onload = () => {
						let backgroundColorOverlay = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${brightness})`;
						backgroundOverlay.style.setProperty("--background-overlay-color", backgroundColorOverlay);
						setClass(backgroundCrossfade, "transition", true);
						setClass(backgroundCrossfade, "show", false);
					};
					backgroundImg.src = newImage;
				});
			};
			backgroundCrossfade.src = oldImg ? oldImg : EMPTY_IMAGE_DATA;
			
			// Colored Text
			let rgbNorm = normalizeColor(rgb);
			document.documentElement.style.setProperty("--text-color", `${rgbNorm.r}, ${rgbNorm.g}, ${rgbNorm.b}`);
		}
	}
}

function setArtworkVisibility(state) {
	setClass(document.getElementById("artwork-img-crossfade"), "transition", state);
	setClass(document.getElementById("artwork-img-crossfade"), "show", !state);
}


function normalizeColor(rgb) {
	let normalizationFactor = 255 / Math.max(rgb.r, rgb.g, rgb.b);
	return {
		r: rgb.r * normalizationFactor,
		g: rgb.g * normalizationFactor,
		b: rgb.b * normalizationFactor
	};
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
	document.getElementById("time-total").innerHTML = formattedTotalTime;

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

const PARAM_FULLSCREEN = "fullscreen";
const PARAM_DARK_MODE = "darkmode";
const PARAM_TRANSITIONS = "transitions";
const PARAM_BG_ARTWORK = "bgartwork";
const PARAM_SHOW_VOLUME = "showvolume";
const PARAM_ARTWORK_GLOW = "artworkglow";
const PARAM_DARKEN_BACKGROUND = "darkenbackground";
const PARAM_SCALE_BACKGROUND = "scalebackground";
const PARAM_COLORED_TEXT = "coloredtext";

// Settings with defaults
var visualPreferences = {
	[PARAM_FULLSCREEN]:        false,
	[PARAM_DARK_MODE]:         false,
	[PARAM_TRANSITIONS]:       true,
	[PARAM_BG_ARTWORK]:        true,
	[PARAM_SHOW_VOLUME]:       false,
	[PARAM_ARTWORK_GLOW]:      true,
	[PARAM_DARKEN_BACKGROUND]: true,
	[PARAM_SCALE_BACKGROUND]:  true,
	[PARAM_COLORED_TEXT]:      true
};

function toggleVisualPreference(key) {
	if (visualPreferences.hasOwnProperty(key)) {
		let newState = !visualPreferences[key];
		refreshPreference(key, newState);
	}
}

function refreshPreference(preference, state) {
	visualPreferences[preference] = state;

	// Refresh Preference
	switch (preference) {
		case PARAM_FULLSCREEN:
			setFullscreen(state);
			break;
		case PARAM_DARK_MODE:
			setClass(document.getElementById("dark-overlay"), "show", state);
			break;
		case PARAM_TRANSITIONS:
			setTransitions(state);
			break;
		case PARAM_BG_ARTWORK:
			setClass(document.getElementById("background-img"), "forcehide", !state);
			setClass(document.getElementById("background-img-crossfade"), "forcehide", !state);
			break;
		case PARAM_SHOW_VOLUME:
			updateVolume(currentData.volume, state);
			break;
		case PARAM_SCALE_BACKGROUND:
			setClass(document.getElementById("background"), "scale", state);
			setClass(document.getElementById("background-img"), "scale", state);
			setClass(document.getElementById("background-img-crossfade"), "scale", state);
			break;
		case PARAM_DARKEN_BACKGROUND:
			setClass(document.getElementById("background"), "darken", state);
			break;
		case PARAM_ARTWORK_GLOW:
			setClass(document.getElementById("artwork-img"), "noshadow", !state);
			break;
		case PARAM_COLORED_TEXT:
			setClass(document.body, "nocoloredtext", !state);
			break;
	}

	// URL Params
	if (preference != PARAM_FULLSCREEN) {
		const url = new URL(window.location);
		url.searchParams.set(preference, state);
		window.history.replaceState({}, 'Spotify Playback Info', url.toString());
		
		// Toggle Checkmark
		let classList = document.getElementById(preference).classList;
		if (state) {
			classList.add("preference-on");
		} else {
			classList.remove("preference-on");
		}
	}
}

function setTransitions(state) {
	setClass(document.getElementById("dark-overlay"), "transition", state);
	setClass(document.getElementById("progress-current"), "transition", state);
	setClass(document.getElementById("settings"), "transition", state);
	
	setClass(document.getElementById("artwork-img"), "transition", state);
	showHide(document.getElementById("artwork-img-crossfade"), state, true);
	
	setClass(document.getElementById("background"), "transition", state);
	setClass(document.getElementById("background-overlay"), "transition", state);
	setClass(document.getElementById("background-img"), "transition", state);
	showHide(document.getElementById("background-img-crossfade"), state, true);
}

window.addEventListener('load', initVisualPreferencesFromUrlParams);
function initVisualPreferencesFromUrlParams() {
	for (let pref in visualPreferences) {
		document.getElementById(pref).firstChild.onclick = () => toggleVisualPreference(pref);
		if (pref != PARAM_FULLSCREEN) { // not for fullscreen because it's blocked by most browsers on non-usergenerated events
			initPreference(pref);
		}
	}
}

function initPreference(preference) {
	const urlParams = new URLSearchParams(window.location.search);
	let state = visualPreferences[preference];
	if (urlParams.get(preference) != null) {
		state = (urlParams.get(preference) == "true");
	}
	refreshPreference(preference, state);
}

function setFullscreen(state) {
	let elem = document.documentElement;
	if (state) {
		if (elem.requestFullscreen) {
			elem.requestFullscreen();
		}
	} else {
	    if (document.exitFullscreen) {
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
			toggleVisualPreference(PARAM_FULLSCREEN);
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
		case "v":
			toggleVisualPreference(PARAM_SHOW_VOLUME);
			break;
		case "g":
			toggleVisualPreference(PARAM_ARTWORK_GLOW);
			break;
		case "b":
			toggleVisualPreference(PARAM_DARKEN_BACKGROUND);
			break;
		case "z":
			toggleVisualPreference(PARAM_SCALE_BACKGROUND);
			break;
		case "c":
			toggleVisualPreference(PARAM_SCALE_BACKGROUND);
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
