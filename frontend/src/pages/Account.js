import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";

export default function Account() {
  const { t } = useTranslation();
  const [userInfo, setUserInfo] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [since, setSince] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 1) À la montée du composant, on écoute l’auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Si non connecté, on redirige vers la home/login
        navigate("/", { replace: true });
        return;
      }

      const email = encodeURIComponent(user.email);

      try {
        // 2) Récupérer les infos Firestore « /me »
        const meRes = await fetch(
          `${process.env.REACT_APP_API_URL}/me?email=${email}`
        );
        if (!meRes.ok) throw new Error("Me fetch failed");
        const meJson = await meRes.json();
        setUserInfo(meJson.email);
        setSince(meJson.since);

        // 3) Vérifier le statut premium « /premium »
        const premRes = await fetch(
          `${process.env.REACT_APP_API_URL}/premium?email=${email}`
        );
        if (!premRes.ok) throw new Error("Premium fetch failed");
        const { premium } = await premRes.json();
        setIsPremium(premium);
      } catch (err) {
        console.error("Account fetch error :", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [navigate]);

  // 4) Rediriger vers Stripe Customer Portal
  const handleManage = async () => {
    if (!userInfo) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userInfo }),
      });
      if (!res.ok) throw new Error("Portal fetch failed");
      const { url } = await res.json();
      window.location.href = url; // redirection vers Customer Portal
    } catch (err) {
      console.error("Error opening portal:", err);
      alert(t("portal_error"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        {t("loading_dotdotdot")}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-4">{t("account_title")}</h1>

      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div>
          <span className="font-medium">{t("email_label")} :</span>{" "}
          <span>{userInfo}</span>
        </div>
        <div>
          <span className="font-medium">{t("subscription_label")} :</span>{" "}
          <span>{isPremium ? t("premium") : t("free")}</span>
        </div>
        <div>
          <span className="font-medium">{t("since_label")} :</span>{" "}
          <span>{new Date(since).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleManage}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
        >
          {t("manage_subscription")}
        </button>
      </div>
    </div>
  );
}
