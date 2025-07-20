import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import redis from "./redisClient";
import { json } from "stream/consumers";
import { syncChangeAsync } from "./syncService";

const app = express();
app.use(express.json());

(async () => {
  await redis.connect();
})();

const DATA_FILE = path.join(__dirname, "data.json");

interface Wagon {
  id: number;
  ilosc_miejsc: number;
  predkosc_wagonu: number;
  lastRunEndTime?: string;
}

interface Kolejka {
  id: number;
  liczba_personelu: number;
  liczba_klientow: number;
  dl_trasy: number;
  godziny_od: string;
  godziny_do: string;
  wagony: Wagon[];
  czy_online: boolean;
  nazwa: string;
}

const canRunWagon = (
  wagon: Wagon,
  kolejka: Kolejka,
  now: Date = new Date()
): boolean => {
  const [openH, openM] = kolejka.godziny_od.split(":").map(Number);
  const [closeH, closeM] = kolejka.godziny_do.split(":").map(Number);

  const open = new Date(now);
  open.setHours(openH, openM, 0, 0);

  const close = new Date(now);
  close.setHours(closeH, closeM, 0, 0);

  if (now < open || now > close) return false;

  if (wagon.lastRunEndTime) {
    const last = new Date(wagon.lastRunEndTime);
    const diff = now.getTime() - last.getTime();
    if (diff < 5 * 60 * 1000) return false;
  }

  const czasTrasy = kolejka.dl_trasy * 1000;
  if (now.getTime() + czasTrasy > close.getTime()) return false;

  return true;
};

app.get("/", (req: Request, res: Response) => {
  res.send("API do Kolejek Górskich działa!");
});

//Rejstracja nowej kolejki gorskiej
app.post("/api/coasters", (req: Request, res: Response) => {
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
    czy_online: false,
    nazwa: "",
  };

  dane.push(nowaKolejka);
  fs.writeFileSync(DATA_FILE, JSON.stringify(dane, null, 2));

  res.status(201).json({ message: "Kolejka została dodana.", nowaKolejka });
});

//Rejstracja nowego wagonu
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

//Usuniencie wagonu
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

//Zmiana kolejki + Synchronizacja dannych
app.put("/api/coasters/:coasterId", (req: Request, res: Response): void => {
  try {
    const coasterId = parseInt(req.params.coasterId);
    const updatedData = req.body;

    const dane: Kolejka[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    const index = dane.findIndex((k) => k.id === coasterId);

    if (index === -1) {
      res.status(404).json({ error: "Nie znaleziono kolejki" });
      return;
    }

    dane[index] = { ...dane[index], ...updatedData };
    fs.writeFileSync(DATA_FILE, JSON.stringify(dane, null, 2), "utf-8");

    // Asynchroniczna synchronizacja zmian z innymi węzłami
    syncChangeAsync({
      typ: "UPDATE_COASTER",
      id: coasterId,
      zmiany: updatedData,
    });

    res.json({ message: "Zmieniono dane kolejki (synchronizacja w tle)" });
  } catch (err) {
    console.error("Błąd przy aktualizacji kolejki:", err);
    res.status(500).json({ error: "Wewnętrzny błąd serwera" });
  }
});

//Redis
app.get("/api/prod/coasters", async (req: Request, res: Response) => {
  try {
    const cache = await redis.get("coasters");
    if (cache) {
      console.warn("Dane pobrane z cache (Redis)");
      return res.json(JSON.parse(cache));
    }

    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const dane = JSON.parse(raw || "[]");

    await redis.set("coasters", JSON.stringify(dane), {
      EX: 60,
    });

    console.log("Dane pobrane z pliku i zapisane do Redis");
    res.json(dane);
  } catch (err: any) {
    console.error("Błąd przy obsłudze Redis:", err.message);
    res.status(500).json({ error: "Wewnętrzny błąd serwera." });
  }
});

//Zarządzanie kolejkami i wagonami 
app.post(
  "/api/coasters/:coasterId/wagons/:wagonId/run",
  (req: Request, res: Response) => {
    try {
      const dane: Kolejka[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

      const coasterId = parseInt(req.params.coasterId);
      const wagonId = parseInt(req.params.wagonId);

      const kolejka = dane.find((k) => k.id === coasterId);
      if (!kolejka)
        return res.status(404).json({ error: "Kolejka nie istnieje" });

      const wagon = kolejka.wagony.find((w) => w.id === wagonId);
      if (!wagon) return res.status(404).json({ error: "Wagon nie istnieje" });

      const now = new Date();

      if (!canRunWagon(wagon, kolejka, now)) {
        return res
          .status(400)
          .json({ error: "Nie można uruchomić wagonu teraz" });
      }

      wagon.lastRunEndTime = now.toISOString();

      fs.writeFileSync(DATA_FILE, JSON.stringify(dane, null, 2));

      res.json({ message: "Wagon ruszył", time: now.toISOString() });
    } catch (error: any) {
      console.error("Błąd w endpoint /run wagon:", error);
      res.status(500).json({ error: "Wewnętrzny błąd serwera" });
    }
  }
);

//Zarządzanie personelem
app.get("/api/coasters/staff-status", (req: Request, res: Response) => {
  try {
    const dane: Kolejka[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

    const stats = dane.map((kolejka) => {
      const wymaganyPersonel = 1 + kolejka.wagony.length * 2;
      const roznica = kolejka.liczba_personelu - wymaganyPersonel;

      let status: string;
      if (roznica === 0) {
        status = "Liczba personelu jest odpowiednia.";
      } else if (roznica > 0) {
        status = `Za duzo personelu. Nadmiar: ${roznica}.`;
      } else {
        status = `Brakuje personelu. Niedobor: ${Math.abs(roznica)}`;
      }

      return {
        kolejkaId: kolejka.id,
        wymaganyPersonel,
        dostepnyPersonel: kolejka.liczba_personelu,
        status,
      };
    });

    res.json(stats);
  } catch (error: any) {
    console.error("Blad podczas sprawdzania personelu:", error);
    res.status(500).json({ error: "Wewnętrzny błąd serwera" });
  }
});

//Zarządzanie klientami
app.get("/api/coasters/klients-status", (req: Request, res: Response) => {
  try {
    const dane: Kolejka[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

    const stats = dane.map((kolejka) => {
      const godzinaOd = parseInt(kolejka.godziny_od.split(":")[0], 10);
      const minutaOd = parseInt(kolejka.godziny_od.split(":")[1], 10);
      const godzinaDo = parseInt(kolejka.godziny_do.split(":")[0], 10);
      const minutaDo = parseInt(kolejka.godziny_do.split(":")[1], 10);

      const czasPracyMinuty =
        godzinaDo * 60 + minutaDo - (godzinaOd * 60 - minutaOd);

      let maksKlientow = 0;

      for (const wagon of kolejka.wagony) {
        const czasPrzejazdu = kolejka.dl_trasy / wagon.predkosc_wagonu;
        const iloscPrzejazdow = Math.floor(
          (czasPracyMinuty * 60) / czasPrzejazdu
        );
        maksKlientow += iloscPrzejazdow * wagon.ilosc_miejsc;
      }

      const wymaganyPersonel = 1 + kolejka.wagony.length * 2;

      let status: string;
      if (maksKlientow < kolejka.liczba_klientow) {
        const niedoborKlientow = kolejka.liczba_klientow - maksKlientow;
        status = `Nie da się obsłużyć wszystkich klientów. Brakuje ${niedoborKlientow}`;
      } else if (maksKlientow >= 2 * kolejka.liczba_klientow) {
        const nadmiarKlientow = maksKlientow - 2 * kolejka.liczba_klientow;
        status = `Za dużo mocy przerobowej. Nadmiarowe miejsca: ${nadmiarKlientow}, nadmiarowy personel: ${
          kolejka.liczba_personelu - wymaganyPersonel
        }`;
      } else {
        status = `Liczba klientów możliwa do obsłużenia: ${maksKlientow}. Wszystko OK.`;
      }

      return {
        kolejkaId: kolejka.id,
        liczbaKlientow: kolejka.liczba_klientow,
        maksKlientow,
        status,
      };
    });
    res.json(stats);
  } catch (error: any) {
    console.error("Blad podczas sprawdzania klientow:", error);
    res.status(500).json({ error: "Wewnętrzny błąd serwera" });
  }
});

//Rozproszony system zarządzania
app.get("/api/coasters/autonomous-system", (req: Request, res: Response) => {
  try {
    const dane: Kolejka[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    const onlineCoasters = dane.filter((kolejka) => kolejka.czy_online);

    if (onlineCoasters.length === 0) {
      return res.json({
        message:
          "Brak kolejek podłączonych do sieci. Wszystkie działają autonomicznie.",
      });
    }

     if (onlineCoasters.length === 1) {
      return res.json({
        message: "Tylko jedna kolejka podłączona do systemu. Działa autonomicznie.",
        node: onlineCoasters[0].id,
      });
     }

     const centralNode = onlineCoasters.reduce((min, current) =>
      current.id < min.id ? current : min
    );

     const synchronizacja = onlineCoasters.map(k => ({
      id: k.id,
      status: k.id === centralNode.id ? "Centralny węzeł" : `Zsynchronizowano z węzłem ${centralNode.id}`,
    }));

    res.json({
      message: `Węzeł centralny to kolejka ${centralNode.id}`,
      centralNode: centralNode.id,
      synchronizacja,
    });
    
  } catch (error: any) {
    console.error("Blad syatemu:", error);
    res.status(500).json({ error: "Wewnętrzny błąd serwera" });
  }
});


//Synchronizacja dannych


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`API działa na http://localhost:${PORT}`);
});
