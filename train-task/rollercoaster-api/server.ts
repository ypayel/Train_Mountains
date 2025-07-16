import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

const DATA_FILE = path.join(__dirname, "data.json");

interface Wagon {
  id: number;
  ilosc_miejsc: number;
  predkosc_wagonu: number;
}

interface Kolejka {
  id: number;
  liczba_personelu: number;
  liczba_klientow: number;
  dl_trasy: number;
  godziny_od: string;
  godziny_do: string;
  wagony: Wagon[];
}


app.get("/", (req: Request, res: Response) => {
  res.send("API do Kolejek Górskich działa!");
});


app.post("/api/coasters", (req: Request, res: Response) => {
  const { liczba_personelu, liczba_klientow, dl_trasy, godziny_od, godziny_do } =
    req.body;

  if (
    !liczba_personelu ||
    !liczba_klientow ||
    !dl_trasy ||
    !godziny_od ||
    !godziny_do
  ) {
    return res.status(400).json({ error: "Brakuje wymaganych danych." });
  }

  const dane: Kolejka[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  const noweId = dane.length > 0 ? Math.max(...dane.map((k) => k.id)) + 1 : 1;

  const nowaKolejka: Kolejka = {
    id: noweId,
    liczba_personelu,
    liczba_klientow,
    dl_trasy,
    godziny_od,
    godziny_do,
    wagony: [],
  };

  dane.push(nowaKolejka);
  fs.writeFileSync(DATA_FILE, JSON.stringify(dane, null, 2));

  res.status(201).json({ message: "Kolejka została dodana.", nowaKolejka });
});


app.post("/api/coasters/:coastersId/wagons", (req: Request, res: Response) => {
  const coastersId = parseInt(req.params.coastersId);
  const { ilosc_miejsc, predkosc_wagonu } = req.body;

  if (!ilosc_miejsc || !predkosc_wagonu) {
    return res.status(400).json({ error: "Brakuje danych wagonu" });
  }

  const dane: Kolejka[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  const kolejka = dane.find((k) => k.id === coastersId);

  if (!kolejka) {
    return res.status(404).json({ error: "Kolejka nie istnieje" });
  }

  const nowyWagon: Wagon = {
    id:
      kolejka.wagony.length > 0
        ? Math.max(...kolejka.wagony.map((w) => w.id)) + 1
        : 1,
    ilosc_miejsc,
    predkosc_wagonu,
  };

  kolejka.wagony.push(nowyWagon);
  fs.writeFileSync(DATA_FILE, JSON.stringify(dane, null, 2));

  res.status(201).json({ message: "Wagon został dodany", nowyWagon });
});


app.delete(
  "/api/coasters/:coasterId/wagons/:wagonId",
  (req: Request, res: Response) => {
    const coasterId = parseInt(req.params.coasterId);
    const wagonId = parseInt(req.params.wagonId);

    const dane: Kolejka[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    const kolejka = dane.find((k) => k.id === coasterId);

    if (!kolejka) {
      return res.status(404).json({ error: "Kolejka nie istnieje." });
    }

    const indexWagonu = kolejka.wagony.findIndex((w) => w.id === wagonId);

    if (indexWagonu === -1) {
      return res.status(404).json({ error: "Wagon nie istnieje." });
    }

    kolejka.wagony.splice(indexWagonu, 1);
    fs.writeFileSync(DATA_FILE, JSON.stringify(dane, null, 2));

    res.json({ message: "Wagon został usunięty." });
  }
);


app.put("/api/coasters/:coasterId", (req: Request, res: Response) => {
  const coasterId = parseInt(req.params.coasterId);
  const { liczba_klientow, liczba_personelu, godziny_do, godziny_od } =
    req.body;

  const dane: Kolejka[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  const kolejka = dane.find((k) => k.id === coasterId);

  if (!kolejka) {
    return res.status(404).json({ error: "Kolejka nie istnieje" });
  }

  if (liczba_klientow !== undefined)
    kolejka.liczba_klientow = liczba_klientow;
  if (liczba_personelu !== undefined)
    kolejka.liczba_personelu = liczba_personelu;
  if (godziny_do !== undefined) kolejka.godziny_do = godziny_do;
  if (godziny_od !== undefined) kolejka.godziny_od = godziny_od;

  fs.writeFileSync(DATA_FILE, JSON.stringify(dane, null, 2));
  res.json({ message: "Kolejka została zaktualizowana", kolejka });
});


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`API działa na http://localhost:${PORT}`);
});