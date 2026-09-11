<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    protected $primaryKey = 'employee_id';

    protected $fillable = [
        'employee_no',
        'full_name',
        'email',
        'department_code',
        'is_salesperson',
    ];

    protected $casts = [
        'is_salesperson' => 'boolean',
    ];
}
