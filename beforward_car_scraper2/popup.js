chrome.storage.local.get("lastCarData", ({ lastCarData }) => {
  const container = document.getElementById("content");

  if (!lastCarData) {
    container.innerText = "No car data found. Open a car page.";
    return;
  }

  container.innerHTML = `
    <div class="row"><span class="label">Make:</span> ${lastCarData.carMake}</div>
    <div class="row"><span class="label">Model:</span> ${lastCarData.carModelBody}</div>
    <div class="row"><span class="label">Model Body</span> ${lastCarData.modelBody}</div>
    <div class="row"><span class="label">Year:</span> ${lastCarData.yearOfManufacture}</div>
    <div class="row"><span class="label">Origin:</span> ${lastCarData.countryOfOrigin}</div>
    <div class="row"><span class="label">Fuel:</span> ${lastCarData.fuelType}</div>
    <div class="row"><span class="label">Engine:</span> ${lastCarData.engineCapacity}</div>
  `;
});