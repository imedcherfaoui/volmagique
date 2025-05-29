import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase"; // your firebase init
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Button } from "./ui/button";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const nav = useNavigate();

  // Subscribe to auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  // Handle logout
  const handleLogout = async () => {
    await signOut(auth);
    nav("/", { replace: true });
  };

  return (
    <nav className="flex items-center justify-between py-4 container mx-auto">
      <Link to="/" className="font-bold text-xl">
        ✈️ VolMagique ✈️
      </Link>

      <div className="flex items-center space-x-4">
        {user ? (
          <>
            {/* Show the user’s email */}
            <span className="text-gray-700">{user.email}</span>
            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-red-500 text-white rounded"
            >
              Se déconnecter
            </button>
            {user && user.email === "imadeddine300@hotmail.com" && (
              /* If admin, show admin links */
              <>
                <Link to="/stats">Stats</Link> <Link to="/admin">Admin</Link>
              </>
            )}
          </>
        ) : (
          /* If not logged in, show “Login” link */
          <Button
            variant="outline"
            onClick={() => nav("/login")}
            className="px-3 py-1 bg-brand rounded"
          >
            Se connecter
          </Button>
        )}
      </div>
    </nav>
  );
}
