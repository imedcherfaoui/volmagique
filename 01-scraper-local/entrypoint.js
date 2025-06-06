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


const stripe = new Stripe(process.env.STRIPE_SECRET, {
  apiVersion: "2023-10-16",
});

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
const SENDGRID_TEMPLATE_ID = process.env.SENDGRID_BROADCAST_TEMPLATE_ID;

function checkAdmin(req, res, next) {
  if (req.headers["x-admin-secret"] !== ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

const db = new Firestore({ projectId: "volmagique-b1e7b" });

// ─────────────── Cache en mémoire pour /deals ───────────────

// On garde dans la variable `cachedDealsData` un objet qui contiendra :
//   { timestampMs: <Date.now() du dernier fetch>, data: [array_of_deals] }
let cachedDealsData = {
  timestampMs: 0,
  data: [],
  originFilter: null, // on mémorise la valeur de "origin" utilisée pour la requête
  limit: null, // on mémorise la valeur de "limit" utilisée
};

// Durée de validité du cache en millisecondes (ici 5 minutes)
const DEALS_CACHE_TTL_MS = 5 * 60 * 1000;

const run = (cmd) =>
  new Promise((res, rej) =>
    exec(`node ${cmd}`, (e, out, err) => (e ? rej(err) : res(out)))
  );

// ─── POST /subscribe ───────────────────────────────────────────────────────────
app.post("/subscribe", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const docRef = db.collection("subscribers").doc(email);
    const snap = await docRef.get();

    if (!snap.exists) {
      // Le doc n’existe pas → on crée avec tier: "free"
      await docRef.set({
        email,
        tier: "free",
        createdAt: Timestamp.now(),
      });

      console.log("Nouvel abonné créé en mode FREEMIUM :", email);

      // (Optionnel) Envoyer le mail de bienvenue uniquement la première fois
      await sgMail.send({
        to: email,
        from: { email: "deals.volmagique@gmail.com", name: "VolMagique" },
        subject: "Bienvenue chez VolMagique – Abonnement gratuit activé 🎉",
        html: `
          <p>Bonjour ! Merci de vous être inscrit(e) à VolMagique (version gratuite).</p>
          <p>Vous recevrez chaque jour nos meilleures offres. Pour tout voir et accéder aux fonctionnalités premium, pensez à <a href="https://volmagique.com/#pricing">passer à Premium</a> !</p>
          <p>À très vite,<br/>L’équipe VolMagique</p>
        `,
      });
    } else {
      // Le document existe déjà (l’utilisateur s’est déjà inscrit) → on ne touche pas au champ "tier"
      console.log("Abonné existant, on ne réinitialise pas tier:", email);
    }

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
    console.log("Scrape logged");
    res.send(out);
    console.log(`🔄 [${new Date().toISOString()}] /scrape triggered`);
  } catch (e) {
    console.error("/scrape error:", e);

    // → Écrire l’erreur dans Firestore (“errors”)
    await db.collection("errors").add({
      type: "scrape",
      timestamp: Timestamp.now(),
      message: e.message || "Unknown scrape error",
      stack: e.stack || null,
    });

    return res.status(500).send(e.toString());
  }
});

/**
 * GET /send
 * Envoie un broadcast quotidien en utilisant un Dynamic Template SendGrid
 */
app.get("/send", checkAdmin, async (req, res) => {
  const mode = req.query.tag === "premium" ? "premium" : "free";
  const MAX = mode === "premium" ? 10 : 3;

  try {
    // 1) Récupérer les deals de la journée (basé sur createdAt, cf. précédemment)
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    const dealsSnap = await db
      .collection("deals")
      .where("createdAt", ">=", Timestamp.fromDate(midnight))
      .orderBy("createdAt", "desc")
      .orderBy("price", "asc")
      .limit(MAX)
      .get();

    const deals = dealsSnap.docs.map((d) => d.data());
    if (!deals.length) {
      return res.json({ status: "no-deals", mode });
    }

    // 2) Stocker simplement la longueur dans une variable
    const dealCount = deals.length;

    // 2) Récupérer les adresses des abonnés du tier mode
    const subsSnap = await db
      .collection("subscribers")
      .where("tier", "==", mode)
      .get();

    const subscribers = subsSnap.docs.map((doc) => doc.data());
    const emails = subscribers.map((s) => s.email);
    if (!emails.length) {
      return res.json({ status: "no-subscribers", mode });
    }

    // 3) Construire le tableau des "personalizations" pour SendGrid
    // Ici, on peut extraire le prénom s’il existe dans vos données subscribers
    // sinon, on passe un fallback générique (ex. “Cher·e abonné·e”).
    const personalizations = emails.map((email) => {
      // Si vous stockez le prénom dans Firestore, faites : s.firstName
      // pour l’exemple, on n’a que l’email, donc prénom = email.split(‘@’)[0]
      const firstName = email.split("@")[0];
      const unsubscribeLink = `https://volmagique.com/unsubscribe?email=${encodeURIComponent(
        email
      )}`;

      return {
        to: [{ email }], // Chaque destinataire recevra SON email en To
        dynamic_template_data: {
          first_name: firstName,
          deal_count: dealCount, // <- la longueur envoyée explicitement
          deals: deals, // tableau d’objets { origin, city, price }
          cta_url: "https://volmagique.com/dashboard",
          unsubscribe_link: unsubscribeLink,
        },
      };
    });

    // 4) Construire le message SendGrid
    const msg = {
      template_id: SENDGRID_TEMPLATE_ID,
      personalizations,
      from: { email: "deals.volmagique@gmail.com", name: "VolMagique" },
    };

    // 5) Envoyer en batch (un seul appel API)
    try {
      await sgMail.send(msg);
      console.log(`✉️ Broadcast ${mode} envoyé à ${emails.length} abonnés`);
    } catch (sgError) {
      console.error("❌ SendGrid error:", sgError.response?.body || sgError);
      return res
        .status(500)
        .json({ error: "SendGrid send failed", details: sgError });
    }

    // 6) Logger l’événement dans Firestore
    await db.collection("logs").add({
      type: "send",
      mode,
      timestamp: Timestamp.now(),
      count: emails.length,
    });

    return res.json({ status: "ok", mode, sent_to: emails.length });
  } catch (err) {
    console.error("/send error", err);

    // → Écrire l’erreur dans Firestore (“errors”)
    await db.collection("errors").add({
      type: "send",
      mode, // "free" ou "premium"
      timestamp: Timestamp.now(),
      message: err.message || "Unknown send error",
      stack: err.stack || null,
    });

    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /errors
 * Retourne les N dernières erreurs (scrape/send)
 */
app.get("/errors", checkAdmin, async (req, res) => {
  try {
    // On peut éventuellement récupérer un paramètre ?limit=...
    const limitParam = parseInt(req.query.limit || "50", 10);
    const limitN = Number.isNaN(limitParam) ? 50 : limitParam;

    const snap = await db
      .collection("errors")
      .orderBy("timestamp", "desc")
      .limit(limitN)
      .get();

    const errors = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        type: d.type,
        mode: d.mode || null,
        message: d.message,
        stack: d.stack,
        timestamp: d.timestamp.toDate().toISOString(),
      };
    });
    return res.json({ errors });
  } catch (err) {
    console.error("/errors error:", err);
    return res.status(500).json({ error: err.message });
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
    // 1) Récupérer le client Stripe pour cet email
    const customers = await stripe.customers.list({ email, limit: 1 });

    // 2) Si pas de customer : on considère “free” ET on met à jour Firestore
    if (!customers.data.length) {
      await db
        .collection("subscribers")
        .doc(email)
        .set({ email, tier: "free" }, { merge: true });
      return res.json({ premium: false });
    }

    const customerId = customers.data[0].id;

    // 3) Lister toutes les souscriptions de ce customer (tous statuts)
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 1,
    });

    // 4) Déterminer “premium” si status est 'active' ou 'trialing'
    let isPremium = false;
    if (subs.data.length > 0) {
      const status = subs.data[0].status; // ex. 'trialing', 'active', 'canceled', etc.
      if (status === "active" || status === "trialing") {
        isPremium = true;
      }
    }

    // 5) Mettre à jour Firestore selon le cas
    await db
      .collection("subscribers")
      .doc(email)
      .set(
        {
          email,
          tier: isPremium ? "premium" : "free",
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

// … (imports, init Firestore, etc.)

/**
 * GET /deals?origin=XXX&limit=N
 */
app.get("/deals", async (req, res) => {
  try {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    const origin     = req.query.origin;
    const limitParam = parseInt(req.query.limit || "30", 10);
    const limitN     = Number.isNaN(limitParam) ? 30 : limitParam;

    // 1) “where” sur createdAt
    let query = db.collection("deals")
      .where("createdAt", ">=", Timestamp.fromDate(midnight));

    // 2) Si on a un filtre “origin”, on l’ajoute
    if (origin) {
      query = query.where("origin", "==", origin);
    }

    // 3) **On ordonne d’abord sur createdAt**, puis sur price
    query = query
      .orderBy("createdAt", "asc")
      .orderBy("price",    "asc")
      .limit(limitN);

    const snap = await query.get();
    const deals = snap.docs.map((d) => d.data());
    return res.json({ deals });
  } catch (err) {
    console.error("/deals error:", err);
    return res.status(500).json({ error: err.message });
  }
});


/**
 * GET /future?days=7&origin=XXX&limit=N
 */
app.get("/future", async (req, res) => {
  try {
    const days = parseInt(req.query.days || "7", 10);
    const origin = req.query.origin;
    const limitParam = parseInt(req.query.limit || "20", 10); // 20 par défaut
    const limitN = Number.isNaN(limitParam) ? 20 : limitParam;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + days);

    let query = db
      .collection("deals")
      .where("createdAt", ">=", Timestamp.fromDate(today));

    if (origin) {
      query = query.where("origin", "==", origin);
    }

    // On n’a PAS besoin de orderBy sur “departureDate” pour Firestore,
    // car nous chargeons tout puis trions en mémoire JS.
    const snap = await query.get();
    const upcomingAll = snap.docs
      .map((d) => d.data())
      .filter((d) => {
        const dep = new Date(d.departureDate);
        return dep >= today && dep <= cutoff;
      })
      .sort((a, b) => {
        const da = new Date(a.departureDate);
        const dbd = new Date(b.departureDate);
        if (da < dbd) return -1;
        if (da > dbd) return 1;
        return a.price - b.price;
      });

    const upcomingLimited = upcomingAll.slice(0, limitN);
    return res.json({ upcoming: upcomingLimited });
  } catch (err) {
    console.error("/future error:", err);
    return res.status(500).json({ error: err.message });
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
