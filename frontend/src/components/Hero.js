import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { auth } from "../firebase";
import { useTranslation } from "react-i18next";

export default function Hero() {
  const { t } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    //check if the user is authenticated and stock the auth state in isAuthenticated
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);

  return (
    <section className="relative h-screen flex flex-col justify-center items-center text-center bg-gradient-to-br from-indigo-600 to-blue-500">
      <h1 className="text-5xl md:text-6xl font-extrabold text-white drop-shadow-lg">
        {t("hero1")}
      </h1>
      <p className="mt-4 text-xl text-indigo-100 max-w-2xl">
        {t("hero2")} <span className="font-semibold text-xl">VolMagique</span>{" "}
        {t("hero3")}
        <span className="font-semibold text-yellow-300 mx-1">{t("hero4")}</span>
        {t("hero5")}{" "}
        <span className="font-semibold text-yellow-300 mx-1">{t("hero6")}</span>
        <br />
        {t("hero7")}
        <br />
        <span className="font-semibold text-yellow-300 mx-1">{t("hero8")}</span>
      </p>
      <div className="mt-8 gap-4 flex flex-wrap justify-center items-center">
        <Button
          variant="legendary"
          size="lg"
          className="text-lg"
          onClick={() => (window.location.href = "/dashboard")}
        >
          {t("show_today_deals")}
        </Button>
        {!isAuthenticated && (
          <Button
            variant="indigowhite"
            size="lg"
            className="text-lg"
            onClick={() => (window.location.href = "/login")}
          >
            {t("login")}
          </Button>
        )}
        <Button
          variant="premium"
          size="lg"
          className="text-lg"
          onClick={() => (window.location.href = "/#pricing")}
        >
          {t("show_pricing")}
        </Button>
      </div>
    </section>
  );
}
