import { useEffect, useState, useMemo } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";

const API = process.env.REACT_APP_API_URL;
const ADMIN_SECRET = process.env.REACT_APP_ADMIN_SECRET;

export default function Admin() {
  const [subs, setSubs] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState("all");
  const nav = useNavigate();

  //  ––––– Fetch subscribers & errors une fois au montage –––––
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || user.email !== "imadeddine300@hotmail.com") {
        nav("/", { replace: true });
        return;
      }
      try {
        // 1) récupération des abonnés
        const res = await fetch(`${API}/subscribers`, {
          headers: { "x-admin-secret": ADMIN_SECRET },
        });
        if (!res.ok) throw new Error(await res.text());
        const { subscribers = [] } = await res.json();
        setSubs(subscribers);

        // 2) récupération des dernières erreurs
        const errRes = await fetch(`${API}/errors?limit=50`, {
          headers: { "x-admin-secret": ADMIN_SECRET },
        });
        if (!errRes.ok) throw new Error(await errRes.text());
        const { errors: errs = [] } = await errRes.json();
        setErrors(errs);
      } catch (err) {
        console.error("Admin fetch error:", err);
        setSubs([]);
        setErrors([]);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, [nav]);

  // Derived counts
  const totalCount = subs.length;
  const freeCount = subs.filter((s) => s.tier === "free").length;
  const premiumCount = subs.filter((s) => s.tier === "premium").length;

  // Filtered + searched list
  const visible = useMemo(() => {
    return subs
      .filter((s) => (filterTier === "all" ? true : s.tier === filterTier))
      .filter((s) => s.email.toLowerCase().includes(search.toLowerCase()));
  }, [subs, filterTier, search]);

  if (loading) {
    return <div className="p-6 text-center">Loading admin data…</div>;
  }
  if (!loading && totalCount === 0) {
    return (
      <div className="p-6 text-center">
        No subscribers yet. (Have any free or premium users signed up?)
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Top controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-x-2">
          <Button
            onClick={async () => {
              await fetch(`${API}/scrape`, {
                headers: { "x-admin-secret": ADMIN_SECRET },
              });
              alert("🔍 Scrape triggered");
            }}
          >
            Run Scrape Now
          </Button>
          <Button
            onClick={async () => {
              await fetch(`${API}/send?tag=free`, {
                headers: { "x-admin-secret": ADMIN_SECRET },
              });
              alert("✉️ Free broadcast sent");
            }}
          >
            Send Free Broadcast
          </Button>
          <Button
            onClick={async () => {
              await fetch(`${API}/send?tag=premium`, {
                headers: { "x-admin-secret": ADMIN_SECRET },
              });
              alert("💎 Premium broadcast sent");
            }}
          >
            Send Premium Broadcast
          </Button>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 bg-white rounded-lg shadow text-center">
          <h3 className="text-gray-500 text-sm">Total</h3>
          <p className="text-2xl font-bold">{totalCount}</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow text-center">
          <h3 className="text-gray-500 text-sm">Free</h3>
          <p className="text-2xl font-bold">{freeCount}</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow text-center">
          <h3 className="text-gray-500 text-sm">Premium</h3>
          <p className="text-2xl font-bold">{premiumCount}</p>
        </div>
      </div>

      {/* Search & filter */}
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 p-2 border rounded"
        />
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="all">All Tiers</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
      </div>

      {/* Subscribers table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full table-auto">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Tier</th>
              <th className="p-3 text-left">Since</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="p-3">{s.email}</td>
                <td className="p-3 capitalize">{s.tier}</td>
                <td className="p-3">{new Date(s.since).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── NOUVELLE SECTION “Erreurs” ─── */}
      {errors.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-2">Dernières erreurs</h2>
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-left">Mode</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Message</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="p-2 capitalize">{e.type}</td>
                    <td className="p-2 capitalize">{e.mode || "-"}</td>
                    <td className="p-2">
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="p-2 truncate max-w-xs" title={e.message}>
                      {e.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
