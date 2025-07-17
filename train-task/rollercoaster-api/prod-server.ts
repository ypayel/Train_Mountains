import fs from "fs";
import express, {Request, Response} from "express";
import path from "path";

const app = express();
app.use(express.json());

const DATA_FILE = path.join(__dirname, "data.prod.json")

const warnStreamProd = fs.createWriteStream("warn.log", {flags: "a"});
const errorStreamProd = fs.createWriteStream("error.log", {flags: "a"});

console.log = () => {};

console.warn = (msg: any) => {
  const text = typeof msg === "string" ? msg : JSON.stringify(msg);
  const logLine = new Date().toISOString() + " [WARN] " + text + "\n";
  process.stderr.write(logLine);
  warnStreamProd.write(logLine);
};

console.error = (msg: any) => {
  const text = typeof msg === "string" ? msg : JSON.stringify(msg);
  const logLine = new Date().toISOString() + " [ERROR] " + text + "\n";
  process.stderr.write(logLine);
  errorStreamProd.write(logLine);
};

app.get("/api/coasters", (req: Request, res: Response) => {
  let dane: any[] = [];

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    dane = JSON.parse(raw || "[]");
  } catch (err: any) {
    console.error("Błąd przy odczycie danych produkcyjnych: " + err.message);
    return res.status(500).json({ error: "Błąd serwera." });
  }

  res.json(dane);
});


const PORT = 3051;
app.listen(PORT, "localhost", () => {
    console.warn(`Wersja PRODUKCYJNA dziala na http://localhost:${PORT}`);
});