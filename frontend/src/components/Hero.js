import { Button } from "./ui/button";

export default function Hero() {
  return (
    <section className="relative h-screen flex flex-col justify-center items-center text-center bg-gradient-to-br from-indigo-600 to-blue-500">
      <h1 className="text-5xl md:text-6xl font-extrabold text-white drop-shadow-lg">
        Des vols pas chers, livrés chaque jour
      </h1>
      <p className="mt-4 text-xl text-indigo-100 max-w-2xl">
        Découvrez les meilleures affaires de dernière minute directement dans
        votre boîte mail. Passez Premium pour ne rien manquer.
      </p>
      <div className="mt-8 flex gap-4">
        <Button
          variant="indigowhite"
          onClick={() => (window.location.href = "/#pricing")}
        >
          Voir les tarifs
        </Button>
        <Button
          variant="indigowhite"
          onClick={() => (window.location.href = "/login")}
        >
          Connexion
        </Button>
      </div>
    </section>
  );
}
