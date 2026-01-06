async function fetchJson(url) {
  console.log("TRA API Request URL:", url);
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "FETCH_TRA", url }, response => {
      if (response && response.success) resolve(response.data);
      else reject(new Error(response ? response.error : "No response from background"));
    });
  });
}

async function getMakeId(carMake) {
  const makes = await fetchJson('https://taxpayerportal.tra.go.tz/umvvs-api/ExternalCalculator/getMakes');
  const make = makes.find(m => m.makeName.toUpperCase() === carMake.toUpperCase());
  return make ? make.makeId : null;
}

async function getEngineRange(makeId, modelBody, yom, country, fuelType, engineActual) {
  const url = `https://taxpayerportal.tra.go.tz/umvvs-api/ExternalCalculator/getEngineCapacity?makeId=${makeId}&modelBody=${encodeURIComponent(modelBody)}&yom=${yom}&countryOfOrigin=${country}&fuelType=${encodeURIComponent(fuelType)}`;
  const ranges = await fetchJson(url);

  const engineNum = parseInt(engineActual, 10);
  const rangesStr = ranges.map(r => r.engineCapacity.toString());

  const selected = rangesStr.find(r => {
    const match = r.match(/(\d+)\s*-\s*(\d+)/);
    if (match) {
      const min = parseInt(match[1], 10);
      const max = parseInt(match[2], 10);
      return engineNum >= min && engineNum <= max;
    } else {
      return parseInt(r, 10) === engineNum;
    }
  });

  return selected || rangesStr[0];
}

async function getVehicleDetails(makeId, modelBody, yom, country, fuel, engineRange) {
  const url = `https://taxpayerportal.tra.go.tz/umvvs-api/ExternalCalculator/getVehicleDetails?makeId=${makeId}&modelBody=${encodeURIComponent(modelBody)}&yom=${yom}&cuntryOfOrigin=${country}&fuelType=${encodeURIComponent(fuel)}&engineCapacity=${encodeURIComponent(engineRange)}`;
  console.log("Final Vehicle Details URL:", url);
  return fetchJson(url);
}

async function fetchTraTaxes(carData) {
  try {
    console.log("Car data for TRA:", carData);
    const makeId = await getMakeId(carData.carMake);
    if (!makeId) throw new Error("Make not found in TRA");

    const engineRange = await getEngineRange(makeId, carData.modelBody, carData.yearOfManufacture, carData.countryOfOrigin, carData.fuelType, carData.engineCapacity);
    console.log("Selected engine range:", engineRange);

    return await getVehicleDetails(makeId, carData.modelBody, carData.yearOfManufacture, carData.countryOfOrigin, carData.fuelType, engineRange);
  } catch (err) {
    console.error("TRA Tax fetch error:", err);
    return null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const content = document.getElementById("content");
  const taxesDiv = document.getElementById("taxes");
  const fetchBtn = document.getElementById("fetchTaxes");

  chrome.storage.local.get("lastCarData", ({ lastCarData }) => {
    if (!lastCarData) {
      content.innerText = "No car data found. Open a BE FORWARD car page.";
      return;
    }

    content.innerHTML = `
      <div class="car-info"><b>Make:</b> ${lastCarData.carMake}</div>
      <div class="car-info"><b>Model:</b> ${lastCarData.carModelBody}</div>
      <div class="car-info"><b>Model Body:</b> ${lastCarData.modelBody}</div>
      <div class="car-info"><b>Year:</b> ${lastCarData.yearOfManufacture}</div>
      <div class="car-info"><b>Origin:</b> ${lastCarData.countryOfOrigin}</div>
      <div class="car-info"><b>Fuel:</b> ${lastCarData.fuelType}</div>
      <div class="car-info"><b>Engine:</b> ${lastCarData.engineCapacity}</div>
    `;

    fetchBtn.onclick = async () => {
      taxesDiv.innerHTML = "<div class='loading'>Fetching TRA taxes...</div>";
      const taxes = await fetchTraTaxes(lastCarData);
      if (!taxes) {
        taxesDiv.innerHTML = "<div class='error'>Failed to fetch TRA taxes.</div>";
        return;
      }

      taxesDiv.innerHTML = taxes.map(t => `
        <div class="tax-item"><b>Make:</b> ${t.make}</div>
        <div class="tax-item"><b>Model:</b> ${t.model}</div>
        <div class="tax-item"><b>Body Type:</b> ${t.bodyType}</div>
        <div class="tax-item"><b>Model Body:</b> ${t.modelBody}</div>
        <div class="tax-item"><b>Year of Manufacture:</b> ${t.yom}</div>
        <div class="tax-item"><b>Country:</b> ${t.country}</div>
        <div class="tax-item"><b>Fuel Type:</b> ${t.fuelType}</div>
        <div class="tax-item"><b>Engine Capacity:</b> ${t.engineCapacity}</div>
        <hr>
        <div class="tax-item"><b>CIF (USD):</b> ${t.cifInUSD}</div>
        <div class="tax-item"><b>Import Duty (USD):</b> ${t.importDutyInUSD}</div>
        <div class="tax-item"><b>Excise Duty (USD):</b> ${t.exiseDutyInUSD}</div>
        <div class="tax-item"><b>Excise Duty Due To Age (USD):</b> ${t.exiseDutyDueToAgeInUSD}</div>
        <div class="tax-item"><b>VAT (USD):</b> ${t.vatInUSD}</div>
        <div class="tax-item"><b>Custom Processing Fee (USD):</b> ${t.customProcessingFeeInUSD}</div>
        <div class="tax-item"><b>Railway Dev Levy (USD):</b> ${t.railwayDevLevyInUSD}</div>
        <div class="tax-item"><b>HIV Resp Levy (TZS):</b> ${t.hivRespLevy}</div>
        <div class="tax-total"><b>Total Taxes (TZS): ${t.totalTaxesInTZS}</b></div>
      `).join("");
    };
  });
});
