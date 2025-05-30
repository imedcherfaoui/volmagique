import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../components/ui/accordion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const [deals, setDeals] = useState(null);
  const [future, setFuture] = useState([]);
  const [isPremium, setIsPremium] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const nav = useNavigate();

  // 1) Auth + fetch
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const email = encodeURIComponent(user.email);
        // premium
        const { premium } = await fetch(
          `${process.env.REACT_APP_API_URL}/premium?email=${email}`
        )
          .then((r) => r.json())
          .catch(() => ({ premium: false }));
        setIsPremium(premium);

        // userInfo
        const ui = await fetch(
          `${process.env.REACT_APP_API_URL}/me?email=${email}`
        )
          .then((r) => r.json())
          .catch(() => null);
        setUserInfo(ui);
      } else {
        // no user → default to free
        setIsPremium(false);
        setUserInfo(null);
      }

      // in all cases, fetch today’s deals
      const d = await fetch(`${process.env.REACT_APP_API_URL}/deals`)
        .then((r) => r.json())
        .then((j) => (Array.isArray(j.deals) ? j.deals : []))
        .catch(() => []);
      setDeals(d);
    });
    return () => unsub();
  }, [nav]);

  // 2) upcoming if premium
  useEffect(() => {
    if (deals !== null && isPremium) {
      fetch(`${process.env.REACT_APP_API_URL}/future?days=7`)
        .then((r) => r.json())
        .then((j) => setFuture(j.upcoming))
        .catch(() => setFuture([]));
    }
  }, [deals, isPremium]);

  // only wait when deals haven’t loaded; userInfo can be null for guests
  if (deals === null) {
    return <div className="p-6 text-center">Chargement des données…</div>;
  }

  // Helper: convert Firestore Timestamp (firstSeen, createdAt, or lastUpdated) to a date string
  const convertToDate = (ts) => {
    if (!ts) return null;
    const seconds = ts._seconds ?? ts.seconds;
    const nanos = ts._nanoseconds ?? ts.nanoseconds ?? 0;
    return new Date(seconds * 1000 + nanos / 1000000).toDateString();
  };

  // Only keep one deal per origin-city for today
  const uniqueDeals = Array.isArray(deals)
    ? Array.from(
        new Map(deals.map((d) => [`${d.origin}_${d.city}`, d])).values()
      )
    : [];

  const todayDeals = uniqueDeals.filter((d) => {
    // Use firstSeen (when deal first appeared), fallback to createdAt or lastUpdated
    const dateStr = convertToDate(d.firstSeen || d.createdAt || d.lastUpdated);
    return dateStr === new Date().toDateString();
  });

  const todayCount = todayDeals.length;
  const upcomingCount = future.length;
  const avgPrice = todayCount
    ? (todayDeals.reduce((s, d) => s + d.price, 0) / todayCount).toFixed(2)
    : "—";
  const visibleDeals = isPremium ? todayDeals : todayDeals.slice(0, 3);

  // prepare chart data
  const chartData = [
    { name: "Aujourd’hui", count: todayCount },
    ...(isPremium ? [{ name: "À venir", count: upcomingCount }] : []),
  ];

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* header */}
      {userInfo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 items-center justify-between gap-4">
          <h1 className="text-2xl font-bold truncate">
            Bienvenue, <small>{auth.currentUser.email}</small>
          </h1>
        </div>
      )}

      {/* user stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {userInfo && (
          <div className="p-4 bg-white rounded-lg shadow">
            <h2 className="text-sm text-gray-500">Abonnement</h2>
            <p className="text-xl font-semibold">
              {userInfo.tier === "premium" ? "Premium" : "Gratuit"}
            </p>
            <p className="text-xs text-gray-400">
              depuis {new Date(userInfo.since).toLocaleDateString()}
            </p>
          </div>
        )}
        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-sm text-gray-500">Offres aujourd’hui</h2>
          <p className="text-xl font-semibold">{todayCount}</p>
        </div>
        {isPremium && (
          <div className="p-4 bg-white rounded-lg shadow">
            <h2 className="text-sm text-gray-500">Offres à venir</h2>
            <p className="text-xl font-semibold">{upcomingCount}</p>
          </div>
        )}
        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-sm text-gray-500">Prix moyen (€)</h2>
          <p className="text-xl font-semibold">{avgPrice}</p>
        </div>
      </div>

      {/* bar chart */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-2">Comparatif Offres</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#6366F1" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Today’s deals */}
      {!isPremium && (
        <div className="mt-4 text-center">
          <p className="text-gray-600 mb-2">
            <span className="font-bold me-1">
              Seules les 3 premières sont visibles,
            </span>
            pour voir toutes les offres, et les offres à venir
            <Button
              className="ml-2"
              variant="premium"
              onClick={() => (window.location.href = "/#pricing")}
            >
              Passez Premium
            </Button>
          </p>
        </div>
      )}
      <Accordion type="single" collapsible defaultValue="item-1">
        <AccordionItem
          value="item-1"
          className="bg-slate-100/50 hover:bg-slate-200/50 transition px-2 rounded-lg"
        >
          <AccordionTrigger>
            <h2 className="text-2xl font-bold mb-4">
              Offres du jour <small>({todayCount} Offres)</small>
            </h2>
          </AccordionTrigger>
          <AccordionContent className="max-h-[400px] overflow-y-auto">
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleDeals.map((d, i) => (
                <li
                  key={i}
                  //nav to d.link in a new tab
                  onClick={() => window.open(d.link, "_blank")}
                  className="p-4 cursor-pointer bg-orange-300/20 rounded-lg shadow hover:shadow-lg transition flex flex-row justify-between items-center"
                >
                  <div>
                    <a
                      href={d.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-indigo-600 font-semibold hover:underline mb-1 text-lg underline underline-offset-2"
                    >
                      {d.origin} → {d.city}
                    </a>
                    <p className="text-gray-500 text-sm mb-2">
                      {d.departureDate}
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-indigo-900">
                    {d.price} €
                  </p>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Upcoming deals */}

      {isPremium && future.length > 0 && (
        <Accordion type="single" collapsible defaultValue="item-1">
          <AccordionItem
            value="item-1"
            className="bg-slate-100/50 hover:bg-slate-200/50 transition px-2 rounded-lg"
          >
            <AccordionTrigger>
              <h2 id="upcoming" className="text-2xl font-bold mb-4">
                Offres à venir (7 jours) <small>({future.length} Offres)</small>
              </h2>
            </AccordionTrigger>
            <AccordionContent className="max-h-[200px] overflow-y-auto">
              <ul className="space-y-4">
                {future.map((d, i) => (
                  <li
                    key={i}
                    className="p-4 bg-orange-300/20 rounded-lg shadow hover:shadow-lg transition flex justify-between"
                  >
                    <div>
                      <a
                        href={d.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 font-semibold hover:underline mb-1 text-lg underline underline-offset-2"
                      >
                        {d.origin} → {d.city}
                      </a>
                      <p className="text-gray-500 text-sm">{d.departureDate}</p>
                    </div>
                    <p className="text-3xl font-bold text-indigo-900">
                      {d.price} €
                    </p>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
