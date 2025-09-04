let prefSearchCache = {};

window.addEventListener('load', initVisualPreferences);

function initVisualPreferences() {
  if (isLocalStorageAvailable()) {
    let visualPreferencesFromLocalStorage = getVisualPreferencesFromLocalStorage();
    if (visualPreferencesFromLocalStorage) {
      // Init setting states from local storage (dark mode is auto-disabled on page refresh)
      for (let pref of PREFERENCES) {
        let state = (pref.id !== "dark-mode")
          ? visualPreferencesFromLocalStorage.includes(pref.id)
          : false;
        refreshPreference(pref, state);
      }

      let expertModeStateFromLocalStorage = getExpertModeStateFromLocalStorage();
      setExpertMode(expertModeStateFromLocalStorage === "true");
    } else {
      // On first load, apply the default preset and enable the ignoreDefaultOn settings. Then force-open the settings menu
      applyDefaultPreset();
    }
  }
  submitVisualPreferencesToBackend();
}

function findPreference(id) {
  if (id in prefSearchCache) {
    return prefSearchCache[id];
  }
  let pref = PREFERENCES.find(pref => pref.id === id);
  prefSearchCache[id] = pref;
  return pref;
}

function findPreset(id) {
  return PREFERENCES_PRESETS.find(preset => preset.id === id);
}

function isPrefEnabled(id) {
  let pref = findPreference(id);
  return pref.state; // needs to be new line so the IDE doesn't complain about "state" not existing for some reason
}


function applyDefaultPreset() {
  applyPreset(PREFERENCES_PRESETS.find(preset => preset.id === "preset-default"));
  PREFERENCES.filter(pref => pref.default && pref.protected).forEach(pref => {
    setVisualPreferenceFromId(pref.id, true);
  });
  requestAnimationFrame(() => {
    setSettingsMenuState(true);
  });
}

function submitVisualPreferencesToBackend() {
  let simplifiedPrefs = [...PREFERENCES_PRESETS, ...PREFERENCES]
    .sort((a, b) => PREFERENCES_CATEGORY_ORDER.indexOf(a.category) - PREFERENCES_CATEGORY_ORDER.indexOf(b.category))
    .map(pref => {
      return {
        id: pref.id,
        name: pref.name,
        category: pref.category,
        subcategoryHeader: pref.subcategoryHeader,
        description: pref.description,
        state: pref.state
      }
    });

  fetch("/settings/list", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(simplifiedPrefs)
  })
    .then(response => {
      if (response.status >= 400) {
        console.warn("Failed to transmit settings to backend");
      }
    })
}

const LOCAL_STORAGE_TEST_KEY = "local_storage_availability_test";
let localStorageAvailable = null;

function isLocalStorageAvailable() {
  if (localStorageAvailable === null) {
    try {
      localStorage.setItem(LOCAL_STORAGE_TEST_KEY, LOCAL_STORAGE_TEST_KEY);
      localStorage.removeItem(LOCAL_STORAGE_TEST_KEY);
      localStorageAvailable = true;
    } catch (e) {
      localStorageAvailable = false;
    }
  }
  return localStorageAvailable;
}

const LOCAL_STORAGE_KEY_SETTINGS = "visual_preferences";
const LOCAL_STORAGE_SETTINGS_SPLIT_CHAR = "+";
function getVisualPreferencesFromLocalStorage() {
  if (localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS)) {
    let storedVisualPreferences = localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS);
    return storedVisualPreferences?.split(LOCAL_STORAGE_SETTINGS_SPLIT_CHAR);
  }
  return null;
}

function refreshPrefsLocalStorage() {
  if (isLocalStorageAvailable()) {
    let enabledPreferences = PREFERENCES
      .filter(pref => pref.state)
      .map(pref => pref.id)
      .join(LOCAL_STORAGE_SETTINGS_SPLIT_CHAR);
    localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, enabledPreferences);
  }
}

const LOCAL_STORAGE_KEY_VERSION_HASH = "version_hash";
function getVersionHashFromLocalStorage() {
  return localStorage.getItem(LOCAL_STORAGE_KEY_VERSION_HASH);
}

function setVersionHashInLocalStorage(newVersionHash) {
  return localStorage.setItem(LOCAL_STORAGE_KEY_VERSION_HASH, newVersionHash);
}

function calculateVersionHash() {
  // the generated hash is really just the total length of all setting IDs concatenated
  let pseudoHash = [...PREF_IDS_ALL].reduce((totalLength, str) => totalLength + str.length, 0);
  return pseudoHash.toString();
}

const LOCAL_STORAGE_KEY_EXPERT_MODE = "expert_mode";
function getExpertModeStateFromLocalStorage() {
  return localStorage.getItem(LOCAL_STORAGE_KEY_EXPERT_MODE);
}

function setExpertModeStateInLocalStorage(state) {
  return localStorage.setItem(LOCAL_STORAGE_KEY_EXPERT_MODE, state);
}

function toggleVisualPreference(pref) {
  setVisualPreference(pref, !pref.state);
}

function setVisualPreferenceFromId(prefId, newState) {
  setVisualPreference(findPreference(prefId), newState);
}

function setVisualPreference(pref, newState) {
  if (pref) {
    refreshPreference(pref, newState);
    refreshPrefsLocalStorage();
  }
}

let refreshContentTimeout;

function isRenderingPreferenceChange() {
  return !!refreshContentTimeout;
}

function refreshPreference(preference, state) {
  preference.state = state;

  if ('callback' in preference) {
    preference.callback(state);
  }
  if ('css' in preference) {
    for (let id in preference.css) {
      let targetClassRaw = preference.css[id].toString();
      let targetClass = targetClassRaw.replace("!", "");
      let targetState = targetClassRaw.startsWith("!") ? !state : state;
      setClass(id.select(), targetClass, targetState)
    }
  }

  // Refresh Background and Tracklist, but only do it once per preset application
  clearTimeout(refreshContentTimeout);
  refreshContentTimeout = setTimeout(() => {
    refreshAll();
    refreshContentTimeout = null;
  }, getTransitionFromCss());

  // Update the settings that are invalidated
  updateOverridden(preference);

  // Toggle Checkmark
  let prefElem = preference.id.select();
  if (prefElem) {
    setClass(prefElem, "on", state);
  }
}

function updateOverridden(preference) {
  let prefElem = preference.id.select();
  if (prefElem) {
    let state = preference.state && !prefElem.classList.toString().includes("overridden-");
    if ('requiredFor' in preference) {
      preference.requiredFor.forEach(override => {
        setClass(override.select(), `overridden-${preference.id}`, !state);
        updateOverridden(findPreference(override));
      });
    }
    if ('overrides' in preference) {
      preference.overrides.forEach(override => {
        setClass(override.select(), `overridden-${preference.id}`, state);
        updateOverridden(findPreference(override));
      });
    }
  }
}

function applyPreset(preset) {
  "main".select().style.setProperty("--artwork-size", "0");

  [PREF_IDS_DEFAULT_ENABLED, preset.enabled].flat()
    .filter(prefId => !PREF_IDS_PROTECTED.includes(prefId))
    .filter(prefId => !preset.disabled.includes(prefId))
    .forEach(prefId => setVisualPreferenceFromId(prefId, true));

  [PREF_IDS_DEFAULT_DISABLED, preset.disabled].flat()
    .filter(prefId => !PREF_IDS_PROTECTED.includes(prefId))
    .filter(prefId => !preset.enabled.includes(prefId))
    .forEach(prefId => setVisualPreferenceFromId(prefId, false));
}

function updateExternallyToggledPreferences(changes) {
  return new Promise(resolve => {
    let reload = false;
    if (changes.settingsToToggle?.length > 0) {
      for (let setting of changes.settingsToToggle) {
        if (setting.startsWith("dark-mode-")) {
          setDarkModeIntensity(setting);
          setting = "dark-mode";
        }
        if (setting === "reload") {
          reload = true;
        } else {
          let preference = findPreference(setting);
          if (preference) {
            toggleVisualPreference(preference);
            showToast(`'${preference.name}' ${preference.state ? "enabled" : "disabled"} via remote`);
          } else {
            let preset = findPreset(setting);
            if (preset) {
              applyPreset(preset);
              showToast(`Preset ${preset.name} applied via remote`);
              requestAnimationFrame(() => {
                setMouseVisibility(false);
              });
            }
          }
        }
      }
      changes.settingsToToggle = [];
      if (reload) {
        reloadPage();
      }
    }
    resolve();
  });
}

function toggleFullscreen() {
  if (document.fullscreenEnabled) {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then();
    } else {
      document.exitFullscreen().then();
    }
  }
}

"fullscreen-toggle-button".select().onclick = () => {
  toggleFullscreen();
};

document.addEventListener("dblclick", (e) => {
  if (isPrefEnabled("fullscreen-double-click") && !settingsVisible && !window.getSelection().toString() && !isHoveringControlElem(e.target)) {
    toggleFullscreen();
  }
});

function toggleDarkMode() {
  toggleVisualPreference(findPreference("dark-mode"));
}

function setDarkModeIntensity(setting) {
  let intensity = parseInt(setting.replace("dark-mode-", "")) / 100;
  "dark-overlay".select().style.setProperty("--dark-intensity", intensity.toString());
}

const OPACITY_TIMEOUT = 2 * 1000;
let volumeTimeout;

function handleVolumeChange(volume, device, customVolumeSettings) {
  let volumeContainer = "volume".select();
  let volumeTextContainer = "volume-text".select();

  let volumeWithPercent = volume + "%";

  let customVolumeSetting = customVolumeSettings.find(setting => setting.device === device);
  if (customVolumeSetting) {
    let baseDb = customVolumeSetting.baseDb;
    let db = (volume - baseDb).toFixed(1).replace("-", "&#x2212;");
    volumeTextContainer.innerHTML = db + " dB";
  } else {
    volumeTextContainer.innerHTML = volumeWithPercent;
  }
  volumeContainer.style.setProperty("--volume", volumeWithPercent);

  volumeContainer.classList.add("active");
  clearTimeout(volumeTimeout);
  volumeTimeout = setTimeout(() => {
    volumeContainer.classList.remove("active");
  }, OPACITY_TIMEOUT);
}

let deviceTimeout;
function handleDeviceChange(device) {
  let deviceContainer = "device".select();
  deviceContainer.innerHTML = device;

  deviceContainer.classList.add("active");
  clearTimeout(deviceTimeout);
  deviceTimeout = setTimeout(() => {
    deviceContainer.classList.remove("active");
  }, OPACITY_TIMEOUT);
}