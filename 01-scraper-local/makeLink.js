import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET, {
  apiVersion: "2023-10-16",
});

const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  line_items: [{ price: "price_1RWpIHLKea6PsY5cMUZXU2SE", quantity: 1 }],
  success_url: "https://volmagique.com/",
  cancel_url: "https://volmagique.com/",
});
console.log(session.url);
