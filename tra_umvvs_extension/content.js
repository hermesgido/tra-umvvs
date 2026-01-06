function normalizeText(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(s) {
  return normalizeText(s).toLowerCase();
}

function parseIntFromText(s) {
  const m = String(s || '').replace(/,/g, '').match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function parseEngineCc(text) {
  const s = String(text || '').replace(/,/g, '').toLowerCase();
  const m1 = s.match(/(\d{3,4})\s*cc/);
  if (m1) return Number(m1[1]);
  const m2 = s.match(/engine\s*:\s*(\d{3,4})/);
  if (m2) return Number(m2[1]);
  const m3 = s.match(/(\d{3,4})\s*\(?cc\)?/);
  if (m3) return Number(m3[1]);
  return null;
}

function tokens(s) {
  return normalizeText(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

function scoreCandidate(candidate, wantedTokens) {
  const candTokens = new Set(tokens(candidate));
  let score = 0;
  for (const t of wantedTokens) {
    if (candTokens.has(t)) score += 3;
    else if (String(candidate).toLowerCase().includes(t)) score += 1;
  }
  score -= Math.max(0, candTokens.size - wantedTokens.length);
  return score;
}

function extractPairsFromTables() {
  const out = [];
  const rows = Array.from(document.querySelectorAll('table tr'));
  for (const tr of rows) {
    const th = tr.querySelector('th');
    const td = tr.querySelector('td');
    if (!th || !td) continue;
    const key = normalizeText(th.textContent);
    const val = normalizeText(td.textContent);
    if (!key || !val) continue;
    out.push([key, val]);
  }
  return out;
}

function extractPairsFromDl() {
  const out = [];
  const dts = Array.from(document.querySelectorAll('dt'));
  for (const dt of dts) {
    const dd = dt.nextElementSibling;
    if (!dd || dd.tagName.toLowerCase() !== 'dd') continue;
    const key = normalizeText(dt.textContent);
    const val = normalizeText(dd.textContent);
    if (!key || !val) continue;
    out.push([key, val]);
  }
  return out;
}

function buildFieldMap() {
  const pairs = [...extractPairsFromDl(), ...extractPairsFromTables()];
  const map = new Map();
  for (const [k, v] of pairs) {
    const nk = normalizeKey(k);
    if (!map.has(nk)) map.set(nk, v);
  }
  return map;
}

function findFirstValue(map, keys) {
  for (const k of keys) {
    const v = map.get(k);
    if (v) return v;
  }
  return null;
}

function getSpecValue(label) {
  const rows = document.querySelectorAll('table.specification tr');
  for (const row of rows) {
    const cells = Array.from(row.children);
    for (let i = 0; i < cells.length - 1; i++) {
      const cell = cells[i];
      const next = cells[i + 1];
      if (cell.tagName === 'TH' && normalizeText(cell.innerText).startsWith(label) && next.tagName === 'TD') {
        return normalizeText(next.innerText);
      }
    }
  }
  return null;
}

function getBreadcrumbValues() {
  const crumbs = Array.from(document.querySelectorAll('#bread li a')).map((a) => normalizeText(a.innerText));
  return {
    carMake: crumbs[1] || null,
    bodyType: crumbs[2] || null,
    carModel: crumbs[3] || null,
    year: crumbs[4] || null,
  };
}

function getChassisModelCode() {
  const chassis = getSpecValue('Chassis No.') || getSpecValue('Chassis No');
  if (!chassis) return null;
  return String(chassis).split('-')[0].trim() || null;
}

function guessVehicleFromPage() {
  const title = normalizeText(document.querySelector('meta[property="og:title"]')?.getAttribute('content') || document.title);
  const breadcrumb = getBreadcrumbValues();
  const modelCode = getChassisModelCode();

  const specYear =
    getSpecValue('Registration Year/month') ||
    getSpecValue('Manufacture Year/month') ||
    getSpecValue('Year') ||
    getSpecValue('Year of manufacture');
  const specFuel = getSpecValue('Fuel') || getSpecValue('Fuel Type');
  const specEngine =
    getSpecValue('Engine Size') ||
    getSpecValue('Steering Right Engine Size') ||
    getSpecValue('Steering Left Engine Size') ||
    getSpecValue('Engine');

  const makeGuess = breadcrumb.carMake;
  const yearGuess = breadcrumb.year || specYear;
  const year = parseIntFromText(yearGuess);
  const engineCc = parseEngineCc(specEngine) || parseEngineCc(title);

  const modelBody =
    breadcrumb.carModel && modelCode && breadcrumb.bodyType
      ? `${String(breadcrumb.carModel).toUpperCase()} - ${String(modelCode).toUpperCase()} - ${String(
          breadcrumb.bodyType
        ).toUpperCase()}`
      : null;

  const map = buildFieldMap();
  const makeFallback =
    findFirstValue(map, ['make', 'manufacturer', 'brand']) || (title.split(' ').length ? title.split(' ')[0] : null);
  const modelFallback = findFirstValue(map, ['model', 'vehicle model', 'car model']) || title;
  const fuelFallback = findFirstValue(map, ['fuel', 'fuel type']) || '';
  const countryFallback = findFirstValue(map, ['country of origin', 'origin']) || '';

  return {
    makeGuess: makeGuess ? normalizeText(makeGuess) : makeFallback ? normalizeText(makeFallback) : null,
    modelGuess: modelBody ? normalizeText(modelBody) : breadcrumb.carModel ? normalizeText(breadcrumb.carModel) : normalizeText(modelFallback),
    year,
    fuelGuess: normalizeText(specFuel || fuelFallback),
    engineCc,
    countryGuess: normalizeText(countryFallback || 'JAPAN'),
    title,
  };
}

function isLikelyCarDetailsPage() {
  const url = location.href.toLowerCase();
  if (url.includes('/stock/')) return true;
  if (url.includes('stock=')) return true;
  if (url.includes('/car/')) return true;
  if (url.includes('/id/')) return true;
  if (document.querySelector('table.specification')) return true;
  if (document.querySelector('#bread')) return true;
  const t = document.title.toLowerCase();
  if (t.includes('beforward') && (t.includes('stock') || t.includes('toyota') || t.includes('nissan'))) return true;
  return false;
}

function createPanel() {
  const root = document.createElement('div');
  root.id = 'tra-umvvs-panel';
  root.style.position = 'fixed';
  root.style.right = '12px';
  root.style.bottom = '12px';
  root.style.width = '360px';
  root.style.maxHeight = '70vh';
  root.style.overflow = 'auto';
  root.style.background = '#ffffff';
  root.style.border = '1px solid #cfd6e4';
  root.style.borderRadius = '10px';
  root.style.boxShadow = '0 8px 30px rgba(0,0,0,0.16)';
  root.style.zIndex = '2147483647';
  root.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  root.style.fontSize = '12px';
  root.style.color = '#1a1a1a';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.padding = '10px 10px 8px';
  header.style.borderBottom = '1px solid #eef1f7';

  const title = document.createElement('div');
  title.textContent = 'TRA Taxes (UMVVS)';
  title.style.fontWeight = '700';

  const close = document.createElement('button');
  close.textContent = '×';
  close.style.border = '1px solid #cfd6e4';
  close.style.background = '#fff';
  close.style.borderRadius = '8px';
  close.style.width = '28px';
  close.style.height = '28px';
  close.style.cursor = 'pointer';
  close.addEventListener('click', () => root.remove());

  header.appendChild(title);
  header.appendChild(close);

  const status = document.createElement('div');
  status.id = 'tra-umvvs-status';
  status.style.padding = '10px';
  status.style.color = '#4a4a4a';

  const body = document.createElement('div');
  body.id = 'tra-umvvs-body';
  body.style.padding = '0 10px 10px';

  root.appendChild(header);
  root.appendChild(status);
  root.appendChild(body);

  document.documentElement.appendChild(root);
  return root;
}

function setPanelStatus(text, isError = false) {
  const el = document.getElementById('tra-umvvs-status');
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? '#b00020' : '#4a4a4a';
}

function renderVehicle(vehicle) {
  const container = document.getElementById('tra-umvvs-body');
  if (!container) return;
  container.innerHTML = '';

  const important = [
    ['totalTaxesInTZS', 'Total Taxes (TZS)'],
    ['totalImportTaxesInTZS', 'Total Import Taxes (TZS)'],
    ['vehicleRegistrationFeeInTZS', 'Registration Fee (TZS)'],
    ['cifInUSD', 'CIF (USD)'],
    ['totalImportTaxesInUSD', 'Total Import Taxes (USD)'],
    ['year', 'TRA Year'],
    ['quarter', 'TRA Quarter'],
  ];

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.marginTop = '8px';

  const tbody = document.createElement('tbody');

  for (const [key, label] of important) {
    if (!(key in vehicle)) continue;
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    td1.textContent = label;
    td1.style.padding = '6px 0';
    td1.style.borderBottom = '1px solid #eef1f7';
    td1.style.color = '#4a4a4a';
    const td2 = document.createElement('td');
    td2.textContent = vehicle[key] == null ? '' : String(vehicle[key]);
    td2.style.padding = '6px 0';
    td2.style.borderBottom = '1px solid #eef1f7';
    td2.style.textAlign = 'right';
    td2.style.fontWeight = '700';
    tr.appendChild(td1);
    tr.appendChild(td2);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  container.appendChild(table);

  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(vehicle, null, 2);
  pre.style.margin = '10px 0 0';
  pre.style.padding = '10px';
  pre.style.background = '#f6f7f9';
  pre.style.borderRadius = '8px';
  pre.style.overflow = 'auto';
  pre.style.maxHeight = '260px';
  pre.style.fontSize = '11px';
  pre.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  container.appendChild(pre);
}

function fetchTra(path, params) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'fetchTra', path, params }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response || !response.ok) {
        reject(new Error(response && response.error ? response.error : 'Unknown error'));
        return;
      }
      resolve(response.data);
    });
  });
}

function bestMatchFromList(list, guess, extraTokens = []) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const wanted = [...tokens(guess), ...extraTokens].filter(Boolean);
  if (wanted.length === 0) return list[0];
  let best = list[0];
  let bestScore = -Infinity;
  for (const item of list) {
    const s = scoreCandidate(item, wanted);
    if (s > bestScore) {
      bestScore = s;
      best = item;
    }
  }
  return best;
}

function normalizeFuelGuess(s) {
  const t = tokens(s).join(' ');
  if (t.includes('diesel')) return 'DIESEL';
  if (t.includes('petrol') && (t.includes('hybrid') || t.includes('electric'))) return 'PETROL & ELECTRIC';
  if (t.includes('hybrid') || t.includes('electric')) return 'PETROL & ELECTRIC';
  if (t.includes('petrol') || t.includes('gasoline')) return 'PETROL';
  return null;
}

function matchEngineCapacity(options, engineCc) {
  if (!Array.isArray(options) || options.length === 0) return null;
  if (!engineCc) return options[0].engineCapacity;

  for (const o of options) {
    const s = String(o.engineCapacity || '').toUpperCase();
    const m = s.match(/(\d+)\s*-\s*(\d+)\s*CC/);
    if (!m) continue;
    const min = Number(m[1]);
    const max = Number(m[2]);
    if (engineCc >= min && engineCc <= max) return o.engineCapacity;
  }
  return options[0].engineCapacity;
}

async function runAuto() {
  if (!isLikelyCarDetailsPage()) return;
  createPanel();
  const guess = guessVehicleFromPage();
  setPanelStatus('Detecting vehicle and loading taxes...');

  try {
    const makes = await fetchTra('getMakes');
    const makeNameWanted = guess.makeGuess || '';
    const makeMatch = bestMatchFromList(
      makes.map((m) => m.makeName),
      makeNameWanted,
      tokens(guess.title)
    );
    const makeObj = makes.find((m) => m.makeName === makeMatch) || makes[0];

    const modelBodyOptions = await fetchTra('getModelBody', { makeId: String(makeObj.makeId) });
    const modelBodies = modelBodyOptions.map((x) => x.modelBody).filter(Boolean);
    const modelBody = bestMatchFromList(modelBodies, guess.modelGuess || '', tokens(guess.title));

    const yomOptions = await fetchTra('getYom', { makeId: String(makeObj.makeId), modelBody });
    const yoms = yomOptions.map((x) => x.yom).filter(Boolean);
    const year = guess.year && yoms.includes(guess.year) ? guess.year : yoms[0];

    const countryOptions = await fetchTra('getCountryOfOrigin', {
      makeId: String(makeObj.makeId),
      modelBody,
      yom: String(year),
    });
    const countries = countryOptions.map((x) => x.countryOfOrigin).filter(Boolean);
    const countryWanted = guess.countryGuess || 'JAPAN';
    const countryOfOrigin = bestMatchFromList(countries, countryWanted, []);

    const fuelOptions = await fetchTra('getFuelType', {
      makeId: String(makeObj.makeId),
      modelBody,
      yom: String(year),
      countryOfOrigin,
    });
    const fuels = fuelOptions.map((x) => x.fuelType).filter(Boolean);
    const fuelWanted = normalizeFuelGuess(guess.fuelGuess) || guess.fuelGuess || '';
    const fuelType = bestMatchFromList(fuels, fuelWanted, []);

    const engineOptions = await fetchTra('getEngineCapacity', {
      makeId: String(makeObj.makeId),
      modelBody,
      yom: String(year),
      countryOfOrigin,
      fuelType,
    });
    const engineCapacity = matchEngineCapacity(engineOptions, guess.engineCc);

    setPanelStatus('Calculating tax...');
    const details = await fetchTra('getVehicleDetails', {
      makeId: String(makeObj.makeId),
      modelBody,
      yom: String(year),
      cuntryOfOrigin: countryOfOrigin,
      fuelType,
      engineCapacity,
    });
    const vehicle = Array.isArray(details) ? details[0] : details;
    renderVehicle(vehicle);
    setPanelStatus('Done.');
  } catch (e) {
    setPanelStatus(String(e && e.message ? e.message : e), true);
  }
}

runAuto();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'getVehicleGuess') return;
  try {
    try {
      const ts = new Date().toISOString();
      console.log(`[TRA UMVVS][content][${ts}] getVehicleGuess`, { url: location.href });
    } catch {}
    if (!isLikelyCarDetailsPage()) {
      try {
        const ts = new Date().toISOString();
        console.log(`[TRA UMVVS][content][${ts}] getVehicleGuess:notDetails`);
      } catch {}
      sendResponse({ ok: false, error: 'Not a vehicle details page' });
      return;
    }
    const guess = guessVehicleFromPage();
    try {
      const ts = new Date().toISOString();
      console.log(`[TRA UMVVS][content][${ts}] getVehicleGuess:ok`, guess);
    } catch {}
    sendResponse({ ok: true, guess });
  } catch (e) {
    try {
      const ts = new Date().toISOString();
      console.log(`[TRA UMVVS][content][${ts}] getVehicleGuess:error`, String(e && e.message ? e.message : e));
    } catch {}
    sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
  }
});
