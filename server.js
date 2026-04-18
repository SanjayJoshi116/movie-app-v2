require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const os = require("os");
const { createObjectCsvWriter } = require("csv-writer");

const app = express();
const PORT = 3001;
const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from any host on port 3000 (LAN access) or no origin (same-origin)
    if (!origin || /^http:\/\/[^:]+:3000$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  }
}));
app.use(express.json());

// Django API proxy — forwards to local Django on port 8000
app.use("/api/django", async (req, res) => {
  const DJANGO_BASE = "http://localhost:8000/api";
  const targetUrl = `${DJANGO_BASE}${req.path}`;
  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      params: req.query,
      data: req.body,
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
        ...(req.headers["authorization"] ? { Authorization: req.headers["authorization"] } : {}),
      },
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || { error: err.message };
    res.status(status).json(data);
  }
});

// Generic TMDB proxy — all TMDB calls go through here, key never reaches the browser
app.get("/api/tmdb/*", async (req, res) => {
  const tmdbPath = req.params[0];
  const queryParams = { ...req.query, api_key: TMDB_KEY };
  try {
    const response = await axios.get(`${TMDB_BASE}/${tmdbPath}`, {
      params: queryParams,
    });
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// Keep existing watched CSV endpoint
const csvWriter = createObjectCsvWriter({
  path: path.join(__dirname, "watched_movies.csv"),
  header: [
    { id: "id", title: "Movie ID" },
    { id: "name", title: "Name" },
    { id: "language", title: "Language" },
    { id: "runtime", title: "Runtime" },
    { id: "releaseYear", title: "Release Year" },
  ],
  append: true,
});

app.post("/api/mark-watched", async (req, res) => {
  const { id, name, language, runtime, releaseYear } = req.body;
  if (!id || !name || !language || !runtime || !releaseYear) {
    return res.status(400).json({ error: "Incomplete movie details provided." });
  }
  try {
    await csvWriter.writeRecords([{ id, name, language, runtime, releaseYear }]);
    res.status(200).json({ message: "Movie details added to CSV successfully." });
  } catch (err) {
    console.error("Error writing to CSV:", err);
    res.status(500).json({ error: "Failed to write movie details to CSV." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  const nets = os.networkInterfaces();
  const ips = Object.values(nets)
    .flat()
    .filter((n) => n.family === "IPv4" && !n.internal)
    .map((n) => n.address);

  console.log(`\nExpress proxy → http://localhost:${PORT}`);
  ips.forEach((ip) => console.log(`                http://${ip}:${PORT}`));
  console.log(`\nOpen the app at:`);
  console.log(`  Local:   http://localhost:3000`);
  ips.forEach((ip) => console.log(`  Network: http://${ip}:3000`));
});
