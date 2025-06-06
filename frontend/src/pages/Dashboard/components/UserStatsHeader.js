import { useTranslation } from 'react-i18next'
import PremiumDialogLink from './PremiumDialogLink';

function UserStatsHeader({
  userInfo,
  isPremium,
  todayCount,
  upcomingCount,
  avgPrice,
}) {
    const { t } = useTranslation()
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {userInfo && (
        <div className="flex flex-col justify-between p-4 bg-white rounded-lg shadow">
          <h2 className="text-sm text-gray-500">{t("subscription")}</h2>
          <span>
            <p className="md:text-xl font-semibold">
              {userInfo.tier === "premium" ? t("premium") : t("free")}
            </p>
            <p className="text-xs text-gray-400">
              {t("since", {
                date: new Date(userInfo.since).toLocaleDateString(),
              })}
            </p>
          </span>
        </div>
      )}
      <div className="flex flex-col justify-between bg-white p-4 rounded-lg shadow">
        <h2 className="text-sm text-gray-500">{t("deals_today")}</h2>
        <p className="text-xl md:text-2xl font-semibold">
          {isPremium ? (
            <>
              {todayCount}{" "}
              <small className="text-gray-400 text-xs font-normal italic">
                {t("or_more")}
              </small>
            </>
          ) : (
            todayCount
          )}
        </p>
      </div>
      {isPremium ? (
        <div className="flex flex-col justify-between p-4 bg-white rounded-lg shadow">
          <h2 className="text-sm text-gray-500">{t("upcoming")}</h2>
          <p className="text-xl md:text-2xl font-semibold">{upcomingCount}</p>
        </div>
      ) : (
        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-sm text-gray-500">{t("upcoming")}</h2>
          <div className="items-center text-center">
            <br />
            <PremiumDialogLink userInfo={userInfo} variant="premium" />
          </div>
        </div>
      )}
      <div className="flex flex-col justify-between p-4 bg-white rounded-lg shadow">
        <h2 className="text-sm text-gray-500">{t("avg_price")}</h2>
        <p className="text-xl md:text-2xl font-semibold">{avgPrice}</p>
      </div>
    </div>
  );
}

export default UserStatsHeader