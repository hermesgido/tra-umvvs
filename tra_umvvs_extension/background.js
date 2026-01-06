const API_BASE_URL = 'https://taxpayerportal.tra.go.tz/umvvs-api/ExternalCalculator';

const DEBUG = true;

function dbg(event, data) {
  if (!DEBUG) return;
  try {
    const ts = new Date().toISOString();
    if (data === undefined) console.log(`[TRA UMVVS][bg][${ts}] ${event}`);
    else console.log(`[TRA UMVVS][bg][${ts}] ${event}`, data);
  } catch {}
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'fetchTra') return;

  const path = String(message.path || '').replace(/^\/+/, '');
  const params = message.params || {};
  const url = new URL(`${API_BASE_URL}/${path}`);

  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }

  dbg('fetchTra', { path, url: url.toString() });

  fetch(url.toString(), {
    headers: {
      Accept: 'application/json, text/plain, */*',
    },
  })
    .then(async (res) => {
      const text = await res.text();
      if (!res.ok) {
        dbg('fetchTra:httpError', { status: res.status, url: url.toString() });
        sendResponse({
          ok: false,
          error: `HTTP ${res.status}: ${text}`,
        });
        return;
      }
      try {
        const data = JSON.parse(text);
        dbg('fetchTra:ok', { path, kind: Array.isArray(data) ? 'array' : typeof data });
        sendResponse({ ok: true, data });
      } catch (e) {
        dbg('fetchTra:parseError', { url: url.toString(), error: String(e && e.message ? e.message : e) });
        sendResponse({
          ok: false,
          error: `Non-JSON response: ${String(e && e.message ? e.message : e)}`,
        });
      }
    })
    .catch((err) => {
      dbg('fetchTra:networkError', String(err && err.message ? err.message : err));
      sendResponse({
        ok: false,
        error: String(err && err.message ? err.message : err),
      });
    });

  return true;
});
