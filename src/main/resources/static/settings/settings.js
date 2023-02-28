const reloadSetting = {
  id: "reload",
  name: "Reload Interface",
  description: "Trigger a page reload request to the interface. Use this if the app becomes unresponsive"
}

let loadedSettings;

fetch("/settings/list")
    .then(response => response.json())
    .then(json => loadedSettings = json)
    .then(() => {
      let settingsListContainer = document.getElementById("settings");
      let categories = {};
      for (let setting of [...loadedSettings, reloadSetting]) {
        let settingContainer = document.createElement("div");
        settingContainer.id = setting.id;
        settingContainer.classList.add("setting");
        settingContainer.innerHTML = setting.name;
        if (setting.description) {
          settingContainer.innerHTML += `<div class="setting-description">${setting.description}</div>`;
        }
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

        // Setup show descriptions toggle button
        let descriptionToggle = document.getElementById("description-toggle");
        descriptionToggle.onclick = () => {
          settingsListContainer.classList.toggle("show-descriptions");
          descriptionToggle.classList.toggle("on");
        }
      }
    });

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
          console.warn("Failed to transmit setting to backend");
        }
      }).finally(() => {
        setTimeout(() => {
          settingContainer.classList.remove("disabled")
        }, 1000);
      })
  }
}
