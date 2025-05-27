/**
 * Express server exposing two GET endpoints:
 *  /scrape → runs index.js logic
 *  /send   → runs sendEmail.js logic
 */
import express from "express";
import { exec } from "node:child_process";
const app = express();
const port = process.env.PORT || 8080;

const run = (cmd) =>
  new Promise((res, rej) =>
    exec(`node ${cmd}`, (e, out, err) => (e ? rej(err) : res(out)))
  );

app.get("/scrape", async (_, res) => {
  try {
    const out = await run("index.js");
    res.status(200).send(out);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get("/send", async (_, res) => {
  try {
    const out = await run("sendEmail.js");
    res.status(200).send(out);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get("/", (_, r) => r.send("VolMagique OK"));
app.listen(port, () => console.log("Listening on", port));
