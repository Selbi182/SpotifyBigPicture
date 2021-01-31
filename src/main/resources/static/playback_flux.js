var currentData = {};
var idle = false;


///////////////////////////////
// WEB STUFF
///////////////////////////////

const FLUX_URL = "/playbackinfoflux";
const FULL_INFO_URL = "/playbackinfo?full=true";
const RETRY_TIMEOUT_MS = 5 * 1000;

window.addEventListener('load', init);

function init() {
	console.info("Init");
	singleRequest();
	closeFlux();
	startFlux();
	createHeartbeatTimeout();
}

function singleRequest() {
	fetch(FULL_INFO_URL)
		.then(response => response.json())
		.then(json => processJson(json))
		.catch(ex => {
			console.error("Single request", ex);
			setTimeout(singleRequest, RETRY_TIMEOUT_MS);
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
						singleRequest();
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

window.onfocus = () => singleRequest();

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

		// Commented out to pretend the song is still playing, it usually reconnects after a few seconds anyway
		// setIdle();

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
		document.getElementById("title").innerHTML = changes.title;
	}
	if ('artist' in changes) {
		document.getElementById("artist").innerHTML = changes.artist;
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

const HIDE_VOLUME_TIMEOUT_MS = 3 * 1000;
var volumeTimeout;

function updateVolume(volume) {
	if (volume != null && volume !== currentData.volume) {
		let volumeBox = document.getElementById("volume");
		showHide(volumeBox, true);
		clearTimeout(volumeTimeout);
		volumeTimeout = setTimeout(() => showHide(volumeBox, false), HIDE_VOLUME_TIMEOUT_MS);

		document.getElementById("volume-current").style.height = volume + "%";
	}
}

const IMAGE_TRANSITION_MS = 1 * 1000;
var setImageTransitionMs = IMAGE_TRANSITION_MS;

const DEFAULT_IMAGE = 'img/idle.png';
const DEFAULT_BACKGROUND = 'img/gradient.png';

var preloadImg;
var newImageFadeIn;

function changeImage(newImage) {
	let oldImg = document.getElementById("artwork-img").style.backgroundImage;
	if (!oldImg.includes(newImage)) {
		clearTimeout(newImageFadeIn);
		preloadImg = new Image();
		if (!liteMode) {
			preloadImg.crossOrigin = "Anonymous";
		}
		preloadImg.onload = () => {
			newImageFadeIn = setTimeout(() => {
				let img = makeUrl(preloadImg.src);
				document.getElementById("artwork-img").style.backgroundImage = img;

				let backgroundUrl = makeUrl(DEFAULT_BACKGROUND);
				if (!img.includes(DEFAULT_IMAGE)) {
					if (liteMode) {
						backgroundUrl += `, ${img}`;
					} else {
						let dominantColor = getDominantImageColor(preloadImg);
						backgroundUrl += `, rgba(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]}, ${dominantColor[3]}) ${img}`;
					}
				}
				document.getElementById("background-img").style.background = backgroundUrl;

				setArtworkOpacity("1");
			}, setImageTransitionMs);
		}
		preloadImg.src = newImage;
		setArtworkOpacity("0");
	}
}

window.addEventListener('load', setLiteMode);
var liteMode = false;
function setLiteMode() {
	const urlParams = new URLSearchParams(window.location.search);
	if (urlParams.get("lite") != null) {
		liteMode = true;
		document.getElementById("artwork-img").style.transition = "unset";
		document.getElementById("background-img").style.transition = "unset";
		setImageTransitionMs = 0;
	}
}

function setArtworkOpacity(value) {
	document.getElementById("artwork-img").style.opacity = value;
	document.getElementById("background-img").style.opacity = value;
}

function extractUrl(url) {
	return url.slice(4, -1).replace(/"/g, "");
}

function makeUrl(url) {
	return "url(" + url + ")";
}


var colorThief;
window.addEventListener('load', () => {
	colorThief = new ColorThief();
});

const PALETTE_SAMPLE_SIZE = 6;
const OVERLAY_MIN_ALPHA = 0.1;
const OVERLAY_MAX_ALPHA = 0.9;

function getDominantImageColor(img) {
	try {
		if (colorThief) {
			let palette = colorThief.getPalette(img, PALETTE_SAMPLE_SIZE);

			let dominant;
			let prevColorfulness = 0;
			for (let color of palette) {
				let currentColorfulness = colorfulness(color[0], color[1], color[2]);
				if (currentColorfulness >= prevColorfulness) {
					dominant = color;
					prevColorfulness = currentColorfulness;
				}
			}

			if (dominant) {
				let r = dominant[0];
				let g = dominant[1];
				let b = dominant[2];

				// Basically, the more colorful the result color is,
				// the more visible the overlay will be
				let tmpAlpha = Math.sin(prevColorfulness * (Math.PI / 2));
				let alpha = Math.max(OVERLAY_MIN_ALPHA, Math.min(OVERLAY_MAX_ALPHA, tmpAlpha));

				return [r, g, b, alpha];
			}
		}
		throw "Found no dominant color";
	} catch (ex) {
		console.error(ex);
		return [0, 0, 0, OVERLAY_MIN_ALPHA];
	}
}

function colorfulness(r, g, b) {
	// Rough implementation of Colorfulness Index defined by Hasler and Suesstrunk
	// -> https://infoscience.epfl.ch/record/33994/files/HaslerS03.pdf (p. 5+6)
	let rg = Math.abs(r - g);
	let yb = Math.abs((0.5 * (r + g)) - b);
	let meanRoot = Math.sqrt(Math.pow(rg, 2) + Math.pow(yb, 2));
	return meanRoot / 255;
}


///////////////////////////////
// PROGRESS
///////////////////////////////

function updateProgress(changes) {
	let current = 'timeCurrent' in changes ? changes.timeCurrent : currentData.timeCurrent;
	let total = 'timeTotal' in changes ? changes.timeTotal : currentData.timeTotal;

	let formattedTime = formatTime(current, total)
	let formattedCurrentTime = formattedTime.current;
	let formattedTotalTime = formattedTime.total;

	document.getElementById("time-current").innerHTML = formattedCurrentTime;
	document.getElementById("time-total").innerHTML = formattedTotalTime;

	let progressPercent = Math.min(1, ((current / total))) * 100;
	if (isNaN(progressPercent)) {
		progressPercent = 0;
	}
	document.getElementById("progress-current").style.width = progressPercent + "%";
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
		currentData.timeCurrent = Math.min(currentData.timeCurrent + ellapsedTime, currentData.timeTotal);
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
			artist: "&nbsp;",
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