# 📝 Brain Changelog

บันทึกทุกการเปลี่ยนแปลงของ brain

## 2026-02-24
- 🆕 สร้างระบบ brain เริ่มต้น
  - สร้าง `index.md` (สารบัญหลัก)
  - สร้าง 6 topics: billing-system, database, deployment, station-types, bugs-and-fixes, attendance
  - สร้าง `changelog.md` (ไฟล์นี้)
  - สร้าง `sync.sh` (git auto-sync script)
  - สร้าง workflow `.agent/workflows/brain-system.md`

## 2026-04-18
- 🆕 เพิ่ม topic `watchara-shared-dispenser.md`
  - สรุป mapping ของ external Watchara dispenser → local `station-2`
  - บันทึกข้อควรระวังเรื่อง business date, stale source, และ missing source metadata
  - บันทึกว่าระบบจริงมีหลาย route/service ที่ query `prisma.transaction` ตรง ต้อง patch ให้ครบก่อน merge external sales
- 📝 เพิ่ม decision `2026-04-18-watchara-shared-dispenser-safe-rollout.md`
  - ตกลงใช้ rollout แบบเก็บ raw แยก ไม่ปน `transactions`
  - ต้อง align reporting กับ anomaly/reconciliation ก่อนเปิดใช้ production
- 📝 เพิ่มเอกสาร `docs/WATCHARA_SHARED_DISPENSER_SAFE_ROLLOUT.md`
  - ระบุ rollout ตามไฟล์จริงใน repo
  - ระบุเงื่อนไขก่อน push/deploy อย่างปลอดภัย
- 🛠️ เพิ่ม Wave 1 scaffolding ใน code สำหรับ Watchara shared dispenser
  - เพิ่ม Prisma schema สำหรับ raw external sales landing
  - เพิ่ม client/sync/status libraries และ admin APIs
  - เพิ่ม helper tests และผ่าน `prisma generate`, `vitest`, `tsc`
- 🗄️ อัปเดตฐานข้อมูลจริงสำหรับ Watchara shared dispenser
  - รัน `prisma db push` สำเร็จ
  - bootstrap source registry `watchara_shared_dispenser`
  - ยืนยันสถานะล่าสุด: source 1 รายการ, imported transactions 0 รายการ
- 🖥️ เพิ่มหน้า admin สำหรับ Watchara shared dispenser
  - route `/admin/watchara-dispenser`
  - ใช้ดู status, bootstrap, probe external, dry-run sync, และ import จริง
- 🔌 ยืนยัน external connection ของ Watchara shared dispenser ใช้งานได้แล้ว
  - ใส่ `WATCHARA_DISPENSER_DATABASE_URL` ใน local environment
  - probe external DB ผ่าน
  - ยืนยัน source state: 4954 rows, ข้อมูลขายถึง 2026-03-14, latest row update 2026-03-23
  - เริ่ม historical backfill เข้า local landing tables แล้ว
- ✅ ปิด historical backfill ของ Watchara shared dispenser สำเร็จ
  - import local landing rows ครบ `4954`
  - distinct external transaction ids ตรงกับ source `4954`
  - source registry ไม่มี `lastError`
- 📊 เพิ่ม Wave 2 merge สำหรับ Watchara shared dispenser ใน simple admin
  - เพิ่ม helper กลาง `src/lib/operational-sales.ts`
  - patch API routes: overview, analytics, stations, fuel-time
  - patch UI pages และเพิ่ม banner เตือน stale source
  - ยืนยัน smoke test merge กับ DB จริงผ่าน
- 🧾 เพิ่มเอกสาร handoff `docs/WATCHARA_SHARED_DISPENSER_AI_HANDOFF.md`
  - สรุปสิ่งที่ทำแล้ว, file touchpoints, smoke result, และงานค้างสำหรับ AI/engineer คนถัดไป
- 🌐 เพิ่ม Wave 3 สำหรับ Watchara shared dispenser ใน global reporting
  - patch reports route/page
  - patch executive route/page แบบ additive
  - patch CSV export ให้ใช้ merged dataset และ business day เดียวกับ report
- 🧮 เพิ่ม Wave 4 core service alignment
  - patch daily anomaly, shift reconciliation, และ shift service
  - เติม synthetic external contribution เข้า expected/meter side
  - smoke test วันที่ `2026-03-13` แล้ว variance กลับมา `GREEN`
- 📝 อัปเดตเอกสาร handoff/safe rollout หลัง Wave 4
  - ระบุว่ายังไม่ได้ push/deploy
  - ระบุ production/staging env ต้องตั้งเองและห้าม commit credential
  - ระบุ persisted `shift_reconciliations` เก่ายังไม่ได้ backfill/recalculate อัตโนมัติ
- 🔎 บันทึกผล audit code รอบ production-readiness
  - priority หลักคือ API auth/access-control gap เพราะ middleware exclude `/api` และไม่ protect `/admin`
  - บันทึก gotchas เรื่อง audit log atomicity และ variance sign convention
- 🔐 Implement push-hardening รอบแรกก่อน push ชุด Watchara
  - เพิ่ม `/admin` server-side admin guard และ helper `src/lib/api-auth.ts`
  - ล็อก high-risk APIs สำหรับ users/settings/admin maintenance/station transactions/gas v2/upload/billing collection
  - LINE webhook fail-closed และ transaction edit/void audit เป็น atomic
- 🔒 ปิด final legacy write API auth sweep ก่อน push
  - ล็อก gas-station/simple-station/station write APIs ด้วย station access
  - ล็อก invoice/payment/product/price-book/dispenser/nozzle/admin data-entry ด้วย session/admin guard
  - เพิ่ม resource ownership checks สำหรับ shift/inventory/dispenser/nozzle
  - quick scan ล่าสุดรายงาน `NO_UNGUARDED_WRITE_ROUTES`
- 🛢️ แก้ logic แท๊งลอยวัชรเกียรติ (`station-1`) ให้สอดคล้องระดับกะ
  - ผูก transaction ของ FULL station เข้ากะที่เปิดอยู่ (`shiftId`) ทั้ง single และ bulk create
  - เพิ่ม helper กลางสำหรับดึง transaction ระดับกะ และให้ reconciliation/anomaly ใช้ source เดียวกัน
  - แก้หน้า/route `shift-end` ให้ใช้ transactions เฉพาะกะ, meters พร้อม `shiftId`, และรวมเงินเชื่ออัตโนมัติ
  - เปลี่ยน anomaly preview ให้เช็กค่ามิเตอร์ที่พนักงานเพิ่งกรอก ไม่ใช่ข้อมูลเก่าใน DB
  - เปลี่ยน flow หากะค้างของหน้าใหม่ให้ใช้ `shift-status` แทน admin endpoint และแก้ `shift history` ให้ normalize station/date/auth ถูกต้อง

## 2026-04-19
- 🖨️ เพิ่มการพิมพ์รายงานสรุปทั้งวันหลังปิดกะสำหรับแท๊งลอยวัชรเกียรติ
  - เพิ่ม helper `src/lib/daily-report-print.ts` สำหรับพิมพ์ daily work report
  - patch `src/app/api/station/[id]/daily/route.ts` ให้คืน `fuelType` เพื่อใช้ในรายงาน
  - patch หน้า `simple-station/[id]/new/shift-end` และ `station/[id]/new/shift-end` ให้แสดง success modal หลังปิดกะ พร้อมปุ่ม `พิมพ์รายงานทั้งวัน`
  - ใช้ station-wide `/api/station/[id]/daily?date=...` สำหรับแท๊งลอยเพื่อไม่ให้รายงานโดนกรองเหลือเฉพาะรายการของ staff คนเดียว
- 🔗 แก้จุด disconnect ระหว่าง UI ใหม่กับ UI เก่าของแท๊งลอยเรื่องราคาน้ำมันประจำวัน
  - เพิ่ม helper `src/lib/full-station-price-utils.ts`
  - patch `simple-station/[id]/new/open-shift`, `home`, และ `sell` ให้ใช้ `/api/station/[id]/daily`
  - เปลี่ยนฟอร์มราคาของหน้าใหม่ให้ตรงกับ model จริงของ FULL station: `retailPrice` / `wholesalePrice`
  - ยกเลิกการพึ่ง `localStorage fuelPrices_*` และ route `/api/station/[id]/fuel-prices` ที่ไม่มีจริงใน flow หลักของแท๊งลอย
- 🧾 แก้จุด disconnect ระหว่าง UI ใหม่กับ UI เก่าของแท๊งลอยเรื่อง transaction/receipt/slip flow
  - patch `api/station/[id]/transactions` ให้ FULL station list เป็น station-wide, คืน alias `createdAt`/`bookNo`, และคืน `transferProofUrl`
  - patch `api/station/[id]/transactions/[transactionId]` ให้ single GET/PUT รองรับ alias ของหน้าใหม่ (`bookNo`/`billBookNo`)
  - patch `simple-station/[id]/new/summary` ให้แก้ไขรายการด้วย field ถูกชุด, แนบ/ดูสลิปผ่าน `/api/upload/transfer-proof`, และพิมพ์ receipt ได้กับ credit-like payment types
  - patch `simple-station/[id]/new/sell` และ `summary` ให้แสดงทุก `PAYMENT_TYPES` แบบเดียวกับหน้าเก่า

## 2026-04-21
- 🔎 บันทึกผล audit เรื่องการรวมบิลกับระบบภายนอก
  - อัปเดต `billing-system.md` ว่าใบวางบิลรวมและ invoice ยึด `ownerId` เป็นหลัก ไม่ได้ยึด `ownerName`
  - บันทึกว่า legacy write routes บางตัว resolve ลูกค้าจาก `ownerName` แบบ `contains`, ขณะที่ GAS v2 route ใหม่บังคับ `ownerId`
  - บันทึกผล live DB audit: CREDIT/BOX_TRUCK ที่มี `ownerName` แต่ไม่มี `ownerId` จำนวน `35/7066` รายการ, active owner name ซ้ำ exact `241` กลุ่ม, active owner code ซ้ำ exact `237` กลุ่ม, และ `venderCode` ของ active owner ยังว่างทั้งหมด
  - สรุปว่าถ้าจะเชื่อม FuelStation หรือ external billing source ต้องมี stable customer mapping/key ใหม่ก่อน ไม่ควรรวมบิลจากชื่อ display หรือ customer code ปัจจุบันอย่างเดียว

## 2026-04-23
- 🔎 บันทึกผล audit ปั๊มแก๊สทั้ง 2 สาขา
  - พบ UI/API ซ้อนกันระหว่าง `/gas-station/[id]/new` + legacy API กับ `/gas/[stationId]` + `/api/v2/gas`
  - พบ `/gas/[stationId]/gauge` เรียก `/api/v2/gas/[stationId]/gauge` แต่ไม่มี route ทำให้บันทึกเกจปิดกะไม่ได้
  - พบ GAS v2/legacy gaps: meters route ไม่มี station guard, close shift ไม่ verify station ownership, v2 sell ไม่ผูก `shiftId`, payment type `CARD` ไม่ตรง enum `CREDIT_CARD`, และ read/admin gas routes หลายตัวไม่มี auth guard
  - ตรวจ DB จริงแบบ read-only: `station-5` มีกะ `OPEN` ค้าง 57 กะ, `station-6` ค้าง 13 กะ, และ station-5 config `hasProducts` ไม่ตรงกับ DB (`false`)
- 🛠️ Implement GAS hardening ตาม audit
  - เพิ่ม `/api/v2/gas/[stationId]/gauge`, helper guard กลาง `requireGasStationAccess`, station ownership checks ใน v2 meters/current/summary/close และ legacy shift/transaction/snapshot routes
  - แก้ v2 sell/summary ให้ผูก `shiftId`, normalize `CARD -> CREDIT_CARD`, รองรับ `TRANSFER`, เก็บ `billBookNo`/`billNo`/`notes`, และ aggregate ครบทุก payment bucket
  - เพิ่ม auth ให้ GAS v2 admin reports/settings และ legacy read routes ที่ audit เจอ
  - จำกัดสินค้าเสริมเฉพาะ `station-5`, sync DB แล้วให้ `station-5.hasProducts=true` และ `station-6.hasProducts=false`
  - เพิ่ม `/api/admin/gas/stale-shifts` สำหรับ preview/close กะค้างแบบมี confirmation + audit log และเพิ่ม tests สำหรับ payment/stale shift rules
- ✅ ปิดกะ GAS ค้างใน DB จริงเพื่อเริ่มใหม่วันนี้
  - ปิด `OPEN` shifts ครบ 70 กะ (`station-5` 57, `station-6` 13) และตรวจซ้ำแล้ว `remainingOpen=0`
  - เติม end meter ที่ว่าง 16 จุดเป็นค่า start เดิม, ปิด daily records ที่ไม่มี open shift เหลือ 67 records, และสร้าง audit log ครบ 70 รายการ
- 🧾 บันทึก post-hardening review ของ GAS v2
  - พบว่า `/gas/[stationId]/sell` ยังใช้ global gas settings เป็นราคาขาย ขณะที่ summary/reconciliation ยึด `dailyRecord.gasPrice` และ route เปิดกะ seed วันใหม่ด้วย `16.09` แบบ hard-coded
  - ระบุว่า `/api/v2/gas/[stationId]/shift/open` ยังไม่ atomic: create dailyRecord/shift/meters/gauges แยกหลาย query และ validate ค่า meter/gauge ฝั่ง server ยังไม่พอ
  - ระบุว่า v2 meters/gauge ยังแก้ start baseline ย้อนหลังได้ ซึ่งเสี่ยงทำให้ expected liters และ reconciliation เปลี่ยนย้อนหลัง
  - บันทึกว่า tests ปัจจุบันยังครอบเฉพาะ helper/mocks และควรเพิ่ม route-level coverage ก่อนขยาย feature GAS v2 รอบถัดไป
- ✅ ปิด follow-up หลักของ GAS v2 core flow
  - เพิ่ม helper กลาง `src/lib/gas/v2-workflow.ts` สำหรับ price fallback, exact payload validation ของ meter/gauge, และ baseline lock rules
  - patch `api/v2/gas/[stationId]/sell` ให้คำนวณ `pricePerLiter`/`amount` จาก `dailyRecord.gasPrice` ฝั่ง server, patch `summary` และ `shift/close` ให้ใช้ fallback เดียวกัน, และให้หน้า `/gas/[stationId]/sell` อ่านราคาจาก summary แทน global settings
  - patch `api/v2/gas/[stationId]/shift/open` ให้ใช้ `prisma.$transaction`, seed `dailyRecord.gasPrice` จากค่า default จริงของ station/settings, และ validate meter/gauge ให้ครบทุกหัวจ่าย/ทุกถัง
  - patch `api/v2/gas/[stationId]/meters`, `gauge`, และ `shift/current` ให้บล็อก start baseline edit หลังมี sale/end/reconciliation แล้ว พร้อมทำให้หน้า `/gas/[stationId]/meters` และ `/gauge` แสดงสถานะล็อกตรงกับ backend
  - เพิ่ม tests `tests/gas-v2-routes.test.ts` และขยาย `gas-station-hardening.test.ts` เพื่อครอบ price source, atomic open, payload validation, และ baseline immutability
- 📊 ขยาย GAS admin analytics/reporting ให้ใช้ source เดียวกัน
  - เพิ่ม `src/lib/gas/admin-analytics.ts` สำหรับรวม shift/day facts, map transaction เข้ากะ, normalize station aliases, และ parse/build `cardReceived` ใน `varianceNote`
  - patch `api/v2/gas/admin/reports/daily`, `reports/shift`, `reconciliation`, `executive` ให้ใช้ fact layer เดียวกันแทนการคำนวณแยก route ต่อ route
  - เพิ่ม `PUT /api/v2/gas/admin/reconciliation/[shiftId]` ให้หน้า shift report แก้ยอด received ได้จริง พร้อมเก็บ `cardReceived` อย่างสอดคล้องกับ schema ปัจจุบัน
  - อัปเดตหน้า admin daily/shift/reconciliation/executive ให้โชว์ payment mix, received vs sales, avg ticket, liters variance, และ station/day breakdown เพิ่มขึ้น
- 📈 ต่อยอด GAS admin analytics ให้ actionable มากขึ้น
  - เพิ่ม rollup `staff` และ `nozzle` ใน fact layer เพื่อใช้ดู top performer และ throughput ต่อหัวจ่าย
  - ขยาย executive dashboard ให้แสดง inventory runout (`litersRemaining`, `daysToEmpty`), top staff/nozzle, และ action alerts เช่น low stock, repeated variance, sales drop, และ liters drift
  - patch `api/v2/gas/admin/reports/meters` และหน้า meters report ให้ใช้ fact layer เดียวกัน พร้อมแสดง transaction liters, liters variance, actual sales, และ transaction count
  - เพิ่ม tests ใน `tests/gas-admin-analytics.test.ts` เพื่อกัน regression ของ staff/nozzle rollups

## 2026-04-24
- 🔎 ตรวจ live incident ปั๊มแก๊สที่พนักงานพยายามลงข้อมูลแต่ยอดไม่อัปเดต
  - DB จริงมี session ของ `เหน่ง` ที่ `station-6` เวลา 06:16 Bangkok และมี `DailyRecord` วันนี้ 1 แถวกับ `Shift` 2 แถวเวลา 06:17/06:52
  - แต่ยังไม่มี `meterReadings`, `gaugeReadings`, `transactions`, หรือ `auditLogs`; `dailyRecord.gasPrice` เป็น `null`
  - ระบุสาเหตุที่ตรงกับ code: `/gas-station/[id]/new/home` เรียก legacy `/api/gas-station/[id]/shifts` ด้วย `{ action: 'open', shiftNumber }` โดยไม่ส่ง meter/gauge ทำให้ legacy route สร้างกะว่างได้
  - บันทึก follow-up ว่าต้อง repair live rows ของวันนี้และปิดทาง legacy empty open shift ก่อนให้พนักงานใช้งานต่อ
- 🛠️ แก้ GAS legacy/v2 bridge หลังทดสอบบัญชี `เล็ก`
  - พบว่า `station-5` บันทึกมิเตอร์ได้จริงแต่ไปอยู่ duplicate `DailyRecord` ที่ date `2026-04-24T00:00:00Z` และไม่ผูก shift จึงเปิดกลับมาไม่เห็น
  - patch หน้าเก่าให้ปุ่มเปิดกะพาไป v2 open flow, legacy shift route ปฏิเสธ open แบบไม่มี meter, legacy daily/meter/gauge ใช้ Bangkok date range, และ legacy meters save ผูก `shiftId`
  - เพิ่มช่อง “ราคาขายวันนี้” ใน `/gas/[stationId]/shift/open` และให้ v2 open route รับ `gasPrice` เพื่อ seed/update `dailyRecord.gasPrice`
  - ซ่อม DB จริง: ย้าย meter start 4 หัวของ `เล็ก` เข้า shift กะ 2 ที่เปิดอยู่, ตั้ง `gasPrice=16.09`, audit repair, และลบ duplicate daily record ที่ว่างหลังย้ายแล้ว

## 2026-04-25
- 🛠️ เพิ่มให้พนักงานแก้ราคาขายแก๊สประจำวันหลังเปิดกะได้
  - เพิ่ม `PUT /api/v2/gas/[stationId]/price` สำหรับ staff station access โดย update/create `DailyRecord` ของวันนั้นพร้อม audit log
  - เพิ่มการ์ด “ราคาขายแก๊สวันนี้” บน `/gas/[stationId]` และปุ่มแก้ราคาบน `/gas/[stationId]/sell`
  - เพิ่ม route-level test ใน `tests/gas-v2-routes.test.ts` เพื่อกัน price update regression
- 🔎 ตรวจและ patch flow ลงบิล/รับเงินของ GAS
  - ตรวจ DB จริงพบ GAS `CREDIT` 24 รายการยังไม่มี `billBookNo`/`billNo` และ 5 รายการไม่มี `truckId`
  - patch `POST /api/v2/gas/[stationId]/sell` ให้เงินเชื่อต้องมี owner/truck/เล่มที่/เลขที่บิล และ verify truck อยู่ใต้ owner ก่อนบันทึก
  - patch หน้า sell ให้ validate เล่มที่/เลขที่บิลตาม label required จริง
  - patch close-shift route/page ให้ยอดเงินสดรับ เงินเชื่อ บัตร และโอนต้องเป็นตัวเลขไม่ติดลบ
