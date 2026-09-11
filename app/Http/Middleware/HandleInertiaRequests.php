<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $usdToAed = (float) config('forecast.exchange_rates.usd_to_aed');
        $aedToMyr = (float) config('forecast.exchange_rates.aed_to_myr');

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
            ],
            // Currency rates (single source of truth in config/forecast.php).
            // USD is derived from the peg so it stays reciprocal-consistent.
            'exchangeRates' => [
                'usdToAed' => $usdToAed,
                'rates' => [
                    'AED' => 1.0,
                    'MYR' => $aedToMyr,
                    'USD' => $usdToAed > 0 ? 1 / $usdToAed : 0,
                ],
            ],
        ];
    }
}
