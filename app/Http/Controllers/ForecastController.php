<?php

namespace App\Http\Controllers;

use App\Models\Lob;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\UserPlanning;
use App\Models\CategoryBudget;
use App\Models\ActualSale;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ForecastController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();
        $isAdmin = $user->role_id == 2;

        $currentLobIds = Lob::where('sales_representative_no', $user->employee_id)
            ->pluck('lob_id')
            ->toArray();

        $historicalLobIds = ActualSale::where('sales_representative_no', $user->employee_id)
            ->pluck('lob_id')
            ->toArray();
        $validLobIds = array_unique(array_merge($currentLobIds, $historicalLobIds));

        $allowedLobs = Lob::query()
            ->select(
                'lobs.lob_id', 'lobs.sold_to_bp', 'lobs.sold_to_bp_name',
                'lobs.lob_code', 'lobs.lob_name', 'lobs.sales_representative_no',
                'users.full_name as sales_rep_name'
            )
            ->leftJoin('users', 'lobs.sales_representative_no', '=', 'users.employee_id')
            ->when(!$isAdmin, function ($query) use ($validLobIds) {
                $query->whereIn('lobs.lob_id', $validLobIds);
            })
            ->get();

        $allowedLobIds = $allowedLobs->pluck('lob_id');

        // capture all data request from the frontend 
        $requestedLobId = $request->input('lob_id');
        $summaryMonth = $request->input('summary_month');
        $startMonth = $request->input('start_month');
        $endMonth = $request->input('end_month');

        return Inertia::render('Forecast/Forecast', [
            'dbLobs' => $allowedLobs,

            // Products for the Sales Data Entry grid — priced for the selected LOB.
            // Separate prop from the summary/dashboard products so switching tabs
            // (which reloads dbProductsMonth) never clobbers the entry grid's data.
            'dbProductsLob' => function () use ($requestedLobId) {
                if (!$requestedLobId) return [];

                $pricedProductIds = ProductPrice::where('lob_id', $requestedLobId)
                    ->orWhereNull('lob_id')
                    ->pluck('product_id')
                    ->unique();

                return Product::select(
                    'product_id', 'item_code', 'product_model', 'item_description',
                    'product_category', 'product_line', 'item_group', 'brand',
                    'cogs_price', 'cogs_currency', 'kmi_qty', 'kme_qty', 'total_qty',
                    'avg_12m_sales', 'avg_6m_sales', 'avg_3m_sales'
                )->whereIn('product_id', $pricedProductIds)->get();
            },

            // Products for the Summary / Dashboard tabs — forecasted or sold within the month/range.
            'dbProductsMonth' => function () use ($summaryMonth, $startMonth, $endMonth, $allowedLobIds, $isAdmin, $user) {
                if (!($summaryMonth || ($startMonth && $endMonth))) return [];

                // Forecasted products
                $planningQuery = UserPlanning::query()->when(!$isAdmin, fn($q) => $q->whereIn('lob_id', $allowedLobIds));
                if ($summaryMonth) {
                    $planningQuery->where('planning_month', $summaryMonth);
                } else {
                    $planningQuery->whereBetween('planning_month', [$startMonth, $endMonth]);
                }
                $forecastProductIds = $planningQuery->pluck('product_id')->toArray();

                // Products with actual sales
                $actualQuery = ActualSale::when(!$isAdmin, fn($q) => $q->where('sales_representative_no', $user->employee_id));
                if ($startMonth && $endMonth) {
                    $actualQuery->whereBetween('invoice_date', [$startMonth . '-01', date('Y-m-t', strtotime($endMonth . '-01'))]);
                } elseif ($summaryMonth) {
                    $actualQuery->whereBetween('invoice_date', [$summaryMonth . '-01', date('Y-m-t', strtotime($summaryMonth . '-01'))]);
                }
                $actualProductIds = $actualQuery->pluck('product_id')->toArray();

                $activeProductIds = array_unique(array_merge($forecastProductIds, $actualProductIds));
                return Product::select(
                    'product_id', 'item_code', 'product_model', 'item_description',
                    'product_category', 'product_line', 'item_group', 'brand',
                    'cogs_price', 'cogs_currency', 'kmi_qty', 'kme_qty', 'total_qty',
                    'avg_12m_sales', 'avg_6m_sales', 'avg_3m_sales'
                )->whereIn('product_id', $activeProductIds)->get();
            },

            'dbPricingLob' => function () use ($requestedLobId) {
                if ($requestedLobId) {
                    return ProductPrice::where('lob_id', $requestedLobId)
                        ->orWhereNull('lob_id')
                        ->select('product_id', 'lob_id', 'price')
                        ->get();
                }
                return [];
            },

            'dbPricingMonth' => function () use ($summaryMonth, $startMonth, $endMonth, $allowedLobIds, $isAdmin) {
                if ($summaryMonth || ($startMonth && $endMonth)) {
                    $query = UserPlanning::query()->when(!$isAdmin, fn($q) => $q->whereIn('lob_id', $allowedLobIds));
                    if ($summaryMonth) {
                        $query->where('planning_month', $summaryMonth);
                    } else {
                        $query->whereBetween('planning_month', [$startMonth, $endMonth]);
                    }
                    $activeProductIds = $query->pluck('product_id')->unique();
                    return ProductPrice::whereIn('product_id', $activeProductIds)
                        ->select('product_id', 'lob_id', 'price')
                        ->get();
                }
                return [];
            },

            'dbEntriesLob' => function () use ($requestedLobId, $allowedLobIds, $isAdmin) {
                if ($requestedLobId) {
                    return UserPlanning::when(!$isAdmin, fn($q) => $q->whereIn('lob_id', $allowedLobIds))
                        ->where('lob_id', $requestedLobId)
                        ->orderBy('created_at', 'desc')
                        ->get();
                }
                return [];
            },

            'dbEntriesMonth' => function () use ($summaryMonth, $startMonth, $endMonth, $allowedLobIds, $isAdmin) {
                $query = UserPlanning::query()->when(!$isAdmin, fn($q) => $q->whereIn('lob_id', $allowedLobIds));
                if ($summaryMonth) return $query->where('planning_month', $summaryMonth)->orderBy('created_at', 'desc')->get();
                if ($startMonth && $endMonth) return $query->whereBetween('planning_month', [$startMonth, $endMonth])->orderBy('created_at', 'desc')->get();
                return [];
            },

            'dbBudgets' => Inertia::lazy(fn() => CategoryBudget::when(!$isAdmin, fn($q) => $q->where('user_id', $user->user_id))->get()),
            'dbActualSales' => function () use ($summaryMonth, $startMonth, $endMonth, $isAdmin, $user) {
                if (!$summaryMonth && !($startMonth && $endMonth)) return [];

                $query = ActualSale::when(!$isAdmin, fn($q) => $q->where('sales_representative_no', $user->employee_id));
                
                if ($startMonth && $endMonth) {
                    $query->whereBetween('invoice_date', [$startMonth . '-01', date('Y-m-t', strtotime($endMonth . '-01'))]);
                } elseif ($summaryMonth) {
                    $query->whereBetween('invoice_date', [$summaryMonth . '-01', date('Y-m-t', strtotime($summaryMonth . '-01'))]);
                }
                
                return $query->get();
            },
        ]);
    }

    public function store(Request $request)
    {
        $nextMonth = now()->addMonth()->format('Y-m');

        $validated = $request->validate([
            'entries' => 'required|array|min:1',
            'entries.*.lob_id' => 'required|exists:lobs,lob_id',
            'entries.*.product_id' => 'required|exists:products,product_id',
            'entries.*.planning_month' => 'required|date_format:Y-m|after_or_equal:' . $nextMonth,
            'entries.*.planned_quantity' => 'required|integer|min:1',
            'entries.*.planned_price_myr' => 'required|numeric',
            'entries.*.planned_price_usd' => 'required|numeric',
            'entries.*.planned_price_aed' => 'required|numeric',
            'entries.*.total_amount' => 'required|numeric',
            'entries.*.confirmed_quantity' => 'required|integer|min:0',
        ]);

        $currentUserId = Auth::user()->user_id;

        DB::transaction(function () use ($validated, $currentUserId) {
            foreach ($validated['entries'] as $entry) {
                $planning = UserPlanning::firstOrNew([
                    'lob_id' => $entry['lob_id'],
                    'product_id' => $entry['product_id'],
                    'planning_month' => $entry['planning_month'],
                ]);

                if (!$planning->exists) {
                    $planning->user_id = $currentUserId;
                }

                $planning->updated_by = $currentUserId;

                $planning->fill([
                    'planned_quantity' => $entry['planned_quantity'],
                    'planned_price_aed' => $entry['planned_price_aed'],
                    'planned_price_myr' => $entry['planned_price_myr'],
                    'planned_price_usd' => $entry['planned_price_usd'],
                    'total_amount' => $entry['total_amount'],
                    'confirmed_quantity' => $entry['confirmed_quantity'] ?? 0,
                ])->save();
            }
        });

        return back();
    }

    public function storeBudgets(Request $request)
    {
        $validated = $request->validate([
            'budgets' => 'required|array',
            'budgets.*.product_line' => 'required|string',
            'budgets.*.planning_month' => 'required|date_format:Y-m',
            'budgets.*.budget_aed' => 'nullable|numeric',
            'budgets.*.w1_aed' => 'nullable|numeric',
            'budgets.*.w2_aed' => 'nullable|numeric',
            'budgets.*.w3_aed' => 'nullable|numeric',
            'budgets.*.w4_aed' => 'nullable|numeric',
            'budgets.*.w5_aed' => 'nullable|numeric',
        ]);

        $userId = Auth::user()->user_id;
        $upsertData = [];

        foreach ($validated['budgets'] as $data) {
            $upsertData[] = [
                'user_id' => $userId,
                'product_line' => $data['product_line'],
                'planning_month' => $data['planning_month'],
                'budget_aed' => $data['budget_aed'] ?? 0,
                'w1_aed' => $data['w1_aed'] ?? 0,
                'w2_aed' => $data['w2_aed'] ?? 0,
                'w3_aed' => $data['w3_aed'] ?? 0,
                'w4_aed' => $data['w4_aed'] ?? 0,
                'w5_aed' => $data['w5_aed'] ?? 0,
            ];
        }

        if (!empty($upsertData)) {
            CategoryBudget::upsert(
                $upsertData,
                ['user_id', 'product_line', 'planning_month'],
                ['budget_aed', 'w1_aed', 'w2_aed', 'w3_aed', 'w4_aed', 'w5_aed']
            );
        }

        return back();
    }
}
