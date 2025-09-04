document.onkeydown = (e) => {
  if (modalActive) {
    switch (e.key) {
      case 'Escape':
        hideModal();
        break;
    }
  } else {
    switch (e.key) {
      case ' ':
        toggleSettingsMenu();
        break;
      case 'Escape':
        setSettingsMenuState(false);
        break;
      case 'Control':
        if (settingsVisible) {
          toggleSettingsExpertMode();
        }
        break;
      case 'f':
        toggleFullscreen();
        break;
      case 'd':
        toggleDarkMode();
        break;
      case 'l':
        toggleLyrics();
        break;
      case 'ArrowUp':
        scrollSettingsUpDown(-1);
        break;
      case 'ArrowDown':
        scrollSettingsUpDown(1);
        break;
    }
  }
};