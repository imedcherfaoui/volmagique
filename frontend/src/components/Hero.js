import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { auth } from "../firebase";

export default function Hero() {
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
        Des vols pas chers, livrés chaque jour
      </h1>
      <p className="mt-4 text-xl text-indigo-100 max-w-2xl">
        Découvrez les meilleures affaires de dernière minute directement dans
        votre boîte mail. Passez Premium pour ne rien manquer.
      </p>
      <div className="mt-8 gap-4 grid grid-cols-1 md:grid-cols-3">
        <Button
          variant="premium"
          onClick={() => (window.location.href = "/#pricing")}
        >
          Voir les tarifs
        </Button>
        {!isAuthenticated && (
          <Button
            variant="indigowhite"
            onClick={() => (window.location.href = "/login")}
          >
            Se connecter
          </Button>
        )}
        <Button
          variant="legendary"
          onClick={() => (window.location.href = "/dashboard")}
        >
          Voir les offres d'aujourd'hui
        </Button>
      </div>
    </section>
  );
}
