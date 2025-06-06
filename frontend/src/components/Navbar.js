import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { auth } from "../firebase";
import { Button } from "./ui/button";
import { useTranslation } from "react-i18next";
import { UserIcon } from "lucide-react";

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { pathname } = useLocation();
  // Si on n’est pas déjà sur la home, on préfixe d’un slash
  const prefix = pathname === "/" ? "" : "/";
  const nav = useNavigate();

  useEffect(() => {
    //check if the user is authenticated and stock the auth state in isAuthenticated
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm shadow-sm">
      <div className="container mx-auto flex items-center justify-between p-4">
        <Link to={prefix} className="font-bold text-xl">
          <img src="/bannerVM.png" alt="VolMagique" className="h-8" />
        </Link>
        <div className="hidden md:flex gap-6 my-auto h-full items-center">
          <Link
            to={`${prefix}#features`}
            className="hover:text-indigo-600 font-medium"
          >
            {t("features")}
          </Link>
          <Link
            to={`${prefix}#pricing`}
            className="hover:text-indigo-600 font-medium"
          >
            {t("tarifs")}
          </Link>
          <Link to="/dashboard" className="hover:text-indigo-600 font-medium">
            {t("upcoming_flights")}
          </Link>

          {/* ─── BOUTONS BASCULE LANGUE ─── */}
          <div className="flex justify-end space-x-2">
            <button
              className={`px-3 py-1 rounded ${
                i18n.language === "fr"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200"
              }`}
              onClick={() => i18n.changeLanguage("fr")}
            >
              FR
            </button>
            <button
              className={`px-3 py-1 rounded ${
                i18n.language === "en"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200"
              }`}
              onClick={() => i18n.changeLanguage("en")}
            >
              EN
            </button>
          </div>
          {isAuthenticated ? (
            <div className="space-x-2">
              <Button
                variant="destructive"
                onClick={() => {
                  auth.signOut();
                  nav("/");
                }}
              >
                {t("logout")}
              </Button>
            </div>
          ) : (
            <Button variant="indigowhite" onClick={() => nav("/login")}>
              {t("login")}
            </Button>
          )}
          {/* User Icon Link to /account */}
          {isAuthenticated && (
            <Link to="/account" className="hover:text-indigo-600 font-medium">
              <UserIcon className="w-6 h-6 text-gray-700" />
            </Link>
          )}
        </div>
        <button
          className="md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6 text-gray-700"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16m-7 6h7"
            />
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden bg-white shadow-inner border-b border-gray-500">
          <div className="flex items-center justify-between px-4 mt-2 hover:bg-gray-100">
            {isAuthenticated && (
              <Link
                to="/account"
                className="flex items-end space-x-2 text-sm text-gray-700 hover:text-indigo-600"
              >
                <UserIcon className="w-6 h-6" />
                <p>{t("account_title")}</p>
              </Link>
            )}
            {/* ─── BOUTONS BASCULE LANGUE ─── */}
            <div className="space-x-2">
              <button
                className={`px-2 py-1 rounded ${
                  i18n.language === "fr"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200"
                }`}
                onClick={() => i18n.changeLanguage("fr")}
              >
                FR
              </button>
              <button
                className={`px-2 py-1 rounded ${
                  i18n.language === "en"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200"
                }`}
                onClick={() => i18n.changeLanguage("en")}
              >
                EN
              </button>
            </div>
          </div>
          <Link
            to={`${prefix}#features`}
            className="block px-4 py-2 hover:bg-gray-100 ms-1 text-gray-700 hover:text-indigo-600"
            onClick={() => setOpen(false)}
          >
            {t("features")}
          </Link>
          <Link
            to={`${prefix}#pricing`}
            className="block px-4 py-2 hover:bg-gray-100 ms-1 text-gray-700 hover:text-indigo-600"
            onClick={() => setOpen(false)}
          >
            {t("tarifs")}
          </Link>
          <Link
            to="/dashboard"
            className="block px-4 py-2 hover:bg-gray-100 ms-1 text-gray-700 hover:text-indigo-600"
            onClick={() => setOpen(false)}
          >
            {t("upcoming_flights")}
          </Link>
          {isAuthenticated ? (
            <div className="py-2 ms-1">
              <Button
                variant="destructiveLink"
                onClick={() => {
                  auth.signOut();
                  nav("/");
                }}
              >
                {t("logout")}
              </Button>
            </div>
          ) : (
            <div className="px-4 py-2">
              <Button variant="indigowhite" onClick={() => nav("/login")}>
                {t("login")}
              </Button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
