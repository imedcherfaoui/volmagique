import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "./ui/button";

const LIVE_CHECKOUT_URL = "https://buy.stripe.com/00w14o5Z673N9gI65Z4ow00";

export default function Pricing() {
  const [user, setUser] = useState(null);
  const [isPremium, setIsPremium] = useState(false);

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
      <div className="grid sm:grid-cols-2 gap-8">
        {showFree && (
          <Card
            title="Daily (gratuit)"
            price="0 €"
            cta="S'inscrire"
            onClick={async () => {
              const email = prompt("Entrez votre email");
              if (!email) return;
              const res = await fetch(
                `${process.env.REACT_APP_API_URL}/subscribe`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email }),
                }
              );
              const json = await res.json();
              alert(json.success ? "Abonné ✔" : `Erreur : ${json.error}`);
            }}
          />
        )}
        <Card
          title={user ? "Passer à Premium" : "Premium"}
          price="4,99 € / mois"
          cta="Voir les détails"
          onClick={() => (window.location.href = LIVE_CHECKOUT_URL)}
        />
      </div>
    </section>
  );
}

function Card({ title, price, cta, onClick }) {
  return (
    <div className="border rounded-2xl p-6 shadow-sm flex flex-col items-center">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-brand text-2xl mb-6">{price}</p>
      <Button onClick={onClick}>{cta}</Button>
    </div>
  );
}
