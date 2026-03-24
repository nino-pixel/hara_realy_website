<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Inquiry extends Model
{
    use SoftDeletes;
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'email',
        'phone',
        'property_id',
        'property_title',
        'message',
        'status',
        'priority',
        'budget_range',
        'buying_timeline',
        'financing_method',
        'employment_status',
        'estimated_monthly',
        'downpayment',
        'loan_term',
        'interest_rate',
        'next_follow_up_at',
        'last_contacted_at',
        'notes',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'estimated_monthly' => 'decimal:2',
            'interest_rate' => 'decimal:4',
            'loan_term' => 'integer',
            'next_follow_up_at' => 'date',
            'last_contacted_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class, 'property_id');
    }
}
