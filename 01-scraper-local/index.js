const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));
const cheerio = require("cheerio");

/*
  Simple Google Flights Explore scraper (demo)
  -------------------------------------------
  1. Change origins in the ORIGINS array.
  2. Run:   node index.js
  3. You’ll see an array of cheap deals in the console.
*/

const ORIGINS = ["CDG", "ORY"]; // Paris airports
const MAX_PRICE = 150; // € threshold – adjust as you like

const scrape = async (origin) => {
  // small variation of the Explore URL so Google doesn't block us instantly
  const url =
    `https://www.google.com/travel/explore?tfs=CBwQAhooEgoyMDI1LTA3LTA2agwIAhIIL20vMDF0eGhxQAFIUgA` +
    `&tfu=KgIKAlBIMEgC&curr=EUR&hl=en-US&orig=${origin}`;

  const html = await (await fetch(url)).text();
  const $ = cheerio.load(html);

  const deals = [];
  $("div[role='listitem']").each((_, el) => {
    const city = $(el).find("div[jsname='tYr6pf']").first().text();
    const priceStr = $(el)
      .find("div[jsname='IRqVMb']")
      .text()
      .replace(/[^\d]/g, "");
    const price = parseInt(priceStr, 10);
    if (price && price <= MAX_PRICE) {
      deals.push({ origin, city, price });
    }
  });
  return deals;
};

const run = async () => {
  const results = [];
  for (const o of ORIGINS) results.push(...(await scrape(o)));
  console.log(JSON.stringify(results, null, 2));
};

run().catch(console.error);
