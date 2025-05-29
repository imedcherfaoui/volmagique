import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

export default function Hero() {
  const navigate = useNavigate();

  return (
    <header className="text-center py-20 bg-slate-50">
      <h1 className="text-4xl font-extrabold mb-4">
        Les erreurs tarifaires avion
        <br />
        directement dans votre boîte mail
      </h1>
      <p className="mb-8 text-lg">
        Recevez – ou ratez – la promo… à vous de choisir !
      </p>
      <Button onClick={() => navigate("/dashboard")}>
        Voir les offres du jour 🚀
      </Button>
    </header>
  );
}
