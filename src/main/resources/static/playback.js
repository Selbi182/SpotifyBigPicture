var firstRequestDone = false;
var currentData;
const UPDATE_INTERVAL = 1000;

setInterval(() => updatePlaybackDataAsync(false), UPDATE_INTERVAL);
setInterval(() => updatePlaybackDataAsync(true), UPDATE_INTERVAL * 10);

function updatePlaybackDataAsync(force) {
    try {
        let url = "/playbackinfo";
        if (force || !firstRequestDone) {
            url += "?full=true";
            firstRequestDone = true;
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
            document.documentElement.style.setProperty("--img", "url(" + data.image + ")");
            
            document.getElementById("album").innerHTML = data.album + " (" + data.release + ")";
            document.getElementById("artist").innerHTML = data.artist;
            document.getElementById("title").innerHTML = data.title;
            document.getElementById("time-total").innerHTML = formatTime(data.timeTotal);
            
            showHide(document.getElementById("pause"), data.paused);
            showHide(document.getElementById("shuffle"), data.shuffle);
            showHide(document.getElementById("repeat"), data.repeat == "context");
            showHide(document.getElementById("repeat-one"), data.repeat == "track");
            
            // document.getElementById("playlist").innerHTML = data.playlist;
            // document.getElementById("device").innerHTML = data.device;
        }
        document.getElementById("time-current").innerHTML = formatTime(data.timeCurrent);
        document.documentElement.style.setProperty("--progress", calcProgress(data.timeCurrent, currentData.timeTotal));
        
        document.title = `[${formatTime(data.timeCurrent)}/${formatTime(currentData.timeTotal)}] ${currentData.artist} – ${currentData.title}`;
    }
}

function showHide(elem, state) {
    if (state) {
        elem.classList.remove("hidden");
    } else {
        elem.classList.add("hidden");
    }
}

function formatTime(s) {
    var ms = Math.floor(s / 1000);
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