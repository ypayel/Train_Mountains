const fs = require("fs");
const express = require("express");
const app = express();
const path = require("path");

const DATA_FILE = path.join(__dirname, "data.dev.json");

const logStream = fs.createWriteStream("info.log", { flags: "a" });
const warnStream = fs.createWriteStream("warn.log", { flags: "a" });
const errorStream = fs.createWriteStream("error.log", { flags: "a" });

console.log = (msg) => {
  process.stdout.write("[LOG] " + msg + "\n");
  logStream.write(new Date().toISOString() + " [LOG] " + msg + "\n");
};

console.warn = (msg) => {
  process.stdout.write("[WARN] " + msg + "\n");
  warnStream.write(new Date().toISOString() + " [WARN] " + msg + "\n");
};

console.error = (msg) => {
  process.stderr.write("[ERROR] " + msg + "\n");
  errorStream.write(new Date().toISOString() + " [ERROR] " + msg + "\n");
};

app.use(express.json());

app.get("/", (req, res) => {
  console.log("Strona główna została odwiedzona.");
  res.send("Wersja deweloperska API działa!");
});

app.get("/api/dev/coasters", (req, res) => {
  const dane = JSON.parse(fs.readFileSync(DATA_FILE));
  console.log("Pobrano kolejki (dev):", dane.length);
  res.json(dane);
});

const PORT = 3050;
app.listen(PORT, "localhost", () => {
  console.log(`🔧 Wersja DEV działa na http://localhost:${PORT}`);
});
