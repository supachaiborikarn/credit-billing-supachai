<!-- SUMMARY: Integration สำหรับ Watchara shared dispenser ควรเก็บ raw data แยกจาก transactions,
     map เข้า local station `station-2`, normalize Bangkok business date,
     และต้อง patch หลาย route/service ที่ query prisma.transaction ตรง ไม่ใช่แค่ executive/gov-report/analytics -->

# Watchara Shared Dispenser

## Overview
แผน integration สำหรับ source ภายนอกของ Watchara ที่ขายดีเซลนอก POS หลัก แต่ใช้ inventory เดียวกับสถานี Watchara ในระบบนี้

## Confirmed Mapping
- External source station: `station-1` (`Watchara shared dispenser`)
- Local FuelStation target: `station-2` (`วัชรเกียรติออยล์`)
- Phase 1 scope: merge ระดับ `Watchara diesel total` เท่านั้น
- ยังไม่ split `T6` / `T8`
- Treat เป็น one all-day synthetic shift ได้ในช่วงแรก

## Recommended Design
- เก็บ raw external transactions ใน table แยก
- อย่าเขียนทับหรือปนกับ `transactions` ตรงๆ
- เก็บ `raw_json`, source timestamps, void/delete flags เพื่อ audit และ re-sync
- Normalize `business_date` เป็น Bangkok date ให้ชัดเจน เพราะ external source anchor วันที่แปลก

## Source Caveats
- `shiftId` ใน external transactions เป็น null
- `dispensers` / `nozzles` ของ source ยังว่าง
- `productType` ขาดหายหลายรายการ
- latest sold transaction ใน source อยู่ที่ `2026-03-14`
- latest source row update อยู่ที่ `2026-03-23T07:12:43.882Z`
- `daily_records.date` ของ source anchor ที่วันก่อนหน้า `17:00`

## Repo Integration Notes
- โปรเจกต์นี้ใช้ station ids แบบ string (`station-1`, `station-2`, ...)
- Watchara local target ใน repo ปัจจุบันคือ `station-2`
- Dashboard/report/analytics หลายจุด query `prisma.transaction` ตรง
- ถ้าจะ merge external sales ผ่าน aggregated layer ต้อง patch ทุก consumer ที่ใช้ยอดขาย ไม่ใช่เฉพาะ 2-3 ไฟล์ในเอกสาร
- Reconciliation/anomaly logic ปัจจุบันก็ใช้ `transactions` ตรง จึงจะเพี้ยนทันทีถ้ารวมยอดใน report ก่อนแต่ยังไม่รวมใน validation layer

## First-Pass Review Outcome
- แนวคิดแยก raw table ออกจาก transaction หลักถือว่าถูกทาง
- Handoff doc ใช้ได้ค่อนข้างดีสำหรับคุยกับ owner ของ external program
- Integration plan ยังอ้าง file/route ที่ไม่มีใน codebase จริงหลายจุด
- ก่อน implement ควร rewrite plan ให้ยึด repo จริงเป็นหลัก โดย enumerate touchpoints จาก codebase นี้

## Implementation Status
- Wave 1 scaffolding ถูก implement แล้วใน repo
- เพิ่ม Prisma models สำหรับ `external_sales_sources` และ `external_dispenser_transactions`
- เพิ่ม files:
  - `src/lib/watchara-dispenser-utils.ts`
  - `src/lib/watchara-dispenser-client.ts`
  - `src/lib/watchara-dispenser-sync.ts`
  - `src/lib/operational-sales.ts`
  - `src/app/api/admin/watchara-dispenser/status/route.ts`
  - `src/app/api/admin/watchara-dispenser/sync/route.ts`
  - `src/app/api/admin/watchara-dispenser/bootstrap/route.ts`
  - `src/app/admin/watchara-dispenser/page.tsx`
- Sync endpoint รองรับ `dryRun`
- Status endpoint รายงาน env/schema readiness และ stale state ได้
- เพิ่ม `bootstrap` endpoint สำหรับสร้าง source registry ฝั่ง local
- มีหน้า admin ใช้งานจริงที่ `/admin/watchara-dispenser` และมีเมนูใน Sidebar
- รัน `prisma db push` สำเร็จกับ local project database แล้ว
- bootstrap source `watchara_shared_dispenser` สำเร็จแล้วใน DB
- ใส่ `WATCHARA_DISPENSER_DATABASE_URL` ใน local `.env.local` แล้ว
- probe external database สำเร็จ และยืนยัน source state:
  - total rows = `4954`
  - source transaction date range = `2025-12-03` ถึง `2026-03-14`
  - latest source row update = `2026-03-23T07:12:43.882Z`
- historical backfill ถูกเริ่มแล้ว โดย:
  - `2025-12-01` ถึง `2025-12-31`: created `1235`
  - `2026-01-01` ถึง `2026-01-31`: created `1867`
- historical backfill เสร็จแล้ว โดย:
  - `2026-02-01` ถึง `2026-02-28`: created `1596`
  - `2026-03-01` ถึง `2026-03-31`: created `252`, updated `4`
  - backfill summary: fetched `4954`, created `4950`, updated `4`
- สถานะล่าสุดใน local DB หลัง backfill:
  - `external_sales_sources = 1`
  - `external_dispenser_transactions = 4954`
  - distinct `externalTxId = 4954`
  - `lastSyncedAt = 2026-04-18T11:27:20.384Z`
  - `lastSeenSourceAt = 2026-03-14T11:01:05.000Z`
  - `lastError = null`
- Wave 2 สำหรับ simple admin ถูก implement แล้ว:
  - patch `overview`, `analytics`, `stations`, `fuel-time` routes ฝั่ง `src/app/api/v2/simple/admin/*`
  - patch หน้า `src/app/admin/simple/*`
  - เพิ่ม `src/components/WatcharaExternalStatusBanner.tsx`
  - route ที่ patch แล้วคืน field additive `watcharaExternal`
  - merge จำกัดเฉพาะ `station-2`
- smoke test helper merge กับ DB จริงผ่านแล้วสำหรับ range `2026-03-01` ถึง `2026-04-18`
  - merged rows = `579`
  - external rows in range = `214`
  - external liters in range = `91738.239`
  - external revenue in range = `2872279.0697`
- จุดที่ยังไม่ทำ:
  - user validation / rollout signoff
- Wave 3 ถูก implement แล้ว:
  - patch `src/app/api/reports/route.ts`
  - patch `src/app/reports/page.tsx`
  - patch `src/app/api/dashboard/executive/route.ts`
  - patch `src/app/dashboard/executive/page.tsx`
  - patch `src/app/api/export/csv/route.ts`
  - global sales reports ใช้ merged helper แล้ว
  - executive ใช้ additive `operational_sales` + `watcharaExternal`
- Wave 4 core services ถูก implement แล้ว:
  - patch `daily-anomaly-detection`, `shift-reconciliation`, `shift-service`
  - ใช้ synthetic external contribution ฝั่ง meter/expected ด้วย ไม่ใช่บวกแค่ received/transactions
  - smoke test `station-2` วันที่ `2026-03-13` แล้วได้ `variance = 0` / `GREEN`
- rollout caveats หลัง Wave 4:
  - ยังไม่ได้ push/deploy
  - production/staging ต้องตั้ง `WATCHARA_DISPENSER_DATABASE_URL` เอง ห้าม commit credential
  - persisted `shift_reconciliations` เก่าที่บันทึกก่อน patch นี้ยังไม่ได้ถูก recalculate/backfill อัตโนมัติ
  - ต้อง validate ตัวเลขกับ owner/team ก่อนเปิดใช้จริง เพราะ source ปัจจุบัน stale
- push-hardening ก่อน push รอบนี้:
  - เพิ่ม `src/app/admin/layout.tsx` เพื่อ guard `/admin` ด้วย ADMIN session
  - เพิ่ม `src/lib/api-auth.ts`
  - ล็อก high-risk APIs: users/settings/admin maintenance, station transaction create/edit/void, gas v2 sell/open/close, upload, billing collection destructive/verification
  - LINE webhook fail-closed ถ้าไม่มี secret
  - transaction edit/void audit log อยู่ใน DB transaction เดียวกับ data change
- final legacy write API auth sweep ก่อน push:
  - ล็อก gas-station/simple-station/station write APIs ด้วย station access guard
  - ล็อก invoice/payment/product/price-book/dispenser/nozzle/admin data-entry ตาม session/admin guard ที่เหมาะสม
  - เพิ่ม cross-station resource checks ให้ shift/inventory/dispenser/nozzle mutations
  - quick scan ล่าสุดได้ `NO_UNGUARDED_WRITE_ROUTES`
- business-day note:
  - latest sold transaction = `2026-03-14`
  - latest businessDate in local landing = `2026-03-13`
  - export/report/executive รอบนี้ยึด business day ให้ตรงกันแล้ว

## Changelog
- 2026-04-18: เพิ่ม topic นี้จากการรีวิวเอกสาร handoff/integration plan ของ Watchara shared dispenser
- 2026-04-18: เพิ่มเอกสาร `docs/WATCHARA_SHARED_DISPENSER_SAFE_ROLLOUT.md` และตัดสินใจใช้ safe rollout ก่อนแตะ production
- 2026-04-18: implement Wave 1 scaffolding สำหรับ schema/client/sync/status ของ Watchara shared dispenser
- 2026-04-18: รัน `prisma db push`, bootstrap source registry, และยืนยัน local landing tables บน DB จริง
- 2026-04-18: เพิ่มหน้า admin `/admin/watchara-dispenser` เพื่อใช้งาน status/bootstrap/probe/dry-run sync
- 2026-04-18: ยืนยัน `WATCHARA_DISPENSER_DATABASE_URL` ใช้งานได้จริง, probe external DB ผ่าน, และเริ่ม historical backfill แล้ว
- 2026-04-18: historical backfill เสร็จครบ `4954` rows และ local landing count ตรงกับ source โดยไม่มี duplicate
- 2026-04-18: Wave 2 merge สำหรับ simple admin ถูก implement แล้ว พร้อม banner เตือน stale source และ helper กลาง `operational-sales.ts`
- 2026-04-18: Wave 3 global reporting / executive / export alignment ถูก implement แล้ว
- 2026-04-18: Wave 4 core reconciliation/anomaly alignment ถูก implement แล้ว และ smoke test ผ่านบน `station-2` วันที่ `2026-03-13`
- 2026-04-18: เพิ่ม caveat เรื่อง env production/staging, source stale, และ persisted reconciliation records ที่ยังไม่ถูก backfill
- 2026-04-18: เพิ่ม push-hardening รอบแรกเพื่อให้ชุด Watchara/reports/reconciliation พร้อม push ได้ปลอดภัยขึ้น
- 2026-04-18: เพิ่ม final legacy write API auth sweep และยืนยัน scan ไม่พบ write route ที่ไม่มี guard ชัดเจน
