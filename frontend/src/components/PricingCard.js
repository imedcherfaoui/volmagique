import { useState } from "react";
import { Button } from "./ui/button";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { useTranslation } from "react-i18next";
import Login from "../pages/Login";

export default function PricingCard({
  title,
  price,
  features = [],
  cta,
  onClick,
  recommended = false,
  isLoggedIn,
}) {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);

  function handleClick() {
    if (!isLoggedIn) {
      setOpen(true);
    } else {
      onClick();
    }
  }

  return (
    <>
      <motion.div
        className={`relative border rounded-2xl p-8 flex flex-col items-start justify-between gap-4 transform transition hover:-translate-y-1 hover:shadow-lg ${
          recommended ? "border-indigo-500" : "border-gray-200"
        }`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02, boxShadow: "0px 15px 25px rgba(0,0,0,0.1)" }}
        transition={{ duration: 0.4 }}
      >
        {/** Card content **/}
        <div>
          {recommended && (
            <span className="absolute top-3 right-3 bg-indigo-500 text-white text-xs uppercase px-2 py-1 rounded-full">
              {t("recommended")}
            </span>
          )}
          <h3 className="text-2xl font-bold">{title}</h3>
          {recommended && (
            <p className="text-base font-semibold text-yellow-600 mt-2">
              {t("try_for_15_days_free")}
            </p>
          )}
          <p className="text-3xl font-extrabold text-indigo-600">
            {recommended && (
              <span className="line-through text-gray-500 mr-1 text-base">
                €4.99
              </span>
            )}
            {price}
          </p>
          <ul className="space-y-2 mt-10">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-2">
                <Check className="w-5 h-5 text-indigo-500" />
                <span className="text-gray-700">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/** CTA button **/}
        <Button
          className="mt-6 w-full"
          variant="indigowhite"
          onClick={handleClick}
        >
          {isLoggedIn ? cta : `${t("login")} / ${t("register")}`}
        </Button>
      </motion.div>

      {/** The dialog **/}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-white text-black">
          <DialogHeader>
            <DialogTitle>{t("please_login")}</DialogTitle>
            <DialogDescription className="text-red-500 text-center">
              {t("please_login_message")}
            </DialogDescription>
          </DialogHeader>

          {/** Show your Login component in the dialog **/}
          <Login
            onSuccess={() => {
              setOpen(false);
              onClick(); // once logged in, fire the original CTA
            }}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
