const reloadSetting = {
  id: "reload",
  name: "Reload Interface"
}

let loadedSettings;

fetch("/settings/list")
    .then(response => response.json())
    .then(json => loadedSettings = json)
    .then(() => {
      let settingsListContainer = document.getElementById("settings");
      let categories = {};
      for (let setting of [...loadedSettings, reloadSetting]) {
        if (setting.id === "fullscreen") {
          continue; // Fullscreen cannot be controlled externally
        }

        let settingContainer = document.createElement("div");
        settingContainer.id = setting.id;
        settingContainer.classList.add("setting");
        settingContainer.innerHTML = setting.name;
        settingContainer.onclick = () => {
          toggleSetting(settingContainer, setting.id);
        }

        // Group to category
        if (!setting.category) {
          setting.category = "Misc";
        }
        if (!categories.hasOwnProperty(setting.category)) {
          let categoryElem = document.createElement("div");
          categoryElem.classList.add("setting-category");
          let categoryElemHeader = document.createElement("div");
          categoryElemHeader.classList.add("setting-category-header");
          categoryElemHeader.innerHTML = setting.category;
          categoryElemHeader.onclick = () => {
            if (categoryElem.classList.contains("expand")) {
              categoryElem.classList.remove("expand");
            } else {
              categoryElem.classList.add("expand");
            }
          }
          categoryElem.appendChild(categoryElemHeader);
          settingsListContainer.appendChild(categoryElem);
          categories[setting.category] = categoryElem;
        }
        let categoryElem = categories[setting.category];
        categoryElem.appendChild(settingContainer);
      }
    })

document.getElementById("expand-button").onclick = () => {
  expandAll();
}

function toggleSetting(settingContainer, settingId) {
  if (!settingContainer.classList.contains("disabled")) {
    settingContainer.classList.add("disabled");
    fetch("/settings/toggle/" + settingId, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: settingId
    })
      .then(response => {
        if (response.status >= 200 && response.status < 300) {
        } else if (response.status >= 400) {
          console.warn("Failed to transmit settings to backend");
        }
      }).finally(() => {
        setTimeout(() => {
          settingContainer.classList.remove("disabled")
        }, 1000);
      })
  }
}

function expandAll() {
  document.getElementById("expand-button").classList.add("hide");
  document.getElementById("settings").classList.add("expand");
}