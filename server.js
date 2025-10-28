const express = require("express");
const app = express();

// Salli frontend-kutsut (kaikkialta)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

// Kaupungin nimi koordinaateista
async function getCity(lat, lng) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
  );
  const data = await response.json();
  return data.address?.city || data.address?.town || "Tuntematon";
}

// Säätiedot koordinaateista
async function getWeather(lat, lng) {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`
  );
  const data = await response.json();
  return {
    temperature: Math.round(data.current_weather.temperature),
    description: data.current_weather.weathercode < 3 ? "selkeää" : "pilvistä",
  };
}

// Kaikki junat
app.get("/api/trains", async (req, res) => {
  const response = await fetch(
    "https://rata.digitraffic.fi/api/v1/train-locations/latest"
  );
  const trains = await response.json();

  // Filtteröi vain tarvittavat kentät
  const filteredTrains = trains.map((train) => ({
    trainNumber: train.trainNumber,
    location: train.location,
    speed: train.speed,
    timestamp: train.timestamp,
    accuracy: train.accuracy,
  }));

  res.json(filteredTrains);
});

// TEHTÄVÄ 1: Lisää tähän /api/trains/count endpoint
app.get("/api/trains/count", async (req, res) => {
  try {
    const response = await fetch(
      "https://rata.digitraffic.fi/api/v1/train-locations/latest"
    );
    const trains = await response.json();
    res.json({ count: Array.isArray(trains) ? trains.length : 0 });
  } catch (err) {
    res.status(500).json({ error: "Junamäärän hakeminen epäonnistui" });
  }
});

// TEHTÄVÄ 2: Lisää tähän /api/trains/fastest endpoint
app.get("/api/trains/fastest", async (req, res) => {
  try {
    const response = await fetch(
      "https://rata.digitraffic.fi/api/v1/train-locations/latest"
    );
    const trains = await response.json();

    // Järjestä nopeuden mukaan ja ota 5 nopeinta
    const fastest = trains
      .filter((t) => typeof t.speed === "number")
      .sort((a, b) => b.speed - a.speed)
      .slice(0, 5);

    res.json(fastest);
  } catch (err) {
    res.status(500).json({ error: "Nopeimpien junien hakeminen epäonnistui" });
  }
});

// Yksi juna + kaupunki + sää
app.get("/api/trains/:id", async (req, res) => {
  const response = await fetch(
    `https://rata.digitraffic.fi/api/v1/train-locations/latest/${req.params.id}`
  );
  const trains = await response.json();
  const train = trains[0];
  const [lng, lat] = train.location.coordinates;
  const city = await getCity(lat, lng);
  const weather = await getWeather(lat, lng);
  res.json({ ...train, city, weather });
});

app.listen(3000, () => console.log("Backend käynnissä: http://localhost:3000"));