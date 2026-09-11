<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ForecastController;
use App\Http\Controllers\Auth\MicrosoftController;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    if (Auth::check()) {
        return redirect()->route('forecast');
    }
    return redirect()->route('login');
});

// Protected App Routes (Must be logged in)
Route::middleware(['auth', 'verified'])->group(function () {
    
    // 'dashboard' is kept as a named route (referenced by the email-verification
    // flow) but the app's real home is the Forecast tool, so redirect there.
    Route::get('/dashboard', function () {
        return redirect()->route('forecast');
    })->name('dashboard');

    //  New Sales Forecast Tool
    Route::get('/forecast', [ForecastController::class, 'index'])->name('forecast');
    Route::post('/forecast', [ForecastController::class, 'store'])->name('forecast.store');

    Route::post('/forecast/budgets', [ForecastController::class, 'storeBudgets'])->name('forecast.budgets');

});

// User Profile Routes
Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});


Route::get('/auth/microsoft/redirect', [MicrosoftController::class, 'redirect'])->name('microsoft.redirect');
Route::get('/auth/microsoft/callback', [MicrosoftController::class, 'callback'])->name('microsoft.callback');

require __DIR__.'/auth.php';