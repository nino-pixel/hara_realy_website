<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Support\ApiResponse;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClientController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $municipalities = config('bulacan.municipalities', []);

        $validated = $request->validate([
            'id' => 'required|string|max:64',
            'name' => 'required|string|max:255',
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('clients', 'email')->ignore($request->input('id'), 'id'),
            ],
            'phone' => ['required', 'string', 'regex:/^09\d{9}$/'],
            'source' => 'nullable|string|max:128',
            'status' => 'nullable|string|max:64',
            'assigned_to' => 'nullable|string|max:64',
            'assignedTo' => 'nullable|string|max:64',
            'province' => ['required', 'string', 'in:Bulacan'],
            'municipality' => ['required', 'string', Rule::in($municipalities)],
            'barangay' => ['required', 'string', 'max:255'],
            'purok_or_street' => ['nullable', 'string', 'max:255'],
            'notes' => 'nullable|string|max:20000',
            'adminNotes' => 'nullable|string|max:20000',
            'history' => 'nullable|array|max:500',
            'history.*.date' => 'nullable|string|max:64',
            'history.*.note' => 'nullable|string|max:2000',
        ]);

        $assigned = $validated['assigned_to'] ?? $validated['assignedTo'] ?? null;

        $core = [
            'id', 'name', 'email', 'phone', 'source', 'status', 'assigned_to', 'assignedTo', 'history',
            'province', 'municipality', 'barangay', 'purok_or_street', 'notes', 'adminNotes',
        ];
        $extra = collect($request->all())->except($core)->filter(fn ($v) => $v !== null)->all();

        $purok = isset($validated['purok_or_street']) ? trim((string) $validated['purok_or_street']) : '';
        $barangay = trim($validated['barangay']);
        $mun = trim($validated['municipality']);
        $prov = $validated['province'];

        $addressLine = $purok !== ''
            ? "{$purok}, {$barangay}, {$mun}, {$prov}"
            : "{$barangay}, {$mun}, {$prov}";

        $extra = array_merge($extra, [
            'province' => $prov,
            'municipality' => $mun,
            'barangay' => $barangay,
            'purokOrStreet' => $purok !== '' ? $purok : null,
            'address' => $addressLine,
        ]);

        if (array_key_exists('notes', $validated)) {
            $extra['notes'] = $validated['notes'] ?? '';
        }
        if (array_key_exists('adminNotes', $validated)) {
            $extra['adminNotes'] = $validated['adminNotes'] ?? '';
        }
        if (isset($validated['history'])) {
            $extra['history'] = $validated['history'];
        }

        $row = Client::query()->updateOrCreate(
            ['id' => $validated['id']],
            [
                'name' => $validated['name'],
                'email' => $validated['email'],
                'phone' => $validated['phone'],
                'source' => $validated['source'] ?? null,
                'status' => $validated['status'] ?? 'new',
                'assigned_to' => $assigned,
                'extra' => $extra,
            ]
        );

        return ApiResponse::success([
            'data' => $this->toFrontendShape($row),
        ], 201);
    }

    private function toFrontendShape(Client $c): array
    {
        $extra = is_array($c->extra) ? $c->extra : [];

        $base = [
            'id' => $c->id,
            'name' => $c->name,
            'email' => $c->email,
            'phone' => $c->phone ?? '',
            'source' => $c->source,
            'status' => $c->status,
            'assignedTo' => $c->assigned_to,
            'createdAt' => $c->created_at?->toIso8601String(),
            'updatedAt' => $c->updated_at?->toIso8601String(),
        ];

        return array_merge($extra, $base);
    }

    public function destroy(string $id): JsonResponse
    {
        $c = Client::query()->find($id);
        if (! $c) {
            return ApiResponse::failure('Not found.', 404);
        }

        $c->delete();

        return ApiResponse::success([
            'message' => 'Client archived successfully.',
        ]);
    }
}
