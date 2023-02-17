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
      for (let setting of [...loadedSettings, reloadSetting]) {
        if (setting.id === "fullscreen") {
          continue; // Fullscreen cannot be controlled externally
        }
        let settingContainer = document.createElement("div");
        settingContainer.id = setting.id;
        settingContainer.innerHTML = setting.name;
        settingContainer.onclick = () => {
          toggleSetting(settingContainer, setting.id);
        }
        settingsListContainer.append(settingContainer);
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