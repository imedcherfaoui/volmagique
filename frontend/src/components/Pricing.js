import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "./ui/button";
import PricingCard from "./PricingCard";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const LIVE_CHECKOUT_URL = "https://buy.stripe.com/00w14o5Z673N9gI65Z4ow00";

export default function Pricing() {
  const [user, setUser] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    // subscribe to auth
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // check if they’re premium
        fetch(`${process.env.REACT_APP_API_URL}/premium?email=${u.email}`)
          .then((r) => r.json())
          .then(({ premium }) => setIsPremium(premium))
          .catch(console.error);
      }
    });
    return unsub;
  }, []);

  // 1) Premium users see a banner + manage button
  if (user && isPremium) {
    return (
      <section className="py-16 container mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">Vous êtes déjà Premium 🎉</h2>
        <p className="mb-8">
          Profitez de tous les avantages sans interruption.
        </p>
        <Button onClick={() => (window.location.href = "/dashboard")}>
          Accéder à mon tableau de bord
        </Button>
      </section>
    );
  }

  // 2) Logged-in free users only get the Upgrade card
  const showFree = !user;
  return (
    <section id="pricing" className="py-16 container mx-auto">
      <h2 className="text-3xl font-bold mb-8 text-center">
        Choisissez votre plan
      </h2>
      <motion.div
        className={"grid gap-8 w-full px-5" + (showFree ? " md:grid-cols-2" : " md:grid-cols-1")}
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: { staggerChildren: 0.2 },
          },
        }}
      >
        {showFree && (
          <PricingCard
            title="Daily (Gratuit)"
            price="0 €"
            features={[
              "Top 3 des meilleurs deals du jour",
              "Alertes par e-mail quotidiennes (3 vols)",
              "Aucun engagement",
            ]}
            cta="S'inscrire"
            onClick={() => nav("/login")}
          />
        )}

        <PricingCard
          recommended
          title="Premium"
          price="4,99 € / mois"
          features={[
            "Tous des deals du jour",
            "Alertes par e-mail instantanées (10 vols)",
            "Accès aux \"Vols à venir\" (vols dans la semaine)",
            "Support prioritaire",
          ]}
          cta="Voir les détails"
          onClick={() => (window.location.href = LIVE_CHECKOUT_URL)}
        />
      </motion.div>
    </section>
  );
}
