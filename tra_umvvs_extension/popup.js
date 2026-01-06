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

function setStatus(text, isError = false) {
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
    chrome.runtime.sendMessage(
      {
        type: 'fetchTra',
        path,
        params,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.ok) {
          reject(new Error(response && response.error ? response.error : 'Unknown error'));
          return;
        }
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
  renderVehicle(vehicle);
  jsonOutEl.value = JSON.stringify(vehicle, null, 2);
  resultEl.style.display = 'block';
  setStatus('Done.');
}

async function init() {
  try {
    setDisabled(true);
    await loadMakes();
    resetDependents();
    setStatus('Ready.');
  } catch (e) {
    setStatus(String(e && e.message ? e.message : e), true);
  } finally {
    setDisabled(false);
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
