import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";

export default function Stats() {
  const [stats, setStats] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || user.email !== "imadeddine300@hotmail.com") {
        return nav("/", { replace: true });
      }
      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/stats`, {
          headers: { "x-admin-secret": process.env.REACT_APP_ADMIN_SECRET },
        });
        const json = await res.json();
        setStats(json);
      } catch (e) {
        console.error("Stats fetch error", e);
      }
    });
    return unsub;
  }, [nav]);

  if (!stats) {
    return <div className="p-6 text-center">Loading stats…</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Platform Stats</h1>
        <Button
          onClick={() => {
            auth.signOut();
            nav("/");
          }}
        >
          Log out
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="p-4 border rounded">
          <h2 className="text-xl">Free Subscribers</h2>
          <p className="text-3xl font-bold">{stats.freeCount}</p>
        </div>
        <div className="p-4 border rounded">
          <h2 className="text-xl">Premium Subscribers</h2>
          <p className="text-3xl font-bold">{stats.premiumCount}</p>
        </div>
        <div className="p-4 border rounded">
          <h2 className="text-xl">Deals Today</h2>
          <p className="text-3xl font-bold">{stats.dealCount}</p>
        </div>
        <div className="p-4 border rounded">
          <h2 className="text-xl">Avg. Price (€)</h2>
          <p className="text-3xl font-bold">{stats.avgPrice.toFixed(2)}</p>
        </div>
      </div>
      {/* New: last-run timestamps */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-4 border rounded">
          <h2 className="text-xl">Last Scrape</h2>
          <p>{stats.lastScrape ? new Date(stats.lastScrape).toLocaleString() : "—"}</p>
        </div>
        <div className="p-4 border rounded">
          <h2 className="text-xl">Last Send (Free)</h2>
          <p>{stats.lastSendFree ? new Date(stats.lastSendFree).toLocaleString() : "—"}</p>
        </div>
        <div className="p-4 border rounded">
          <h2 className="text-xl">Last Send (Premium)</h2>
          <p>{stats.lastSendPremium ? new Date(stats.lastSendPremium).toLocaleString() : "—"}</p>
        </div>
      </div>
    </div>
  );
}
