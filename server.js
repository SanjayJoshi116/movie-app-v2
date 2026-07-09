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
app.use(express.json({ limit: "10mb" }));

// Django API proxy — forwards to local Django on port 8000
app.use("/api/django", async (req, res) => {
  const DJANGO_BASE = process.env.DJANGO_API_URL || "http://localhost:8000/api";
  const targetUrl = `${DJANGO_BASE}${req.path}`;
  const isMultipart = (req.headers["content-type"] || "").startsWith("multipart/form-data");
  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      params: req.query,
      data: isMultipart ? req : req.body,
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
        ...(isMultipart && req.headers["content-length"] ? { "Content-Length": req.headers["content-length"] } : {}),
        ...(req.headers["authorization"] ? { Authorization: req.headers["authorization"] } : {}),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
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

app.get("/health", (req, res) => res.sendStatus(200));

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
  const hostIp = process.env.HOST_IP || null;
  console.log(`\nExpress proxy → http://localhost:${PORT}`);
  console.log(`\nOpen the app at:`);
  console.log(`  Local:   http://localhost`);
  console.log(`  Local:   http://localhost:3000`);
  if (hostIp) {
    console.log(`  Network: http://${hostIp}`);
    console.log(`  Network: http://${hostIp}:3000`);
  } else {
    console.log(`  Network: run 'ipconfig' on host → use WiFi/Ethernet IPv4 on port 80`);
    console.log(`           or set HOST_IP=<your-lan-ip> in .env.docker`);
  }
});
