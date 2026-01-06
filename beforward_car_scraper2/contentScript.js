function getSpecValue(label) {
  const rows = document.querySelectorAll("table.specification tr");

  for (const row of rows) {
    const cells = Array.from(row.children);

    for (let i = 0; i < cells.length - 1; i++) {
      const cell = cells[i];
      const next = cells[i + 1];

      if (
        cell.tagName === "TH" &&
        cell.innerText.trim().startsWith(label) &&
        next.tagName === "TD"
      ) {
        return next.innerText.trim();
      }
    }
  }
  return null;
}

function getBreadcrumbValues() {
  const crumbs = Array.from(
    document.querySelectorAll("#bread li a")
  ).map(a => a.innerText.trim());

  return {
    carMake: crumbs[1] || null,        // TOYOTA
    bodyType: crumbs[2] || null,       // Hatchback
    carModel: crumbs[3] || null,       // IST
    year: crumbs[4] || null            // 2008
  };
}

// Use Chassis No. as model code
function getChassisModelCode() {
  const chassis = getSpecValue("Chassis No.");
  if (!chassis) return null;

  return chassis.split("-")[0].trim();
}

// Extract only numeric part of engine
function normalizeEngine(engineStr) {
  if (!engineStr) return null;
  const match = engineStr.replace(",", "").match(/\d+/);
  return match ? match[0] : null;
}

function scrapeCarData() {
  const breadcrumb = getBreadcrumbValues();
  const modelCode = getChassisModelCode();

  const modelBody =
    breadcrumb.carModel && modelCode && breadcrumb.bodyType
      ? `${breadcrumb.carModel.toUpperCase()} - ${modelCode.toUpperCase()} - ${breadcrumb.bodyType.toUpperCase()}`
      : null;

  const fuel = getSpecValue("Fuel")?.toUpperCase() || null;
  const engine = normalizeEngine(getSpecValue("Engine Size"));

  const data = {
    carMake: breadcrumb.carMake?.toUpperCase() || null,
    carModelBody: breadcrumb.carModel?.toUpperCase() || null,
    modelBody,                         // already uppercase
    yearOfManufacture: breadcrumb.year,
    countryOfOrigin: "JAPAN",
    fuelType: fuel,
    engineCapacity: engine
  };

  chrome.storage.local.set({ lastCarData: data });
  chrome.runtime.sendMessage({
    type: "BEFORWARD_CAR_DATA",
    payload: data
  });
}

scrapeCarData();
