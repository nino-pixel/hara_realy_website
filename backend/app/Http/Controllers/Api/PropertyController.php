<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Support\ApiResponse;
use App\Models\Property;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class PropertyController extends Controller
{
    private const CORE_KEYS = [
        'id', 'title', 'location', 'price', 'type', 'status',
        'beds', 'baths', 'area', 'image', 'showOnWebsite', 'archived',
    ];

    public function index(): JsonResponse
    {
        $rows = Property::query()->orderByDesc('updated_at')->get();

        return ApiResponse::success([
            'data' => $rows->map(fn (Property $p) => $this->toFrontendShape($p))->values(),
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $p = Property::query()->find($id);
        if (! $p) {
            return ApiResponse::failure('Not found.', 404);
        }

        return ApiResponse::success([
            'data' => $this->toFrontendShape($p),
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $p = Property::query()->find($id);
        if (! $p) {
            return ApiResponse::failure('Not found.', 404);
        }

        // Mark the archived flag so any consumer checking the boolean sees it archived,
        // then soft-delete so ArchivesController::index() can find it via onlyTrashed().
        $p->archived = true;
        $p->save();
        $p->delete();

        return ApiResponse::success([
            'message' => 'Property archived successfully.',
        ]);
    }

    /**
     * Merge DB columns with `extra` JSON for full Property shape the SPA expects.
     */
    private function toFrontendShape(Property $p): array
    {
        $extra = is_array($p->extra) ? $p->extra : [];

        $core = [
            'id' => $p->id,
            'title' => $p->title,
            'location' => $p->location,
            'price' => $p->price,
            'type' => $p->type,
            'status' => $p->status,
            'beds' => (int) $p->beds,
            'baths' => (int) $p->baths,
            'area' => $p->area ?? '',
            'image' => $this->normalizePublicUrl($p->image ?? ''),
            'showOnWebsite' => (bool) $p->show_on_website,
            'archived' => (bool) $p->archived,
        ];

        $merged = array_merge($extra, $core);

        $merged = $this->normalizeGalleryInPayload($merged);

        return $this->normalizeFloorPlanInPayload($merged);
    }

    /** Stored path from Storage::store — e.g. properties/foo.jpg → /storage/properties/foo.jpg */
    private function relativePublicStorageUrl(string $storedPath): string
    {
        return '/storage/'.ltrim($storedPath, '/');
    }

    /**
     * Strip scheme/host so the SPA can load images from its origin (Vite proxies /storage → Laravel).
     */
    private function normalizePublicUrl(string $url): string
    {
        if ($url === '') {
            return '';
        }
        if (str_starts_with($url, '/storage/')) {
            return $url;
        }
        if (preg_match('#^https?://[^/]+(/storage/.+)$#i', $url, $m)) {
            return $m[1];
        }

        return $url;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function normalizeGalleryInPayload(array $payload): array
    {
        if (! isset($payload['gallery']) || ! is_array($payload['gallery'])) {
            return $payload;
        }
        $payload['gallery'] = array_values(array_map(
            fn ($u) => $this->normalizePublicUrl(is_string($u) ? $u : ''),
            $payload['gallery']
        ));

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function normalizeFloorPlanInPayload(array $payload): array
    {
        if (! isset($payload['floorPlan']) || ! is_string($payload['floorPlan'])) {
            return $payload;
        }
        $payload['floorPlan'] = $this->normalizePublicUrl($payload['floorPlan']);

        return $payload;
    }

    /**
     * @throws ValidationException
     */
    private function assertFloorPlanNotBase64(?string $value): void
    {
        if ($value === null || $value === '') {
            return;
        }
        if (str_starts_with($value, 'data:')) {
            throw ValidationException::withMessages([
                'floorPlan' => ['Base64 or data-URL floor plans are not allowed. Upload a file instead.'],
            ]);
        }
    }

    /**
     * Upsert property — JSON body (legacy / sync) OR multipart with `property` JSON + file uploads.
     */
    public function store(Request $request): JsonResponse
    {
        if ($request->has('property')) {
            return $this->storeFromMultipart($request);
        }

        return $this->storeFromJsonBody($request);
    }

    /**
     * Multipart: field `property` = JSON string; optional `cover` file; optional `gallery[]` files.
     */
    private function storeFromMultipart(Request $request): JsonResponse
    {
        $request->validate([
            'property'                  => 'required|json',
            'cover'                     => 'nullable|image|mimes:jpeg,jpg,png,webp|max:2048',
            'gallery'                   => 'nullable|array',
            'gallery.*'                 => 'image|mimes:jpeg,jpg,png,webp|max:2048',
            'floorPlan'                 => 'nullable|file|mimes:jpeg,jpg,png,webp,pdf|max:4096',
            'documentContract'          => 'nullable|file|mimes:jpeg,jpg,png,webp,pdf|max:8192',
            'documentReservationForm'   => 'nullable|file|mimes:jpeg,jpg,png,webp,pdf|max:8192',
            'documentTitleCopy'         => 'nullable|file|mimes:jpeg,jpg,png,webp,pdf|max:8192',
        ]);

        $data = json_decode($request->input('property'), true);
        if (! is_array($data)) {
            return ApiResponse::failure('Invalid property JSON.', 422);
        }

        Validator::make($data, $this->propertyDataRules())->validate();

        if ($request->hasFile('floorPlan')) {
            unset($data['floorPlan']);
        }
        if ($request->hasFile('documentContract')) {
            unset($data['documentContract']);
        }
        if ($request->hasFile('documentReservationForm')) {
            unset($data['documentReservationForm']);
        }
        if ($request->hasFile('documentTitleCopy')) {
            unset($data['documentTitleCopy']);
        }

        $this->assertFloorPlanNotBase64(isset($data['floorPlan']) && is_string($data['floorPlan']) ? $data['floorPlan'] : null);

        $disk = 'public';

        if ($request->hasFile('floorPlan')) {
            $path = $request->file('floorPlan')->store('properties/floorplans', $disk);
            $data['floorPlan'] = $this->relativePublicStorageUrl($path);
        }

        if ($request->hasFile('documentContract')) {
            $path = $request->file('documentContract')->store('properties/documents', $disk);
            $data['documentContract'] = $this->relativePublicStorageUrl($path);
        }

        if ($request->hasFile('documentReservationForm')) {
            $path = $request->file('documentReservationForm')->store('properties/documents', $disk);
            $data['documentReservationForm'] = $this->relativePublicStorageUrl($path);
        }

        if ($request->hasFile('documentTitleCopy')) {
            $path = $request->file('documentTitleCopy')->store('properties/documents', $disk);
            $data['documentTitleCopy'] = $this->relativePublicStorageUrl($path);
        }

        if ($request->hasFile('cover')) {
            $path = $request->file('cover')->store('properties', $disk);
            $data['image'] = $this->relativePublicStorageUrl($path);
        }

        $newGalleryUrls = [];
        foreach ($request->file('gallery', []) as $file) {
            if ($file === null) {
                continue;
            }
            $path = $file->store('properties', $disk);
            $newGalleryUrls[] = $this->relativePublicStorageUrl($path);
        }

        if ($newGalleryUrls !== []) {
            $existing = isset($data['gallery']) && is_array($data['gallery']) ? $data['gallery'] : [];
            $data['gallery'] = array_values(array_merge($existing, $newGalleryUrls));
        }

        $coreColumnKeys = self::CORE_KEYS;
        $extra = collect($data)->except($coreColumnKeys)->filter(fn ($v) => $v !== null)->all();

        $row = Property::query()->updateOrCreate(
            ['id' => $data['id']],
            [
                'title' => $data['title'],
                'location' => $data['location'],
                'price' => $data['price'] ?? null,
                'type' => $data['type'],
                'status' => $data['status'],
                'beds' => $data['beds'] ?? 0,
                'baths' => $data['baths'] ?? 0,
                'area' => $data['area'] ?? '',
                'image' => $data['image'] ?? '',
                'show_on_website' => $data['showOnWebsite'] ?? true,
                'archived' => $data['archived'] ?? false,
                'extra' => $extra,
            ]
        );

        return ApiResponse::success([
            'data' => $this->toFrontendShape($row),
        ], 201);
    }

    /**
     * Legacy: application/json with flat keys (sync / clients without files).
     */
    private function storeFromJsonBody(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id' => 'required|string|max:64',
            'title' => 'required|string|max:500',
            'location' => 'required|string|max:500',
            'price' => 'nullable|string|max:100',
            'type' => 'required|string|max:64',
            'status' => 'required|string|max:64',
            'beds' => 'nullable|integer|min:0|max:100',
            'baths' => 'nullable|integer|min:0|max:100',
            'area' => 'nullable|string|max:100',
            'image' => 'nullable|string',
            'showOnWebsite' => 'nullable|boolean',
            'archived' => 'nullable|boolean',
        ]);

        $coreColumnKeys = self::CORE_KEYS;
        $all = $request->all();
        $extra = collect($all)->except($coreColumnKeys)->filter(fn ($v) => $v !== null)->all();

        $this->assertFloorPlanNotBase64(isset($extra['floorPlan']) && is_string($extra['floorPlan']) ? $extra['floorPlan'] : null);

        $row = Property::query()->updateOrCreate(
            ['id' => $validated['id']],
            [
                'title' => $validated['title'],
                'location' => $validated['location'],
                'price' => $validated['price'] ?? null,
                'type' => $validated['type'],
                'status' => $validated['status'],
                'beds' => $validated['beds'] ?? 0,
                'baths' => $validated['baths'] ?? 0,
                'area' => $validated['area'] ?? '',
                'image' => $validated['image'] ?? '',
                'show_on_website' => $validated['showOnWebsite'] ?? true,
                'archived' => $validated['archived'] ?? false,
                'extra' => $extra,
            ]
        );

        return ApiResponse::success([
            'data' => $this->toFrontendShape($row),
        ], 201);
    }

    /** Rules for decoded `property` JSON (multipart). */
    private function propertyDataRules(): array
    {
        return [
            'id' => 'required|string|max:64',
            'title' => 'required|string|max:500',
            'location' => 'required|string|max:500',
            'price' => 'nullable|string|max:100',
            'type' => 'required|string|max:64',
            'status' => 'required|string|max:64',
            'beds' => 'nullable|integer|min:0|max:100',
            'baths' => 'nullable|integer|min:0|max:100',
            'area' => 'nullable|string|max:100',
            'image' => 'nullable|string',
            'showOnWebsite' => 'nullable|boolean',
            'archived' => 'nullable|boolean',
            'gallery' => 'nullable|array',
            'gallery.*' => 'nullable|string|max:20000',
            /** Stored path only (e.g. /storage/properties/floorplans/...) — never base64 */
            'floorPlan' => 'nullable|string|max:2048',
        ];
    }
}
