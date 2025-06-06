import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Combobox } from "@headlessui/react";
import { CheckIcon, MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../../firebase";
import LoadingCircle from "../../components/LoadingCircle/LoadingCircle";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../../components/ui/accordion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import PremiumDialogLink from "./components/PremiumDialogLink";
import SortDropdown from "./components/SortDropdown";
import {
  collection,
  query,
  where,
  orderBy,
  limit as limitFn,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { db } from "../../firebase";
import FreeUpcomingDeals from "./components/FreeUpcomingDeals";
import PremiumUpcomingDeals from "./components/PremiumUpcomingDeals";
import UserStatsHeader from "./components/UserStatsHeader";
import DateFilter from "./components/DateFilter";
import { Button } from "../../components/ui/button";
const airportIataCodes = require("airport-iata-codes");

// 1) Liste réduite des aéroports européens (francophones + hubs majeurs)
const ORIGINS = [
  // France (francophones)
  "CDG", // Paris Charles-de‐Gaulle
  "ORY", // Paris Orly
  "NCE", // Nice Côte d’Azur
  "MRS", // Marseille
  "BVA", // Beauvais-Tillé
  "LYS", // Lyon-Saint-Exupéry
  "BOD", // Bordeaux
  "LIL", // Lille

  // Suisse / Belgique / Luxembourg
  "GVA", // Genève
  "BRU", // Bruxelles
  "LUX", // Luxembourg

  // Hubs européens majeurs (non francophones)
  "LHR", // London Heathrow
  "AMS", // Amsterdam Schiphol
  "FRA", // Frankfurt
  "MAD", // Madrid-Barajas
  "BCN", // Barcelone-El Prat
  "MUC", // Munich
  "BER", // Berlin Brandenburg

  // Autres hubs européens connus pour les vols low-cost
  "VIE", // Vienne
  "ZRH", // Zurich
  "DUB", // Dublin
  "CPH", // Copenhague
  "MIL", // Milan Malpensa
  "LIN", // Milan Linate  (remplacé “MIR” par le code “LIN” correct)
  "STN", // London Stansted
  "LGW", // London Gatwick
];

// 2) Fonction utilitaire pour obtenir le nom d’un aéroport à partir de son code IATA
function getAirportName(iata) {
  const arr = airportIataCodes(iata);
  if (Array.isArray(arr) && arr?.length > 0) {
    return arr[0].name;
  }
  return iata;
}

/**
 * Va chercher en Firestore tous les deals dont `departureDate` :
 *  - en mode “fixed” est exactement égal à targetDate (string “YYYY-MM-DD”),
 *  - en mode “flexible” se trouve entre (targetDate - 3j) et (targetDate + 3j) au format ISO.
 *
 * Ensuite, côté client, on effectuera un filtrage sur `returnDate` avec la même logique.
 */
async function fetchDealsByDateRange(
  targetDate,
  mode,
  originFilter,
  isPremium,
  dealLimit
) {
  if (!targetDate) return [];

  // 1) Construire la chaîne min/max en ISO (YYYY-MM-DD) pour ±3 jours
  const base = new Date(targetDate);
  base.setHours(0, 0, 0, 0);

  // Fonction utilitaire pour formater “YYYY-MM-DD”
  const toISODateString = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  let q;
  const collRef = collection(db, "deals");

  if (mode === "fixed") {
    // Exact match sur departureDate
    q = query(
      collRef,
      where("departureDate", "==", targetDate),
      originFilter
        ? where("origin", "==", originFilter)
        : where("createdAt", ">=", new Date(0)),
      orderBy("departureDate", "asc"),
      orderBy("price", "asc"),
      limitFn(isPremium ? dealLimit + 1 : dealLimit)
    );
  } else {
    // Flexible : on calcule minDate = targetDate - 3j, maxDate = targetDate + 3j
    const minD = new Date(base);
    minD.setDate(minD.getDate() - 3);
    const maxD = new Date(base);
    maxD.setDate(maxD.getDate() + 3);
    const minString = toISODateString(minD);
    const maxString = toISODateString(maxD);

    q = query(
      collRef,
      where("departureDate", ">=", minString),
      where("departureDate", "<=", maxString),
      originFilter
        ? where("origin", "==", originFilter)
        : where("createdAt", ">=", new Date(0)),
      orderBy("departureDate", "asc"),
      orderBy("price", "asc"),
      limitFn(isPremium ? dealLimit + 1 : dealLimit)
    );
  }

  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data());
  } catch (err) {
    console.error("fetchDealsByDateRange error:", err);
    return [];
  }
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [originFilter, setOriginFilter] = useState(""); // code IATA sélectionné (ou "" pour “aucun”)
  const [searchIata, setSearchIata] = useState(""); // texte de recherche dans le combobox
  const [filteredOrigins, setFilteredOrigins] = useState([]); // options filtrées par la recherche

  const [deals, setDeals] = useState(null);
  // `dealLimit` stocke combien on veut demander au back-end
  const [dealLimit, setDealLimit] = useState(3);
  const [futureLimit, setFutureLimit] = useState(10);
  const [future, setFuture] = useState([]);
  const [isPremium, setIsPremium] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  // critère de tri actuel, valeur par défaut "none"
  const [sortKey, setSortKey] = useState("none");
  // ordre de tri : "asc" ou "desc" (par défaut ascendant)
  const [sortOrder, setSortOrder] = useState("asc");
  // Filtre prix : valeur minimale et maximale (en euros)
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [depDate, setDepDate] = useState("");
  const [arrDate, setArrDate] = useState("");
  const [dateMode, setDateMode] = useState("fixed"); // “fixed” ou “flexible”
  const nav = useNavigate();

  // ─── Fonction réutilisable pour recharger les deals depuis Firestore ───
  async function fetchDealsOnce() {
    // On marque d'abord l'état en "loading"
    setDeals(null);

    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    let q = query(
      collection(db, "deals"),
      where("createdAt", ">=", midnight),
      orderBy("createdAt", "asc"),
      orderBy("price", "asc"),
      limitFn(isPremium ? dealLimit + 1 : dealLimit)
    );
    if (originFilter) {
      q = query(
        collection(db, "deals"),
        where("createdAt", ">=", midnight),
        where("origin", "==", originFilter),
        orderBy("createdAt", "asc"),
        orderBy("price", "asc"),
        limitFn(isPremium ? dealLimit + 1 : dealLimit)
      );
    }

    try {
      const snap = await getDocs(q);
      const docs = snap.docs.map((doc) => doc.data());
      setDeals(docs);
    } catch (err) {
      console.error("getDocs /deals error:", err);
      setDeals([]);
    }
  }

  // ─── 2.1) Mémoïser la liste “code + nom” UNE SEULE FOIS au montage ───
  const allOriginsOptions = useMemo(() => {
    return ORIGINS.map((code) => ({ code, name: getAirportName(code) })).sort(
      (a, b) => a.name.localeCompare(b.name)
    );
  }, []); // <- dépendance vide : ne se recalculera jamais

  // ─── 2.2) Filtrer la liste “allOriginsOptions” en fonction de searchIata ───
  useEffect(() => {
    if (searchIata.trim() === "") {
      setFilteredOrigins(allOriginsOptions);
    } else {
      const term = searchIata.toLowerCase();
      const filt = allOriginsOptions.filter(
        (item) =>
          item.code.toLowerCase().includes(term) ||
          item.name.toLowerCase().includes(term)
      );
      setFilteredOrigins(filt);
    }
  }, [searchIata, allOriginsOptions]);

  // ─── 2.3) Auth + fetch deals en fonction de originFilter et de dealLimit ───
  // ─── useEffect REMIS À JOUR pour /deals en temps réel ───
  useEffect(() => {
    // 1) On écoute l’état d’auth pour connaître isPremium + userInfo
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const email = encodeURIComponent(user.email);

        // a) Récupérer le statut premium
        const { premium } = await fetch(
          `${process.env.REACT_APP_API_URL}/premium?email=${email}`
        )
          .then((r) => r.json())
          .catch(() => ({ premium: false }));
        setIsPremium(premium);

        // b) Si premium et dealLimit < 10 → on assure un minimum de 10
        if (premium && dealLimit < 10) {
          setDealLimit(10);
        }

        // c) Récupérer userInfo
        const ui = await fetch(
          `${process.env.REACT_APP_API_URL}/me?email=${email}`
        )
          .then((r) => r.json())
          .catch(() => null);
        setUserInfo(ui);
      } else {
        // Non connecté → on remet au mode « free »
        setIsPremium(false);
        setDealLimit(3);
        setUserInfo(null);
      }
    });

    // 2) Dès qu’on a isPremium et originFilter et dealLimit, on monte un listener Firestore
    //    pour récupérer la liste des deals répondant aux critères
    //    On veut évidemment se rebinder à chaque changement de isPremium, originFilter ou dealLimit
    //    donc on place cette logique dans un deuxième useEffect qui dépend de [isPremium, originFilter, dealLimit].

    return () => {
      // cleanup de l’auth listener
      unsubAuth();
    };
  }, [originFilter, nav, isPremium, dealLimit]);

  // ─── 2️⃣ useEffect “deals” révisé pour n’appeler que fetchDealsOnce() ───
  useEffect(() => {
    // Ne rien faire si isPremium n’est pas encore déterminé
    if (isPremium === null) return;
    fetchDealsOnce();
  }, [originFilter, isPremium, dealLimit]);

  // ─── Si date change ET le filtre local est vide, refetch “par date” ───
  useEffect(() => {
    if (deals === null) return;

    // On sait que arrDate >= depDate (sinon impossible)
    // 1) Filtrer localement sur depDate
    const attemptLocalFilter = (arr, mode) => {
      if (!depDate) return arr;
      const chosen = new Date(depDate);
      if (mode === "fixed") {
        return arr.filter((d) => {
          const dep = new Date(d.departureDate);
          return (
            dep.getFullYear() === chosen.getFullYear() &&
            dep.getMonth() === chosen.getMonth() &&
            dep.getDate() === chosen.getDate()
          );
        });
      } else {
        const min = new Date(chosen);
        min.setDate(min.getDate() - 3);
        const max = new Date(chosen);
        max.setDate(max.getDate() + 3);
        return arr.filter((d) => {
          const dep = new Date(d.departureDate);
          return dep >= min && dep <= max;
        });
      }
    };

    const filteredByDep = attemptLocalFilter(deals, dateMode);

    // 2) Filtrer localement sur arrDate
    const attemptArrFilter = (arr, mode) => {
      if (!arrDate) return arr;
      const chosen = new Date(arrDate);
      if (mode === "fixed") {
        return arr.filter((d) => {
          if (!d.returnDate) return false;
          const arrd = new Date(d.returnDate);
          return (
            arrd.getFullYear() === chosen.getFullYear() &&
            arrd.getMonth() === chosen.getMonth() &&
            arrd.getDate() === chosen.getDate()
          );
        });
      } else {
        const min = new Date(chosen);
        min.setDate(min.getDate() - 3);
        const max = new Date(chosen);
        max.setDate(max.getDate() + 3);
        return arr.filter((d) => {
          if (!d.returnDate) return false;
          const arrd = new Date(d.returnDate);
          return arrd >= min && arrd <= max;
        });
      }
    };

    const locallyFilteredBoth = attemptArrFilter(filteredByDep, dateMode);

    // 3) Si aucun deal n’a déjà été récupéré localement, on fait un fetch serveur “by date”
    if (locallyFilteredBoth.length === 0 && depDate) {
      (async () => {
        const serverSide = await fetchDealsByDateRange(
          depDate,
          dateMode,
          originFilter,
          isPremium,
          dealLimit
        );
        const serverFilteredArr = attemptArrFilter(serverSide, dateMode);
        setDeals(serverFilteredArr);
      })();
    }
  }, [depDate, arrDate, deals, dateMode, originFilter, isPremium, dealLimit]);

  // ─── 3) Fetch “future” uniquement si deals est chargé et si l’utilisateur est premium ───
  useEffect(() => {
    if (deals !== null && isPremium) {
      const originParam = originFilter ? `&origin=${originFilter}` : "";
      fetch(
        `${process.env.REACT_APP_API_URL}/future?days=7` +
          originParam +
          `&limit=${futureLimit}`
      )
        .then((r) => r.json())
        .then((j) => setFuture(j.upcoming))
        .catch(() => setFuture([]));
    }
  }, [deals, isPremium, originFilter, futureLimit]);

  // ─── 4) Afficher un loader si deals n’est pas encore chargé ───
  if (deals === null) {
    return <LoadingCircle />;
  }

  // ① Copier les données reçues dans une nouvelle variable
  let filteredDeals = [...deals];

  // ─── FILTRE PAR DATES ───

  // 1) Construire Date objects
  const depObj = depDate ? new Date(depDate) : null;
  const arrObj = arrDate ? new Date(arrDate) : null;

  // 2) Detecter “return < departure” → intervalle invalide
  const invalidDateRange = depObj && arrObj && arrObj < depObj;

  // 3) Filtrage sur la date de départ seulement si intervalle valide
  if (depObj && !invalidDateRange) {
    if (dateMode === "fixed") {
      filteredDeals = filteredDeals.filter((d) => {
        const dDep = new Date(d.departureDate);
        return (
          dDep.getFullYear() === depObj.getFullYear() &&
          dDep.getMonth() === depObj.getMonth() &&
          dDep.getDate() === depObj.getDate()
        );
      });
    } else {
      // flexible ±3 jours
      const min = new Date(depObj);
      min.setDate(min.getDate() - 3);
      const max = new Date(depObj);
      max.setDate(max.getDate() + 3);
      filteredDeals = filteredDeals.filter((d) => {
        const dDep = new Date(d.departureDate);
        return dDep >= min && dDep <= max;
      });
    }
  }

  // 4) Filtrage sur la date de retour seulement si intervalle valide
  if (arrObj && !invalidDateRange) {
    if (dateMode === "fixed") {
      filteredDeals = filteredDeals.filter((d) => {
        if (!d.returnDate) return false;
        const dArr = new Date(d.returnDate);
        return (
          dArr.getFullYear() === arrObj.getFullYear() &&
          dArr.getMonth() === arrObj.getMonth() &&
          dArr.getDate() === arrObj.getDate()
        );
      });
    } else {
      // flexible ±3 jours
      const min = new Date(arrObj);
      min.setDate(min.getDate() - 3);
      const max = new Date(arrObj);
      max.setDate(max.getDate() + 3);
      filteredDeals = filteredDeals.filter((d) => {
        if (!d.returnDate) return false;
        const dArr = new Date(d.returnDate);
        return dArr >= min && dArr <= max;
      });
    }
  }

  // ② Si priceMin ou priceMax renseigné, filtrer sur le champ price
  if (priceMin !== "" || priceMax !== "") {
    filteredDeals = filteredDeals.filter((d) => {
      // si priceMin renseigné, s’assurer que d.price >= priceMin
      if (priceMin !== "" && d.price < parseInt(priceMin, 10)) {
        return false;
      }
      // si priceMax renseigné, s’assurer que d.price <= priceMax
      if (priceMax !== "" && d.price > parseInt(priceMax, 10)) {
        return false;
      }
      return true;
    });
  }

  // ③ Copier filteredDeals pour tri
  let sortedDeals = [...filteredDeals];

  // ④ Appliquer le tri si nécessaire
  if (sortKey !== "none") {
    sortedDeals.sort((a, b) => {
      let aVal, bVal;
      switch (sortKey) {
        case "price":
          aVal = a.price;
          bVal = b.price;
          break;
        case "duration":
          aVal = a.durationMin;
          bVal = b.durationMin;
          break;
        case "distance":
          aVal = a.distanceKm;
          bVal = b.distanceKm;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });
  }

  // ⑤ Maintenant sortedDeals contient la liste filtrée ET triée
  const todayDeals = sortedDeals;

  const todayCount = todayDeals?.length;
  const upcomingCount = future?.length;
  const avgPrice = todayCount
    ? (todayDeals.reduce((s, d) => s + d.price, 0) / todayCount).toFixed(2)
    : "—";
  // ‟todayDeals” contient potentiellement dealLimit + 1 éléments
  let visibleDeals;
  if (isPremium) {
    // on n’en affiche que les dealLimit premiers
    visibleDeals = todayDeals.slice(0, dealLimit);
  } else {
    // free view : toujours max 3
    visibleDeals = todayDeals.slice(0, 3);
  }

  let filteredFuture = [...future];

  // ─── FILTRE PAR DATES POUR “À VENIR” ───
  if (depDate) {
    const chosenDep = new Date(depDate);
    if (dateMode === "fixed") {
      filteredFuture = filteredFuture.filter((d) => {
        const dep = new Date(d.departureDate);
        return (
          dep.getFullYear() === chosenDep.getFullYear() &&
          dep.getMonth() === chosenDep.getMonth() &&
          dep.getDate() === chosenDep.getDate()
        );
      });
    } else {
      const min = new Date(chosenDep);
      min.setDate(min.getDate() - 3);
      const max = new Date(chosenDep);
      max.setDate(max.getDate() + 3);
      filteredFuture = filteredFuture.filter((d) => {
        const dep = new Date(d.departureDate);
        return dep >= min && dep <= max;
      });
    }
  }
  if (arrDate) {
    const chosenArr = new Date(arrDate);
    if (dateMode === "fixed") {
      filteredFuture = filteredFuture.filter((d) => {
        if (!d.returnDate) return false;
        const arr = new Date(d.returnDate);
        return (
          arr.getFullYear() === chosenArr.getFullYear() &&
          arr.getMonth() === chosenArr.getMonth() &&
          arr.getDate() === chosenArr.getDate()
        );
      });
    } else {
      const min = new Date(chosenArr);
      min.setDate(min.getDate() - 3);
      const max = new Date(chosenArr);
      max.setDate(max.getDate() + 3);
      filteredFuture = filteredFuture.filter((d) => {
        if (!d.returnDate) return false;
        const arr = new Date(d.returnDate);
        return arr >= min && arr <= max;
      });
    }
  }

  if (priceMin !== "" || priceMax !== "") {
    filteredFuture = filteredFuture.filter((d) => {
      if (priceMin !== "" && d.price < parseInt(priceMin, 10)) return false;
      if (priceMax !== "" && d.price > parseInt(priceMax, 10)) return false;
      return true;
    });
  }

  if (sortKey !== "none") {
    filteredFuture.sort((a, b) => {
      let aVal, bVal;
      switch (sortKey) {
        case "price":
          aVal = a.price;
          bVal = b.price;
          break;
        case "duration":
          aVal = a.durationMin;
          bVal = b.durationMin;
          break;
        case "distance":
          aVal = a.distanceKm;
          bVal = b.distanceKm;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });
  }

  let visibleFuture;
  if (isPremium) {
    visibleFuture = filteredFuture.slice(0, futureLimit);
  } else {
    visibleFuture = [];
  }
  const totalFutureCount = filteredFuture.length;

  // ─── 7) Préparer les données pour le bar chart ───
  const chartData = [
    { name: "Aujourd’hui", count: todayCount },
    ...(isPremium ? [{ name: "À venir", count: upcomingCount }] : []),
  ];

  // options de tri présentées à l’utilisateur
  const sortOptions = [
    { value: "none", label: t("choose_sort") },
    { value: "price", label: t("price") },
    { value: "duration", label: t("duration") },
    { value: "distance", label: t("distance") },
  ];

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* ─── HEADER UTILISATEUR ─── */}
      {userInfo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 items-center justify-between gap-4">
          <h1 className="text-lg md:text-2xl font-bold truncate">
            {t("welcome", { email: auth.currentUser.email })}
          </h1>
        </div>
      )}

      {/* ─── STATISTIQUES UTILISATEUR ─── */}
      <UserStatsHeader
        userInfo={userInfo}
        isPremium={isPremium}
        todayCount={todayCount}
        upcomingCount={upcomingCount}
        avgPrice={avgPrice}
      />

      {/* ─── BAR CHART COMPARATIF ─── */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-2">{t("offers_comparison")}</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#6366F1" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ─── FILTRES ─── */}
      <div className="space-y-4">
        {/* ─── FILTRE AÉROPORT D’ORIGINE ─── */}
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="origin-combobox"
            className="whitespace-nowrap font-bold"
          >
            {t("filter_origin")}
          </label>
          <Combobox
            as="div"
            value={originFilter}
            onChange={(code) => setOriginFilter(code)}
            className="w-full relative"
          >
            <div className="relative">
              <Combobox.Button className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon
                  className="h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
              </Combobox.Button>
              <Combobox.Input
                id="origin-combobox"
                className="w-full border rounded px-2 py-1 pl-10 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder={t("look_for_airport")}
                displayValue={(code) => (code ? getAirportName(code) : "")}
                onChange={(e) => setSearchIata(e.target.value)}
              />
            </div>
            <Combobox.Options className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 overflow-y-auto rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {filteredOrigins?.length === 0 && (
                <div className="cursor-default select-none py-2 px-4 text-gray-500">
                  {t("no_airport_found")}
                </div>
              )}
              {filteredOrigins.map((airport) => (
                <Combobox.Option
                  key={airport.code}
                  value={airport.code}
                  className={({ active }) =>
                    `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                      active ? "bg-indigo-600 text-white" : "text-gray-900"
                    }`
                  }
                >
                  {({ selected, active }) => (
                    <>
                      <span
                        className={`block truncate ${
                          selected ? "font-semibold" : ""
                        }`}
                      >
                        {airport.name} ({airport.code})
                      </span>
                      {selected && (
                        <span
                          className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                            active ? "text-white" : "text-indigo-600"
                          }`}
                        >
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      )}
                    </>
                  )}
                </Combobox.Option>
              ))}
            </Combobox.Options>
          </Combobox>
        </div>
        {/* ─── TRI DYNAMIQUE ─── */}{" "}
        <div className="flex items-center gap-2">
          {" "}
          <label className="font-bold">{t("sort_by")}</label>
          <SortDropdown
            options={sortOptions}
            selected={sortKey}
            onChange={(val) => {
              setSortKey(val);
              // Si l’utilisateur choisit "none", on remet ordre sur "asc"
              if (val === "none") setSortOrder("asc");
            }}
          />
          {/* Si un critère autre que "none" est sélectionné, on affiche un bouton pour inverser l’ordre */}
          {sortKey !== "none" && (
            <button
              className="px-2 py-1 bg-white rounded hover:bg-gray-300 transition text-indigo-500 text-xl border border-indigo-900"
              onClick={() =>
                setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
              }
            >
              {sortOrder === "asc" ? "⬆︎" : "⬇︎"}
            </button>
          )}
        </div>
        {/* ─── FILTRE FOURCHETTE DE PRIX ─── */}
        <p className="font-bold whitespace-nowrap">{t("sort_by_price")} :</p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="font-medium whitespace-nowrap">Min (€) :</label>
          <input
            type="number"
            min="0"
            step="1"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            placeholder="0"
            className="w-20 border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <label className="font-medium whitespace-nowrap">Max (€) :</label>
          <input
            type="number"
            min="0"
            step="1"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            placeholder="300"
            className="w-20 border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        {/* ─── FILTRE DATES ─── */}
        <DateFilter
          depDate={depDate}
          setDepDate={setDepDate}
          arrDate={arrDate}
          setArrDate={setArrDate}
          dateMode={dateMode}
          setDateMode={setDateMode}
        />
        {/* ─── BOUTON RÉINITIALISER TOUS LES FILTRES ─── */}
        <div className="flex justify-end">
          <Button
            variant="indigowhite"
            onClick={async () => {
              // 1) On réinitialise tous les filtres visuels
              setOriginFilter("");
              setSearchIata("");
              setSortKey("none");
              setSortOrder("asc");
              setPriceMin("");
              setPriceMax("");
              setDepDate("");
              setArrDate("");
              setDateMode("fixed");

              // 2) On recharge “à zéro” la liste des deals
              await fetchDealsOnce();
            }}
          >
            {t("reset_filters")}
          </Button>
        </div>
      </div>

      {/* ─── ACCORDION “Offres du jour” ─── */}
      <Accordion type="single" collapsible defaultValue="item-1">
        <AccordionItem
          value="item-1"
          className="bg-slate-100/50 hover:bg-slate-200/50 transition px-2 rounded-lg"
        >
          <AccordionTrigger>
            <h2 className="flex items-end flex-wrap text-lg md:text-2xl font-bold mb-4">
              <span
                className="flex items-center justify-center
                             w-5 h-5 md:w-6 md:h-6
                             bg-orange-300/20 text-yellow-700 text-sm md:text-base font-bold
                             rounded-full shadow mr-1 md:mr-2 mb-1"
              >
                {todayCount}
              </span>{" "}
              {t("today_offers")}{" "}
              {isPremium && (
                <small className="text-gray-400 text-xs flex items-end ml-2 font-normal italic">
                  {t("you_can_load_more_offers_at_the_bottom_of_the_list")}
                </small>
              )}
            </h2>
          </AccordionTrigger>
          <AccordionContent className="max-h-[400px] overflow-y-auto">
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleDeals.map((d, i) => (
                <li
                  key={i}
                  onClick={() => window.open(d.link, "_blank")}
                  className="relative py-4 px-2 cursor-pointer bg-orange-300/20 rounded-lg
                           shadow hover:shadow-lg transition flex flex-col w-[90%]"
                >
                  {/* Corner price badge */}
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
                    {/* extra right-padding so long airport names don’t tuck under the badge */}
                    <h3 className="text-indigo-600 font-semibold text-xs md:text-md underline underline-offset-2 truncate max-w-[80%]">
                      {getAirportName(d?.origin)} ({d?.origin})
                      <br />
                      {" ↓ "} <br />
                      {getAirportName(d?.city)} ({d?.city})
                    </h3>
                    {/* you can remove the old price <span> here — it’s replaced by the badge */}
                  </div>

                  {/* Vol + départ/retour */}
                  <p className="text-gray-500 text-xs">
                    {t("flight")}{" "}
                    {d?.nbEscales === 0
                      ? t("direct")
                      : `${t("with")} ${d?.nbEscales} ${t("stop")}${
                          d?.nbEscales > 1 ? "s" : ""
                        }`}
                    <br />
                    {t("departure")} : {d?.departureDate}
                    <br />
                    {d?.returnDate && `${t("return")} : ${d?.returnDate}`}
                  </p>

                  {/* Durée */}
                  <p className="text-gray-500 text-xs">
                    {t("duration")} : {Math.floor(d?.durationMin / 60)}h
                    {d?.durationMin % 60}min
                  </p>

                  {/* Distance & fournisseur */}
                  <p className="text-gray-500 text-xs">
                    {t("distance")} : {d?.distanceKm} km
                  </p>
                </li>
              ))}
            </ul>
            {/* Si je suis premium ET que j’ai récupéré plus que dealLimit offres,cela signifie qu’il y en a encore “au‐dessus” de la limite actuelle.
             */}
            {isPremium && deals.length > dealLimit && (
              <div className="flex justify-center mt-4">
                <button
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                  onClick={() => {
                    setDealLimit((prev) => prev + 10);
                  }}
                >
                  {t("load_more_offers")}
                </button>
              </div>
            )}

            {/* ─── OFFRES DU JOUR FREE USERS LIMIT MESSAGE ─── */}
            {!isPremium && (
              <div className="mt-4 text-center">
                <p className="text-gray-600 mb-2">
                  <span className="font-bold me-1">
                    {t("only_3_random_offers_visible")},
                  </span>
                  {t("to_see_all_available_offers_with_the")}{" "}
                  <span className="font-bold text-yellow-500">
                    {t("best_last_minute_cheapest_flights")}
                  </span>
                  , {t("please_upgrade_to_premium_plan")}
                </p>
                <PremiumDialogLink userInfo={userInfo} variant="premium" />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* ─── OFFRES À VENIR POUR LES NON-PREMIUM ─── */}
      {!isPremium && <FreeUpcomingDeals userInfo={userInfo} />}

      {/* ─── ACCORDION “Offres à venir” POUR LES PREMIUM ─── */}
      {isPremium && totalFutureCount > 0 && (
        <PremiumUpcomingDeals
          visibleFuture={visibleFuture}
          totalFutureCount={totalFutureCount}
          isPremium={isPremium}
          setFutureLimit={setFutureLimit}
          futureLimit={futureLimit}
          getAirportName={getAirportName}
        />
      )}
    </div>
  );
}
