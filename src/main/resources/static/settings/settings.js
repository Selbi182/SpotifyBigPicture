(function() {
  document.getElementById("copyright-current-year").innerHTML = new Date().getFullYear().toString();

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
        if (setting.state) {
          settingContainer.classList.add("on");
        }

        // Preset Thumbnail
        if (setting.id.startsWith("preset-")) {
          settingContainer.classList.add("preset");
          settingContainer.innerHTML = `<div class="image-wrapper"><img src="/design/img/presets/${setting.id}.png"></div>`;
        }

        // Setting Name
        settingContainer.innerHTML += setting.name;

        // Setting Description
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
      }

      // Setup show descriptions toggle button
      let descriptionToggle = document.getElementById("description-toggle");
      descriptionToggle.onclick = () => {
        settingsListContainer.classList.toggle("show-descriptions");
        descriptionToggle.classList.toggle("on");
      }

      // Setup expand/collapse all toggle button
      let expandExpandAll = document.getElementById("expand-collapse-all");
      expandExpandAll.onclick = () => {
        if (expandExpandAll.innerHTML.startsWith("Expand")) {
          expandExpandAll.innerHTML = "Collapse All Categories"
          settingsListContainer.childNodes.forEach(child => child.classList.add("expand"));
        } else {
          expandExpandAll.innerHTML = "Expand All Categories"
          settingsListContainer.childNodes.forEach(child => child.classList.remove("expand"));
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
          settingContainer.classList.toggle("on")
          if (settingId === "reload") {
            window.location.reload();
          }
        }, 2000);
      })
    }
  }
})();