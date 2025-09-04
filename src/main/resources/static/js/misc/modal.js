let modalActive = false;

function showModal(title, content, onConfirm = null, onReject = null, okayButtonLabel = "Okay", closeButtonLabel = "Close") {
  requestAnimationFrame(() => {
    // Set content
    "modal-header".select().innerHTML = title;
    "modal-main".select().innerHTML = content;

    // Create buttons
    let modalButtons = "modal-buttons".select();
    modalButtons.innerHTML = ""; // Remove all old buttons to avoid conflicts
    createModalButton(closeButtonLabel, "close", onReject);

    // Set onConfirm logic if this is a confirmation modal
    setClass(modalButtons, "confirm", !!onConfirm);
    if (onConfirm) {
      createModalButton(okayButtonLabel, "okay", onConfirm);
    }

    // Display modal
    setClass("modal-overlay".select(), "show", true);
    setClass(document.body, "dark-blur", true);
    modalActive = true;

    // Modal button generator
    function createModalButton(text, className, customOnClick = null) {
      let modalButton = document.createElement("div");
      modalButton.innerHTML = text;
      modalButton.className = className;
      modalButtons.append(modalButton);
      modalButton.onclick = () => {
        if (customOnClick) {
          requestAnimationFrame(() => customOnClick.call(this));
        }
        hideModal();
      }
    }
  });
}

function hideModal() {
  modalActive = false;
  setClass("modal-overlay".select(), "show", false);
  setClass(document.body, "dark-blur", false);
}