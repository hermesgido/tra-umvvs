chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "FETCH_TRA") {
    // Return true immediately to keep the message channel open
    (async () => {
      try {
        const res = await fetch(msg.url);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // MUST return true here for async response
  }
});
