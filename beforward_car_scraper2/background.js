chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "BEFORWARD_CAR_DATA") {
    console.log("Received car data:", message.payload);
  }
});