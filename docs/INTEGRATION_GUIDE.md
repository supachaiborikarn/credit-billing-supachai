# Credit-Billing → Supachaigroup Integration Package

สรุปสิ่งที่ควรนำไปใช้กับโปรเจค Supachaigroup

---

## 1. 🗄️ Database Schema Changes

### New Tables to Add in Laravel

```php
// Migration: create_shift_reconciliations_table.php
Schema::create('shift_reconciliations', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('shift_run_id')->unique()->constrained('shift_runs');
    $table->decimal('expected_fuel_amount', 15, 2);
    $table->decimal('expected_other_amount', 15, 2)->default(0);
    $table->decimal('total_expected', 15, 2);
    $table->decimal('total_received', 15, 2);
    $table->decimal('cash_received', 15, 2)->default(0);
    $table->decimal('credit_received', 15, 2)->default(0);
    $table->decimal('transfer_received', 15, 2)->default(0);
    $table->decimal('variance', 15, 2);
    $table->enum('variance_status', ['GREEN', 'YELLOW', 'RED'])->default('GREEN');
    $table->timestamps();
});
```

### Modify shift_runs Table

```php
// add_anti_fraud_fields_to_shift_runs.php
Schema::table('shift_runs', function (Blueprint $table) {
    $table->timestamp('locked_at')->nullable();
    $table->foreignUuid('locked_by_user_id')->nullable()->constrained('users');
    $table->text('variance_note')->nullable();
});
```

---

## 2. 📦 Key Services to Port

### A. Shift Service (shift-service.ts → ShiftService.php)

```php
// app/Services/ShiftService.php

class ShiftService
{
    const VARIANCE_YELLOW = 200;
    const VARIANCE_RED = 500;

    public function validateCloseShift(ShiftRun $shift): array
    {
        $errors = [];
        
        if ($shift->status !== 'OPEN') {
            $errors[] = 'กะนี้ปิดหรือล็อกไปแล้ว';
        }

        // ตรวจมิเตอร์ครบ
        $expectedNozzles = $shift->station->nozzles()->count();
        $completedMeters = $shift->meterReadings()
            ->whereNotNull('close_meter')
            ->count();

        if ($completedMeters < $expectedNozzles) {
            $errors[] = "มิเตอร์ยังไม่ครบ ({$completedMeters}/{$expectedNozzles} หัว)";
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }

    public function calculateReconciliation(ShiftRun $shift): array
    {
        $gasPrice = $shift->priceBook?->retail_price ?? 15.50;
        
        $totalSoldLiters = $shift->meterReadings->sum('sold_qty');
        $expectedFuelAmount = $totalSoldLiters * $gasPrice;
        
        $cashReceived = $shift->payments()
            ->where('method', 'CASH')
            ->sum('amount');
        $creditReceived = $shift->creditTransactions->sum('amount');
        $transferReceived = $shift->payments()
            ->whereIn('method', ['TRANSFER', 'CREDIT_CARD'])
            ->sum('amount');

        $totalReceived = $cashReceived + $creditReceived + $transferReceived;
        $variance = $expectedFuelAmount - $totalReceived;

        return [
            'expected_fuel_amount' => $expectedFuelAmount,
            'total_received' => $totalReceived,
            'variance' => $variance,
            'variance_status' => $this->getVarianceStatus($variance),
        ];
    }

    public function getVarianceStatus(float $variance): string
    {
        $abs = abs($variance);
        if ($abs > self::VARIANCE_RED) return 'RED';
        if ($abs > self::VARIANCE_YELLOW) return 'YELLOW';
        return 'GREEN';
    }

    public function lockShift(ShiftRun $shift, User $user): bool
    {
        if ($shift->status !== 'CLOSED') {
            throw new \Exception('ต้องปิดกะก่อนถึงจะล็อกได้');
        }

        $shift->update([
            'status' => 'LOCKED',
            'locked_at' => now(),
            'locked_by_user_id' => $user->id,
        ]);

        return true;
    }
}
```

### B. Model Observer (ป้องกันแก้ไขเมื่อ LOCKED)

```php
// app/Observers/MeterReadingObserver.php

class MeterReadingObserver
{
    public function updating(MeterReading $reading)
    {
        if ($reading->shiftRun->status === 'LOCKED') {
            throw new \Exception('ไม่สามารถแก้ไขได้ กะนี้ถูกล็อกแล้ว');
        }
    }

    public function deleting(MeterReading $reading)
    {
        if ($reading->shiftRun->status === 'LOCKED') {
            throw new \Exception('ไม่สามารถลบได้ กะนี้ถูกล็อกแล้ว');
        }
    }
}
```

---

## 3. 📊 Constants/Enums

### Thai Labels for Payment Types

```php
// app/Enums/PaymentTypeLabels.php

class PaymentTypeLabels
{
    const LABELS = [
        'CASH' => 'เงินสด',
        'CREDIT' => 'เงินเชื่อ',
        'TRANSFER' => 'โอนเงิน',
        'CREDIT_CARD' => 'บัตรเครดิต',
        'BOX_TRUCK' => 'รถตู้ทึบ',
        'OIL_TRUCK_SUPACHAI' => 'รถน้ำมันศุภชัย',
    ];
}
```

### Variance Thresholds

```php
// config/billing.php

return [
    'variance' => [
        'yellow' => 200, // บาท
        'red' => 500,    // บาท
    ],
    'device_limit_per_station' => 2,
];
```

---

## 4. 🔌 API Endpoints ที่ควรเพิ่ม

| Method | Endpoint | หน้าที่ |
|--------|----------|--------|
| `GET` | `/api/health` | เช็คสถานะระบบ |
| `POST` | `/api/shift-runs/{id}/close` | ปิดกะพร้อม reconciliation |
| `POST` | `/api/shift-runs/{id}/lock` | ล็อกกะ (แก้ไขไม่ได้) |
| `GET` | `/api/shift-runs/{id}/reconciliation` | ดูยอดสรุป |
| `POST` | `/api/devices/register` | ลงทะเบียนอุปกรณ์ |

---

## 5. 🎨 UI Components (React)

หาก supachaigroup ใช้ React/Next.js สามารถ copy ไปใช้ได้เลย:

```
src/components/ui/
├── button.tsx   # ปุ่มพร้อม variants
├── card.tsx     # Card component
├── input.tsx    # Input พร้อม error
└── badge.tsx    # Status badges
```

---

## 6. 📋 Checklist ก่อน Migrate

- [ ] Backup database ทั้ง 2 โปรเจค
- [ ] Run migrations ใน supachaigroup
- [ ] ย้าย ShiftService logic
- [ ] เพิ่ม Model Observers
- [ ] Test ปิดกะ + reconciliation
- [ ] Test lock + ป้องกันแก้ไข
