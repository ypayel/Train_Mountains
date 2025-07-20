import fs from "fs";
import path from "path";

const LOG_FILE = path.join(__dirname, "sync-log.json");

export const syncChangeAsync = (change: any): void => {
  setTimeout(() => {
    const existingLog = fs.existsSync(LOG_FILE)
      ? JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"))
      : [];

    const newLog = [
      ...existingLog,
      {
        timestamp: new Date().toISOString(),
        action: change,
      },
    ];

    fs.writeFileSync(LOG_FILE, JSON.stringify(newLog, null, 2), "utf-8");
    console.log("✅ Zmiana zsynchronizowana asynchronicznie:", change);
  }, 2000);
};
