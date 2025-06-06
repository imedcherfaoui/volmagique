import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "./ui/button";
import PricingCard from "./PricingCard";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogFooter } from "./ui/dialog";
import { useTranslation } from "react-i18next";

const LIVE_CHECKOUT_URL = "https://buy.stripe.com/3cI3cwgDKdsbgJa65Z4ow01";

export default function Pricing() {
  const { t } = useTranslation();

  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [openAlertDialog, setOpenAlertDialog] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    //check if the user is authenticated and stock the auth state in isLoggedIn
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(!!user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // subscribe to auth
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // 1) force-sync subscription status in Firestore
        fetch(`${process.env.REACT_APP_API_URL}/sync?email=${u.email}`)
          .then((r) => r.json())
          .then(() => {
            // 2) now check the updated tier
            return fetch(
              `${process.env.REACT_APP_API_URL}/premium?email=${u.email}`
            );
          })
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
      <section id="pricing" className="py-16 container mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">{t("already_premium")}</h2>
        <p className="mb-8">{t("take_full_advantage")}</p>
        <Button onClick={() => (window.location.href = "/dashboard")}>
          {t("access_dashboard")}
        </Button>
      </section>
    );
  }

  // 2) Logged-in free users only get the Upgrade card
  const showFree = !user;

  const features = t("premium_offer_features", {
    returnObjects: true,
  });
  return (
    <section id="pricing" className="py-16 container mx-auto">
      <h2 className="text-3xl font-bold mb-8 text-center">
        {isLoggedIn
          ? t("discover_our_premium_plans")
          : t("choose_your_volmagique_plan")}
      </h2>
      <motion.div
        className={
          "grid gap-8 w-full px-5" +
          (showFree ? " md:grid-cols-2" : " md:grid-cols-1")
        }
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
            title={t("basic_offer")}
            price={t("free")}
            features={[t("top_3_deals"), t("daily_email_alerts")]}
            cta={t("sign_up_for_daily_alerts")}
            onClick={() => nav("/login")}
          />
        )}

        <PricingCard
          recommended
          title={t("premium_offer")}
          price={t("premium_price")}
          features={features.map((f) => t(f))}
          cta={t("try_for_15_days_free")}
          isLoggedIn={isLoggedIn}
          onClick={() => setOpenAlertDialog(true)}
        />
        <Dialog open={openAlertDialog} onOpenChange={setOpenAlertDialog}>
          <DialogContent className="max-w-lg bg-white text-black">
            {/* Warning disant au client que c'est très important d'utiliser la meme adresse e-mail que pour son compte VolMagique que pour la souscription Premium */}
            <div className="text-red-600 mb-4">
              <strong>
                Important :{" "}
                <span className="text-black">{t("use_same_email")}</span>
              </strong>
            </div>

            <DialogFooter>
              <Button
                variant="indigowhite"
                className="mt-4"
                onClick={() => {
                  window.location.href = LIVE_CHECKOUT_URL;
                }}
              >
                {t("try_for_15_days_free")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </section>
  );
}
