import React from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../../../components/ui/accordion";

function PremiumUpcomingDeals({
  isPremium,
  totalFutureCount,
  futureLimit,
  setFutureLimit,
  visibleFuture,
  getAirportName,
}) {
  const { t } = useTranslation();
  return (
    <Accordion type="single" collapsible defaultValue="item-1">
      <AccordionItem
        value="item-1"
        className="bg-slate-100/50 hover:bg-slate-200/50 transition px-2 rounded-lg"
      >
        <AccordionTrigger>
          <h2
            id="upcoming"
            className="flex items-end flex-wrap text-lg md:text-2xl font-bold mb-4"
          >
            <span
              className="flex items-center justify-center
                     w-5 h-5 md:w-6 md:h-6
                     bg-orange-300/20 text-yellow-700 text-sm md:text-base font-bold
                     rounded-full shadow mr-1 md:mr-2 mb-1"
            >
              {totalFutureCount}
            </span>{" "}
            {t("upcoming")}
            {isPremium && (
              <small className="text-gray-400 text-sm m-2 font-normal italic">
                {t("you_can_load_more_offers_at_the_bottom_of_the_list")}
              </small>
            )}
          </h2>
        </AccordionTrigger>
        <AccordionContent className="max-h-[200px] overflow-y-auto">
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleFuture.map((d, i) => (
              <li
                key={i}
                onClick={() => window.open(d.link, "_blank")}
                className="relative py-4 px-2 cursor-pointer bg-orange-300/20 rounded-lg
                     shadow hover:shadow-lg transition flex flex-col w-[90%]"
              >
                {/* Badge prix dans le coin */}
                <span
                  className="absolute top-2 right-2
                       flex items-center justify-center
                       w-10 h-10 md:w-12 md:h-12
                       bg-indigo-600 text-white text-sm md:text-base font-bold
                       rounded-full shadow"
                >
                  {d.price} €
                </span>

                <div className="flex justify-between items-center mb-2 pr-14">
                  {/* pr-14 ajoute un peu d’espace pour que le texte ne passe pas sous le badge */}
                  <h3 className="text-indigo-600 font-semibold text-xs md:text-md underline underline-offset-2 truncate max-w-[80%]">
                    {getAirportName(d.origin)} ({d.origin})
                    <br />
                    {" ↓ "} <br />
                    {getAirportName(d.city)} ({d.city})
                  </h3>
                  {/* ancien <span> prix supprimé, remplacé par le badge */}
                </div>

                <p className="text-gray-500 text-xs">
                  {t("flight")}{" "}
                  {d.nbEscales === 0
                    ? t("direct")
                    : `${t("with")} ${d.nbEscales} ${t("stop")}${
                        d.nbEscales > 1 ? "s" : ""
                      }`}
                  <br />
                  {t("departure")} : {d.departureDate}
                  <br />
                  {d.returnDate && `${t("return")} : ${d.returnDate}`}
                </p>

                <p className="text-gray-500 text-xs">
                  {t("duration")} : {Math.floor(d.durationMin / 60)}h
                  {d.durationMin % 60}min
                </p>

                <p className="text-gray-500 text-xs">
                  {t("distance")} : {d.distanceKm} km
                </p>
              </li>
            ))}
          </ul>

          {isPremium && totalFutureCount > futureLimit && (
            <div className="flex justify-center mt-4">
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                onClick={() => {
                  setFutureLimit((prev) => prev + 10);
                }}
              >
                {t("load_more_offers")}
              </button>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export default PremiumUpcomingDeals;
