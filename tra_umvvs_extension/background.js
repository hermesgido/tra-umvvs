const API_BASE_URL = 'https://taxpayerportal.tra.go.tz/umvvs-api/ExternalCalculator';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'fetchTra') return;

  const path = String(message.path || '').replace(/^\/+/, '');
  const params = message.params || {};
  const url = new URL(`${API_BASE_URL}/${path}`);

  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }

  fetch(url.toString(), {
    headers: {
      Accept: 'application/json, text/plain, */*',
    },
  })
    .then(async (res) => {
      const text = await res.text();
      if (!res.ok) {
        sendResponse({
          ok: false,
          error: `HTTP ${res.status}: ${text}`,
        });
        return;
      }
      try {
        const data = JSON.parse(text);
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({
          ok: false,
          error: `Non-JSON response: ${String(e && e.message ? e.message : e)}`,
        });
      }
    })
    .catch((err) => {
      sendResponse({
        ok: false,
        error: String(err && err.message ? err.message : err),
      });
    });

  return true;
});
