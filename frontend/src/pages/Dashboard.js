import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";

export default function Dashboard() {
  const [deals, setDeals] = useState(null);
  const [future, setFuture] = useState([]);
  const [isPremium, setIsPremium] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const nav = useNavigate();

  // 1) Auth & fetch deals + premium status + user info
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        nav("/login", { replace: true });
        return;
      }
      const email = encodeURIComponent(user.email);
      // Check premium status
      let premium = false;
      try {
        const r = await fetch(
          `${process.env.REACT_APP_API_URL}/premium?email=${email}`
        );
        const j = await r.json();
        premium = j.premium;
      } catch (err) {
        console.error("Premium check failed", err);
      }
      setIsPremium(premium);

      // Fetch user stats
      try {
        const r3 = await fetch(
          `${process.env.REACT_APP_API_URL}/me?email=${email}`
        );
        console.log(
          "User info fetch URL:",
          `${process.env.REACT_APP_API_URL}/me?email=${email}`
        );
        const j3 = await r3.json();
        console.log("User info response:", j3);
        setUserInfo(j3);
      } catch (err) {
        console.error("User info fetch failed", err);
      }

      // Fetch today's deals
      try {
        const r2 = await fetch(`${process.env.REACT_APP_API_URL}/deals`);
        const j2 = await r2.json();
        setDeals(j2.deals);
      } catch (err) {
        console.error("Deals fetch failed", err);
        setDeals([]);
      }
    });
    return () => unsub();
  }, [nav]);

  // 2) Fetch upcoming deals if premium
  useEffect(() => {
    if (deals !== null && isPremium) {
      fetch(`${process.env.REACT_APP_API_URL}/future?days=7`)
        .then((r) => r.json())
        .then(({ upcoming }) => setFuture(upcoming))
        .catch((err) => console.error("Future fetch failed", err));
    }
  }, [deals, isPremium]);

  // Loading state
  if (deals === null || !userInfo) {
    return <div className="p-6 text-center">Loading…</div>;
  }

  // Show all for premium, top 3 for free
  const visibleDeals = isPremium ? deals : deals.slice(0, 3);

  console.log("userInfo", userInfo);
  return (
    <div className="container mx-auto p-6">
      {/* Personal stats banner */}
      <div className="mb-6 p-4 bg-blue-50 rounded">
        <p>
          Bonjour <strong>{auth.currentUser.email}</strong> ! Vous êtes abonné{" "}
          <strong>{userInfo.tier === "premium" ? "Premium" : "Gratuit"}</strong>{" "}
          depuis{" "}
          <strong>{new Date(userInfo.since).toLocaleDateString()}</strong>. Vous
          avez consulté <strong>{visibleDeals.length}</strong> offres
          aujourd’hui.
        </p>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Today’s Deals</h2>
      </div>

      {/* Free-tier teaser */}
      {!isPremium && (
        <div className="mb-6 p-6 bg-gradient-to-r from-yellow-300 to-yellow-500 text-center rounded-lg shadow">
          <h3 className="text-xl font-bold mb-2 text-red-800">
            Vous utilisez la version gratuite !
          </h3>
          <p className="mb-4 text-red-700">
            Découvrez seulement les 3 meilleures offres. Passez Premium pour
            accéder à <strong>toutes</strong> les destinations <em>et</em> aux
            vols à venir dans la semaine !
          </p>
          <Button onClick={() => (window.location.href = "/#pricing")}>
            Passez Premium
          </Button>
        </div>
      )}

      {/* Manage subscription */}
      <div className="mb-6 text-center">
        <Button
          onClick={async () => {
            try {
              const resp = await fetch(
                `${process.env.REACT_APP_API_URL}/portal`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: auth.currentUser.email }),
                }
              );
              const data = await resp.json();
              if (!resp.ok) {
                return alert(data.error || "Could not open portal.");
              }
              window.location.href = data.url;
            } catch (err) {
              console.error("Portal error:", err);
              alert("Network error opening portal.");
            }
          }}
        >
          Gérer mon abonnement
        </Button>
      </div>

      {/* Upcoming Deals anchor */}
      {isPremium && future.length > 0 && (
        <div className="mt-10">
          <h3 className="text-xl font-bold my-5">
            <a href="#upcoming" className="text-indigo-600 hover:underline">
              ⬇️ Aller aux offres à venir (7 prochains jours)
            </a>
          </h3>
        </div>
      )}

      {/* Today’s Deals list */}
      <ul className="space-y-2">
        {visibleDeals.map((d, i) => (
          <li
            key={i}
            className="border p-2 rounded flex justify-between items-center"
          >
            <a
              href={d.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {d.origin} → {d.city}
              <span className="ml-2 text-sm text-gray-600">
                ({d.departureDate})
              </span>
            </a>
            <span className="font-semibold">{d.price} €</span>
          </li>
        ))}
      </ul>

      {/* Upcoming Deals for premium */}
      {isPremium && future.length > 0 && (
        <div id="upcoming" className="mt-6">
          <h3 className="text-xl font-bold mb-4">
            Offres à venir (7 prochains jours)
          </h3>
          <ul className="space-y-2">
            {future.map((d, i) => (
              <li
                key={i}
                className="border p-2 rounded flex justify-between items-center"
              >
                <div>
                  <a
                    href={d.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {d.origin} → {d.city}
                  </a>
                  <span className="ml-2 text-sm text-gray-600">
                    ({d.departureDate})
                  </span>
                </div>
                <span className="font-semibold">{d.price} €</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
