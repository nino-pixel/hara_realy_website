<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Support\ApiResponse;
use App\Models\Inquiry;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InquiryController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = Inquiry::query()->orderByDesc('created_at')->get();

        return ApiResponse::success([
            'data' => $rows->map(fn (Inquiry $i) => $this->toFrontendShape($i))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate($this->rulesForStore());

        $data = $request->all();
        $id = isset($data['id']) && is_string($data['id']) && $data['id'] !== ''
            ? $data['id']
            : ('i'.time());

        $meta = $this->buildMeta($data, []);

        $row = Inquiry::query()->updateOrCreate(
            ['id' => $id],
            array_merge($this->toDbColumns($id, $data), ['meta' => $meta])
        );

        return ApiResponse::success([
            'data' => $this->toFrontendShape($row),
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $inquiry = Inquiry::query()->find($id);
        if (! $inquiry) {
            return ApiResponse::failure('Not found.', 404);
        }

        $request->validate($this->rulesForUpdate());

        $data = $request->all();
        $meta = $this->buildMeta($data, is_array($inquiry->meta) ? $inquiry->meta : []);

        $inquiry->fill(array_merge($this->toDbColumns($id, $data), ['meta' => $meta]));
        $inquiry->save();

        return ApiResponse::success([
            'data' => $this->toFrontendShape($inquiry->fresh()),
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $inquiry = Inquiry::query()->find($id);
        if (! $inquiry) {
            return ApiResponse::failure('Not found.', 404);
        }

        $inquiry->delete();

        return ApiResponse::success([
            'message' => 'Inquiry archived successfully.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function rulesForStore(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'string', 'max:20'],
            'message' => ['required', 'string', 'max:1000'],
            'status' => ['required', 'string', 'max:32'],
            'id' => ['nullable', 'string', 'max:64'],
            'propertyId' => ['nullable', 'string', 'max:64'],
            'propertyTitle' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:10000'],
            'priority' => ['nullable', 'string', 'max:32'],
            'lastContactedAt' => ['nullable', 'string', 'max:64'],
            'nextFollowUpAt' => ['nullable', 'string', 'max:32'],
            'lostReason' => ['nullable', 'string', 'max:500'],
            'source_auto' => ['nullable', 'string', 'max:128'],
            'source_manual' => ['nullable', 'string', 'max:128'],
            'utm_campaign' => ['nullable', 'string', 'max:128'],
            'utm_medium' => ['nullable', 'string', 'max:128'],
            'linkedClientId' => ['nullable', 'string', 'max:64'],
            'budgetRange' => ['nullable', 'string', 'max:255'],
            'buyingTimeline' => ['nullable', 'string', 'max:255'],
            'financingMethod' => ['nullable', 'string', 'max:255'],
            'employmentStatus' => ['nullable', 'string', 'max:255'],
            'estimatedMonthly' => ['nullable', 'numeric'],
            'downpayment' => ['nullable', 'string', 'max:255'],
            'loanTerm' => ['nullable', 'integer', 'min:0', 'max:600'],
            'interestRate' => ['nullable', 'numeric'],
            'downpaymentPercent' => ['nullable', 'numeric'],
            'highBuyingIntent' => ['nullable', 'boolean'],
            'meta' => ['nullable', 'array'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function rulesForUpdate(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255'],
            'phone' => ['sometimes', 'required', 'string', 'max:20'],
            'message' => ['sometimes', 'required', 'string', 'max:1000'],
            'status' => ['sometimes', 'required', 'string', 'max:32'],
            'propertyId' => ['nullable', 'string', 'max:64'],
            'propertyTitle' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:10000'],
            'priority' => ['nullable', 'string', 'max:32'],
            'lastContactedAt' => ['nullable', 'string', 'max:64'],
            'nextFollowUpAt' => ['nullable', 'string', 'max:32'],
            'lostReason' => ['nullable', 'string', 'max:500'],
            'source_auto' => ['nullable', 'string', 'max:128'],
            'source_manual' => ['nullable', 'string', 'max:128'],
            'utm_campaign' => ['nullable', 'string', 'max:128'],
            'utm_medium' => ['nullable', 'string', 'max:128'],
            'linkedClientId' => ['nullable', 'string', 'max:64'],
            'budgetRange' => ['nullable', 'string', 'max:255'],
            'buyingTimeline' => ['nullable', 'string', 'max:255'],
            'financingMethod' => ['nullable', 'string', 'max:255'],
            'employmentStatus' => ['nullable', 'string', 'max:255'],
            'estimatedMonthly' => ['nullable', 'numeric'],
            'downpayment' => ['nullable', 'string', 'max:255'],
            'loanTerm' => ['nullable', 'integer', 'min:0', 'max:600'],
            'interestRate' => ['nullable', 'numeric'],
            'downpaymentPercent' => ['nullable', 'numeric'],
            'highBuyingIntent' => ['nullable', 'boolean'],
            'meta' => ['nullable', 'array'],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $previousMeta
     */
    private function buildMeta(array $data, array $previousMeta): array
    {
        $metaKeys = [
            'lostReason', 'source_auto', 'source_manual', 'utm_campaign', 'utm_medium',
            'linkedClientId', 'downpaymentPercent', 'highBuyingIntent',
        ];
        $meta = $previousMeta;
        foreach ($metaKeys as $k) {
            if (array_key_exists($k, $data)) {
                $meta[$k] = $data[$k];
            }
        }
        if (isset($data['meta']) && is_array($data['meta'])) {
            $meta = array_merge($meta, $data['meta']);
        }

        return $meta;
    }

    /**
     * @param  array<string, mixed>  $v
     */
    private function toDbColumns(string $id, array $v): array
    {
        $last = null;
        if (! empty($v['lastContactedAt'])) {
            try {
                $last = Carbon::parse($v['lastContactedAt']);
            } catch (\Throwable) {
                $last = null;
            }
        }

        $next = ! empty($v['nextFollowUpAt']) ? $v['nextFollowUpAt'] : null;

        return [
            'id' => $id,
            'name' => (string) ($v['name'] ?? ''),
            'email' => (string) ($v['email'] ?? ''),
            'phone' => (string) ($v['phone'] ?? ''),
            'property_id' => $v['propertyId'] ?? null,
            'property_title' => $v['propertyTitle'] ?? null,
            'message' => (string) ($v['message'] ?? ''),
            'status' => (string) ($v['status'] ?? 'new'),
            'priority' => $v['priority'] ?? null,
            'budget_range' => $v['budgetRange'] ?? null,
            'buying_timeline' => $v['buyingTimeline'] ?? null,
            'financing_method' => $v['financingMethod'] ?? null,
            'employment_status' => $v['employmentStatus'] ?? null,
            'estimated_monthly' => $v['estimatedMonthly'] ?? null,
            'downpayment' => $v['downpayment'] ?? null,
            'loan_term' => $v['loanTerm'] ?? null,
            'interest_rate' => $v['interestRate'] ?? null,
            'next_follow_up_at' => $next,
            'last_contacted_at' => $last,
            'notes' => $v['notes'] ?? null,
        ];
    }

    private function toFrontendShape(Inquiry $i): array
    {
        $meta = is_array($i->meta) ? $i->meta : [];

        $base = [
            'id' => $i->id,
            'name' => $i->name,
            'email' => $i->email,
            'phone' => $i->phone ?? '',
            'propertyId' => $i->property_id,
            'propertyTitle' => $i->property_title ?? '',
            'message' => $i->message,
            'notes' => $i->notes ?? '',
            'status' => $i->status,
            'priority' => $i->priority,
            'createdAt' => $i->created_at?->toIso8601String(),
            'lastContactedAt' => $i->last_contacted_at?->toIso8601String(),
            'nextFollowUpAt' => $i->next_follow_up_at?->format('Y-m-d'),
            'budgetRange' => $i->budget_range,
            'buyingTimeline' => $i->buying_timeline,
            'financingMethod' => $i->financing_method,
            'employmentStatus' => $i->employment_status,
            'estimatedMonthly' => $i->estimated_monthly !== null ? (float) $i->estimated_monthly : null,
            'downpayment' => $i->downpayment,
            'loanTerm' => $i->loan_term,
            'interestRate' => $i->interest_rate !== null ? (float) $i->interest_rate : null,
        ];

        return array_merge($meta, $base);
    }
}
