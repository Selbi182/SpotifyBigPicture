var currentData = {};
var idle = false;


///////////////////////////////
// WEB STUFF
///////////////////////////////

const FLUX_URL = "/playbackinfoflux";
const FULL_INFO_URL = "/playbackinfo?full=true";

window.addEventListener('load', startFlux);

function singleRequest() {
	fetch(FULL_INFO_URL)
		 .then(response => response.json())
		 .then(json => processJson(json))
	     .catch(ex => {
			error("Single request", ex);
	 		singleRequest();
	     });
}

var flux;
function startFlux() {
	if (!flux || flux.readyState === 2) {
		try {
			flux = new EventSource(FLUX_URL);
			flux.onopen = () => {
				singleRequest();
				createHeartbeatTimeout();
			};
			flux.onmessage = (event) => {
				try {
					createHeartbeatTimeout();
					let data = event.data;
					let json = JSON.parse(data);
					processJson(json);					
				} catch (ex) {
					error("Flux onmessage", ex);
					startFlux();
				}
			};
			flux.onerror = (ex) => {
				error("Flux onerror", ex);
				startFlux();
			};
		} catch (ex) {
			error("Flux creation", ex);
			startFlux();
		}
	}
}

function processJson(json) {
	if (Object.entries(json).length > 0) {
		if (idle) {
			startFlux();
		} else {
			setDisplayData(json);
			for (let prop in json) {
				currentData[prop] = json[prop];
			}
			startTimers();
		}
	}
}

const HEARTBEAT_TIMEOUT_MS = 60 * 1000;
var heartbeatTimeout;
function createHeartbeatTimeout() {
	clearTimeout(heartbeatTimeout);
	heartbeatTimeout = setTimeout(() => {
		console.error("Heartbeat receive timeout");
		startFlux();
	}, HEARTBEAT_TIMEOUT_MS);
}

function error(text, ex) {
	console.error(text);
	console.error(ex);
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
	
	// Top Left
	if ('playlist' in changes) {
		document.getElementById("playlist").innerHTML = changes.playlist;
	}
	if ('device' in changes) {
	    document.getElementById("device").innerHTML = changes.device;
	}
	
	// Time
	if ('timeCurrent' in changes || 'timeTotal' in changes) {
  		updateProgress(changes);
	}	
	
	// States
	if ('paused' in changes) {
        showHide(document.getElementById("pause"), changes.paused);		
	}
	if ('shuffle' in changes) {
	    showHide(document.getElementById("shuffle"), changes.shuffle);
	}
	if ('repeat' in changes) {
	    showHide(document.getElementById("repeat"), changes.repeat == "context");
	    showHide(document.getElementById("repeat-one"), changes.repeat == "track");
	}
	
	// Image
	if ('image' in changes) {
		changeImage(changes.image);
	}
}

function showHide(elem, state) {
    if (state) {
        elem.classList.remove("hidden");
    } else {
        elem.classList.add("hidden");
    }
}


///////////////////////////////
// COVER ART
///////////////////////////////

const IMAGE_TRANSITION_MS = 1 * 1000;

const DEFAULT_IMAGE = 'img/idle.png';
const DEFAULT_BACKGROUND = 'url(img/gradient.png)';

var preloadImg;
var newImageFadeIn;

function changeImage(newImage) {
	let oldImg = document.getElementById("artwork-img").src;
	if (oldImg != newImage) {
		clearTimeout(newImageFadeIn);
		
		preloadImg = new Image();
		preloadImg.onload = () => {
			newImageFadeIn = setTimeout(() => {
				let img = preloadImg.src;
        		document.getElementById("artwork-img").src = img;
        		
        		let background = DEFAULT_BACKGROUND + ", url(" + img + ")";
        		if (img.endsWith(DEFAULT_IMAGE)) {
        			background = DEFAULT_BACKGROUND;
        		}
            	document.getElementById("background-img").style.background = background;
            	
            	document.getElementById("artwork-img").style.opacity = "1";
				document.getElementById("background-img").style.opacity = "1";
			}, IMAGE_TRANSITION_MS);
		}
		preloadImg.src = newImage;
		
		document.getElementById("artwork-img").style.opacity = "0";
		document.getElementById("background-img").style.opacity = "0";
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
	
	//document.title = `[${formattedCurrentTime}/${formattedTotalTime}] ${currentData.artist} – ${currentData.title}`; // TODO fix
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
    	release: "&nbsp;",
    	
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
