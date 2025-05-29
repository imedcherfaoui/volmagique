import { Button } from "./ui/button";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

export default function PricingCard({
  title,
  price,
  features = [],
  cta,
  onClick,
  recommended = false,
}) {
  return (
    <motion.div
      className={`relative border rounded-2xl p-8 flex flex-col items-start gap-4 transform transition hover:-translate-y-1 hover:shadow-lg ${
        recommended ? "border-indigo-500" : "border-gray-200"
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, boxShadow: "0px 15px 25px rgba(0,0,0,0.1)" }}
      transition={{ duration: 0.4 }}
    >
      {recommended && (
        <span className="absolute top-3 right-3 bg-indigo-500 text-white text-xs uppercase px-2 py-1 rounded-full">
          Recommandé
        </span>
      )}
      <h3 className="text-2xl font-bold">{title}</h3>
      <p className="text-3xl font-extrabold text-indigo-600">{price}</p>
      <ul className="space-y-2 mt-4">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2">
            <Check className="w-5 h-5 text-indigo-500" />
            <span className="text-gray-700">{f}</span>
          </li>
        ))}
      </ul>
      <Button
        className="mt-6 w-full"
        variant="indigowhite"
        onClick={onClick}
      >
        {cta}
      </Button>
    </motion.div>
  );
}
