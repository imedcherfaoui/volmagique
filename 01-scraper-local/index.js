import fetch from "node-fetch";

import { Firestore, Timestamp } from "@google-cloud/firestore";

/* ---------- CONFIG ---------- */
const ORIGINS = ["CDG", "ORY"]; // airports you want to scan
const MAX_PRICE = 300; // € threshold – raise/lower anytime
const PROJECT_ID = "volmagique-b1e7b"; // ← ❗ Project ID
/* ----------------------------- */

const db = new Firestore({ projectId: PROJECT_ID });

/* Scrape Google Flights Explore for one origin city */
async function scrape(origin) {
  // TravelPayouts "Cheap Tickets" endpoint (last 48 h)
  const url =
    `https://api.travelpayouts.com/v2/prices/latest?origin=${origin}` +
    `&currency=EUR&page=1&limit=30&token=${process.env.TP_TOKEN}`;

  const { data } = await fetch(url).then((r) => r.json()); // pure JSON

  const deals = [];
  for (const ticket of data) {
    const price = ticket.value; // €
    const city = ticket.destination; // e.g. "LIS"
    if (price && price <= MAX_PRICE) {
      deals.push({ origin, city, price });
    }
  }
  return deals;
}

/* Main runner: scrapes → writes to Firestore in one batch */
async function run() {
  const allDeals = [];
  for (const o of ORIGINS) allDeals.push(...(await scrape(o)));

  if (!allDeals.length) {
    console.log("No deals under €" + MAX_PRICE);
    return;
  }

  const ts = Date.now();
  const batch = db.batch();

  allDeals.forEach((d) => {
    const id = `${d.origin}_${d.city}_${d.price}_${ts}`;
    batch.set(db.collection("deals").doc(id), {
      ...d,
      createdAt: Timestamp.fromMillis(ts),
    });
  });

  await batch.commit();
  console.log(`${allDeals.length} deals saved to Firestore ✅`);
}

run().catch(console.error);
