import { usePage } from '@inertiajs/react';
import { EXCHANGE_RATES as FALLBACK_RATES, USD_TO_AED_RATE as FALLBACK_USD_TO_AED } from '../Utils/constants';

type RatesShape = { AED: number; MYR: number; USD: number };

/**
 * Currency exchange rates, sourced from the backend (config/forecast.php)
 * via Inertia shared props. Falls back to the compiled-in constants if the
 * shared prop is missing. The returned references are stable across renders
 * (Inertia keeps shared props stable), so they're safe to use in memo deps.
 */
export function useExchangeRates(): { EXCHANGE_RATES: RatesShape; USD_TO_AED_RATE: number } {
    const shared = (usePage().props as any).exchangeRates as
        | { usdToAed: number; rates: RatesShape }
        | undefined;

    if (shared && shared.usdToAed > 0 && shared.rates) {
        return { EXCHANGE_RATES: shared.rates, USD_TO_AED_RATE: shared.usdToAed };
    }

    return { EXCHANGE_RATES: FALLBACK_RATES as RatesShape, USD_TO_AED_RATE: FALLBACK_USD_TO_AED };
}
