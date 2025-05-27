/*
  Firestore → ConvertKit · create broadcast THEN schedule it
  ----------------------------------------------------------
  Env-vars requis : CK_API_SECRET, CK_TAG_ID, GOOGLE_APPLICATION_CREDENTIALS
*/

const { Firestore, Timestamp } = require("@google-cloud/firestore");
import fetch from "node-fetch";

const mjml = require("mjml");

const PROJECT_ID = "volmagique-b1e7b";
const MAX_DEALS = 10;

const CK_SECRET = process.env.CK_API_SECRET;
const TAG_ID = process.env.CK_TAG_ID;

if (!CK_SECRET || !TAG_ID) {
  console.error("❌  Set CK_API_SECRET and CK_TAG_ID");
  process.exit(1);
}

const db = new Firestore({ projectId: PROJECT_ID });

(async () => {
  /* 1. Récupère les deals du jour */
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const snap = await db
    .collection("deals")
    .where("createdAt", ">=", Timestamp.fromDate(midnight))
    .orderBy("price", "asc")
    .limit(MAX_DEALS)
    .get();
  if (snap.empty) {
    console.log("No deals today — abort");
    return;
  }
  const deals = snap.docs.map((d) => d.data());

  /* 2. Construit le HTML */
  const rows = deals
    .map(
      (d) =>
        `<tr><td>${d.origin}</td><td>${d.city}</td><td><b>${d.price} €</b></td></tr>`
    )
    .join("");
  const html = mjml(`
    <mjml><mj-body><mj-section><mj-column>
      <mj-text font-size="20px" font-weight="bold">
        ✈️ ${deals.length} fresh error-fares
      </mj-text>
      <mj-table cellpadding="6" font-family="Helvetica">
        <tr style="background:#eee"><th>From</th><th>To</th><th>Price</th></tr>
        ${rows}
      </mj-table>
      <mj-text font-size="12px" color="#888">
        You’re tagged “alpha”.
      </mj-text>
    </mj-column></mj-section></mj-body></mjml>`).html;

  const subject = `✈️ ${deals[0].price} € to ${deals[0].city} – VolMagique`;

  /* 3. — CREATE draft broadcast — */
  const create = await fetch(
    `https://api.convertkit.com/v3/broadcasts?api_secret=${CK_SECRET}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        content: html,
        segment_ids: [Number(TAG_ID)],
      }),
    }
  ).then((r) => r.json());

  if (!create.broadcast?.id) {
    console.error("❌  Broadcast creation failed", create);
    return;
  }
  const bid = create.broadcast.id;
  console.log("✔︎ Broadcast draft id", bid);

  /* 4. — SCHEDULE it for “now” (envoi immédiat) — */
  const sendAt = new Date(Date.now() + 60_000).toISOString(); // +60 s
  const schedule = await fetch(
    `https://api.convertkit.com/v3/broadcasts/${bid}?api_secret=${CK_SECRET}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ send_at: sendAt }),
    }
  ).then((r) => r.json());

  console.log("✔︎ Scheduled →", schedule.broadcast?.send_at || schedule);
})();
