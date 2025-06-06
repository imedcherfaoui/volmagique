//01-scraper-local/index.js
import fetch from "node-fetch";
import { Firestore, Timestamp } from "@google-cloud/firestore";


let cacheDeals = [];       // variable globale dans le conteneur
let cacheUpdatedAt = 0;    // timestamp de la dernière mise à jour

const ORIGINS = [
  // France (francophones)
  "CDG", // Paris Charles-de‐Gaulle
  "ORY", // Paris Orly
  "NCE", // Nice Côte d’Azur
  "MRS", // Marseille
  "BVA", // Beauvais-Tillé
  "LYS", // Lyon-Saint-Exupéry
  "BOD", // Bordeaux
  "LIL", // Lille

  // Suisse / Belgique / Luxembourg
  "GVA", // Genève
  "BRU", // Bruxelles
  "LUX", // Luxembourg

  // Hubs européens majeurs (non francophones)
  "LHR", // London Heathrow
  "AMS", // Amsterdam Schiphol
  "FRA", // Frankfurt
  "MAD", // Madrid-Barajas
  "BCN", // Barcelone-El Prat
  "MUC", // Munich
  "BER", // Berlin Brandenburg

  // Autres hubs européens connus pour les vols low-cost
  "VIE", // Vienne
  "ZRH", // Zurich
  "DUB", // Dublin
  "CPH", // Copenhague
  "MIL", // Milan Malpensa
  "MIR", // Milan Linate
  "STN", // London Stansted
  "LGW", // London Gatwick
];

const MAX_PRICE = 300; // € threshold – raise/lower anytime
const PROJECT_ID = "volmagique-b1e7b"; // ← ❗ Project ID
/* ----------------------------- */

const db = new Firestore({ projectId: PROJECT_ID });

/**
 * fetchWithRetry : wrapper fetch() avec gestion des 429 + backoff exponentiel
 */
async function fetchWithRetry(
  url,
  options = {},
  retries = 3,
  backoffMs = 1000
) {
  try {
    const response = await fetch(url, options);
    if (response.status === 429) {
      // rate limit atteint → réessayer après backoff
      if (retries > 0) {
        console.warn(`→ 429 Too Many Requests, retry dans ${backoffMs} ms…`);
        await new Promise((r) => setTimeout(r, backoffMs));
        return fetchWithRetry(url, options, retries - 1, backoffMs * 2);
      } else {
        throw new Error("Nombre de retries atteint (429).");
      }
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} sur ${url}`);
    }
    return await response.json();
  } catch (err) {
    if (retries > 0) {
      console.warn(
        `→ Erreur fetch (${err.message}), retry dans ${backoffMs} ms…`
      );
      await new Promise((r) => setTimeout(r, backoffMs));
      return fetchWithRetry(url, options, retries - 1, backoffMs * 2);
    }
    console.error("Erreur finale fetchWithRetry :", err);
    throw err;
  }
}

/* Scrape Google Flights Explore for one origin city */
async function scrape(origin) {
  const url =
    `https://api.travelpayouts.com/v2/prices/latest?origin=${origin}` +
    `&currency=EUR&page=1&limit=30&token=${process.env.TP_TOKEN}`;

  const { data } = await fetchWithRetry(url);

  const deals = [];
  for (const ticket of data) {
    const price = ticket.value; // prix en €
    const city = ticket.destination; // ex. "ROM"
    if (!price || price > MAX_PRICE) continue; // on ne garde que ≤ MAX_PRICE

    // Autres champs récupérables
    const departureDate = ticket.depart_date; // ex. "2025-09-03"
    const returnDate = ticket.return_date; // ex. "2025-09-10" (le cas échéant)
    const nbEscales = ticket.number_of_changes; // ex. 0
    const durationMin = ticket.duration; // ex. 260 (minutes)
    const distanceKm = ticket.distance; // ex. 1090 km
    const provider = ticket.gate; // ex. "Kupi.com"
    const foundAt = ticket.found_at; // ex. "2025-05-27T07:34:58"

    // Construire le lien Google Flights
    const query = `Flights to ${city} from ${origin} on ${departureDate}`;
    const link =
      `https://www.google.com/travel/flights?hl=en` +
      `&q=${encodeURIComponent(query)}`;

    deals.push({
      origin,
      city,
      price,
      link,
      departureDate,
      returnDate,
      nbEscales,
      durationMin,
      distanceKm,
      provider,
      foundAt,
    });
  }
  return deals;
}

/* Main runner : scrapes → upsert dans Firestore en batch */
async function run() {
  // 1) Scraper tous les origines
  const allDeals = [];
  for (const o of ORIGINS) {
    try {
      const listDeals = await scrape(o);
      allDeals.push(...listDeals);
    } catch (err) {
      console.error(`❌ Erreur lors du scrape de ${o} :`, err.message);
      // on continue malgré l’erreur
    }
  }

  // 2) Déduplication rapide à la volée (par origin+city)
  const seen = new Set();
  const uniqueDeals = allDeals.filter((d) => {
    const key = `${d.origin}_${d.city}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!uniqueDeals.length) {
    console.log(`Aucun deal en dessous de €${MAX_PRICE} trouvé.`);
    return;
  }

  // 3) Commit batch dans Firestore
  const tsMillis = Date.now();
  const batch = db.batch();
  uniqueDeals.forEach((d) => {
    // ID de document inchangé : origin_city_price_timestamp
    const id = `${d.origin}_${d.city}_${d.price}_${tsMillis}`;

    // CALCUL DE expiresAt à partir de `departureDate`
    // On part de d.departureDate (chaîne “YYYY-MM-DD”), on crée un Date à minuit ce jour-là
    const depDate = new Date(d.departureDate);
    depDate.setHours(0, 0, 0, 0);
    const expiresAtTimestamp = Timestamp.fromDate(depDate);

    batch.set(db.collection("deals").doc(id), {
      origin: d.origin,
      city: d.city,
      price: d.price,
      link: d.link,
      departureDate: d.departureDate,
      returnDate: d.returnDate,
      nbEscales: d.nbEscales,
      durationMin: d.durationMin,
      distanceKm: d.distanceKm,
      provider: d.provider,
      foundAt: Timestamp.fromDate(new Date(d.foundAt)),
      createdAt: Timestamp.fromMillis(tsMillis),
      // NOUVEAU : champ TTL pour suppression automatique
      expiresAt: expiresAtTimestamp,
    });
  });
  await batch.commit();
  console.log(`${uniqueDeals.length} deals upserted to Firestore ✅`);

  // 4) Log de l’exécution
  await db.collection("logs").add({
    type: "scrape",
    timestamp: Timestamp.fromMillis(tsMillis),
    count: uniqueDeals.length,
  });
  console.log("Scrape logged");
}

run().catch((err) => {
  console.error("❌ run() échoué:", err);
});
