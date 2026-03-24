<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Support\ApiResponse;
use App\Models\Client;
use App\Models\Deal;
use App\Models\Inquiry;
use App\Models\Property;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArchivesController extends Controller
{
    /**
     * Get all archived (soft-deleted) items.
     */
    public function index(): JsonResponse
    {
        $archives = [];

        // 1. Clients
        foreach (Client::onlyTrashed()->get() as $item) {
            $archives[] = [
                'id' => $item->id,
                'type' => 'client',
                'title' => $item->name,
                'subtitle' => $item->email,
                'archived_at' => $item->deleted_at->toIso8601String(),
            ];
        }

        // 2. Properties (Handle both SoftDeletes and manual 'archived' flag for transition)
        // Note: After migration, mostly SoftDeletes will be used.
        $properties = Property::onlyTrashed()->get();
        foreach ($properties as $item) {
            $archives[] = [
                'id' => $item->id,
                'type' => 'property',
                'title' => $item->title,
                'subtitle' => $item->location,
                'archived_at' => $item->deleted_at->toIso8601String(),
            ];
        }

        // 3. Deals
        foreach (Deal::onlyTrashed()->get() as $item) {
            $archives[] = [
                'id' => $item->id,
                'type' => 'deal',
                'title' => "Deal: " . ($item->client->name ?? 'Unknown Client'),
                'subtitle' => $item->property->title ?? 'Unknown Property',
                'archived_at' => $item->deleted_at->toIso8601String(),
            ];
        }

        // 4. Inquiries
        foreach (Inquiry::onlyTrashed()->get() as $item) {
            $archives[] = [
                'id' => $item->id,
                'type' => 'inquiry',
                'title' => $item->name,
                'subtitle' => $item->property_title ?? 'General Inquiry',
                'archived_at' => $item->deleted_at->toIso8601String(),
            ];
        }

        // Sort by most recently archived
        usort($archives, fn($a, $b) => strcmp($b['archived_at'], $a['archived_at']));

        return ApiResponse::success([
            'data' => $archives
        ]);
    }

    /**
     * Restore soft-deleted item(s).
     */
    public function restore(Request $request): JsonResponse
    {
        $request->validate([
            'items' => 'nullable|array',
            'items.*.id' => 'required|string',
            'items.*.type' => 'required|string|in:client,property,deal,inquiry',
            // Backwards compatibility for single item
            'id' => 'required_without:items|string',
            'type' => 'required_without:items|string|in:client,property,deal,inquiry'
        ]);

        $itemsToRestore = $request->has('items') 
            ? $request->input('items') 
            : [['id' => $request->input('id'), 'type' => $request->input('type')]];

        $count = 0;
        foreach ($itemsToRestore as $itemData) {
            $model = match($itemData['type']) {
                'client' => Client::class,
                'property' => Property::class,
                'deal' => Deal::class,
                'inquiry' => Inquiry::class,
            };

            $item = $model::onlyTrashed()->find($itemData['id']);
            if ($item) {
                $item->restore();
                $count++;
            }
        }

        return ApiResponse::success([
            'message' => $count > 1 ? "$count items restored successfully." : 'Item restored successfully.'
        ]);
    }

    /**
     * Permanently delete soft-deleted item(s).
     */
    public function destroy(Request $request): JsonResponse
    {
        $request->validate([
            'items' => 'nullable|array',
            'items.*.id' => 'required|string',
            'items.*.type' => 'required|string|in:client,property,deal,inquiry',
            // Backwards compatibility for single item
            'id' => 'required_without:items|string',
            'type' => 'required_without:items|string|in:client,property,deal,inquiry'
        ]);

        $itemsToDelete = $request->has('items') 
            ? $request->input('items') 
            : [['id' => $request->input('id'), 'type' => $request->input('type')]];

        $count = 0;
        foreach ($itemsToDelete as $itemData) {
            $model = match($itemData['type']) {
                'client' => Client::class,
                'property' => Property::class,
                'deal' => Deal::class,
                'inquiry' => Inquiry::class,
            };

            $item = $model::onlyTrashed()->find($itemData['id']);
            if ($item) {
                $item->forceDelete();
                $count++;
            }
        }

        return ApiResponse::success([
            'message' => $count > 1 ? "$count items permanently deleted." : 'Item permanently deleted.'
        ]);
    }
}
