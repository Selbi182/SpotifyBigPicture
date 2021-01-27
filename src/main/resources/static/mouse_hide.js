// Hide cursor automatically when not being moved
var cursorTimeout;
document.addEventListener("mousemove", () => {
	document.querySelector("body").style.cursor = "default";
	clearTimeout(cursorTimeout);
	cursorTimeout = setTimeout(() => {
		document.querySelector("body").style.cursor = "none"
	}, 500);
});
