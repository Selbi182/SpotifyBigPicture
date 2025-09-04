const DEV_MODE = new URLSearchParams(document.location.search).has("dev");
if (DEV_MODE) {
  console.info("Developer Mode enabled!");
}

window.addEventListener('load', () => {
  if (DEV_MODE) {
    console.info(`${PREFERENCES.length} settings // ${PREFERENCES_PRESETS.length} presets // ${PREFERENCES_CATEGORY_ORDER.length} categories`)

    // Anomaly check for presets
    for (let preset of PREFERENCES_PRESETS) {
      preset.enabled.forEach(prefId => {
        if (PREF_IDS_DEFAULT_ENABLED.includes(prefId)) {
          console.warn(`${preset.name}: ${prefId} is redundantly set to enabled`);
        }
      });
      preset.disabled.forEach(prefId => {
        if (PREF_IDS_DEFAULT_DISABLED.includes(prefId)) {
          console.warn(`${preset.name}: ${prefId} is redundantly set to disabled`);
        }
      });

      [preset.enabled, preset.disabled].flat().forEach(prefId => {
        if (PREF_IDS_PROTECTED.includes(prefId)) {
          console.warn(`${preset.name}: ${prefId} is being used in a preset despite being marked as protected`);
        }
      });
    }
  }
});