import { useEffect, useState, useMemo } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";

const API = process.env.REACT_APP_API_URL;
const ADMIN_SECRET = process.env.REACT_APP_ADMIN_SECRET;

export default function Stats() {
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState("all");
  const nav = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || user.email !== "imadeddine300@hotmail.com") {
        nav("/", { replace: true });
        return;
      }
      try {
        const res = await fetch(`${API}/stats`, {
          headers: { "x-admin-secret": ADMIN_SECRET },
        });
        if (!res.ok) throw new Error(await res.text());
        setStats(await res.json());
      } catch (err) {
        console.error("Stats fetch error", err);
      }
    });
    return unsub;
  }, [nav]);

  if (!stats) {
    return <div className="p-6 text-center">Loading platform stats…</div>;
  }

  // Format timestamps
  const formatDate = (d) => (d ? new Date(d).toLocaleString() : "—");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Platform Stats</h1>
        <Button
          variant="destructive"
          onClick={() => {
            auth.signOut();
            nav("/");
          }}
        >
          Se Déconnecter
        </Button>
      </div>

      {/* Quick Filter */}
      <div className="flex items-center gap-4">
        <label>Show:</label>
        <select
          className="p-2 border rounded"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="subscribers">Subscribers</option>
          <option value="deals">Deals</option>
          <option value="runs">Last Runs</option>
        </select>
      </div>

      {/* Main grids */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-lg shadow text-center">
          <h2 className="text-sm text-gray-500">Free Subs</h2>
          <p className="text-2xl font-bold">{stats.freeCount}</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow text-center">
          <h2 className="text-sm text-gray-500">Premium Subs</h2>
          <p className="text-2xl font-bold">{stats.premiumCount}</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow text-center">
          <h2 className="text-sm text-gray-500">Deals Today</h2>
          <p className="text-2xl font-bold">{stats.dealCount}</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow text-center">
          <h2 className="text-sm text-gray-500">Avg Price (€)</h2>
          <p className="text-2xl font-bold">{stats.avgPrice.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-lg shadow text-center">
          <h2 className="text-sm text-gray-500">Last Scrape</h2>
          <p>{formatDate(stats.lastScrape)}</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow text-center">
          <h2 className="text-sm text-gray-500">Last Free Send</h2>
          <p>{formatDate(stats.lastSendFree)}</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow text-center">
          <h2 className="text-sm text-gray-500">Last Premium Send</h2>
          <p>{formatDate(stats.lastSendPremium)}</p>
        </div>
      </div>
    </div>
  );
}
