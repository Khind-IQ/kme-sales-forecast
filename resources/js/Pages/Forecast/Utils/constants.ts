// Fallback exchange rates. The live values come from the backend via Inertia
// shared props (see config/forecast.php + useExchangeRates). These defaults are
// only used if the shared prop is unavailable.
// USD is derived from the peg so it never drifts from USD_TO_AED_RATE.
export const USD_TO_AED_RATE = 3.67;
export const EXCHANGE_RATES = { MYR: 1.08, USD: 1 / USD_TO_AED_RATE, AED: 1 };
export const ITEMS_PER_PAGE = 50;
