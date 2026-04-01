<?php

use App\Http\Controllers\Api\ArchivesController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\DealController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\InquiryController;
use App\Http\Controllers\Api\PropertyController;
use App\Http\Controllers\Api\SyncController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public API (no auth)
|--------------------------------------------------------------------------
| - Health, property catalog, public inquiry submission
| - Auth login (rate-limited)
*/

Route::get('/health', HealthController::class);

Route::middleware('throttle:5,1')->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login']);
});

Route::get('/properties', [PropertyController::class, 'index']);
Route::get('/properties/{id}', [PropertyController::class, 'show']);

/** Website lead forms — anti-spam throttle per IP */
Route::middleware('throttle:inquiries')->group(function () {
    Route::post('/inquiries', [InquiryController::class, 'store']);
});

/*
|--------------------------------------------------------------------------
| Authenticated API (Sanctum Bearer)
|--------------------------------------------------------------------------
| Admin / CRM: listings write, inquiries list & update, clients, deals, sync.
| Activity audit logs: client-side today; reserve protected routes when a DB-backed log exists.
*/

Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    Route::post('/properties', [PropertyController::class, 'store']);
    Route::delete('/properties/{id}', [PropertyController::class, 'destroy']);

    Route::get('/inquiries', [InquiryController::class, 'index']);
    Route::put('/inquiries/{id}', [InquiryController::class, 'update']);
    Route::delete('/inquiries/{id}', [InquiryController::class, 'destroy']);

    Route::get('/clients', [ClientController::class, 'index']);
    Route::post('/clients', [ClientController::class, 'store']);
    Route::delete('/clients/{id}', [ClientController::class, 'destroy']);

    Route::get('/deals', [DealController::class, 'index']);
    Route::post('/deals', [DealController::class, 'store']);
    Route::delete('/deals/{id}', [DealController::class, 'destroy']);

    Route::post('/sync/from-local', SyncController::class);

    // Archives
    Route::get('/archives', [ArchivesController::class, 'index']);
    Route::post('/archives/restore', [ArchivesController::class, 'restore']);
    Route::delete('/archives', [ArchivesController::class, 'destroy']);
});
