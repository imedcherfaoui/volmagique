// entrypoint.js
import express from "express";
import { exec } from "node:child_process";
import cors from "cors";
import Stripe from "stripe";
import fetch from "node-fetch";
import mjml from "mjml";
import { Firestore, Timestamp } from "@google-cloud/firestore";
import sgMail from "@sendgrid/mail";
import bodyParser from "body-parser";

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();

// CORS
app.use(cors({ origin: ["http://localhost:3000", "https://volmagique.com"] }));
app.use(express.json());

// Admin auth
const ADMIN_SECRET = process.env.ADMIN_SECRET;

const stripe = new Stripe(process.env.STRIPE_SECRET, {
  apiVersion: "2023-10-16",
});


function checkAdmin(req, res, next) {
  if (req.headers["x-admin-secret"] !== ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

const db = new Firestore({ projectId: "volmagique-b1e7b" });
const run = (cmd) =>
  new Promise((res, rej) =>
    exec(`node ${cmd}`, (e, out, err) => (e ? rej(err) : res(out)))
  );

// ─── POST /subscribe ───────────────────────────────────────────────────────────
app.post("/subscribe", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    // 1) Save subscriber in Firestore
    await db.collection("subscribers").doc(email).set({
      email,
      tier: "free",
      createdAt: Timestamp.now(),
    });

    console.log(
      "SENDGRID_API_KEY prefix:",
      process.env.SENDGRID_API_KEY?.substring(0, 5)
    );

    // 2) (Optional) send a welcome email via SendGrid
    await sgMail.send({
      to: email,
      from: { email: "deals.volmagique@gmail.com", name: "VolMagique" },
      subject: "Bienvenue chez VolMagique – Abonnement gratuit activé 🎉",
      html: `
        <p>Bonjour ! Merci de vous être inscrit(e) à VolMagique (version gratuite).</p>
        <p>Vous recevrez chaque jour nos meilleures offres. Pour tout voir et accéder aux ✅ fonctionnalités premium, pensez à <a href="https://volmagique.com/#pricing">passer à Premium</a> !</p>
        <p>À très vite,<br/>L’équipe VolMagique</p>
      `,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ /subscribe error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Scrape endpoint
app.get("/scrape", checkAdmin, async (req, res) => {
  try {
    const out = await run("index.js");
    res.send(out);
    console.log(`🔄 [${new Date().toISOString()}] /scrape triggered`);
  } catch (e) {
    res.status(500).send(e);
  }
});

// Send broadcast free/premium
app.get("/send", checkAdmin, async (req, res) => {
  const mode = req.query.tag === "premium" ? "premium" : "free";
  const MAX = mode === "premium" ? 10 : 3;
  try {
    // get today's deals
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const snap = await db
      .collection("deals")
      .where("createdAt", ">=", Timestamp.fromDate(midnight))
      .orderBy("price", "asc")
      .limit(MAX)
      .get();
    const deals = snap.docs.map((d) => d.data());
    if (!deals.length) return res.json({ status: "no-deals", mode });

    // format HTML
    const rows = deals
      .map(
        (d) =>
          `<tr><td>${d.origin}</td><td>${d.city}</td><td><b>${d.price}€</b></td></tr>`
      )
      .join("");
    const upgrade =
      mode === "free"
        ? `<mj-text align="center"><a href="https://volmagique.com">🔓 Passez Premium!</a></mj-text>`
        : "";
    const html = mjml(`
      <mjml><mj-body><mj-section><mj-column>
        <mj-text font-size="24px" font-weight="bold">
          Bonjour, <strong>${
            mode === "premium" ? "Premium" : "Gratuit"
          }</strong> !
          Voici les meilleures offres du jour :
        </mj-text>
        <mj-text font-size="20px" font-weight="bold">
          ✈️ ${
            mode === "premium" ? "Top " + deals.length : "Top " + deals.length
          } deals!
        </mj-text>
        <mj-table>
          <tr style="background:#eee"><th>From</th><th>To</th><th>Price</th></tr>
          ${rows}
        </mj-table>
        ${upgrade}
      </mj-column></mj-section></mj-body></mjml>
    `).html;

    // collect subscriber emails
    const subsSnap = await db
      .collection("subscribers")
      .where("tier", "==", mode)
      .get();
    const emails = subsSnap.docs.map((d) => d.data().email);
    // ↓ NEW DEBUG LINES ↓
    console.log(`→ MODE = ${mode}`);
    console.log(`→ Found ${emails.length} subscribers:`, emails);

    if (!emails.length) {
      console.log(`→ No ${mode} subs, skipping send.`);
      return res.json({ status: "no-subscribers", mode });
    }

    // send via SendGrid
    const msg = {
      personalizations: [
        {
          to: emails.map((e) => ({ email: e })),
          subject: `✈️ ${deals[0].price}€ → ${deals[0].city} (${mode})`,
        },
      ],
      from: { email: "deals.volmagique@gmail.com", name: "VolMagique" },
      content: [{ type: "text/html", value: html }],
    };
    try {
      const [response] = await sgMail.send(msg);
      console.log(
        `✉️ Sent ${mode} broadcast to ${emails.length} addresses:`,
        emails
      );
      console.log("→ SendGrid response status code:", response.statusCode);
    } catch (sgError) {
      console.error("❌ SendGrid error:", sgError.response?.body || sgError);
      return res
        .status(500)
        .json({ error: "SendGrid send failed", details: sgError });
    }
    console.log(
      `🔄 [${new Date().toISOString()}] /send?tag=${req.query.tag} triggered`
    );

    // Log the successful send event
    await db.collection("logs").add({
      type: "send",
      mode,
      timestamp: Timestamp.now(),
      count: emails.length,
    });
    return res.json({ status: "ok", mode, sent_to: emails.length });
  } catch (err) {
    console.error("/send error", err);
    res.status(500).json({ error: err.message });
  }
});

// Listen for Stripe webhooks
app.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("⚠️  Webhook signature verification failed.", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const email = session.customer_details.email;

      try {
        // Upgrade them in Firestore
        await db.collection("subscribers").doc(email).set(
          {
            email,
            tier: "premium",
            createdAt: Timestamp.now(),
          },
          { merge: true } // merge so we don't wipe other fields
        );
        console.log("✅ Upgraded to premium in Firestore:", email);
      } catch (fireErr) {
        console.error("❌ Firestore update failed:", fireErr);
      }
    }

    // Return a 200 to Stripe
    res.json({ received: true });
  }
);


/**
 * GET /premium?email=you@example.com
 * Returns { premium: true|false } by checking Firestore `subscribers` tier.
 */
app.get("/premium", async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const snap = await db
      .collection("subscribers")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (snap.empty) return res.json({ premium: false });

    const tier = snap.docs[0].data().tier;
    res.json({ premium: tier === "premium" });
  } catch (err) {
    console.error("/premium error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /portal
 * { email } → returns { url } to Stripe Customer Portal
 */
app.post("/portal", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (!customers.data.length)
      return res.status(404).json({ error: "Customer not found" });

    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: "https://volmagique.com/dashboard",
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("/portal error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /deals
 * Returns today’s scraped deals as JSON.
 */
app.get("/deals", async (_, res) => {
  try {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const snap = await db
      .collection("deals")
      .where("createdAt", ">=", Timestamp.fromDate(midnight))
      .orderBy("price", "asc")
      .get();
    res.json({ deals: snap.docs.map((d) => d.data()) });
  } catch (err) {
    console.error("/deals error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /future?days=7
 * Returns deals departing in the next `days` days (default 7).
 */
app.get("/future", async (req, res) => {
  try {
    const days = parseInt(req.query.days || "7", 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + days);

    const snap = await db
      .collection("deals")
      .where("createdAt", ">=", Timestamp.fromDate(today))
      .get();

    const upcoming = snap.docs
      .map((d) => d.data())
      .filter((d) => {
        const dep = new Date(d.departureDate);
        return dep >= today && dep <= cutoff;
      })
      .sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));

    res.json({ upcoming });
  } catch (err) {
    console.error("/future error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /subscribers
 * Lists all free + premium subscribers from Firestore.
 */
app.get("/subscribers", checkAdmin, async (req, res) => {
  try {
    const snap = await db
      .collection("subscribers")
      .orderBy("createdAt", "desc")
      .get();
    const subscribers = snap.docs.map((d) => ({
      email: d.data().email,
      tier: d.data().tier,
      since: d.data().createdAt.toDate().toISOString(),
    }));
    res.json({ subscribers });
  } catch (err) {
    console.error("/subscribers error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /stats
 * Returns subscriber counts, deal stats, and last scrape/send timestamps.
 */
app.get("/stats", checkAdmin, async (req, res) => {
  try {
    // counts
    const subsSnap = await db.collection("subscribers").get();
    let freeCount = 0,
      premiumCount = 0;
    subsSnap.docs.forEach((d) => {
      d.data().tier === "premium" ? premiumCount++ : freeCount++;
    });

    // today’s deals
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const dealsSnap = await db
      .collection("deals")
      .where("createdAt", ">=", Timestamp.fromDate(midnight))
      .get();
    const dealCount = dealsSnap.size;
    const avgPrice = dealCount
      ? dealsSnap.docs.reduce((s, d) => s + d.data().price, 0) / dealCount
      : 0;

    // last runs
    const last = async (type, mode) => {
      let q = db.collection("logs").where("type", "==", type);
      if (mode) q = q.where("mode", "==", mode);
      const s = await q.orderBy("timestamp", "desc").limit(1).get();
      return s.empty ? null : s.docs[0].data().timestamp.toDate().toISOString();
    };

    res.json({
      freeCount,
      premiumCount,
      dealCount,
      avgPrice,
      lastScrape: await last("scrape"),
      lastSendFree: await last("send", "free"),
      lastSendPremium: await last("send", "premium"),
    });
  } catch (err) {
    console.error("/stats error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /me?email=you@example.com
 * Returns { email, tier, since } from Firestore.
 */
app.get("/me", async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const snap = await db
      .collection("subscribers")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (snap.empty)
      return res.status(404).json({ error: "Subscriber not found" });

    const d = snap.docs[0].data();
    res.json({
      email: d.email,
      tier: d.tier,
      since: d.createdAt.toDate().toISOString(),
    });
  } catch (err) {
    console.error("/me error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (_, r) => r.send("VolMagique OK"));
app.listen(process.env.PORT || 8080, () => console.log("Listening"));
