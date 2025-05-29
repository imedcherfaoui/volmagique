import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET, {
  apiVersion: "2023-10-16",
});

const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  line_items: [{ price: "price_1RTldALKea6PsY5cG45GTkrG", quantity: 1 }],
  success_url: "https://volmagique.com/thanks",
  cancel_url: "https://volmagique.com/cancel",
});
console.log(session.url);
