function toggleLyrics() {
  toggleVisualPreference(findPreference("show-lyrics"));
}
"lyrics-toggle-button".select().onclick = () => {
  toggleLyrics();
  showToast(`Lyrics ${isPrefEnabled("show-lyrics") ? "enabled" : "disabled"}!`);
}

let lyricsContainer = "lyrics".select();
function refreshLyrics(changes) {
  stopLyricsScroll();
  lyricsContainer.innerHTML = "";
  lyricsContainer.scrollTop = 0;
  fetchAndPrintLyrics(changes);
}

let preloadedNextLyricsId;
let preloadedNextLyrics;
function fetchAndPrintLyrics(changes) {
  let artist = getChange(changes, "currentlyPlaying.artists").value[0];
  let song = fullStrip(getChange(changes, "currentlyPlaying.title").value);

  if (getChange(changes, "currentlyPlaying.id").value === preloadedNextLyricsId && preloadedNextLyrics) {
    printLyrics(preloadedNextLyrics);
    preloadNextLyrics(changes);
  } else if (artist && song) {
    fetchLyrics(artist, song)
      .then(lyrics => printLyrics(lyrics))
      .then(() => preloadNextLyrics(changes));
  }

  function fetchLyrics(artistName, songName) {
    return fetch(`/lyrics?artist=${artistName}&song=${songName}`)
      .then(response => response.text());
  }

  function printLyrics(lyrics) {
    let lyricsContainer = "lyrics".select();
    lyricsContainer.innerHTML = lyrics;

    let hasLyrics = !!lyrics;
    setClass("content-center".select(), "lyrics", hasLyrics);
    if (hasLyrics) {
      lyricsContainer.scrollTop = 0;
      fadeIn(lyricsContainer);
      if (isPrefEnabled("lyrics-simulated-scroll")) {
        scrollLyrics(changes);
      }
    } else {
      showToast("Lyrics not found for current track!");
    }
  }

  function preloadNextLyrics(changes) {
    let nextTrackInQueue = changes.trackData.queue[0];
    let nextArtist = nextTrackInQueue?.artists[0];
    let nextTrackName = nextTrackInQueue?.title;
    fetchLyrics(nextArtist, nextTrackName)
      .then(nextLyrics => {
        preloadedNextLyricsId = nextTrackInQueue.id;
        preloadedNextLyrics = nextLyrics;
      });
  }
}

const lyricsScrollInitialDelayPercentage = 0.25;
let lyricsScrollInterval;
let lyricsScrollIntervalMs = 10;
function scrollLyrics(changes, noDelay = false) {
  stopLyricsScroll();

  let timeCurrent = getChange(changes, "currentlyPlaying.timeCurrent").value;
  let timeTotal = getChange(changes, "currentlyPlaying.timeTotal").value;
  let remainingTime = timeTotal - timeCurrent;

  let visibleHeight = lyricsContainer.offsetHeight;
  let totalHeight = lyricsContainer.scrollHeight;
  let currentScrollPosition = lyricsContainer.scrollTop;

  let pixelsToScroll = totalHeight - visibleHeight - currentScrollPosition;
  let preAndPostBuffer = remainingTime * lyricsScrollInitialDelayPercentage;
  lyricsScrollIntervalMs = (remainingTime * (1 - (lyricsScrollInitialDelayPercentage * 2))) / pixelsToScroll;

  setTimeout(() => {
    startLyricsScroll();
  }, noDelay ? 0 : preAndPostBuffer);
}

function startLyricsScroll() {
  if (!lyricsScrollInterval) {
    lyricsScrollInterval = setInterval(() =>  {
      lyricsContainer.scrollBy(0, 1);
      if (lyricsContainer.scrollHeight - lyricsContainer.scrollTop <= lyricsContainer.clientHeight) {
        stopLyricsScroll();
      }
    }, lyricsScrollIntervalMs);
  }
}

function stopLyricsScroll() {
  clearInterval(lyricsScrollInterval);
  lyricsScrollInterval = null;
}

lyricsContainer.onclick = () => {
  if (!window.getSelection().toString()) {
    if (lyricsScrollInterval) {
      stopLyricsScroll();
    } else {
      scrollLyrics(currentData, true);
    }
  }
};

lyricsContainer.onkeydown = (e) => e.preventDefault();