document.addEventListener("DOMContentLoaded", async () => {
  const queueVal = document.getElementById("queueVal");
  const sentTodayVal = document.getElementById("sentTodayVal");
  const statusText = document.getElementById("statusText");
  const statusDot = document.getElementById("statusDot");
  const delaySlider = document.getElementById("delaySlider");
  const minDelayText = document.getElementById("minDelayText");
  const maxDelayText = document.getElementById("maxDelayText");
  const btnClearQueue = document.getElementById("btnClearQueue");

  // Load and apply status
  function updateUI() {
    chrome.runtime.sendMessage({ type: "GET_BRIDGE_STATUS" }, (response) => {
      if (chrome.runtime.lastError || !response) return;

      queueVal.textContent = response.queueLength || 0;
      sentTodayVal.textContent = response.stats?.dailySentCount || 0;

      if (response.isProcessing) {
        statusText.textContent = "Sending...";
        statusDot.className = "status-dot busy";
      } else {
        statusText.textContent = "Ready";
        statusDot.className = "status-dot";
      }

      if (response.stats?.minDelayMs) {
        const sec = Math.round(response.stats.minDelayMs / 1000);
        delaySlider.value = sec;
        minDelayText.textContent = `${sec}s`;
        maxDelayText.textContent = `${sec + 3}s`;
      }
    });
  }

  updateUI();
  const pollInterval = setInterval(updateUI, 2000);
  window.addEventListener("unload", () => clearInterval(pollInterval));

  // Handle delay slider
  delaySlider.addEventListener("input", async (e) => {
    const val = parseInt(e.target.value, 10);
    minDelayText.textContent = `${val}s`;
    maxDelayText.textContent = `${val + 3}s`;

    const data = await chrome.storage.local.get("settings");
    const settings = data.settings || {};
    settings.minDelayMs = val * 1000;
    settings.maxDelayMs = (val + 3) * 1000;
    await chrome.storage.local.set({ settings });
  });

  // Handle clear queue
  btnClearQueue.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_QUEUE" }, () => {
      updateUI();
    });
  });
});
