var firstRequestDone = false;
var currentData;
var backgroundEffects;

const UPDATE_INTERVAL = 1000;
setInterval(() => updatePlaybackDataAsync(true), UPDATE_INTERVAL);
//setInterval(() => updatePlaybackDataAsync(true), UPDATE_INTERVAL * 10);

function updatePlaybackDataAsync(force) {
    try {
        let url = "/playbackinfo";
        if (!firstRequestDone) {
            this.backgroundEffects = getComputedStyle(document.getElementById("background-img")).getPropertyValue("--background-effects");
        }
        if (force || !firstRequestDone) {
            url += "?full=true";
            firstRequestDone = true;
            console.log(backgroundEffects);
        }
        fetch(url)
          .then(response => response.json())
          .then(data => setDisplayData(data))
          .catch(ex => {});
    } catch (ex) {
        console.log(ex);
    }
}

function setDisplayData(data) {
    if (data != null && data.timeCurrent >= 0) {        
        if (!data.partial) {
            this.currentData = data;
            
            let img = "url(" + data.image + ")";
            document.getElementById("cover-img").style.backgroundImage = img;
            document.getElementById("background-img").style.background = backgroundEffects + ", " + img;
            
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
        
        document.title = `[${formattedCurrentTime}/${formattedTotalTime}] ${currentData.artist} – ${currentData.title}`;
    }
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
    return ((current / total) * 100) + "%";
}