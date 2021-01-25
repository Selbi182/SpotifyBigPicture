var idle = false;
var firstRequestDone = false;
var currentData;
var backgroundEffects;

const DEFAULT_IMAGE = "img/idle.png";
const DEFAULT_BACKGROUND = "img/gradient.png";
const PROGRESS_BAR_UPDATE_MS = 1000;

window.addEventListener('load', entryPoint);

function entryPoint() {
    this.backgroundEffects = getComputedStyle(document.getElementById("background-img")).getPropertyValue("--background-effects");
    
    fetch("/playbackinfo?full=true")
      .then(response => response.json())
      .then(data => {
      	setDisplayData(data);
      	//startFlux();
      	startAutoTimer();
      })
      .catch(ex => {});
}

function startFlux() {
	const flux = new EventSource("/playbackinfoflux");
	flux.onmessage = function(event) {
		let data = event.data;
		let json = JSON.parse(data);
		setDisplayData(json);
	};
	flux.onerror = function(e) {
		console.log("lost connection");
    	flux.close();
    	setIdle();
    	startFlux();
    };
}

var autoTimeEnabled = false;

function startAutoTimer() {
	if (!autoTimeEnabled) {
		autoTimeEnabled = true;
		
		// TODO this is a dirty patch because Flux doesn't work yet... fml
		setInterval(() => {
		   fetch("/playbackinfo?full=true")
		      .then(response => response.json())
		      .then(data => {
		      	setDisplayData(data);
				console.debug(data);
		      })
		      .catch(ex => {});
		}, 2 * 1000);
		
		setInterval(() => {
			if (currentData != null && currentData.timeCurrent != null && !currentData.paused) {
				currentData.timeCurrent = Math.min(currentData.timeCurrent + PROGRESS_BAR_UPDATE_MS, currentData.timeTotal);
				setDisplayData(currentData);
			}
		}, PROGRESS_BAR_UPDATE_MS);	
	}
}

function setDisplayData(data) {
    if (data != null) {
    	if (data.timeCurrent >= 0) {
    		this.idle = false;
    		if (this.currentData == null || !data.partial) {
            	this.currentData = data;
    		}
	        if (!data.partial) {
	            if (data.image != null) {
		            document.getElementById("artwork-img").src = data.image;
		            document.getElementById("background-img").style.background = backgroundEffects + ", url(" + data.image + ")";
		        } else {
		            document.getElementById("artwork-img").src = DEFAULT_IMAGE;
		            document.getElementById("background-img").style.background = backgroundEffects + ", url(" + DEFAULT_BACKGROUND + ")";
		        }
	            
	            document.getElementById("album").innerHTML = data.album + " (" + data.release + ")";
	            document.getElementById("artist").innerHTML = data.artist;
	            document.getElementById("title").innerHTML = data.title;
	            
	            showHide(document.getElementById("pause"), data.paused);
	            showHide(document.getElementById("shuffle"), data.shuffle);
	            showHide(document.getElementById("repeat"), data.repeat == "context");
	            showHide(document.getElementById("repeat-one"), data.repeat == "track");
	            
	            document.getElementById("playlist").innerHTML = data.playlist;
	            document.getElementById("device").innerHTML = data.device;
	        }
	        let formattedCurrentTime = (currentData.timeTotal > 60 * 60 * 1000 ? "0:" : "") + formatTime(data.timeCurrent, false);
	        let formattedTotalTime = formatTime(currentData.timeTotal, true);
	        
	        document.getElementById("time-current").innerHTML = formattedCurrentTime;
	        document.getElementById("time-total").innerHTML = formattedTotalTime;
	        
	        document.getElementById("progress-current").style.width = calcProgress(data.timeCurrent, currentData.timeTotal);
	        this.currentData.timeCurrent = data.timeCurrent;
	        
	        document.title = `[${formattedCurrentTime}/${formattedTotalTime}] ${currentData.artist} – ${currentData.title}`;
	        return;
        }
    }
    setIdle();
}

function setIdle()  {
    this.idle = true;
    this.currentData = null;
    
    document.getElementById("artwork-img").src = DEFAULT_IMAGE;
    document.getElementById("background-img").style.background = "url(" + DEFAULT_BACKGROUND + ")";
    
    document.getElementById("album").innerHTML = "&nbsp;";
    document.getElementById("artist").innerHTML = "&nbsp;";
    document.getElementById("title").innerHTML = "&nbsp;";
    
    showHide(document.getElementById("pause"), true);
    showHide(document.getElementById("shuffle"), false);
    showHide(document.getElementById("repeat"), false);
    showHide(document.getElementById("repeat-one"), false);
    
    document.getElementById("playlist").innerHTML = null;
    document.getElementById("device").innerHTML = "Idle";
    
    document.getElementById("time-current").innerHTML = "00:00";
    document.getElementById("time-total").innerHTML = "00:00";
    
    document.getElementById("progress-current").style.width = null;
    
    document.title = "Spotify Player";
}

function showHide(elem, state) {
    if (state) {
        elem.classList.remove("hidden");
    } else {
        elem.classList.add("hidden");
    }
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

function calcProgress(current, total) {
    return Math.min(100, ((current / total) * 100)) + "%";
}

document.addEventListener("click", toggleMouse);
function toggleMouse() {
    let state = document.querySelector("body").style.cursor;
    if (state == "none") {
    	document.querySelector("body").style.cursor = "default";
    } else {
    	document.querySelector("body").style.cursor = "none";
    }
};