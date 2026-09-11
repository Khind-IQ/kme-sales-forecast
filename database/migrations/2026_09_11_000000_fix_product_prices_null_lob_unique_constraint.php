<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    /**
     * The unique constraint on product_prices was UNIQUE (product_id, lob_id).
     * In Postgres, NULLs are treated as distinct in a unique index, so
     * upsert() on (product_id, lob_id) never detects a conflict for rows with
     * a NULL lob_id (the "global / default" price). As a result the daily
     * sync:redshift job INSERTed a fresh duplicate global-price row on every
     * run instead of updating the existing one.
     *
     * This migration:
     *   1. Collapses existing duplicate NULL-lob rows down to one per product
     *      (keeping the lowest product_price_id). All duplicate sets are known
     *      to share the same price, so this is lossless.
     *   2. Recreates the unique constraint as NULLS NOT DISTINCT (Postgres 15+)
     *      so (product_id, NULL) collides with itself and upsert now UPDATEs.
     */
    public function up(): void
    {
        // 1. Remove duplicate NULL-lob rows, keeping the earliest row per product.
        DB::statement(<<<'SQL'
            DELETE FROM product_prices p
            USING (
                SELECT product_id, MIN(product_price_id) AS keep_id
                FROM product_prices
                WHERE lob_id IS NULL
                GROUP BY product_id
            ) k
            WHERE p.lob_id IS NULL
              AND p.product_id = k.product_id
              AND p.product_price_id <> k.keep_id
        SQL);

        // 2. Swap the unique constraint for a NULLS NOT DISTINCT variant.
        DB::statement('ALTER TABLE product_prices DROP CONSTRAINT product_prices_product_id_lob_id_unique');
        DB::statement('ALTER TABLE product_prices ADD CONSTRAINT product_prices_product_id_lob_id_unique UNIQUE NULLS NOT DISTINCT (product_id, lob_id)');
    }

    /**
     * Restore the original constraint. Note: the removed duplicate rows are not
     * restored (they were redundant and lossless to drop).
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE product_prices DROP CONSTRAINT product_prices_product_id_lob_id_unique');
        DB::statement('ALTER TABLE product_prices ADD CONSTRAINT product_prices_product_id_lob_id_unique UNIQUE (product_id, lob_id)');
    }
};
