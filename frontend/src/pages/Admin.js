import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";

const API = process.env.REACT_APP_API_URL;
const ADMIN_SECRET = process.env.REACT_APP_ADMIN_SECRET;

export default function Admin() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || user.email !== "imadeddine300@hotmail.com") {
        return nav("/", { replace: true });
      }
      try {
        const resp = await fetch(
          `${process.env.REACT_APP_API_URL}/subscribers`,
          { headers: { "x-admin-secret": ADMIN_SECRET } }
        );
        const text = await resp.text();
        if (!resp.ok) {
          setSubs([]);
        } else {
          // si body est JSON, parse-le
          const { subscribers = [] } = JSON.parse(text);
          setSubs(subscribers);
        }
      } catch (err) {
        console.error("Admin fetch error:", err);
        setSubs([]);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [nav]);

  if (loading) {
    return <div className="p-6 text-center">Loading admin data…</div>;
  }

  if (subs.length === 0) {
    return (
      <div className="p-6 text-center">
        No subscribers yet. (Have any free or premium users signed up?)
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
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
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">Subscribers</h1>
        <Button
          onClick={() => {
            auth.signOut();
            nav("/");
          }}
        >
          Log out
        </Button>
      </div>
      <table className="w-full border">
        <thead>
          <tr>
            <th className="border p-2">Email</th>
            <th className="border p-2">Tier</th>
            <th className="border p-2">Since</th>
          </tr>
        </thead>
        <tbody>
          {subs.map((s, i) => (
            <tr key={i}>
              <td className="border p-2">{s.email}</td>
              <td className="border p-2">{s.tier}</td>
              <td className="border p-2">
                {new Date(s.since).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
