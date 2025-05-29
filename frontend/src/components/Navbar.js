import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { Button } from "./ui/button";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  // Si on n’est pas déjà sur la home, on préfixe d’un slash
  const prefix = pathname === "/" ? "" : "/";
  const nav = useNavigate();

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm shadow-sm">
      <div className="container mx-auto flex items-center justify-between p-4">
        <a href="/" className="font-bold text-xl">
          VolMagique ✈️
        </a>
        <div className="hidden md:flex gap-6 my-auto h-full items-center">
          <a
            href={`${prefix}#features`}
            className="hover:text-indigo-600 font-medium"
          >
            Fonctionnalités
          </a>
          <a
            href={`${prefix}#pricing`}
            className="hover:text-indigo-600 font-medium"
          >
            Tarifs
          </a>
          <a href="/dashboard" className="hover:text-indigo-600 font-medium">
            Vols à venir
          </a>
          {auth.currentUser && (
            <div className="space-x-2">
              <Button
                variant="destructive"
                onClick={() => {
                  auth.signOut();
                  nav("/login");
                }}
              >
                Déconnexion
              </Button>
            </div>
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
        <div className="md:hidden bg-white shadow-inner">
          <a
            href={`${prefix}#features`}
            className="block px-4 py-2 hover:bg-gray-100"
            onClick={() => setOpen(false)}
          >
            Fonctionnalités
          </a>
          <a
            href={`${prefix}#pricing`}
            className="block px-4 py-2 hover:bg-gray-100"
            onClick={() => setOpen(false)}
          >
            Tarifs
          </a>
          <a
            href="/dashboard"
            className="block px-4 py-2 hover:bg-gray-100"
            onClick={() => setOpen(false)}
          >
            Vols à venir
          </a>
          <div className="px-4 py-2">
            <Button
              variant="destructive"
              onClick={() => {
                auth.signOut();
                nav("/login");
              }}
            >
              Déconnexion
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
