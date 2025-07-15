

const { error } = require("console");
const express = require("express");
const fs = require("fs");
const app = express();

app.use(express.json());

const DATA_FILE = "./data.json";

app.get("/", (req, res) => {
  res.send("API do Kolejek Górskich działa! ");
});

app.post("/api/coasters", (req, res) => {
  const {
    liczba_personelu,
    liczba_klientow,
    dl_trasy,
    godziny_od,
    godziny_do,
  } = req.body;

  if (
    !liczba_personelu ||
    !liczba_klientow ||
    !dl_trasy ||
    !godziny_od ||
    !godziny_do
  ) {
    return res.status(400).json({ error: "Brakuje wymaganych danych." });
  }

  const dane = JSON.parse(fs.readFileSync(DATA_FILE));
  const noweId =
    dane.length > 0 ? Math.max(...dane.map((k) => k.id || 0)) + 1 : 1;

  const nowaKolejka = {
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

app.post("/api/coasters/:coastersId/wagons", (req, res) => {
  const coastersId = parseInt(req.params.coastersId);
  const { ilosc_miejsc, predkosc_wagonu } = req.body;

  if (!ilosc_miejsc || !predkosc_wagonu) {
    return res.status(400).json({ error: "Brakuje dannych wagonu" });
  }

  const dane = JSON.parse(fs.readFileSync(DATA_FILE));
  const kolejka = dane.find((k) => k.id === coastersId);

  if (!kolejka) {
    return res.status(404).json({ error: "Kolejka nie istnieje" });
  }

  const nowyWagon = {
    id:
      kolejka.wagony.length > 0
        ? Math.max(...kolejka.wagony.map((w) => w.id || 0)) + 1
        : 1,
    ilosc_miejsc,
    predkosc_wagonu,
  };

  kolejka.wagony.push(nowyWagon);
  fs.writeFileSync(DATA_FILE, JSON.stringify(dane, null, 2));

  res.status(201).json({ message: "Wagon zostal dodany", nowyWagon });
});

app.delete("/api/coasters/:coasterId/wagons/:wagonId", (req, res) => {
  const coasterId = parseInt(req.params.coasterId);
  const wagonId = parseInt(req.params.wagonId);

  const dane = JSON.parse(fs.readFileSync(DATA_FILE));
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
});

app.put("/api/coasters/:coasterId", (req, res) => {
    const coasterId = parseInt(req.params.coasterId);
    const {liczba_klientow, liczba_personelu, godziny_do, godziny_od } = req.body;

    const dane = JSON.parse(fs.readFileSync(DATA_FILE));
    const kolejka = dane.find((k) => k.id === coasterId);


    if(!kolejka) {
        return res.status(404).json({ error: "Kolejka nie istnieje"});
    }

    if (liczba_klientow !== undefined) kolejka.liczba_klientow = liczba_klientow;
    if(liczba_personelu !== undefined) kolejka.liczba_personelu = liczba_personelu;
    if(godziny_do !== undefined) kolejka.godziny_do = godziny_do;
    if(godziny_od !== undefined) kolejka.godziny_od = godziny_od;


    fs.writeFileSync(DATA_FILE, JSON.stringify(dane, null, 2));
    res.json({ message: "Kolejka została zaktualizowana", kolejka});
})

app.listen(3000, () => {
  console.log("API działa na http://localhost:3000");
});
