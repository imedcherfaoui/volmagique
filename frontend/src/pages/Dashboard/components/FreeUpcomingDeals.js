import { useTranslation } from "react-i18next";
import PremiumDialogLink from "./PremiumDialogLink";

function FreeUpcomingDeals({ userInfo }) {
  const { t } = useTranslation();

  return (
    <div className="bg-gray-100/50 p-4 rounded-lg shadow mt-6">
      <h2 className="flex items-end flex-wrap text-lg md:text-2xl font-bold mb-4">
        {t("upcoming_offers")}
      </h2>
      <span className="text-gray-600">{t("to_see_upcoming_offers")}, </span>
      <PremiumDialogLink userInfo={userInfo} variant="premiumLink" />
    </div>
  );
}

export default FreeUpcomingDeals;
