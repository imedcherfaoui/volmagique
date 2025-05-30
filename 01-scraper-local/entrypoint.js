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

// After imports...
async function webhookHandlerFunction(req, res) {
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
  // …existing event.type logic…
  res.json({ received: true });
}

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();

// CORS
app.use(cors({ origin: ["http://localhost:3000", "https://volmagique.com"] }));

// ─── Webhook must see RAW body ─────────────────────────────────────────────
app.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    console.log("➡️ [webhook] Received raw webhook, length:", req.body.length);
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("⚠️ [webhook] Signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Helper to resolve an email from various objects
    async function resolveEmail(obj) {
      if (obj.customer_details?.email) return obj.customer_details.email;
      if (obj.customer_email) return obj.customer_email;
      if (obj.customer) {
        const cust = await stripe.customers.retrieve(obj.customer);
        return cust.email;
      }
      throw new Error("Could not resolve email from webhook object");
    }

    try {
      let email;
      switch (event.type) {
        case "checkout.session.completed":
          console.log("🔔 [webhook] Event: checkout.session.completed");
          email = await resolveEmail(event.data.object);
          break;

        case "customer.subscription.created":
          console.log("🔔 [webhook] Event: customer.subscription.created");
          email = await resolveEmail(event.data.object);
          break;

        case "invoice.paid":
          console.log("🔔 [webhook] Event: invoice.paid");
          // event.data.object is an invoice; need to fetch the subscription to get customer_details
          const invoice = event.data.object;
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription
          );
          email = await resolveEmail(subscription);
          break;

        default:
          console.log("ℹ️ [webhook] Ignoring event type:", event.type);
          return res.json({ received: true });
      }

      console.log(`✏️ [webhook] Upgrading Firestore subscriber: ${email}`);
      await db
        .collection("subscribers")
        .doc(email)
        .set(
          { email, tier: "premium", upgradedAt: Timestamp.now() },
          { merge: true }
        );
      console.log(`✅ [webhook] Tier set to PREMIUM for ${email}`);

      // ─── Envoi de l’email de confirmation ───────────────────────────
      try {
        await sgMail.send({
          to: email,
          from: { email: "deals.volmagique@gmail.com", name: "VolMagique" },
          templateId: process.env.SENDGRID_CONFIRMATION_TEMPLATE_ID,
          dynamicTemplateData: {
            email,
            date: new Date().toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
            plan: "Premium",
          },
        });
        console.log(`✉️ Confirmation envoyée à ${email}`);
      } catch (mailErr) {
        console.error("❌ Erreur d’envoi de l’email de confirmation:", mailErr);
      }
      // ────────────────────────────────────────────────────────────────

      return res.json({ received: true });
    } catch (err) {
      console.error("❌ [webhook] Processing error:", err);
      return res.status(500).send();
    }
  }
);

// JSON parser for *all other* routes
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
 * GET /sync?email=you@example.com
 * Forces a Firestore update based on Stripe subscription status.
 */
app.get("/sync", async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    // 1) Find the Stripe Customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (!customers.data.length) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const customerId = customers.data[0].id;

    // 2) List active subscriptions for that customer
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    const isPremium = subs.data.length > 0;

    // 3) Write to Firestore
    await db
      .collection("subscribers")
      .doc(email)
      .set(
        {
          email,
          tier: isPremium ? "premium" : "free",
          // optional: only overwrite createdAt on upgrade
          ...(isPremium && { upgradedAt: Timestamp.now() }),
        },
        { merge: true }
      );

    return res.json({ premium: isPremium });
  } catch (err) {
    console.error("/sync error:", err);
    return res.status(500).json({ error: err.message });
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
 * Returns today’s scraped deals as JSON (based on lastUpdated).
 */
app.get("/deals", async (_, res) => {
  try {
    // midnight today
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    // Query for deals touched since midnight
    const snap = await db
      .collection("deals")
      .where("lastUpdated", ">=", Timestamp.fromDate(midnight))
      // Firestore requires any inequality field to be first in orderBy
      .orderBy("lastUpdated", "desc")
      .orderBy("price", "asc")
      .get();

    const deals = snap.docs.map((d) => d.data());
    res.json({ deals });
  } catch (err) {
    console.error("/deals error:", err);
    res.status(500).json({ error: err.message });
  }
});


/**
 * GET /future?days=7
 * Returns deals departing in the next `days` days.
 */
app.get("/future", async (req, res) => {
  try {
    const days = parseInt(req.query.days || "7", 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + days);

    // Fetch all deals (you could optimize with an index on departureDate)
    const snap = await db.collection("deals").get();
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
