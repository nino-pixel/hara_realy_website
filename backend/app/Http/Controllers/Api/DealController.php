<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Support\ApiResponse;
use App\Models\Deal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DealController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id' => 'required|string|max:64',
            'client_id' => 'nullable|string|max:64',
            'clientId' => 'nullable|string|max:64',
            'property_id' => 'nullable|string|max:64',
            'propertyId' => 'nullable|string|max:64',
            'status' => 'required|string|max:64',
            'amount' => 'nullable|string|max:100',
            'closing_date' => 'nullable|string|max:40',
            'closingDate' => 'nullable|string|max:40',
        ]);

        $clientId = $validated['client_id'] ?? $validated['clientId'] ?? null;
        $propertyId = $validated['property_id'] ?? $validated['propertyId'] ?? '';

        if (! $clientId || $propertyId === '') {
            return ApiResponse::failure('clientId and propertyId are required.', 422);
        }

        $core = ['id', 'client_id', 'clientId', 'property_id', 'propertyId', 'status', 'amount', 'closing_date', 'closingDate'];
        $extra = collect($request->all())->except($core)->filter(fn ($v) => $v !== null)->all();

        $closing = $validated['closing_date'] ?? $validated['closingDate'] ?? null;

        $row = Deal::query()->updateOrCreate(
            ['id' => $validated['id']],
            [
                'client_id' => $clientId,
                'property_id' => $propertyId,
                'status' => $validated['status'],
                'amount' => $validated['amount'] ?? null,
                'closing_date' => $closing,
                'extra' => $extra,
            ]
        );

        return ApiResponse::success([
            'data' => $this->toFrontendShape($row),
        ], 201);
    }

    private function toFrontendShape(Deal $d): array
    {
        $extra = is_array($d->extra) ? $d->extra : [];

        $base = [
            'id' => $d->id,
            'clientId' => $d->client_id,
            'propertyId' => $d->property_id,
            'status' => $d->status,
            'amount' => $d->amount,
            'closingDate' => $d->closing_date?->format('Y-m-d'),
        ];

        return array_merge($extra, $base);
    }

    public function destroy(string $id): JsonResponse
    {
        $d = Deal::query()->find($id);
        if (! $d) {
            return ApiResponse::failure('Not found.', 404);
        }

        $d->delete();

        return ApiResponse::success([
            'message' => 'Deal archived successfully.',
        ]);
    }
}
