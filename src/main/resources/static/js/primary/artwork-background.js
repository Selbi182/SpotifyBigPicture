const DEFAULT_IMAGE = 'design/img/blank-cd.png';
const DEFAULT_IMAGE_COLORS = {
  primary: {
    r: 255,
    g: 255,
    b: 255
  },
  secondary: {
    r: 255,
    g: 255,
    b: 255
  },
  averageBrightness: 1.0
}

let nextImagePrerenderCanvasData;
unsetNextImagePrerender().then();

function changeImage(changes) {
  return new Promise(resolve => {
    let imageUrl = isPrefEnabled("hd-artwork")
      ? getChange(changes, "currentlyPlaying.imageData.imageUrlHD")
      : getChange(changes, "currentlyPlaying.imageData.imageUrl");

    if (imageUrl.wasChanged) {
      if (imageUrl.value === BLANK) {
        imageUrl.value = DEFAULT_IMAGE;
      }
      let oldImageUrl = currentData.currentlyPlaying.imageData.imageUrl;
      let newImageUrl = imageUrl.value.toString();
      let colors = getChange(changes, "currentlyPlaying.imageData.imageColors").value;
      if (!oldImageUrl.includes(newImageUrl)) {
        if (nextImagePrerenderCanvasData.imageUrl === newImageUrl) {
          setRenderedBackground(nextImagePrerenderCanvasData.canvasData)
            .then(() => resolve());
        } else {
          setArtworkAndPrerender(newImageUrl, colors)
            .then(pngData => setRenderedBackground(pngData))
            .then(() => resolve());
        }
      } else {
        resolve();
      }
    } else {
      resolve();
    }
  });
}

let nextPrerenderInProgress = false;

function prerenderNextImage(changes) {
  return new Promise(resolve => {
    if (!nextPrerenderInProgress) {
      nextPrerenderInProgress = true;
      let prerenderEnabled = isPrefEnabled("prerender-background");
      if (prerenderEnabled) {
        let currentImageUrl = getChange(changes, "currentlyPlaying.imageData.imageUrl").value;
        let nextImageUrl = getChange(changes, "trackData.nextImageData.imageUrl").value;
        if (currentImageUrl !== nextImageUrl && nextImagePrerenderCanvasData.imageUrl !== nextImageUrl) {
          setTimeout(() => {
            nextImageUrl = isPrefEnabled("hd-artwork")
              ? getChange(changes, "trackData.nextImageData.imageUrlHD").value
              : nextImageUrl;

            let nextImageColors = getChange(changes, "trackData.nextImageData.imageColors").value;
            setArtworkAndPrerender(nextImageUrl, nextImageColors)
              .then(canvasData => {
                nextImagePrerenderCanvasData = {
                  imageUrl: nextImageUrl,
                  canvasData: canvasData
                };
                nextPrerenderInProgress = false;
              });
          }, getTransitionFromCss())
        }
      }
    }
    resolve();
  });
}

function setRenderedBackground(canvas) {
  return new Promise((resolve) => {
    // Set old background to fade out and then delete it
    // (In theory, should only ever be one, but just in case, do it for all children)
    let transitionsEnabled = isPrefEnabled("transitions");
    let backgroundRenderedWrapper = "background-rendered".select();
    backgroundRenderedWrapper.childNodes.forEach(child => {
      if (transitionsEnabled) {
        child.ontransitionend = () => child.remove();
        child.classList.add("crossfade");
      } else {
        child.remove();
      }
    });

    // Add the new canvas
    backgroundRenderedWrapper.append(canvas);
    resolve();
  });
}

function setArtworkAndPrerender(newImageUrl, colors) {
  return new Promise((resolve) => {
    if (!newImageUrl) {
      newImageUrl = DEFAULT_IMAGE;
      colors = DEFAULT_IMAGE_COLORS;
    }
    Promise.all([
        loadArtwork(newImageUrl),
        loadBackground(newImageUrl, colors)
      ])
      .then(() => prerenderBackground())
      .then(canvasData => resolve(canvasData));
  });
}

function loadArtwork(newImage) {
  return new Promise((resolve) => {
    calculateAndRefreshArtworkSize();
    let artwork = "artwork-img".select();
    artwork.onload = () => {
      resolve();
    }
    artwork.src = newImage;
  });
}

function calculateAndRefreshArtworkSize() {
  let main = "main".select();
  let artwork = "artwork".select();

  artwork.style.removeProperty("margin-top");
  artwork.style.removeProperty("--margin-multiplier");

  let settingsEnabled = settingsVisible;
  if (settingsEnabled) {
    main.style.transform = "unset";
    main.style.transition = "unset";
  }

  let artworkSize = 0;
  if (isPrefEnabled("display-artwork")) {
    let contentCenterContainer = "content-center".select();
    let centerRect = contentCenterContainer.getBoundingClientRect();
    let centerTop = centerRect.top;
    let centerBottom = centerRect.bottom;

    let topRect = "content-top".select().getBoundingClientRect();
    let bottomRect = "content-bottom".select().getBoundingClientRect();
    let topEnabled = isPrefEnabled("enable-top-content");
    let contentTop = topEnabled ? topRect.top : centerRect.top;
    let bottomEnabled = isPrefEnabled("enable-bottom-content");
    let contentBottom = bottomEnabled ? bottomRect.bottom : centerRect.bottom;

    let swapTopBottom = isPrefEnabled("swap-top-bottom");
    if (swapTopBottom) {
      contentTop = bottomEnabled ? bottomRect.top : centerRect.top;
      contentBottom = topEnabled ? topRect.bottom : centerRect.bottom;
    }

    artworkSize = centerBottom - centerTop;

    let expandTop = !topEnabled || isPrefEnabled("artwork-expand-top");
    let expandBottom = !bottomEnabled || isPrefEnabled("artwork-expand-bottom");
    if (swapTopBottom) {
      [expandTop, expandBottom] = [expandBottom, expandTop];
    }
    if (expandTop && expandBottom) {
      artworkSize = contentBottom - contentTop;
    } else if (expandTop) {
      artworkSize = centerBottom - contentTop;
    } else if (expandBottom) {
      artworkSize = contentBottom - centerTop;
    }

    if (!expandTop || !expandBottom) {
      artworkSize = Math.min(centerRect.width, artworkSize);
    }

    contentCenterContainer.style.removeProperty("--bonus-padding");
    if (isPrefEnabled("artwork-above-content") && !isPrefEnabled("show-queue")) {
      contentCenterContainer.style.setProperty("padding-top", "0");
      let contentCenterMainHeight = "center-info-main".select().getBoundingClientRect().height;

      artworkSize -= contentCenterMainHeight;
      if (expandTop) {
        artworkSize -= contentTop;
        contentCenterContainer.style.setProperty("--bonus-padding", -(contentTop * 2) + "px");
      }
      contentCenterContainer.style.removeProperty("padding-top");
    }

    let topMargin = expandTop ? contentTop : centerTop;
    artwork.style.marginTop = topMargin + "px";

    setClass(artwork, "double-margins", !expandTop && !expandBottom && isPrefEnabled("center-lr-margins"));
  }

  main.style.setProperty("--artwork-size", artworkSize + "px");

  if (settingsEnabled) {
    main.style.removeProperty("transform");
    main.style.removeProperty("transition");
    finishAnimations(main);
  }
}

function loadBackground(newImage, colors) {
  return new Promise((resolve) => {
    let backgroundCanvasImg = "background-canvas-img".select();
    backgroundCanvasImg.onload = () => {
      let rgbOverlay = colors.secondary;
      let averageBrightness = colors.averageBrightness;
      let backgroundCanvasOverlay = "background-canvas-overlay".select();
      let grainOverlay = "grain".select();

      let backgroundColorOverlay = `rgb(${rgbOverlay.r}, ${rgbOverlay.g}, ${rgbOverlay.b})`;
      "background-canvas".select().style.setProperty("--background-color", backgroundColorOverlay);

      backgroundCanvasOverlay.style.setProperty("--background-brightness", averageBrightness);
      setClass(backgroundCanvasOverlay, "brighter", averageBrightness < 0.2);
      setClass(backgroundCanvasOverlay, "darker", averageBrightness > 0.4);
      grainOverlay.style.setProperty("--intensity", averageBrightness);
      resolve();
    };
    backgroundCanvasImg.src = newImage;
  });
}

function prerenderBackground() {
  return new Promise((resolve) => {
    let prerenderCanvas = "prerender-canvas".select();
    setClass(prerenderCanvas, "show", true);

    // noinspection JSUnresolvedFunction
    domtoimage
      .toCanvas(prerenderCanvas, {
        width: window.innerWidth,
        height: window.innerHeight
      })
      .then(canvas => {
        setClass(prerenderCanvas, "show", false);
        resolve(canvas);
      })
  });
}

let refreshBackgroundRenderInProgress = false;

function refreshBackgroundRender() {
  if (!refreshBackgroundRenderInProgress) {
    refreshBackgroundRenderInProgress = true;
    unsetNextImagePrerender()
      .then(() => {
        let imageUrl = isPrefEnabled("hd-artwork")
          ? currentData.currentlyPlaying.imageData.imageUrlHD
          : currentData.currentlyPlaying.imageData.imageUrl;

        let imageColors = currentData.currentlyPlaying.imageData.imageColors;
        if (imageUrl === BLANK) {
          imageUrl = DEFAULT_IMAGE;
          imageColors = DEFAULT_IMAGE_COLORS;
        }
        if (imageUrl && imageColors) {
          setArtworkAndPrerender(imageUrl, imageColors)
            .then(pngData => setRenderedBackground(pngData));
        }
      })
      .finally(() => {
        refreshBackgroundRenderInProgress = false;
      });
  }
}

function unsetNextImagePrerender() {
  return new Promise((resolve) => {
    nextImagePrerenderCanvasData = {
      imageUrl: null,
      pngData: null
    };
    resolve();
  });
}

const MIN_PERCEIVED_BRIGHTNESS = 0.7;
function setTextColor(rgbText) {
  let r = rgbText.r;
  let g = rgbText.g;
  let b = rgbText.b;

  // Calculate perceived brightness of color and fall back to white if it's under a certain threshold
  // (Formula taken from: http://alienryderflex.com/hsp.html)
  let perceivedBrightness = Math.sqrt(0.299 * Math.pow(r, 2) + 0.587 * Math.pow(g, 2) + 0.114 * Math.pow(b, 2)) / 255;
  if (perceivedBrightness < MIN_PERCEIVED_BRIGHTNESS) {
    [r, g, b] = [255, 255, 255];
  }

  let rgbCss = `rgb(${r}, ${g}, ${b})`;
  document.documentElement.style.setProperty("--color", rgbCss);
}




///////////////////////////////
// REFRESH IMAGE ON RESIZE
///////////////////////////////

let mobileView = null;

function refreshPortraitModeState() {
  mobileView = window.matchMedia("screen and (max-aspect-ratio: 3/2)").matches;
}

function isPortraitMode() {
  if (mobileView === null) {
    refreshPortraitModeState();
  }
  return mobileView;
}

let wasPreviouslyInPortraitMode = false;
let refreshBackgroundEvent;

const LOCAL_STORAGE_KEY_PORTRAIT_PROMPT_ENABLED = "portrait_mode_prompt_enabled";
let portraitModePresetSwitchPromptEnabled = true;
window.addEventListener('load', () => {
  let localStoragePortraitPromptEnabled = localStorage.getItem(LOCAL_STORAGE_KEY_PORTRAIT_PROMPT_ENABLED);
  if (localStoragePortraitPromptEnabled) {
    portraitModePresetSwitchPromptEnabled = localStoragePortraitPromptEnabled === "true";
  }
})

function portraitModePresetSwitchPrompt() {
  refreshPortraitModeState();
  let portraitMode = isPortraitMode();
  if (portraitModePresetSwitchPromptEnabled && !wasPreviouslyInPortraitMode && portraitMode && !isPrefEnabled("artwork-above-content")) {
    showModal(
      "Portrait Mode",
      "It seems like you're using the app in portrait mode. Would you like to switch to the design optimized for vertical aspect ratios?",
      () => applyPreset(PREFERENCES_PRESETS.find(preset => preset.id === "preset-vertical")),
      () => {
        showModal(
          "Portrait Mode",
          "No longer show this prompt when resizing windows?",
          () => {
            portraitModePresetSwitchPromptEnabled = false;
            localStorage.setItem(LOCAL_STORAGE_KEY_PORTRAIT_PROMPT_ENABLED, "false");
          },
          null,
          "Disable Prompts",
          "Keep Prompts"
        )
      },
      "Switch to Portrait Mode",
      "Cancel");
  }
  wasPreviouslyInPortraitMode = portraitMode;
}

function clearLocalStoragePortraitModePresetPromptPreference() {
  portraitModePresetSwitchPromptEnabled = true;
  localStorage.removeItem(LOCAL_STORAGE_KEY_PORTRAIT_PROMPT_ENABLED);
}

window.addEventListener("resize", () => {
  clearTimeout(refreshBackgroundEvent);
  refreshBackgroundEvent = setTimeout(() => {
    if (isTabVisible()) {
      portraitModePresetSwitchPrompt();
    }
    refreshAll();
  }, getTransitionFromCss());
});