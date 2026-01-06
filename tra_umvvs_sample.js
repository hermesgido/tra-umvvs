const BASE_URL = 'https://taxpayerportal.tra.go.tz/umvvs-api/ExternalCalculator';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function buildUrl(path, params) {
  const url = new URL(`${BASE_URL}/${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'tra-umvvs-sample/1.0',
      Accept: 'application/json, text/plain, */*',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} for ${url}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error(`Non-JSON response for ${url}`);
    err.body = text;
    throw err;
  }
}

function pickSingle(options, field, requested) {
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error(`No options returned for ${field}`);
  }
  if (!requested) return options[0][field];
  const normalized = String(requested).toLowerCase();
  const exact = options.find((o) => String(o[field]).toLowerCase() === normalized);
  if (exact) return exact[field];
  const partial = options.find((o) => String(o[field]).toLowerCase().includes(normalized));
  if (partial) return partial[field];
  return options[0][field];
}

async function resolveMakeId(makeId, makeName, responses) {
  if (makeId) return Number(makeId);
  const makesUrl = buildUrl('getMakes');
  const makes = await fetchJson(makesUrl);
  responses.getMakes = { url: makesUrl, data: makes };
  if (!makeName) {
    const toyota = makes.find((m) => m.makeName === 'TOYOTA');
    return toyota ? toyota.makeId : makes[0].makeId;
  }
  const normalized = String(makeName).toLowerCase();
  const exact = makes.find((m) => String(m.makeName).toLowerCase() === normalized);
  if (exact) return exact.makeId;
  const partial = makes.find((m) => String(m.makeName).toLowerCase().includes(normalized));
  if (partial) return partial.makeId;
  return makes[0].makeId;
}

async function run() {
  const args = parseArgs(process.argv);
  if (args.help) {
    process.stdout.write(
      JSON.stringify(
        {
          usage: {
            cmd: 'node tra_umvvs_sample.js --makeName TOYOTA --modelBody "COROLLA FIELDER" --yom 2015',
            optional: [
              '--makeId',
              '--makeName',
              '--modelBody',
              '--yom',
              '--countryOfOrigin',
              '--fuelType',
              '--engineCapacity',
            ],
          },
        },
        null,
        2
      ) + '\n'
    );
    return;
  }

  const responses = {};

  const makeId = await resolveMakeId(args.makeId, args.makeName, responses);

  const modelBodyUrl = buildUrl('getModelBody', { makeId });
  const modelBodyOptions = await fetchJson(modelBodyUrl);
  responses.getModelBody = { url: modelBodyUrl, data: modelBodyOptions };
  const modelBody = pickSingle(modelBodyOptions, 'modelBody', args.modelBody || 'COROLLA FIELDER');

  const yomUrl = buildUrl('getYom', { makeId, modelBody });
  const yomOptions = await fetchJson(yomUrl);
  responses.getYom = { url: yomUrl, data: yomOptions };
  const yom = Number(pickSingle(yomOptions, 'yom', args.yom || 2015));

  const countryUrl = buildUrl('getCountryOfOrigin', { makeId, modelBody, yom });
  const countryOptions = await fetchJson(countryUrl);
  responses.getCountryOfOrigin = { url: countryUrl, data: countryOptions };
  const countryOfOrigin = pickSingle(countryOptions, 'countryOfOrigin', args.countryOfOrigin || 'JAPAN');

  const fuelUrl = buildUrl('getFuelType', { makeId, modelBody, yom, countryOfOrigin });
  const fuelOptions = await fetchJson(fuelUrl);
  responses.getFuelType = { url: fuelUrl, data: fuelOptions };
  const fuelType = pickSingle(fuelOptions, 'fuelType', args.fuelType || 'PETROL & ELECTRIC');

  const engineUrl = buildUrl('getEngineCapacity', { makeId, modelBody, yom, countryOfOrigin, fuelType });
  const engineOptions = await fetchJson(engineUrl);
  responses.getEngineCapacity = { url: engineUrl, data: engineOptions };
  const engineCapacity = pickSingle(engineOptions, 'engineCapacity', args.engineCapacity || '1001 - 1500 CC');

  const detailsUrl = buildUrl('getVehicleDetails', {
    makeId,
    modelBody,
    yom,
    cuntryOfOrigin: countryOfOrigin,
    fuelType,
    engineCapacity,
  });
  const vehicleDetails = await fetchJson(detailsUrl);
  responses.getVehicleDetails = { url: detailsUrl, data: vehicleDetails };

  const result = {
    inputs: {
      makeId,
      modelBody,
      yom,
      countryOfOrigin,
      fuelType,
      engineCapacity,
    },
    vehicle: Array.isArray(vehicleDetails) ? vehicleDetails[0] : vehicleDetails,
    responses,
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

run().catch((err) => {
  const payload = {
    error: {
      message: err && err.message ? err.message : String(err),
      status: err && err.status ? err.status : undefined,
      body: err && err.body ? err.body : undefined,
    },
  };
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  process.exitCode = 1;
});
