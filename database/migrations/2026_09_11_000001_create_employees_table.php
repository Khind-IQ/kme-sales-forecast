<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Employee master, synced from Redshift (khind_rz.vw_kme_apps_employee_master).
     * Used at Microsoft login to resolve the correct employee_no from the user's
     * corporate email, instead of trusting Microsoft Graph's employeeId. That
     * employee_no matches lobs.sales_representative_no for LOB scoping.
     */
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id('employee_id');
            $table->string('employee_no')->unique();
            $table->string('full_name')->nullable();
            $table->string('email')->nullable()->index();
            $table->string('department_code')->nullable();
            $table->boolean('is_salesperson')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
