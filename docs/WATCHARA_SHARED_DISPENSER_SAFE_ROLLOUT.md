# Watchara Shared Dispenser Safe Rollout

อัปเดตล่าสุด: 2026-04-18

## เป้าหมาย

เชื่อมยอดขายดีเซลจากระบบหัวจ่ายภายนอกของ Watchara เข้ากับระบบนี้แบบปลอดภัย โดย:

- ไม่ปน raw data กับ `transactions` เดิม
- ไม่ทำให้ dashboard / report / anomaly ให้ยอดไม่ตรงกัน
- ใช้งานได้เร็วที่สุดในรูปแบบ station-level diesel merge

## Decision Summary

ยืนยันแนวทางดังนี้:

- External source station: `station-1` (`Watchara shared dispenser`)
- Local target station in this repo: `station-2` (`วัชรเกียรติออยล์`)
- Phase 1 ใช้เฉพาะ diesel station total
- ยังไม่ split `T6` / `T8`
- Treat external source เป็น one all-day synthetic shift ชั่วคราว
- ห้ามเขียน external rows ปนลง `transactions`

## ทำไมยังไม่ควรแก้ production ทันที

draft เดิมอ้างไฟล์ที่ไม่มีใน repo นี้ และประเมินจุดที่ต้องแก้ต่ำเกินจริง

repo ปัจจุบันมีหลาย route/service ที่อ่าน `prisma.transaction` ตรง เช่น:

- `src/app/api/dashboard/executive/route.ts`
- `src/app/api/v2/simple/admin/overview/route.ts`
- `src/app/api/v2/simple/admin/analytics/route.ts`
- `src/app/api/v2/simple/admin/stations/route.ts`
- `src/app/api/v2/simple/admin/fuel-time/route.ts`
- `src/app/api/reports/route.ts`
- `src/services/daily-anomaly-detection.ts`
- `src/services/shift-reconciliation.ts`
- `src/services/shift-service.ts`

ถ้า merge เฉพาะบางหน้า ยอดจะไม่ตรงกัน และถ้ารวม report ก่อนรวม reconciliation/anomaly จะเกิด false alert

## Safe Architecture

### 1. Raw landing tables

เพิ่ม table ใหม่ใน Prisma:

- `external_sales_sources`
- `external_dispenser_transactions`

ห้าม reuse `transactions`

### 2. Source-specific connector

เพิ่มไฟล์ใหม่:

- `src/lib/watchara-dispenser-client.ts`

หน้าที่:

- อ่านจาก external Postgres / Neon
- map source `station-1` ไป local `station-2`
- normalize `business_date` เป็น Bangkok date
- coerce fuel type ของ source นี้เป็น `DIESEL`
- เก็บ `raw_json`, `source_updated_at`, void/delete flags

### 3. Sync layer

เพิ่มไฟล์ใหม่:

- `src/lib/watchara-dispenser-sync.ts`
- `src/app/api/admin/watchara-dispenser/sync/route.ts`
- `src/app/api/admin/watchara-dispenser/status/route.ts`
- `src/app/api/admin/watchara-dispenser/bootstrap/route.ts`

หน้าที่:

- sync ตาม date range
- upsert ด้วย unique key `(source_id, external_tx_id)`
- track `last_synced_at`, `last_seen_source_at`, `last_error`
- แสดงสถานะ stale source แบบชัดเจน

### 4. Aggregated operational sales helper

เพิ่มไฟล์ใหม่:

- `src/lib/operational-sales.ts`

helper นี้ต้องคืน 3 แบบ:

- VGCloud-only totals
- external-only totals
- merged operational totals

โดย phase แรกให้รองรับเฉพาะ Watchara diesel:

- merged liters = internal diesel + external diesel
- merged revenue = internal diesel + external diesel

## Rollout ที่ปลอดภัยที่สุด

### Wave 0. Documentation alignment

ทำก่อนเสมอ:

- rewrite plan ให้ตรง repo นี้
- ยืนยัน mapping `station-2`
- list touchpoints ที่ใช้ยอดขายจริง

สถานะ: ทำแล้วในเอกสารนี้

### Wave 1. Safe landing only

เป้าหมาย:

- เพิ่ม schema
- เพิ่ม connector + sync
- import raw external transactions ได้
- ยังไม่กระทบ dashboard/report หลัก

ไฟล์ที่ควรมี:

- `prisma/schema.prisma`
- `src/lib/watchara-dispenser-client.ts`
- `src/lib/watchara-dispenser-sync.ts`
- `src/app/api/admin/watchara-dispenser/sync/route.ts`
- `src/app/api/admin/watchara-dispenser/status/route.ts`

เงื่อนไขก่อนจบ wave:

- sync ย้อนหลัง 1 วันได้
- ไม่มี duplicate import
- rows void/delete ยัง query ได้
- เห็น source freshness ชัดเจน

### Wave 2. Merge into simple-station operational reporting

เป้าหมาย:

- เริ่มแสดงยอด merged เฉพาะจุดที่ Watchara ต้องใช้จริงเร็วที่สุด

patch ก่อน:

- `src/app/api/v2/simple/admin/overview/route.ts`
- `src/app/api/v2/simple/admin/analytics/route.ts`
- `src/app/api/v2/simple/admin/stations/route.ts`
- `src/app/api/v2/simple/admin/fuel-time/route.ts`

หลักการ:

- เฉพาะ `station-2` และเฉพาะ diesel totals
- ต้องมี source split สำหรับ debug
- raw transaction list เดิมยังไม่ต้องหลอมรวม

### Wave 3. Merge into global reporting

patch ต่อเมื่อ Wave 2 ผ่านแล้ว:

- `src/app/api/reports/route.ts`
- `src/app/api/dashboard/executive/route.ts`
- `src/app/api/export/csv/route.ts`

หมายเหตุ:

- route executive ปัจจุบันคำนวณบางค่าโดยอิง shift/meter ไม่ใช่ transaction อย่างเดียว
- ต้องระบุให้ชัดว่าค่าไหนเป็น operational sales และค่าไหนเป็น meter-based KPI

### Wave 4. Reconciliation and anomaly alignment

ห้าม skip wave นี้ถ้าจะเปิดใช้จริง

patch:

- `src/services/daily-anomaly-detection.ts`
- `src/services/shift-reconciliation.ts`
- `src/services/shift-service.ts`

หลักการ:

- ถ้าวันนั้นมี external diesel ของ Watchara ต้องรวมใน logic เปรียบเทียบยอด
- ถ้า source stale ต้องโชว์ warning ไม่ใช่กลืนยอดเก่า
- ยังไม่ต้องบังคับ split ตาม tank/nozzle

### Wave 5. Optional UX/debug improvements

ถ้ามีเวลา:

- หน้า debug สำหรับเทียบ internal vs external vs merged
- badge แสดง source freshness
- export สำหรับตรวจย้อนหลังรายวัน

## สถานะ implementation ล่าสุด

สถานะ ณ `2026-04-18`:

- Wave 0-1 complete: เพิ่ม schema, raw landing tables, connector, sync/status/bootstrap APIs, และหน้า admin แล้ว
- Wave 2 complete: simple admin overview/analytics/stations/fuel-time ใช้ merged operational sales แล้ว
- Wave 3 complete: global sales reports, executive dashboard, และ CSV export ใช้ merged dataset สำหรับ sales views แล้ว
- Wave 4 core complete: anomaly/reconciliation services รวม Watchara external contribution แล้ว เพื่อไม่ให้เกิด false variance จาก diesel ภายนอก
- Push-hardening complete: เพิ่ม server-side `/admin` guard, helper `api-auth`, ล็อก route เสี่ยงสูง, และทำ full legacy write API auth sweep แล้ว
- ยังไม่ได้ push/deploy จากเครื่องนี้
- ยังไม่เขียน external rows ปนเข้า `transactions`

## Smoke Results ล่าสุด

ตรวจบน DB จริงหลัง backfill:

- local landing rows = `4954`
- distinct `externalTxId = 4954`
- report daily range `2026-03-01` ถึง `2026-03-14`:
  - `watcharaExternal.rowsInRange = 214`
  - external liters = `91738.239`
  - external revenue = `2872279.0697000003`
- executive date `2026-03-13`:
  - external amount = `19741.75`
  - external liters = `564.05`
  - external transactions = `4`
- station-2 reconciliation smoke on business date `2026-03-13`:
  - `shift-service.calculateReconciliation()` => `variance = 0`, `GREEN`
  - `shift-reconciliation.calculateForShift()` => `variance = 0`, `GREEN`

## ข้อควรระวังก่อนเปิดใช้จริง

- Source stale อยู่ในตอนนี้:
  - latest sold transaction = `2026-03-14T11:01:05.000Z`
  - latest businessDate in local landing = `2026-03-13`
  - latest source row update = `2026-03-23T07:12:43.882Z`
- Production/staging ต้องตั้ง `WATCHARA_DISPENSER_DATABASE_URL` เอง ห้าม commit credential
- Existing persisted `shift_reconciliations` ที่เคยบันทึกไว้ก่อน patch นี้ไม่ได้ถูกคำนวณใหม่อัตโนมัติ
- Executive dashboard แยก `operational_sales` ออกจาก meter/reconciliation KPIs เพื่อไม่ให้ external sales ไป overwrite KPI ที่มาจากมิเตอร์จริง
- รอบ hardening นี้ปิด legacy write API auth gap ตาม static scan แล้ว:
  - ก่อน hardening: `43` write routes ไม่มี guard ชัดเจน
  - หลัง final sweep: `NO_UNGUARDED_WRITE_ROUTES`
  - ยังควร audit เชิงลึกเรื่อง rate limit, CSRF, business authorization, และ secret hygiene เพิ่มเติม
- ก่อน push/deploy ควร validate ตัวเลขกับเจ้าของระบบอย่างน้อยวันที่ `2026-03-13` และตรวจ UI close-shift/report/export อีกครั้ง

## สิ่งที่ไม่ควรทำในรอบแรก

- ไม่ยัด external rows ลง `transactions`
- ไม่พยายาม map per-tank `T6` / `T8`
- ไม่ผูก shift จริง ถ้า external source ยังไม่มี shift data ที่เชื่อถือได้
- ไม่ merge เข้าหน้า raw transaction history แบบเงียบๆ
- ไม่ deploy โดยยังไม่มี stale-source warning

## Proposed Prisma Shape

ตัวอย่างขั้นต่ำ:

### `external_sales_sources`

- `id`
- `code`
- `stationId`
- `sourceStationRef`
- `fuelFamily`
- `rollupMode`
- `isEnabled`
- `lastSyncedAt`
- `lastSeenSourceAt`
- `lastError`
- `createdAt`
- `updatedAt`

### `external_dispenser_transactions`

- `id`
- `sourceId`
- `externalTxId`
- `externalStationRef`
- `externalDailyRecordRef`
- `soldAt`
- `businessDate`
- `shiftKey`
- `nozzleNumber`
- `fuelFamily`
- `productLabel`
- `liters`
- `amountBaht`
- `pricePerLiter`
- `paymentType`
- `billNo`
- `recordedByRef`
- `rawJson`
- `sourceUpdatedAt`
- `isVoided`
- `isDeleted`
- `syncedAt`

constraint ที่ต้องมี:

- unique `(sourceId, externalTxId)`

## Validation Checklist ก่อนเปิดใช้

ต้องผ่านครบ:

1. historical day 1 วัน
   - external liters
   - external amount
   - merged diesel liters
   - merged diesel revenue
   - report output ตรงกับที่คาด
2. stale-source day 1 วัน
   - status route ฟ้อง stale
   - dashboard/report ไม่แสดงยอดเก่าเหมือนเป็นข้อมูลสด
3. resumed-source day 1 วัน
   - sync ต่อจากของเดิมได้
   - ไม่ duplicate
   - source timestamps อัปเดตถูก
4. Watchara reconciliation day 1 วัน
   - ไม่มี false anomaly จากการรวมยอดไม่ครบชั้น

## Push / Deploy Rule

สำหรับงานนี้ ให้ใช้กฎนี้:

- ยังไม่ push ในรอบ documentation/planning
- push ได้เมื่อ Wave 1-2 เสร็จและทดสอบผ่านใน local/staging
- deploy production เมื่อ Wave 4 ผ่านด้วย เพราะถ้า report กับ anomaly ใช้คนละ logic จะเสี่ยงมาก

## Recommended Next Execution Step

หลังจากสถานะปัจจุบันของ repo นี้ ถ้าจะเดินต่อแบบปลอดภัยที่สุด ให้ทำต่อจากนี้:

1. patch `src/app/api/reports/route.ts`
2. patch `src/app/api/dashboard/executive/route.ts`
3. align `daily-anomaly-detection`, `shift-reconciliation`, `shift-service`
4. validate รายวันว่ารายงาน merged ตรงกับ external raw totals และไม่เกิด false anomaly
5. ค่อยพิจารณา push/deploy

## Current Implementation Status

Wave 1, Wave 2, Wave 3 และ Wave 4 core services ถูกลงใน code แล้ว ณ วันที่ 2026-04-18:

- เพิ่ม Prisma models:
  - `external_sales_sources`
  - `external_dispenser_transactions`
- เพิ่ม utilities:
  - `src/lib/watchara-dispenser-utils.ts`
  - `src/lib/watchara-dispenser-client.ts`
  - `src/lib/watchara-dispenser-sync.ts`
  - `src/lib/operational-sales.ts`
- เพิ่ม admin APIs:
  - `GET /api/admin/watchara-dispenser/status`
  - `POST /api/admin/watchara-dispenser/bootstrap`
  - `POST /api/admin/watchara-dispenser/sync`
- เพิ่ม admin UI:
  - `/admin/watchara-dispenser`
  - มีเมนูใน Sidebar กลุ่ม `Integrations`
- เพิ่ม status banner ฝั่ง UI:
  - `src/components/WatcharaExternalStatusBanner.tsx`
- patch simple admin reporting:
  - `src/app/api/v2/simple/admin/overview/route.ts`
  - `src/app/api/v2/simple/admin/analytics/route.ts`
  - `src/app/api/v2/simple/admin/stations/route.ts`
  - `src/app/api/v2/simple/admin/fuel-time/route.ts`
  - `src/app/admin/simple/page.tsx`
  - `src/app/admin/simple/analytics/page.tsx`
  - `src/app/admin/simple/stations/page.tsx`
  - `src/app/admin/simple/fuel-time/page.tsx`
- รองรับ `dryRun` สำหรับ sync
- มี stale-source calculation
- มี graceful message ถ้าตาราง DB ยังไม่ถูกสร้าง
- route ที่ patch แล้วจะ merge external sales เฉพาะ `station-2`
- response ของทั้ง 4 route มี field additive `watcharaExternal` สำหรับ debug/warning
- patch global reporting:
  - `src/app/api/reports/route.ts`
  - `src/app/api/dashboard/executive/route.ts`
  - `src/app/api/export/csv/route.ts`
- executive route/page ใช้หลักการ:
  - ไม่ทับ KPI ที่อิง shift/meter/reconciliation เดิม
  - เพิ่ม `operational_sales` และ `watcharaExternal` แบบ additive
  - merge payment summary จาก external ได้เพราะ payment types map ตรงกับระบบ
- patch validation/reconciliation core:
  - `src/services/daily-anomaly-detection.ts`
  - `src/services/shift-reconciliation.ts`
  - `src/services/shift-service.ts`
- validation layer จะเติม synthetic external contribution เข้า meter/expected side ด้วย
  - anomaly: บวก external liters ทั้งฝั่ง meterTotal และ transTotal
  - reconciliation: บวก external revenue เข้า expectedFuelAmount และ payment buckets

สิ่งที่ทำเสร็จแล้วบน local project database:

1. รัน `prisma db push` สำเร็จ
2. bootstrap source registry `watchara_shared_dispenser` สำเร็จ
3. ใส่ `WATCHARA_DISPENSER_DATABASE_URL` ใน `.env.local` สำเร็จแล้วสำหรับ local environment
4. probe external database สำเร็จแล้ว
5. ยืนยัน external source state:
   - total rows = `4954`
   - source transaction date range = `2025-12-03` ถึง `2026-03-14`
   - latest source row update = `2026-03-23T07:12:43.882Z`
6. historical backfill เข้า local landing tables สำเร็จแล้ว
   - `2025-12-01` ถึง `2025-12-31`: created `1235`
   - `2026-01-01` ถึง `2026-01-31`: created `1867`
   - `2026-02-01` ถึง `2026-02-28`: created `1596`
   - `2026-03-01` ถึง `2026-03-31`: created `252`, updated `4`
   - backfill summary: fetched `4954`, created `4950`, updated `4`
   - local imported rows หลัง backfill = `4954`
   - distinct `externalTxId` ใน local = `4954`
   - source sync status:
     - `lastSyncedAt = 2026-04-18T11:27:20.384Z`
     - `lastSeenSourceAt = 2026-03-14T11:01:05.000Z`
     - `lastError = null`
7. smoke test helper merge กับฐานจริงผ่านแล้ว
   - range ที่ทดสอบ: `2026-03-01` ถึง `2026-04-18`
   - merged rows = `579`
   - external rows in range = `214`
   - external liters in range = `91738.239`
   - external revenue in range = `2872279.0697`
8. smoke test global reporting / executive / export ผ่านแล้ว
   - `/api/reports?type=daily&startDate=2026-03-01&endDate=2026-03-14`
     - `watcharaExternal.rowsInRange = 214`
   - `/api/dashboard/executive?date=2026-03-13`
     - `operational_sales.external_amount_total = 19741.75`
     - `operational_sales.external_liters_total = 564.05`
   - `/api/export/csv?type=daily&startDate=2026-03-13&endDate=2026-03-13`
     - export date now uses business day key to stay aligned with report totals
9. smoke test Wave 4 reconciliation ผ่านแล้วบน `station-2` วันที่ `2026-03-13`
   - both `shift-service.calculateReconciliation()` and `shift-reconciliation.calculateForShift()`
   - returned `variance = 0`, `varianceStatus = GREEN`

ข้อสังเกตสำคัญของ Wave 2:

- source ภายนอก stale เพราะ latest sold transaction อยู่ที่ `2026-03-14`
- หน้า overview เดือน/วันนี้ ณ วันที่ `2026-04-18` จะยังไม่เห็นยอด external เพิ่ม เพราะ range ปัจจุบันไม่ครอบช่วงที่ source มีข้อมูล
- หน้า analytics จะเริ่มเห็นผลในช่วง compare กับเดือนมีนาคม
- หน้า stations/fuel-time จะเห็นผลเมื่อเลือก range ที่ครอบข้อมูลเก่า เช่น `90` วัน
- `topCustomers` ใน analytics ยังอิง internal POS only เพราะ external source ไม่มี owner/customer data
- source ต้องตีความตาม `businessDate` ไม่ใช่ `soldAt`
  - latest sold transaction = `2026-03-14`
  - latest businessDate in local landing = `2026-03-13`
  - executive/report/export รอบนี้ถูกปรับให้ยึด business day เดียวกันแล้ว

ก่อนใช้งานจริงใน production/staging environment อื่น ยังต้องทำอีก 2 อย่างสำคัญ:

1. ใส่ `WATCHARA_DISPENSER_DATABASE_URL` ใน environment นั้นด้วย
2. ผ่าน validation checklist รายวันก่อน push/deploy production ถึงแม้ code merge/reporting/reconciliation จะลงแล้ว

ถ้าต้องการเตรียม source registry ฝั่ง local ก่อน สามารถเรียก:

- `POST /api/admin/watchara-dispenser/bootstrap`

ตอนนี้สามารถใช้งานผ่านหน้า admin ได้เลยที่:

- `/admin/watchara-dispenser`

เอกสาร handoff สำหรับ AI/engineer คนถัดไป:

- `docs/WATCHARA_SHARED_DISPENSER_AI_HANDOFF.md`
