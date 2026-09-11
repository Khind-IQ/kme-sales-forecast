<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Currency Exchange Rates
    |--------------------------------------------------------------------------
    |
    | AED is the base currency for the forecasting module. These rates are
    | shared to the frontend via HandleInertiaRequests so they can be changed
    | here (or via .env) without rebuilding the frontend bundle.
    |
    | - usd_to_aed : how many AED per 1 USD (USD->AED peg, ~3.67).
    | - aed_to_myr : how many MYR per 1 AED (AED->MYR conversion).
    |
    | The USD display rate (AED->USD) is derived as 1 / usd_to_aed on the
    | frontend so the two never drift apart.
    |
    */

    'exchange_rates' => [
        'usd_to_aed' => (float) env('FX_USD_TO_AED', 3.67),
        'aed_to_myr' => (float) env('FX_AED_TO_MYR', 1.08),
    ],

];
