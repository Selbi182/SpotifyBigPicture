let toastTimeout;
function showToast(text) {
  clearTimeout(toastTimeout);
  let toastContainer = "toast".select();
  let toastTextContainer = "toast-text".select();
  toastTextContainer.innerHTML = text;
  setClass(toastContainer, "show", true);
  toastTimeout = setTimeout(() => {
    setClass(toastContainer, "show", false);
  }, 3000);
}