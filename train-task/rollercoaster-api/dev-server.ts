import fs from "fs";
import express, { Request, Response } from "express";
import path from "path";

const app = express();
app.use(express.json());

const DATA_FILE = path.join(__dirname, "data.dev.json");

const logStream = fs.createWriteStream("info.log", { flags: "a" });
const warnStream = fs.createWriteStream("warn.log", { flags: "a" });
const errorStream = fs.createWriteStream("error.log", { flags: "a" });


console.log = (msg: any) => {
  const text = typeof msg === "string" ? msg : JSON.stringify(msg);
  process.stdout.write("[LOG] " + text + "\n");
  logStream.write(new Date().toISOString() + " [LOG] " + text + "\n");
};

console.warn = (msg: any) => {
  const text = typeof msg === "string" ? msg : JSON.stringify(msg);
  process.stdout.write("[WARN] " + text + "\n");
  warnStream.write(new Date().toISOString() + " [WARN] " + text + "\n");
};

console.error = (msg: any) => {
  const text = typeof msg === "string" ? msg : JSON.stringify(msg);
  process.stderr.write("[ERROR] " + text + "\n");
  errorStream.write(new Date().toISOString() + " [ERROR] " + text + "\n");
};


app.get("/", (req: Request, res: Response) => {
  console.log("Strona główna została odwiedzona.");
  res.send("Wersja deweloperska API działa!");
});


app.get("/api/dev/coasters", (req: Request, res: Response) => {
  let dane: any[] = [];

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    console.log("RAW JSON:", raw);
    dane = JSON.parse(raw || "[]");
  } catch (err: any) {
    console.error("Błąd przy odczycie JSON:", err.message);
    return res.status(500).json({ error: "Nie udało się odczytać danych." });
  }

  console.log("Pobrano kolejki (dev):", dane.length);
  res.json(dane);
});


const PORT = 3050;
app.listen(PORT, "localhost", () => {
  console.log(`Wersja DEV działa na http://localhost:${PORT}`);
});