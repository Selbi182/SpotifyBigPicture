// Hide cursor automatically when not being moved
var cursorTimeout;
document.addEventListener("mousemove", () => {
	document.querySelector("body").style.cursor = "default";
	document.getElementById("settings").style.display = "inherit"
	clearTimeout(cursorTimeout);
	cursorTimeout = setTimeout(() => {
		document.querySelector("body").style.cursor = "none";
		document.getElementById("settings").style.display = "none";
	}, 1000);
});

function toggleFullscreen() {
	let elem = document.documentElement;
	if (!document.fullscreenElement) {
		if (elem.requestFullscreen) {
			elem.requestFullscreen();
		}
	} else {
	    if (document.exitFullscreen) {
	    	document.exitFullscreen();
	    }
	}
}

function toggleDarkMode() {
	let overlay = document.getElementById("dark-overlay").style;
	if (overlay.display == "none") {
		overlay.display = "inherit";
	} else {
		overlay.display = "none";
	}
}