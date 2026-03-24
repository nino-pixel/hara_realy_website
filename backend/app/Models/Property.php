<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Property extends Model
{
    use SoftDeletes;
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'title',
        'location',
        'price',
        'type',
        'status',
        'beds',
        'baths',
        'area',
        'image',
        'show_on_website',
        'archived',
        'extra',
    ];

    protected function casts(): array
    {
        return [
            'show_on_website' => 'boolean',
            'archived' => 'boolean',
            'extra' => 'array',
            'beds' => 'integer',
            'baths' => 'integer',
        ];
    }

    public function inquiries(): HasMany
    {
        return $this->hasMany(Inquiry::class, 'property_id');
    }

    public function deals(): HasMany
    {
        return $this->hasMany(Deal::class, 'property_id');
    }
}
