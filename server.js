require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const { createObjectCsvWriter } = require("csv-writer");

const app = express();
const PORT = 3001;
const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
