window.addEventListener('load', initSettingsMenu);

function initSettingsMenu() {
  const settingsWrapper = "settings-categories".select();

  // User integrity check (reset settings after update)
  if (isLocalStorageAvailable()) {
    let storedVersionHash = getVersionHashFromLocalStorage();
    let newVersionHash = calculateVersionHash();
    setVersionHashInLocalStorage(newVersionHash);
    if (!storedVersionHash) {
      showModal(
        "Welcome to SpotifyBigPicture",
        "Please select a preset to proceed...",
        null,
        null,
        "Okay",
        "Okay"
      )
      resetSettings();
    } else if (storedVersionHash !== newVersionHash) {
      showModal(
        "New Version Detected",
        "It looks like you've installed a new version of SpotifyBigPicture. To prevent conflicts arising from the changes in the new version, it is recommended to reset your settings. Reset settings now?",
        () => resetSettings(),
        null,
        "Reset Settings",
        "Keep Settings")
    }
  }

  // Create categories
  let categories = {};
  for (let category of PREFERENCES_CATEGORY_ORDER) {
    let categoryElem = document.createElement("div");
    categoryElem.classList.add("setting-category");
    let categoryElemHeader = document.createElement("div");
    categoryElemHeader.classList.add("setting-category-header");
    categoryElemHeader.title = "Expand/collapse category..."
    categoryElemHeader.innerHTML = category;
    categoryElemHeader.onclick = () => {
      categoryElem.classList.toggle("collapse");
    }
    categoryElem.appendChild(categoryElemHeader);
    settingsWrapper.appendChild(categoryElem);
    categories[category] = categoryElem;
  }

  let quickJumpElem = "settings-quick-jump".select();
  for (let category of PREFERENCES_CATEGORY_ORDER) {
    let quickJumper = document.createElement("div");
    quickJumper.innerHTML = category;
    quickJumper.onclick = () => quickJump(category);
    quickJumpElem.append(quickJumper);
  }

  // Create settings
  for (let prefIndex in PREFERENCES) {
    let pref = PREFERENCES[prefIndex];

    // Subcategory Headers
    if (pref.subcategoryHeader) {
      let prefElem = document.createElement("div");
      prefElem.innerHTML = pref.subcategoryHeader;
      prefElem.classList.add("setting-subcategory-header");
      let categoryElem = categories[pref.category];
      categoryElem.appendChild(prefElem);
    }

    // Create button element
    let prefElem = document.createElement("div");
    prefElem.id = pref.id;
    prefElem.classList.add("setting");
    prefElem.innerHTML = pref.name;
    prefElem.onclick = () => toggleVisualPreference(pref);

    // Tag as unaffected-by-preset where applicable
    if (PREF_IDS_PROTECTED.includes(pref.id)) {
      prefElem.classList.add("unaffected");
    }

    // Group to category
    let categoryElem = categories[pref.category];
    categoryElem.appendChild(prefElem);
  }

  // Create preset buttons
  const settingsPresetsWrapper = "settings-presets".select();
  for (let presetIndex in PREFERENCES_PRESETS) {
    let preset = PREFERENCES_PRESETS[presetIndex];

    let presetElem = document.createElement("div");
    presetElem.id = preset.id;
    presetElem.classList.add("preset");
    presetElem.innerHTML = `<img src="/design/img/presets/${preset.id}.png" alt=${preset.name}>`;

    presetElem.onclick = () => {
      applyPreset(preset);
    };

    settingsPresetsWrapper.append(presetElem);
  }
}

let settingsVisible = false;
let settingsExpertMode = false;
document.addEventListener("mousemove", (e) => handleMouseEvent(e));
document.addEventListener("click", (e) => handleMouseEvent(e));
document.addEventListener("wheel", (e) => handleMouseEvent(e));
let cursorTimeout;
const MOUSE_MOVE_HIDE_TIMEOUT_MS = 1000;

function setMouseVisibility(state) {
  setClass(document.body, "hide-cursor", !state);
}

function handleMouseEvent(e) {
  clearTimeout(cursorTimeout);
  setMouseVisibility(true)

  if (!modalActive) {
    let mouseMoveButtons = "mouse-move-buttons".select();
    setClass(mouseMoveButtons, "show", true);

    if (!settingsVisible && !isHoveringControlElem(e.target)) {
      cursorTimeout = setTimeout(() => {
        setMouseVisibility(false);
        setClass(mouseMoveButtons, "show", false);
      }, MOUSE_MOVE_HIDE_TIMEOUT_MS);
    }
  }
}

window.addEventListener('load', initSettingsMouseMove);

function printSettingDescription(event) {
  let target = event.target;
  if (target?.classList) {
    if (target.parentNode.classList.contains("preset")) {
      target = target.parentNode;
    }
    if (target.classList.contains("setting") || target.classList.contains("preset")) {
      let pref = findPreference(target.id) || findPreset(target.id);
      if (pref) {
        setSettingDescription(
          (pref.category === "Presets" ? "Preset: " : "") + pref.name,
          pref.description,
          PREF_IDS_PROTECTED.includes(pref.id)
        )
        setDescriptionVisibility(true);
      }
    } else {
      setDescriptionVisibility(false);
    }
  }
}

function setSettingDescription(headerText, descriptionText, isUnaffected, overriddenRootId) {
  let header = "settings-description-header".select();
  let description = "settings-description-description".select();
  let unaffected = "settings-description-unaffected".select();
  let overridden = "settings-description-overridden".select();

  header.innerHTML = headerText;
  description.innerHTML = descriptionText;
  unaffected.innerHTML = isUnaffected ? "Protected: This setting is unaffected by changing presets" : "";

  if (overriddenRootId) {
    overridden.innerHTML = [...overriddenRootId.classList]
      .filter(className => className.startsWith("overridden-"))
      .map(className => findPreference(className.replace("overridden-", "")))
      .map(pref => pref.category + " &#x00BB; " + pref.name)
      .join(" // ");
  }
}

function setDescriptionVisibility(state) {
  let settingsDescriptionContainer = "settings-description".select();
  setClass(settingsDescriptionContainer, "show", state);
}

function initSettingsMouseMove() {
  setMouseVisibility(false);
  let settingsWrapper = "settings-wrapper".select();

  let settingsMenuToggleButton = "settings-menu-toggle-button".select();
  settingsMenuToggleButton.onclick = (e) => {
    if (DEV_MODE && e.shiftKey) {
      generatePresetThumbnail();
    } else {
      requestAnimationFrame(() => toggleSettingsMenu());
    }
  };
  if (!DEV_MODE) {
    "preset-thumbnail-generator-canvas".select().remove();
  }

  "nosleep-lock-button".select().onclick = () => {
    toggleNoSleepMode();
  };

  "fullscreen-toggle-button".select().onclick = () => {
    toggleFullscreen();
  };

  "settings-expert-mode-toggle".select().onclick = () => {
    toggleSettingsExpertMode();
  };

  "settings-reset".select().onclick = () => {
    resetSettingsPrompt();
  };

  "settings-shutdown".select().onclick = () => {
    shutdownPrompt();
  };

  document.body.onclick = (e) => {
    if (modalActive && !"modal".select().contains(e.target)) {
      hideModal();
    } else if (settingsVisible && !isSettingControlElem(e) && !isRenderingPreferenceChange()) {
      setSettingsMenuState(false);
    }
  }

  document.addEventListener("dblclick", (e) => {
    if (isPrefEnabled("fullscreen-double-click") && !settingsVisible && !window.getSelection().toString() && !isHoveringControlElem(e.target)) {
      toggleFullscreen();
    }
  });

  settingsWrapper.onmousemove = (event) => updateSettingDescription(event);
  settingsWrapper.onmousedown = (event) => updateSettingDescription(event);
  "settings-scroller".select().onscroll = () => setDescriptionVisibility(false); // to avoid mismatches
}

function updateSettingDescription(event) {
  requestAnimationFrame(() => clearTimeout(cursorTimeout));
  printSettingDescription(event);
}

function isSettingControlElem(e) {
  return !"main".select().contains(e.target);
}

function isHoveringControlElem(target) {
  return target && "mouse-move-buttons".select().contains(target) && !"playback-controller".select().contains(target);
}

function toggleSettingsMenu() {
  setSettingsMenuState(!settingsVisible);
}

function setSettingsMenuState(state) {
  settingsVisible = state;
  setMouseVisibility(settingsVisible)

  let mouseMoveButtons = "mouse-move-buttons".select();
  setClass(mouseMoveButtons, "settings-active", settingsVisible);

  let settingsWrapper = "settings-wrapper".select();
  let mainBody = "main".select();
  setClass(settingsWrapper, "show", settingsVisible);
  setClass(mainBody, "scale-down", settingsVisible);
}

function toggleSettingsExpertMode() {
  let newState = !settingsExpertMode;
  setExpertMode(newState);
}

function setExpertMode(state) {
  settingsExpertMode = state;
  setExpertModeStateInLocalStorage(state)
  setClass("settings-wrapper".select(), "expert", state);
  setClass("settings-quick-jump".select(), "show", state);
}

function resetSettingsPrompt() {
  showModal("Reset", "Do you really want to reset all settings to their default state?",
    () => resetSettings(),
    null,
    "Reset Settings",
    "Cancel");
}

function resetSettings() {
  PREFERENCES.filter(pref => pref.default).flat().forEach(id => setVisualPreferenceFromId(id, true));
  PREFERENCES.filter(pref => !pref.default).flat().forEach(id => setVisualPreferenceFromId(id, false));
  clearLocalStoragePortraitModePresetPromptPreference();
  localStorage.removeItem(LOCAL_STORAGE_KEY_SETTINGS);
  applyDefaultPreset();
  console.warn("Settings have been reset!")
}

function shutdownPrompt() {
  showModal("Shutdown", "Exit SpotifyBigPicture?", () => {
    showModal("Logout", "Do you also want to log out? You will have to re-enter your credentials on the next startup!",
      () => shutdown(true),
      () => shutdown(false),
      "Logout",
      "Cancel"
    )
  })

  function shutdown(logout) {
    fetch(`/shutdown?logout=${logout}`, {method: 'POST'})
      .then(response => {
        if (response.status === 200) {
          setSettingsMenuState(false);
          enableIdleMode();
          showModal("Shutdown", "Successfully shut down! You may close this tab now.");
        } else {
          showModal("Error", "Failed to shut down! Are the playback controls disabled?");
        }
      });
  }
}

function scrollSettingsUpDown(direction) {
  let settingsScroller = "settings-scroller".select();
  let velocity = settingsScroller.offsetHeight / 2;

  settingsScroller.scroll({
    top: settingsScroller.scrollTop + (velocity * direction),
    left: 0,
    behavior: isPrefEnabled("transitions") ? 'smooth' : 'auto'
  });
}

// noinspection JSUnresolvedFunction
let nosleep = new NoSleep();
let nosleepActive = false;
function toggleNoSleepMode() {
  nosleepActive = !nosleepActive;
  if (nosleepActive) {
    nosleep.enable();
    showToast("No-sleep mode enabled!")
  } else {
    nosleep.disable();
    showToast("No-sleep mode disabled!")
  }
  setClass("nosleep-lock-button".select(), "enabled", nosleepActive);
}

// hidden feature
function generatePresetThumbnail() {
  let thumbnailGenerationEnabled = "main".select().classList.toggle("preset-thumbnail-generator");
  if (thumbnailGenerationEnabled) {
    let prerenderCanvas = setClass("prerender-canvas".select(), "show", true); // needed because rect would return all 0px otherwise

    let artworkBoundingBox = "artwork-img".select().getBoundingClientRect();

    let fakeArtwork = document.createElement("div");
    fakeArtwork.id = "fake-artwork";
    fakeArtwork.style.top = artworkBoundingBox.top + "px";
    fakeArtwork.style.left = artworkBoundingBox.left + "px";
    fakeArtwork.style.width = artworkBoundingBox.width + "px";
    fakeArtwork.style.height = artworkBoundingBox.width + "px";

    let contentMain = "content".select();
    contentMain.insertBefore(fakeArtwork, contentMain.firstChild);

    let content = "content".select();
    let presetThumbnailGeneratorCanvas = "preset-thumbnail-generator-canvas".select();

    // noinspection JSUnresolvedFunction
    domtoimage.toPng(content, {
        width: window.innerWidth,
        height: window.innerHeight
      })
      .then(imgDataBase64 => {
        setClass(presetThumbnailGeneratorCanvas, "show", true);
        let downloadLink = document.createElement('a');
        downloadLink.href = `${imgDataBase64}`;
        downloadLink.download = "preset-thumbnail.png";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        fakeArtwork.remove();
        "main".select().classList.remove("preset-thumbnail-generator");
        setClass(presetThumbnailGeneratorCanvas, "show", false);

        setClass(prerenderCanvas, "show", isPrefEnabled("prerender-background"));
      });
  }
}

function quickJump(targetCategoryName) {
  let settingsCategories = "settings-categories".select();
  let allCategories = settingsCategories.querySelectorAll(".setting-category-header");
  let jumpResult = [...allCategories].find(elem => elem.innerText.startsWith(targetCategoryName));
  if (jumpResult) {
    let settingsScroller = "settings-scroller".select();
    let y = jumpResult.offsetTop - settingsScroller.offsetTop - 35;
    settingsScroller.scroll({
      top: y,
      left: 0,
      behavior: 'smooth'
    });
  }
}
