<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Make `price` nullable so properties without a price
 * (e.g. property groups / multi-unit parents) don't fail
 * the NOT NULL constraint.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->string('price')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            // Restore to NOT NULL — set empty prices to '' first to avoid constraint errors
            \Illuminate\Support\Facades\DB::table('properties')->whereNull('price')->update(['price' => '']);
            $table->string('price')->nullable(false)->change();
        });
    }
};
