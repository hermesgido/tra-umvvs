const makeEl = document.getElementById('make');
const modelBodyEl = document.getElementById('modelBody');
const yomEl = document.getElementById('yom');
const countryEl = document.getElementById('country');
const fuelEl = document.getElementById('fuel');
const engineEl = document.getElementById('engine');
const calculateEl = document.getElementById('calculate');
const resetEl = document.getElementById('reset');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const taxTableEl = document.getElementById('taxTable');
const jsonOutEl = document.getElementById('jsonOut');

const DEBUG = true;

function dbg(event, data) {
  if (!DEBUG) return;
  try {
    const ts = new Date().toISOString();
    if (data === undefined) console.log(`[TRA UMVVS][popup][${ts}] ${event}`);
    else console.log(`[TRA UMVVS][popup][${ts}] ${event}`, data);
  } catch {}
}

function normalizeText(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
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

function normalizeFuelGuess(s) {
  const t = tokens(s).join(' ');
  if (t.includes('diesel')) return 'DIESEL';
  if (t.includes('petrol') && (t.includes('hybrid') || t.includes('electric'))) return 'PETROL & ELECTRIC';
  if (t.includes('hybrid') || t.includes('electric')) return 'PETROL & ELECTRIC';
  if (t.includes('petrol') || t.includes('gasoline')) return 'PETROL';
  return null;
}

function selectBestOption(selectEl, guess, extraTokens = []) {
  const options = Array.from(selectEl.options || []).filter((o) => o && o.value);
  if (options.length === 0) return false;

  const wanted = [...tokens(guess), ...extraTokens].filter(Boolean);
  if (wanted.length === 0) {
    selectEl.value = options[0].value;
    return true;
  }

  let best = options[0];
  let bestScore = -Infinity;
  for (const o of options) {
    const s = scoreCandidate(o.textContent || o.value, wanted);
    if (s > bestScore) {
      bestScore = s;
      best = o;
    }
  }
  selectEl.value = best.value;
  return true;
}

function selectEngineCapacityFromCc(selectEl, engineCc) {
  const options = Array.from(selectEl.options || []).filter((o) => o && o.value);
  if (options.length === 0) return false;
  if (!engineCc) {
    selectEl.value = options[0].value;
    return true;
  }

  for (const o of options) {
    const s = String(o.value || '').toUpperCase();
    const m = s.match(/(\d+)\s*-\s*(\d+)\s*CC/);
    if (!m) continue;
    const min = Number(m[1]);
    const max = Number(m[2]);
    if (engineCc >= min && engineCc <= max) {
      selectEl.value = o.value;
      return true;
    }
  }

  selectEl.value = options[0].value;
  return true;
}

function getActiveTabVehicleGuess() {
  return new Promise((resolve) => {
    try {
      dbg('getActiveTabVehicleGuess:start');
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = Array.isArray(tabs) ? tabs[0] : null;
        const tabId = tab && tab.id;
        dbg('getActiveTabVehicleGuess:tab', { tabId, url: tab && tab.url });
        if (!tabId) {
          resolve(null);
          return;
        }
        chrome.tabs.sendMessage(tabId, { type: 'getVehicleGuess' }, (resp) => {
          if (chrome.runtime.lastError) {
            dbg('getActiveTabVehicleGuess:sendMessage:lastError', chrome.runtime.lastError.message);
            resolve(null);
            return;
          }
          dbg('getActiveTabVehicleGuess:resp', resp);
          if (!resp || !resp.ok || !resp.guess) {
            resolve(null);
            return;
          }
          resolve(resp.guess);
        });
      });
    } catch {
      dbg('getActiveTabVehicleGuess:exception');
      resolve(null);
    }
  });
}

function setStatus(text, isError = false) {
  dbg('status', { text, isError });
  statusEl.textContent = text;
  statusEl.className = isError ? 'status error' : 'status';
}

function setDisabled(disabled) {
  for (const el of [
    makeEl,
    modelBodyEl,
    yomEl,
    countryEl,
    fuelEl,
    engineEl,
    calculateEl,
    resetEl,
  ]) {
    el.disabled = disabled;
  }
}

function clearSelect(selectEl) {
  selectEl.innerHTML = '';
}

function setPlaceholder(selectEl, placeholder) {
  clearSelect(selectEl);
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = placeholder;
  selectEl.appendChild(ph);
  selectEl.value = '';
}

function setOptions(selectEl, items, placeholder) {
  setPlaceholder(selectEl, placeholder);
  for (const item of items) {
    const opt = document.createElement('option');
    opt.value = String(item.value);
    opt.textContent = String(item.label);
    selectEl.appendChild(opt);
  }
}

function fetchJson(path, params = {}) {
  return new Promise((resolve, reject) => {
    dbg('fetchJson:send', { path, params });
    chrome.runtime.sendMessage(
      {
        type: 'fetchTra',
        path,
        params,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          dbg('fetchJson:lastError', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.ok) {
          dbg('fetchJson:error', response);
          reject(new Error(response && response.error ? response.error : 'Unknown error'));
          return;
        }
        dbg('fetchJson:ok', { path, count: Array.isArray(response.data) ? response.data.length : undefined });
        resolve(response.data);
      }
    );
  });
}

function getMakeId() {
  const val = makeEl.value;
  return val ? Number(val) : null;
}

async function loadMakes() {
  setStatus('Loading makes...');
  const data = await fetchJson('getMakes');
  const items = data.map((m) => ({ value: m.makeId, label: m.makeName }));
  setOptions(makeEl, items, 'Select make');
  dbg('loadMakes:done', { items: items.length });
}

async function loadModelBodiesForMake() {
  const makeId = getMakeId();
  setPlaceholder(modelBodyEl, 'Select model/body');
  if (!makeId) return;
  setStatus('Loading model/body options...');
  const data = await fetchJson('getModelBody', { makeId: String(makeId) });
  const list = data.map((x) => x.modelBody).filter(Boolean);
  const items = list.map((v) => ({ value: v, label: v }));
  setOptions(modelBodyEl, items, 'Select model/body');
  dbg('loadModelBodiesForMake:done', { makeId, items: items.length });
}

async function loadYoms() {
  const makeId = getMakeId();
  const modelBody = modelBodyEl.value;
  setPlaceholder(yomEl, 'Select year');
  if (!makeId || !modelBody) return;
  setStatus('Loading year of manufacture...');
  const data = await fetchJson('getYom', { makeId: String(makeId), modelBody });
  const list = data.map((x) => String(x.yom)).filter(Boolean);
  const items = list.map((v) => ({ value: v, label: v }));
  setOptions(yomEl, items, 'Select year');
  dbg('loadYoms:done', { makeId, modelBody, items: items.length });
}

async function loadCountries() {
  const makeId = getMakeId();
  const modelBody = modelBodyEl.value;
  const yom = yomEl.value;
  setPlaceholder(countryEl, 'Select country');
  if (!makeId || !modelBody || !yom) return;
  setStatus('Loading countries...');
  const data = await fetchJson('getCountryOfOrigin', {
    makeId: String(makeId),
    modelBody,
    yom,
  });
  const list = data.map((x) => x.countryOfOrigin).filter(Boolean);
  const items = list.map((v) => ({ value: v, label: v }));
  setOptions(countryEl, items, 'Select country');
  dbg('loadCountries:done', { makeId, modelBody, yom, items: items.length });
}

async function loadFuelTypes() {
  const makeId = getMakeId();
  const modelBody = modelBodyEl.value;
  const yom = yomEl.value;
  const countryOfOrigin = countryEl.value;
  setPlaceholder(fuelEl, 'Select fuel');
  if (!makeId || !modelBody || !yom || !countryOfOrigin) return;
  setStatus('Loading fuel types...');
  const data = await fetchJson('getFuelType', {
    makeId: String(makeId),
    modelBody,
    yom,
    countryOfOrigin,
  });
  const list = data.map((x) => x.fuelType).filter(Boolean);
  const items = list.map((v) => ({ value: v, label: v }));
  setOptions(fuelEl, items, 'Select fuel');
  dbg('loadFuelTypes:done', { makeId, modelBody, yom, countryOfOrigin, items: items.length });
}

async function loadEngineCapacities() {
  const makeId = getMakeId();
  const modelBody = modelBodyEl.value;
  const yom = yomEl.value;
  const countryOfOrigin = countryEl.value;
  const fuelType = fuelEl.value;
  setPlaceholder(engineEl, 'Select engine capacity');
  if (!makeId || !modelBody || !yom || !countryOfOrigin || !fuelType) return;
  setStatus('Loading engine capacities...');
  const data = await fetchJson('getEngineCapacity', {
    makeId: String(makeId),
    modelBody,
    yom,
    countryOfOrigin,
    fuelType,
  });
  const list = data.map((x) => x.engineCapacity).filter(Boolean);
  const items = list.map((v) => ({ value: v, label: v }));
  setOptions(engineEl, items, 'Select engine capacity');
  dbg('loadEngineCapacities:done', { makeId, modelBody, yom, countryOfOrigin, fuelType, items: items.length });
}

function toRows(vehicle) {
  const preferredOrder = [
    'make',
    'model',
    'bodyType',
    'yom',
    'country',
    'fuelType',
    'engineCapacity',
    'cifInUSD',
    'importDutyInUSD',
    'exiseDutyInUSD',
    'exiseDutyDueToAgeInUSD',
    'vatInUSD',
    'customProcessingFeeInUSD',
    'railwayDevLevyInUSD',
    'indDevLevy',
    'hivRespLevy',
    'totalImportTaxesInUSD',
    'totalImportTaxesInTZS',
    'vehicleRegistrationFeeInTZS',
    'totalTaxesInTZS',
    'year',
    'quarter',
    'referenceNumber',
  ];

  const entries = Object.entries(vehicle || {});
  const orderIndex = new Map(preferredOrder.map((k, i) => [k, i]));
  entries.sort((a, b) => {
    const ai = orderIndex.has(a[0]) ? orderIndex.get(a[0]) : 9999;
    const bi = orderIndex.has(b[0]) ? orderIndex.get(b[0]) : 9999;
    if (ai !== bi) return ai - bi;
    return a[0].localeCompare(b[0]);
  });
  return entries;
}

function renderVehicle(vehicle) {
  taxTableEl.innerHTML = '';
  for (const [k, v] of toRows(vehicle)) {
    const tr = document.createElement('tr');
    const tdK = document.createElement('td');
    tdK.textContent = k;
    tdK.className = 'mono';
    const tdV = document.createElement('td');
    tdV.textContent = v === null || v === undefined ? '' : String(v);
    tr.appendChild(tdK);
    tr.appendChild(tdV);
    taxTableEl.appendChild(tr);
  }
}

function clearResult() {
  resultEl.style.display = 'none';
  jsonOutEl.value = '';
}

function resetDependents() {
  setPlaceholder(modelBodyEl, 'Select model/body');
  setPlaceholder(yomEl, 'Select year');
  setPlaceholder(countryEl, 'Select country');
  setPlaceholder(fuelEl, 'Select fuel');
  setPlaceholder(engineEl, 'Select engine capacity');
}

async function calculate() {
  const makeId = getMakeId();
  const modelBody = modelBodyEl.value;
  const yom = yomEl.value;
  const countryOfOrigin = countryEl.value;
  const fuelType = fuelEl.value;
  const engineCapacity = engineEl.value;

  dbg('calculate:input', {
    makeId,
    modelBody,
    yom,
    countryOfOrigin,
    fuelType,
    engineCapacity,
  });

  if (!makeId || !modelBody || !yom || !countryOfOrigin || !fuelType || !engineCapacity) {
    setStatus('Please select all fields before calculating.', true);
    return;
  }

  setStatus('Calculating tax...');
  const data = await fetchJson('getVehicleDetails', {
    makeId: String(makeId),
    modelBody,
    yom,
    cuntryOfOrigin: countryOfOrigin,
    fuelType,
    engineCapacity,
  });
  const vehicle = Array.isArray(data) ? data[0] : data;
  dbg('calculate:result', vehicle);
  renderVehicle(vehicle);
  jsonOutEl.value = JSON.stringify(vehicle, null, 2);
  resultEl.style.display = 'block';
  setStatus('Done.');
}

async function autoFillAndCalculateFromActiveTab() {
  try {
    dbg('autoFill:start');
    const guess = await getActiveTabVehicleGuess();
    dbg('autoFill:guess', guess);
    if (!guess) return false;

    clearResult();
    resetDependents();

    const makePicked = selectBestOption(makeEl, guess.makeGuess || guess.title || '', tokens(guess.title));
    dbg('autoFill:makePicked', { makePicked, makeId: getMakeId(), makeValue: makeEl.value });
    if (!getMakeId()) return false;

    await loadModelBodiesForMake();
    dbg('autoFill:modelBodiesLoaded', { options: modelBodyEl.options.length });
    if (!modelBodyEl.options.length) return false;
    const modelPicked = selectBestOption(modelBodyEl, guess.modelGuess || guess.title || '', tokens(guess.title));
    dbg('autoFill:modelPicked', { modelPicked, modelBody: modelBodyEl.value });
    if (!modelBodyEl.value) return false;

    await loadYoms();
    dbg('autoFill:yomsLoaded', { options: yomEl.options.length });
    if (guess.year) {
      const target = String(guess.year);
      const match = Array.from(yomEl.options || []).find((o) => o && o.value === target);
      if (match) yomEl.value = target;
      else {
        const first = Array.from(yomEl.options || []).find((o) => o && o.value);
        if (first) yomEl.value = first.value;
      }
    } else {
      const first = Array.from(yomEl.options || []).find((o) => o && o.value);
      if (first) yomEl.value = first.value;
    }
    dbg('autoFill:yomPicked', { yom: yomEl.value });
    if (!yomEl.value) return false;

    await loadCountries();
    dbg('autoFill:countriesLoaded', { options: countryEl.options.length });
    const countryPicked = selectBestOption(countryEl, guess.countryGuess || 'JAPAN', []);
    dbg('autoFill:countryPicked', { countryPicked, country: countryEl.value });
    if (!countryEl.value) return false;

    await loadFuelTypes();
    dbg('autoFill:fuelsLoaded', { options: fuelEl.options.length });
    const fuelWanted = normalizeFuelGuess(guess.fuelGuess) || guess.fuelGuess || '';
    const fuelPicked = selectBestOption(fuelEl, fuelWanted, []);
    dbg('autoFill:fuelPicked', { fuelPicked, fuelType: fuelEl.value, fuelWanted });
    if (!fuelEl.value) return false;

    await loadEngineCapacities();
    dbg('autoFill:enginesLoaded', { options: engineEl.options.length });
    const enginePicked = selectEngineCapacityFromCc(engineEl, guess.engineCc);
    dbg('autoFill:enginePicked', { enginePicked, engineCapacity: engineEl.value, engineCc: guess.engineCc });
    if (!engineEl.value) return false;

    setStatus('Auto-calculating tax...');
    await calculate();
    dbg('autoFill:done');
    return true;
  } catch (e) {
    dbg('autoFill:error', String(e && e.message ? e.message : e));
    return false;
  }
}

async function init() {
  try {
    dbg('init:start');
    setDisabled(true);
    await loadMakes();
    resetDependents();
    setStatus('Ready.');
    const didAuto = await autoFillAndCalculateFromActiveTab();
    dbg('init:autoResult', { didAuto });
    if (!didAuto) setStatus('Ready.');
  } catch (e) {
    dbg('init:error', String(e && e.message ? e.message : e));
    setStatus(String(e && e.message ? e.message : e), true);
  } finally {
    setDisabled(false);
    dbg('init:end');
  }
}

makeEl.addEventListener('change', async () => {
  try {
    setDisabled(true);
    clearResult();
    resetDependents();
    await loadModelBodiesForMake();
    setStatus('Ready.');
  } catch (e) {
    setStatus(String(e && e.message ? e.message : e), true);
  } finally {
    setDisabled(false);
  }
});

modelBodyEl.addEventListener('change', async () => {
  try {
    setDisabled(true);
    clearResult();
    setPlaceholder(yomEl, 'Select year');
    setPlaceholder(countryEl, 'Select country');
    setPlaceholder(fuelEl, 'Select fuel');
    setPlaceholder(engineEl, 'Select engine capacity');
    await loadYoms();
    setStatus('Ready.');
  } catch (e) {
    setStatus(String(e && e.message ? e.message : e), true);
  } finally {
    setDisabled(false);
  }
});

yomEl.addEventListener('change', async () => {
  try {
    setDisabled(true);
    clearResult();
    setPlaceholder(countryEl, 'Select country');
    setPlaceholder(fuelEl, 'Select fuel');
    setPlaceholder(engineEl, 'Select engine capacity');
    await loadCountries();
    setStatus('Ready.');
  } catch (e) {
    setStatus(String(e && e.message ? e.message : e), true);
  } finally {
    setDisabled(false);
  }
});

countryEl.addEventListener('change', async () => {
  try {
    setDisabled(true);
    clearResult();
    setPlaceholder(fuelEl, 'Select fuel');
    setPlaceholder(engineEl, 'Select engine capacity');
    await loadFuelTypes();
    setStatus('Ready.');
  } catch (e) {
    setStatus(String(e && e.message ? e.message : e), true);
  } finally {
    setDisabled(false);
  }
});

fuelEl.addEventListener('change', async () => {
  try {
    setDisabled(true);
    clearResult();
    setPlaceholder(engineEl, 'Select engine capacity');
    await loadEngineCapacities();
    setStatus('Ready.');
  } catch (e) {
    setStatus(String(e && e.message ? e.message : e), true);
  } finally {
    setDisabled(false);
  }
});

engineEl.addEventListener('change', () => {
  clearResult();
});

calculateEl.addEventListener('click', async () => {
  try {
    setDisabled(true);
    await calculate();
  } catch (e) {
    setStatus(String(e && e.message ? e.message : e), true);
  } finally {
    setDisabled(false);
  }
});

resetEl.addEventListener('click', async () => {
  try {
    setDisabled(true);
    clearResult();
    await init();
  } catch (e) {
    setStatus(String(e && e.message ? e.message : e), true);
  } finally {
    setDisabled(false);
  }
});

init();
