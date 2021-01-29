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
	console.log("Init");	
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
		console.error("Heartbeat timeout");
		setIdle();
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
	if ('shuffle' in changes) {
	    showHide(document.getElementById("shuffle"), changes.shuffle);
	}
	if ('repeat' in changes) {
		let repeat = document.getElementById("repeat");
	    showHide(repeat, changes.repeat != "off");
	    if (changes.repeat == "track") {
	    	repeat.classList.add("once");
        } else {
        	repeat.classList.remove("once");
        }
	}
	
	// Image
	if ('image' in changes) {
		changeImage(changes.image, changes.paused);
	} else if ('release' in changes && changes.release == "LOCAL") {
		changeImage(DEFAULT_IMAGE, changes.paused);
	}
	if ('paused' in changes) {
		let artwork = document.getElementById("artwork-img");
		displayPaused(artwork, artwork.style.backgroundImage, changes.paused);
	}
}

function showHide(elem, show) {
    if (show) {
        elem.classList.remove("hidden");
    } else {
        elem.classList.add("hidden");
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

const DEFAULT_IMAGE = 'img/idle.png';
const DEFAULT_BACKGROUND = 'img/gradient.png';
const PAUSE_OVERLAY = 'img/symbols/pause.png';

var preloadImg;
var newImageFadeIn;

function changeImage(newImage) {
	let oldImg = document.getElementById("artwork-img").style.backgroundImage;
	if (!oldImg.includes(newImage)) {
		clearTimeout(newImageFadeIn);
		preloadImg = new Image();
		preloadImg.onload = () => {
			newImageFadeIn = setTimeout(() => {
				let img = makeUrl(preloadImg.src);
        		document.getElementById("artwork-img").style.backgroundImage = displayPaused(document.getElementById("artwork-img"), img, currentData.paused);        		
            	document.getElementById("background-img").style.background = makeUrl(DEFAULT_BACKGROUND) + ", " + img;
        		setArtworkOpacity("1");
			}, IMAGE_TRANSITION_MS);
		}
		preloadImg.src = newImage;
		setArtworkOpacity("0");
	}
}

function displayPaused(elem, img, paused) {
	if (paused) {
		if (!elem.style.backgroundImage.includes(PAUSE_OVERLAY)) {
			elem.style.backgroundImage = makeUrl(PAUSE_OVERLAY) + ", " + img;
		}
	} else {
		elem.style.backgroundImage = img.split(",").slice(-1)[0].trim();
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

window.addEventListener('load', setLiteMode);
function setLiteMode() {
	const urlParams = new URLSearchParams(window.location.search);
	if (urlParams.get("lite") != null) {
		document.getElementById("artwork-img").style.transition = "unset";
		document.getElementById("background-img").style.transition = "unset";
	}
}

///////////////////////////////
// PROGRESS
///////////////////////////////

function updateProgress(changes) {
	let current = 'timeCurrent' in changes ? changes.timeCurrent : currentData.timeCurrent;
	let total = 'timeTotal' in changes ? changes.timeTotal : currentData.timeTotal;
	
	let formattedCurrentTime = (total > 60 * 60 * 1000 ? "0:" : "") + formatTime(current, false); // TODO proper 1h
	let formattedTotalTime = formatTime(total, true);
	
	document.getElementById("time-current").innerHTML = formattedCurrentTime;
	document.getElementById("time-total").innerHTML = formattedTotalTime;
	
	document.getElementById("progress-current").style.width = Math.min(100, ((current / total) * 100)) + "%";
}

function formatTime(s, roundType) {
    var baseMs = s / 1000;
    var ms = roundType ? Math.ceil(baseMs) : Math.floor(baseMs);
    s = Math.floor((s - ms) / 1000);
    var secs = s % 60;
    s = (s - secs) / 60;
    var mins = s % 60;
    var hrs = (s - mins) / 60;
    if (hrs > 0) {
        return hrs + ':' + mins.toString().padStart(2, '0')  + ':' + secs.toString().padStart(2, '0');    
    }
    return mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
}


///////////////////////////////
// TIMERS
///////////////////////////////

const PROGRESS_BAR_UPDATE_MS = 250;
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

var autoTimer;
var idleTimeout;

function startTimers() {
	clearTimers();
	autoTimer = setInterval(() => advanceProgressBar(), PROGRESS_BAR_UPDATE_MS);
	idleTimeout = setTimeout(() => setIdle(), IDLE_TIMEOUT_MS);
	this.idle = false;
}

function clearTimers() {
	clearInterval(autoTimer);
	clearTimeout(idleTimeout);
}

function advanceProgressBar() {
	if (currentData != null && currentData.timeCurrent != null && !currentData.paused) {
		currentData.timeCurrent = Math.min(currentData.timeCurrent + PROGRESS_BAR_UPDATE_MS, currentData.timeTotal);
		updateProgress(currentData);
	}
}

function setIdle()  {
	this.idle = true;
	clearTimers();

    let idleDisplayData = {
    	title: "&nbsp;",
    	artist: "&nbsp;",
    	album: "&nbsp;",
    	release: "",
    	
    	playlist: "&nbsp;",
    	device: "&nbsp;",
    	
		pause: true,
    	shuffle: false,
    	repeat: null,
    	
    	timeCurrent: 0,
    	timeTotal: 1, // to avoid NaN
    	
    	image: DEFAULT_IMAGE
    };

    setDisplayData(idleDisplayData);
}
