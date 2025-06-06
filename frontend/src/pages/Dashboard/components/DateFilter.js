import { Fragment } from "react";
import { useTranslation } from "react-i18next";

/**
 * Props:
 * - depDate            : current departure date (string, “YYYY-MM-DD” or "")
 * - setDepDate         : setter for departure date
 * - arrDate            : current arrival date (string, “YYYY-MM-DD” or "")
 * - setArrDate         : setter for arrival date
 * - dateMode           : "fixed" or "flexible"
 * - setDateMode        : setter for date mode
 */
export default function DateFilter({
  depDate,
  setDepDate,
  arrDate,
  setArrDate,
  dateMode,
  setDateMode,
}) {
  const { t } = useTranslation();
  const modes = [
    { value: "fixed", label: t("date_mode_fixed") },
    { value: "flexible", label: t("date_mode_flexible") },
  ];

  return (
    <div className="bg-indigo-200 shadow-md p-4 rounded-lg space-y-4">
      {/* ─── NAVBAR MODE “Fixed / Flexible” ─── */}
      <div className="flex bg-indigo-50 rounded-md overflow-hidden">
        <button
          onClick={() => setDateMode("fixed")}
          className={`flex-1 py-2 text-center font-medium transition ${
            dateMode === "fixed"
              ? "bg-indigo-600 text-white"
              : "text-indigo-600 hover:bg-indigo-100"
          }`}
        >
          {t("fixed")}
        </button>
        <button
          onClick={() => setDateMode("flexible")}
          className={`flex-1 py-2 text-center font-medium transition ${
            dateMode === "flexible"
              ? "bg-indigo-600 text-white"
              : "text-indigo-600 hover:bg-indigo-100"
          }`}
        >
          {t("flexible")}
        </button>
      </div>

      {/* ─── DATE DE DÉPART ─── */}
      <div className="flex flex-col md:flex-row md:items-center md:gap-4">
        <label className="font-medium text-gray-700">
          {t("departure_date")}:
        </label>
        <input
          type="date"
          value={depDate}
          onChange={(e) => setDepDate(e.target.value)}
          className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {/* ─── DATE DE RETOUR ─── */}
      <div className="flex flex-col md:flex-row md:items-center md:gap-4">
        <label className="font-medium text-gray-700">{t("return_date")}:</label>
        <input
          type="date"
          value={arrDate}
          onChange={(e) => setArrDate(e.target.value)}
          min={depDate || undefined}
          className="border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {/* ─── NOTE POUR MODE “Flexible” ─── */}
      {dateMode === "flexible" && (
        <p className="text-sm text-gray-500">{t("flexible_note")}</p>
      )}
    </div>
  );
}