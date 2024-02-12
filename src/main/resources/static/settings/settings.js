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
        // Setting
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
        settingContainer.innerHTML += `<div class="setting-header">${setting.name}</div>`;

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

        // Subcategory Headers
        if (!!setting.subcategoryHeader) {
          let subcategoryHeader = document.createElement("div");
          subcategoryHeader.innerHTML = setting.subcategoryHeader;
          subcategoryHeader.classList.add("setting-subcategory-header");
          categoryElem.append(subcategoryHeader);
        }

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
          expandExpandAll.innerHTML = "Collapse All Categories";
          settingsListContainer.childNodes.forEach(child => child.classList.add("expand"));
        } else {
          expandExpandAll.innerHTML = "Expand All Categories";
          settingsListContainer.childNodes.forEach(child => child.classList.remove("expand"));
        }
      }
    });

  function toggleSetting(settingElement, settingId) {
    if (!settingElement.classList.contains("loading")) {
      settingElement.classList.add("loading");

      if (settingId === "dark-mode" && !settingElement.classList.contains("on")) {
        let darkModeIntensity = prompt("Enter intensity in % (1-100)");
        if (darkModeIntensity > 0 && darkModeIntensity <= 100) {
          settingId += "-" + darkModeIntensity;
        } else {
          settingId += "-50";
        }
      }

      fetch("/settings/toggle/" + settingId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: settingId
      })
      .then(response => {
        if (response.status >= 200 && response.status < 300) {
          if (!settingId.startsWith("preset-") && settingId !== "reload") {
            return response.json();
          }
          return null;
        } else if (response.status >= 400) {
          throw "Failed to transmit setting to backend";
        }
      })
      .then(json => {
        if (json) {
          if (json.state) {
            settingElement.classList.add("on");
          } else {
            settingElement.classList.remove("on");
          }
        }
      }).finally(() => {
        setTimeout(() => {
          settingElement.classList.remove("loading")
          if (settingId.startsWith("preset-") || settingId === "reload") {
            window.location.reload();
          }
        }, 2000);
      })
      .catch(ex => alert(ex));
    }
  }
})();