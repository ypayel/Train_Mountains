import fs from "fs";
import path from "path";


const DATA_FILE = path.join(__dirname, "data.json");

const MIN_WAGONY = 3;
const MIN_PERSONEL = 6;

const getCurrentTime = (): string => {
    const now = new Date();
    return now.toTimeString().split(" ")[0].slice(0, 5);

};


const displaysStats = () => {
    console.clear();
    const now = getCurrentTime();
    console.log(`[Godzina ${now}]`);

    const rawData = fs.readFileSync(DATA_FILE, "utf-8");
    const coasters = JSON.parse(rawData);

    coasters.forEach((coaster: any) => {
        const {
            nazwa,
            godziny_do,
            godziny_od,
            wagony,
            liczba_personelu,
            liczba_klientow,
        } = coaster;

        const wagonCount = wagony.length;
        const personel = liczba_personelu;

        console.log(`[${nazwa}]`);
        console.log(`1. Godziny działania: ${godziny_od} - ${godziny_do}`);
        console.log(`2. Liczba wagonów: ${wagonCount}`);
        console.log(`3. Dostępny personel: ${personel}`);
        console.log(`.4 Klienci dziennie: ${liczba_klientow}`);

        const problems: string[] = [];
        if(wagonCount < MIN_WAGONY) problems.push(`brak ${MIN_WAGONY - wagonCount} wagonów`);
        if(personel < MIN_PERSONEL) problems.push(`brakuje ${MIN_PERSONEL - personel} pracowników`);

        if(problems.length > 0) {
            console.log(`5. Problem: ${problems.join(", ")}`);
        } else {
            console.log(`5. Status: OK`);
        }

        console.log(" ")
    });
}
displaysStats();
setInterval(displaysStats, 5000);