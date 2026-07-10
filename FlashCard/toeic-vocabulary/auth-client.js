(() => {
  "use strict";

  const remote = window.toeicRemoteStorage;
  const button = document.getElementById("accountButton");
  const buttonText = document.getElementById("accountButtonText");
  const dialog = document.getElementById("loginDialog");
  const form = document.getElementById("loginForm");
  const closeButton = document.getElementById("loginCloseButton");
  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  const submitButton = document.getElementById("loginSubmitButton");
  const status = document.getElementById("loginStatus");
  let currentUser = null;
  let apiAvailable = null;

  if (!remote || !button || !dialog || !form) return;

  function renderAccount() {
    button.classList.toggle("is-signed-in", Boolean(currentUser));
    button.classList.toggle("is-local-only", apiAvailable === false);
    if (currentUser) {
      buttonText.textContent = currentUser.displayName || currentUser.username;
      button.title = "Bấm để đăng xuất";
    } else if (apiAvailable === false) {
      buttonText.textContent = "Chỉ lưu cục bộ";
      button.title = "D1 chưa được cấu hình; thiết lập vẫn được lưu trên thiết bị này";
    } else {
      buttonText.textContent = "Đăng nhập đồng bộ";
      button.title = "Đăng nhập để đồng bộ thiết lập";
    }
  }

  function setFormState(loading, message = "", type = "") {
    submitButton.disabled = loading;
    usernameInput.disabled = loading;
    passwordInput.disabled = loading;
    submitButton.textContent = loading ? "Đang đăng nhập..." : "Đăng nhập và đồng bộ";
    status.textContent = message;
    status.className = `login-status${type ? ` is-${type}` : ""}`;
  }

  button.addEventListener("click", async () => {
    if (currentUser) {
      button.disabled = true;
      try {
        await remote.logout();
        currentUser = null;
        renderAccount();
      } catch (error) {
        window.alert(error.message);
      } finally {
        button.disabled = false;
      }
      return;
    }

    if (apiAvailable === false) {
      window.alert("D1 chưa được cấu hình. Website hiện vẫn lưu thiết lập cục bộ trên thiết bị này.");
      return;
    }
    dialog.showModal();
    usernameInput.focus();
  });

  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFormState(true);
    try {
      const result = await remote.login(usernameInput.value, passwordInput.value);
      currentUser = result.user;
      apiAvailable = true;
      setFormState(false, "Đăng nhập thành công.", "success");
      passwordInput.value = "";
      renderAccount();
      if (result.changed) {
        window.location.reload();
      } else {
        window.setTimeout(() => dialog.close(), 500);
      }
    } catch (error) {
      setFormState(false, error.message, "error");
      passwordInput.select();
    }
  });

  document.addEventListener("toeic:sync-status", (event) => {
    button.dataset.syncState = event.detail?.state || "";
  });

  remote.ready.then((result) => {
    currentUser = result.user || null;
    apiAvailable = result.available;
    renderAccount();
    if (result.changed) window.location.reload();
  });
})();
