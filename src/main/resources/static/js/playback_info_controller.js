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
	if ('playlist' in changes) {
		document.getElementById("playlist").innerHTML = changes.playlist;
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
	if ('image' in changes) {
		changeImage(changes.image);
	} else if ('release' in changes && changes.release == "LOCAL") {
		changeImage(DEFAULT_IMAGE);
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
		let featuredArtists = artists.slice(1).join(", ");
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

const TRANSITION_MS = 500;
const DEFAULT_IMAGE = 'img/idle.png';
const DEFAULT_BACKGROUND = 'img/gradient.png';

var preloadImg;
var fadeOutDone = false;
var decodeDone = false;

var fadeOutTimeout;

function changeImage(newImage, force) {
	if (newImage) {
		let oldImg = document.getElementById("artwork-img").style.backgroundImage;
		if (force || !oldImg.includes(newImage)) {
			clearTimeout(fadeOutTimeout);
			fadeOutDone = false;
			decodeDone = false;

			let previousOpacity = setArtworkOpacity("0");
			if (previousOpacity > 0) {
				fadeOutTimeout = setTimeout(() => {
					fadeOutDone = true;
					paintArtwork();
				}, visualPreferences[PARAM_TRANSITIONS] ? TRANSITION_MS : 0);
			} else {
				fadeOutDone = true;
			}

			preloadImg = new Image();
			if (visualPreferences[PARAM_BG_COLOR_OVERLAY] || visualPreferences[PARAM_COLORED_SHADOW]) {
				preloadImg.crossOrigin = "Anonymous";
			}
			preloadImg.src = newImage;

			preloadImg.decode().then(() => {
				decodeDone = true;
				paintArtwork();
			});
		}
	}
}

const FADE_IN_DELAY = 1000;
function paintArtwork() {
	if (fadeOutDone && decodeDone && preloadImg) {
		let artworkUrl = makeUrl(preloadImg.src);

		let backgroundUrl = makeUrl(DEFAULT_BACKGROUND);
		let rgba;
		if (!idle && !artworkUrl.includes(DEFAULT_IMAGE)) {
			rgba = getDominantImageColor(preloadImg);
			let backgroundColorOverlay = `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.alpha})`;
			let backgroundArtworkUrl = visualPreferences[PARAM_BG_ARTWORK] ? artworkUrl + ", " : "";
			backgroundUrl = `${backgroundArtworkUrl} ${backgroundColorOverlay} ${backgroundUrl}`;
		}

		let artwork = document.getElementById("artwork-img").style;
		let background = document.getElementById("background-img").style;
		artwork.backgroundImage = artworkUrl;
		background.background = backgroundUrl;

		if (rgba && !idle && visualPreferences[PARAM_COLORED_SHADOW]) {
			artwork.filter = `drop-shadow(0px 0px 48px rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${1 - rgba.brightness}))`;
		} else {
			artwork.filter = "";
		}

		setTimeout(() => {
			setArtworkOpacity("1");
	    }, visualPreferences[PARAM_FADEIN_DELAY] ? FADE_IN_DELAY : 0);
	}
}

const DARKEN_BACKGROUND_MULTIPLIER = 0.65;
function setArtworkOpacity(value) {
	let previousOpacity = document.getElementById("artwork-img").style.opacity;
	document.getElementById("artwork-img").style.opacity = value;
	document.getElementById("background-img").style.opacity = visualPreferences[PARAM_DARKEN_BACKGROUND] ? value * DARKEN_BACKGROUND_MULTIPLIER : value;
	return previousOpacity;
}

function extractUrl(url) {
	return url.slice(4, -1).replace(/"/g, "");
}

function makeUrl(url) {
	return `url(${url})`;
}


const OVERLAY_MIN_ALPHA = 0.5;
const DEFAULT_RGBA = {
	r: 0,
	g: 0,
	b: 0,
	alpha: OVERLAY_MIN_ALPHA,
	brightness: 0
};
function getDominantImageColor(img) {
	if (visualPreferences[PARAM_BG_COLOR_OVERLAY] || visualPreferences[PARAM_COLORED_SHADOW]) {
		try {
			let palette = new Vibrant(img);
			let swatch = getBestSwatch(palette, false);
			if (swatch) {
				let rgb = swatch.getRgb();

				let r = rgb[0];
				let g = rgb[1];
				let b = rgb[2];

				let alpha = 1.0;
				if (visualPreferences[PARAM_BG_ARTWORK]) {
					// Basically, the brighter the result color is,
					// the more visible the overlay will be
					alpha = OVERLAY_MIN_ALPHA + (Math.sqrt(0.299*r*r + 0.587*g*g + 0.114*b*b ) / 255) * OVERLAY_MIN_ALPHA;
				}
			
				return {
					r: r,
					g: g,
					b: b,
					alpha: alpha,
					brightness: swatch.getHsl()[2]
				};
			}
		} catch (ex) {
			console.error(ex);
		}
	}
	return DEFAULT_RGBA;
}

const WEIGHTED_SWATCHES = {
	Vibrant: 5,
	DarkVibrant: 4,
	LightVibrant: 3,
	Muted: 2,
	LightMuted: 2,
	DarkMuted: 1
};
const MIN_POPULATION_THRESHOLD = 500;
function getBestSwatch(palette, ignoreThreshold) {
	let bestSwatch = null;
	for (let swatchIndex in WEIGHTED_SWATCHES) {
		let swatch = palette.swatches()[swatchIndex];
		if (swatch && (ignoreThreshold || swatch.population > MIN_POPULATION_THRESHOLD)) {
			let weightedPopulation = swatch.population * WEIGHTED_SWATCHES[swatchIndex];
			if (!bestSwatch || bestSwatch.weightedPopulation < weightedPopulation) {
				bestSwatch = swatch;
				bestSwatch.name = swatchIndex;
				bestSwatch.weightedPopulation = weightedPopulation;
			}
		}
	}
	if (!bestSwatch && !ignoreThreshold) {
		return getBestSwatch(palette, true);
	} else {
		return bestSwatch;
	}
}


///////////////////////////////
// PROGRESS
///////////////////////////////

function updateProgress(changes) {
	let current = 'timeCurrent' in changes ? changes.timeCurrent : currentData.timeCurrent;
	let total = 'timeTotal' in changes ? changes.timeTotal : currentData.timeTotal;

	let formattedTimes = formatTime(current, total)
	let formattedCurrentTime = formattedTimes.current;
	let formattedTotalTime = formattedTimes.total;

	document.getElementById("time-current").innerHTML = formattedCurrentTime;
	document.getElementById("time-total").innerHTML = formattedTotalTime;

	let progressPercent = Math.min(1, ((current / total))) * 100;
	if (isNaN(progressPercent)) {
		progressPercent = 0;
	}
	document.getElementById("progress-current").style.width = progressPercent + "%";
	
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
	if (totalHMS.minutes >= 10) {
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

const PROGRESS_BAR_UPDATE_MS = 200;
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const REQUEST_ON_SONG_END_MS = 100;

var autoTimer;
var idleTimeout;

function startTimers() {
	clearTimers();

	startTime = Date.now();
	autoTimer = setInterval(() => advanceProgressBar(), PROGRESS_BAR_UPDATE_MS);

	idleTimeout = setTimeout(() => setIdle(), IDLE_TIMEOUT_MS);
	this.idle = false;
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
			if (currentData.timeCurrent < currentData.timeTotal) {
				setTimeout(() => singleRequest(false), REQUEST_ON_SONG_END_MS);
			}
			newTime = currentData.timeTotal;
		}
		currentData.timeCurrent = newTime;
		updateProgress(currentData);
	}
}

function setIdle() {
	if (!idle) {
		this.idle = true;
		clearTimers();

		let idleDisplayData = {
			type: "IDLE",

			title: "&nbsp;",
			artists: ["&nbsp;"],
			album: "&nbsp;",
			release: "",

			playlist: "&nbsp;",
			device: "&nbsp;",
			volume: 0,

			pause: true,
			shuffle: false,
			repeat: "off",

			timeCurrent: 0,
			timeTotal: 0,

			image: DEFAULT_IMAGE
		};
		setDisplayData(idleDisplayData);
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
const PARAM_BG_COLOR_OVERLAY = "bgcoloroverlay";
const PARAM_SHOW_VOLUME = "showvolume";
const PARAM_FADEIN_DELAY = "fadeindelay";
const PARAM_COLORED_SHADOW = "coloredshadow";
const PARAM_DARKEN_BACKGROUND = "darkenbackground";

// Settings with defaults
var visualPreferences = {
	[PARAM_FULLSCREEN]:        false,
	[PARAM_DARK_MODE]:         false,
	[PARAM_TRANSITIONS]:       true,
	[PARAM_BG_ARTWORK]:        true,
	[PARAM_BG_COLOR_OVERLAY]:  true,
	[PARAM_SHOW_VOLUME]:       false,
	[PARAM_FADEIN_DELAY]:	   false,
	[PARAM_COLORED_SHADOW]:    true,
	[PARAM_DARKEN_BACKGROUND]: true
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
			showHide(document.getElementById("dark-overlay"), state, false);
			break;
		case PARAM_TRANSITIONS:
			setClass(document.getElementById("artwork-img"), "transition", state);
			setClass(document.getElementById("background-img"), "transition", state);
			changeImage(currentData.image, true);
			break;
		case PARAM_BG_ARTWORK:
			setClass(document.getElementById("background-img"), "blur", state);
			changeImage(currentData.image, true);
			break;
		case PARAM_SHOW_VOLUME:
			updateVolume(currentData.volume, state);
			break;
		case PARAM_FADEIN_DELAY:
		case PARAM_BG_COLOR_OVERLAY:
		case PARAM_COLORED_SHADOW:
		case PARAM_DARKEN_BACKGROUND:
			changeImage(currentData.image, true);
			break;
	}

	// URL Params
	if (preference != PARAM_FULLSCREEN) {
		const url = new URL(window.location);
		url.searchParams.set(preference, state);
		window.history.replaceState({}, 'Spotify Playback Info', url.toString());
	}

	// Toggle Checkmark
	let classList = document.getElementById(preference).classList;
	if (state) {
		classList.add("preference-on");
	} else {
		classList.remove("preference-on");
	}
}

window.addEventListener('load', initVisualPreferencesFromUrlParams);
function initVisualPreferencesFromUrlParams() {
	// initPreference(PARAM_FULLSCREEN); // blocked by most browsers on non-usergenerated events
	initPreference(PARAM_DARK_MODE);
	initPreference(PARAM_TRANSITIONS);
	initPreference(PARAM_BG_ARTWORK);
	initPreference(PARAM_BG_COLOR_OVERLAY);
	initPreference(PARAM_SHOW_VOLUME);
	initPreference(PARAM_FADEIN_DELAY);
	initPreference(PARAM_COLORED_SHADOW);
	initPreference(PARAM_DARKEN_BACKGROUND);
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
		case "c":
			toggleVisualPreference(PARAM_BG_COLOR_OVERLAY);
			break;
		case "v":
			toggleVisualPreference(PARAM_SHOW_VOLUME);
			break;
		case "i":
			toggleVisualPreference(PARAM_FADEIN_DELAY);
			break;
		case "s":
			toggleVisualPreference(PARAM_COLORED_SHADOW);
			break;
		case "b":
			toggleVisualPreference(PARAM_DARKEN_BACKGROUND);
			break;
	}
}


///////////////////////////////
// MOUSE HIDE
///////////////////////////////

document.addEventListener("mousemove", handleMouseEvent);
document.addEventListener("click", handleMouseEvent);
var cursorTimeout;
function handleMouseEvent() {
	document.querySelector("body").style.cursor = "default";
	document.getElementById("settings").style.display = "inherit";
	clearTimeout(cursorTimeout);
	cursorTimeout = setTimeout(() => {
		document.querySelector("body").style.cursor = "none";
		document.getElementById("settings").style.display = "none";
	}, 1000);
}
