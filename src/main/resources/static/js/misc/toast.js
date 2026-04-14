let toastTimeout;
function showToast(text) {
  if (!text || text.toLowerCase() === "null") {
    // Prevent spamming useless error messages
    return;
  }
  clearTimeout(toastTimeout);
  let toastContainer = "toast".select();
  let toastTextContainer = "toast-text".select();
  toastTextContainer.innerHTML = text;
  setClass(toastContainer, "show", true);
  toastTimeout = setTimeout(() => {
    setClass(toastContainer, "show", false);
  }, 3000);
}