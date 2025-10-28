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

// Kaikki laivat (viimeisen 10 min ajalta)
app.get("/api/ships", async (req, res) => {
  try {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const url = `https://meri.digitraffic.fi/api/ais/v1/locations?from=${tenMinutesAgo}`;

    const response = await fetch(url);
    const data = await response.json();
    const features = Array.isArray(data?.features) ? data.features : [];

    // Otetaan vain liikkuvat laivat
    const ships = features
      .filter((f) => (f?.properties?.sog || 0) > 0.5 && f?.geometry?.type === "Point")
      .map((f) => ({
        mmsi: f.properties.mmsi,
        location: { type: "Point", coordinates: f.geometry.coordinates },
        sog: f.properties.sog, // solmuina
        speed: Math.round((f.properties.sog || 0) * 1.852), // km/h
        timestamp: f.properties.timestamp,
        cog: f.properties.cog ?? null,
      }));

    res.json(ships);
  } catch (err) {
    res.status(500).json({ error: "Laivojen hakeminen epäonnistui" });
  }
});

// Laivojen määrä
app.get("/api/ships/count", async (req, res) => {
  try {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const url = `https://meri.digitraffic.fi/api/ais/v1/locations?from=${tenMinutesAgo}`;

    const response = await fetch(url);
    const data = await response.json();
    const features = Array.isArray(data?.features) ? data.features : [];

    // Lasketaan vain liikkuvat laivat
    const count = features.filter((f) => (f?.properties?.sog || 0) > 0.5).length;
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Laivamäärän hakeminen epäonnistui" });
  }
});

// Nopeimmat laivat (Top 5)
app.get("/api/ships/fastest", async (req, res) => {
  try {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const url = `https://meri.digitraffic.fi/api/ais/v1/locations?from=${tenMinutesAgo}`;

    const response = await fetch(url);
    const data = await response.json();
    const features = Array.isArray(data?.features) ? data.features : [];

    const fastest = features
      .filter((f) => (f?.properties?.sog || 0) > 0.5 && f?.geometry?.type === "Point")
      .map((f) => ({
        mmsi: f.properties.mmsi,
        location: { type: "Point", coordinates: f.geometry.coordinates },
        sog: f.properties.sog,
        speed: Math.round((f.properties.sog || 0) * 1.852),
        timestamp: f.properties.timestamp,
        cog: f.properties.cog ?? null,
      }))
      .sort((a, b) => b.speed - a.speed)
      .slice(0, 5);

    res.json(fastest);
  } catch (err) {
    res.status(500).json({ error: "Nopeimpien laivojen hakeminen epäonnistui" });
  }
});

// Yksi laiva + kaupunki + sää mmsi:n perusteella
app.get("/api/ships/:mmsi", async (req, res) => {
  try {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const url = `https://meri.digitraffic.fi/api/ais/v1/locations?from=${tenMinutesAgo}`;

    const response = await fetch(url);
    const data = await response.json();
    const features = Array.isArray(data?.features) ? data.features : [];

    const feature = features.find((f) => String(f?.properties?.mmsi) === String(req.params.mmsi));

    if (!feature) {
      return res.status(404).json({ error: "Laivaa ei löytynyt" });
    }

    const [lng, lat] = feature.geometry.coordinates;
    const city = await getCity(lat, lng);
    const weather = await getWeather(lat, lng);

    const ship = {
      mmsi: feature.properties.mmsi,
      location: { type: "Point", coordinates: feature.geometry.coordinates },
      sog: feature.properties.sog,
      speed: Math.round((feature.properties.sog || 0) * 1.852),
      timestamp: feature.properties.timestamp,
      cog: feature.properties.cog ?? null,
      city,
      weather,
    };

    res.json(ship);
  } catch (err) {
    res.status(500).json({ error: "Laivan hakeminen epäonnistui" });
  }
});

app.listen(3000, () => console.log("Backend käynnissä: http://localhost:3000"));