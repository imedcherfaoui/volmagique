import React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogFooter,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import PricingCard from "../../../components/PricingCard";
import { useTranslation } from "react-i18next";

const LIVE_CHECKOUT_URL = "https://buy.stripe.com/3cI3cwgDKdsbgJa65Z4ow01";

function PremiumDialogLink({ userInfo, variant = "default" }) {
    const { t } = useTranslation();
  
  // State to control dialog visibility
  const [openDialog, setOpenDialog] = useState(false);
  const [openAlertDialog, setOpenAlertDialog] = useState(false);
  const features = t("premium_offer_features", {
    returnObjects: true,
  });
  return (
    <Dialog open={openDialog} onOpenChange={setOpenDialog}>
      <DialogTrigger>
        <Button variant={variant}>{t("upgrade_to_premium")}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-white text-black">
        <PricingCard
          recommended
          title={t("premium_offer")}
          price={t("premium_price")}
          features={features.map((f) => t(f))}
          cta={t("try_for_15_days_free")}
          isLoggedIn={userInfo}
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
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpenDialog(false)}>
            Annuler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PremiumDialogLink;
