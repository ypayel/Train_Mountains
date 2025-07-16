import fs from "fs";
import express, {Request, Response} from "express";
import path from "path";

const app = express();
app.use(express.json());

const DATA_FILE = path.join()

const warnStreamProd = fs.createWriteStream("warn.log", {flags: "a"});
const errorStreamProd = fs.createWriteStream("error.log", {flags: "a"});

console.warn = (msg: any) => {
    const text = typeof msg === "string" ? msg : JSON.stringify(msg);
    process.stdout.write("[WARN]" + text + "/n");
    warnStreamProd.write(new Date().toISOString() + "[WARN]" + text + "/n");
};