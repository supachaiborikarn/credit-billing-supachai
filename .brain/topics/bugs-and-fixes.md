<!-- SUMMARY: บันทึก bugs/gotchas ที่เจอ รวมถึงประเด็น audit สำคัญ:
     push-hardening 2026-04-18 ปิด `/admin`, high-risk API, และ legacy write API auth gap ตาม static scan แล้ว;
     รอบเดียวกันยังแก้แท๊งลอยให้ใช้ shift-scoped transactions, anomaly preview จากค่าปัจจุบัน, flow ปิดกะเก่าที่ไม่ต้องพึ่ง admin route,
     เพิ่ม post-close daily report printing ที่ต้องอิง station-wide `/daily` แทน `/transactions`,
     และ fix หน้าใหม่ของแท๊งลอยให้เชื่อมทั้ง daily price, transaction contract, receipt/slip flow กับ backend/source ชุดเดียวกับหน้าเก่า;
     audit ปั๊มแก๊ส 2026-04-23 พบ route/API ซ้อนกันและกะ GAS ค้างจำนวนมาก; hardening รอบเดียวกันเติม v2 gauge route,
     auth/ownership guard, shift-scoped v2 sell/summary, payment type `CREDIT_CARD`, product guard เฉพาะ station-5, admin stale-shift cleanup tool,
     และ follow-up analytics/reporting ให้ GAS admin ใช้ shared shift/day facts ชุดเดียวกันพร้อมเติม payment mix/reconciliation edit flow -->

# Bugs & Fixes

## Overview
บันทึกประวัติ bugs ที่เจอและวิธีแก้ไข เพื่อป้องกันการเกิดซ้ำ

## Resolved Bugs

### 🐛 Billing Sort Order (Feb 2026)
- **ปัญหา**: บิลเรียงผิดเพราะใช้ string comparison → "9" > "10"
- **แก้ไข**: เปลี่ยนเป็น `parseInt()` numeric comparison
- **ไฟล์ที่แก้**: frontend sorting + API query ordering
- **สถานะ**: ✅ แก้แล้ว

### 🐛 Login Failed (Feb 2026)
- **ปัญหา**: login failed ในระบบ
- **สถานะ**: ✅ ตรวจสอบและแก้ไขแล้ว

### 🐛 Shift Filter (Jan 2026)
- **ปัญหา**: มิเตอร์ไม่แยกตามกะ (กะเช้า/กะบ่าย)
- **แก้ไข**: เพิ่ม shift-based meter storage
- **สถานะ**: ✅ แก้แล้ว

### 🐛 Gas Gauge Not Showing (Jan 2026)
- **ปัญหา**: เกจวัดถังแก๊สไม่แสดง
- **สถานะ**: ✅ แก้แล้ว

### 🐛 Fuel Price Sync (Jan 2026)
- **ปัญหา**: ราคาน้ำมันไม่ sync จากหน้า open-shift ไปหน้า sell
- **แก้ไข**: Fuel price sync from open-shift to sell page
- **สถานะ**: ✅ แก้แล้ว

### 🐛 Backfill Data Not Loading (Feb 2026)
- **ปัญหา**: attendance records ที่มีอยู่ใน DB ไม่แสดงในหน้า backfill
- **สถานะ**: ✅ ตรวจสอบและแก้ไขแล้ว

### 🐛 Tank Loy Full Shift Scope Drift (Apr 2026)
- **ปัญหา**: แท๊งลอย (`station-1`) ยังไม่ผูก transaction เข้ากะ (`shiftId`) ทำให้หน้า `shift-end` และ reconciliation บางจุดหยิบรายการ “ทั้งวัน” แทน “กะปัจจุบัน”; anomaly preview ก็เช็กจากมิเตอร์ใน DB ไม่ใช่ค่าที่เพิ่งกรอก และหน้าปิดกะเก่าต้องพึ่ง admin endpoint
- **แก้ไข**: ผูก transaction/bulk transaction ของ FULL station เข้ากะที่เปิดอยู่, ทำ helper กลางสำหรับ shift-scoped transactions, ให้ `shift-end` route คืน meters พร้อม `shiftId` และ transactions เฉพาะกะ, เปลี่ยน anomaly preview ให้ POST ค่ามิเตอร์ล่าสุดเข้าไปเช็ก, รวมเงินเชื่อใน reconciliation อัตโนมัติ, เปลี่ยน flow หากะค้างไปใช้ station route แทน admin route, และเพิ่ม success modal หลังปิดกะที่เรียกพิมพ์ “รายงานสรุปทั้งวัน” ผ่าน `/api/station/[id]/daily` ซึ่งคืน station-wide transactions ของ FULL station
- **ไฟล์ที่แก้**: station transaction APIs, full shift-end APIs/UI, daily route, anomaly service/route, shift services, shift history route
- **สถานะ**: ✅ แก้แล้ว

### 🐛 New vs Old UI Daily Price Drift (Apr 2026)
- **ปัญหา**: หน้าใหม่ของแท๊งลอยบางจุดแยก source ของ “ราคาน้ำมันประจำวัน” ออกจากหน้าเก่า โดย `open-shift`/`home`/`sell` ใช้ `localStorage` และเรียก `/api/station/[id]/fuel-prices` ที่ไม่มี route จริง ขณะที่หน้าเก่าใช้ `dailyRecord.retailPrice/wholesalePrice`
- **แก้ไข**: ให้หน้าใหม่ทั้งหมดของแท๊งลอยโหลดและบันทึกราคาผ่าน `/api/station/[id]/daily` โดยตรง, เปลี่ยนฟอร์มตั้งราคาให้สอดคล้องกับ model จริง (ขายปลีก/เชื่อ + ขายส่ง/สด), และให้หน้าลงบิลใหม่ auto-fill ราคาจาก `dailyRecord` ตาม payment type แบบเดียวกับหน้าเก่า
- **ไฟล์ที่แก้**: `simple-station/[id]/new/open-shift`, `simple-station/[id]/new/home`, `simple-station/[id]/new/sell`, `src/lib/full-station-price-utils.ts`
- **สถานะ**: ✅ แก้แล้ว

### 🐛 New vs Old UI Transaction/Slip Contract Drift (Apr 2026)
- **ปัญหา**: หน้าใหม่ของแท๊งลอยใน `summary`/`receipt`/`sell` ใช้ contract ไม่ตรงกับ route เดิมหลายจุด เช่นคาด `bookNo`/`createdAt` แต่ API คืน `billBookNo`/`date`, ปุ่มแนบรูปเรียก `/api/upload/slip` ที่ไม่มีจริง, route list ไม่คืน `transferProofUrl`, และปุ่มประเภทชำระในหน้าใหม่ไม่แสดงครบทุก type ที่หน้าเก่ารองรับ
- **แก้ไข**: normalize transaction GET/PUT ให้คืน alias ที่หน้าใหม่ใช้ร่วมกับของเก่าได้ (`bookNo`, `billBookNo`, `createdAt`, `date`, `transferProofUrl`), ให้ FULL station transaction list ของแท๊งลอยคืน station-wide rows แบบ daily view, เปลี่ยนหน้า `summary` ให้แนบ/ดูสลิปผ่าน `/api/upload/transfer-proof` + transaction PUT จริง, เปิดพิมพ์ receipt สำหรับ credit-like payment types, และให้หน้า `sell`/`summary` แสดงทุก `PAYMENT_TYPES`
- **ไฟล์ที่แก้**: `api/station/[id]/transactions`, `api/station/[id]/transactions/[transactionId]`, `simple-station/[id]/new/summary`, `simple-station/[id]/new/receipt`, `simple-station/[id]/new/sell`
- **สถานะ**: ✅ แก้แล้ว

## 🔎 Current Findings

### Gas Station Audit (Apr 23, 2026)
- **ปัญหา**: ระบบ GAS มี UI/API ซ้อนกัน 2 ชุด (`/gas-station/[id]/new/*` + legacy `/api/gas-station/[id]/*` และ `/gas/[stationId]/*` + `/api/v2/gas/*`) แต่ยังไม่เทียบ contract ให้จบ ทำให้ admin dashboard ลิงก์เข้า `/gas/[stationId]` ซึ่งมี flow บางส่วนยังใช้งานไม่ได้จริง
- **จุดเสี่ยงหลัก**:
  - `/gas/[stationId]/gauge` เรียก `/api/v2/gas/[stationId]/gauge` แต่ไม่มี route นี้ ทำให้บันทึกเกจปิดกะไม่ได้ และ `/api/v2/gas/[stationId]/shift/close` จะปิดกะไม่ผ่านเพราะหา end gauge ไม่ครบ
  - `/api/v2/gas/[stationId]/meters` มี write route ที่ไม่เรียก `requireStationAccessApi` และไม่ verify ว่า `shiftId` อยู่ใน station ที่ request มา
  - `/api/v2/gas/[stationId]/sell` ไม่ set `shiftId` ตอนสร้าง transaction, ไม่รองรับ `TRANSFER`/`CREDIT_CARD` ทั้งที่ UI แสดง 4 ประเภท, และใช้ payment type `CARD` ที่ไม่ตรงกับ Prisma enum `CREDIT_CARD`
  - `/api/v2/gas/[stationId]/shift/close` รับ `shiftId` แล้วไม่ verify ว่า shift อยู่ใน `station.dbId`; เสี่ยงปิดกะข้ามสาขา
  - route read/admin หลายตัวใน GAS ยังไม่มี auth guard เช่น v2 `info`/`summary`/`shift/current`, v2 admin dashboard/reports/gauge, legacy shift snapshot/monthly-balance/products history
  - legacy `/api/gas-station/[id]/shifts` ยังไม่มี station access guard ใน GET/POST และ action `close` ไม่ใช้ `shiftId` จาก body ทำให้ปิดกะตาม date default แทนกะที่ผู้ใช้เลือก
  - station-5 config ระบุ `hasProducts: true` แต่ DB จริงเป็น `hasProducts=false`; route product บางจุด upsert ด้วย `hasProducts:true` เฉพาะตอน create ไม่ sync row ที่มีอยู่
- **ผล DB audit แบบ read-only**:
  - `station-5` มีกะ `OPEN` ค้าง 57 กะ, เก่าสุดเปิด 2026-01-07, ล่าสุดเปิด 2026-04-23
  - `station-6` มีกะ `OPEN` ค้าง 13 กะ, เก่าสุดเปิด 2026-01-11, ล่าสุดเปิด 2026-02-07
  - 30 วันล่าสุด query หลักไม่พบ transaction/gauge ของทั้ง 2 สาขา ขณะที่มี daily/open shift บางส่วน แปลว่า reporting ปัจจุบันอาจไม่สะท้อนงานหน้าปั๊มจริง
- **แก้ไขรอบ hardening**:
  - เพิ่ม helper `requireGasStationAccess` สำหรับ resolver + station access guard และใช้กับ GAS v2/legacy route ที่ audit เจอ
  - เติม `/api/v2/gas/[stationId]/gauge` สำหรับ GET/POST start/end gauge และผูกกับ `dailyRecordId`/`shiftNumber`
  - ทำ v2 `sell` ให้ normalize `CARD` legacy เป็น `CREDIT_CARD`, รองรับ `TRANSFER`, บันทึก `shiftId`, `billBookNo`, `billNo`, `notes`, และให้ summary/sell aggregate ครบ cash/credit/card/transfer
  - ทำ `meters`, `summary`, `shift/current`, `shift/close` เช็ค station ownership ของ `shiftId`; close shift ตรวจ end gauge จาก `dailyRecordId` แทน today-only
  - เพิ่ม admin auth ให้ v2 GAS admin dashboard/reports/settings และ legacy read routes เช่น snapshot/monthly-balance/products history
  - จำกัดสินค้าเสริมเฉพาะ station-5, sync DB แล้วให้ `station-5.hasProducts=true` และ `station-6.hasProducts=false`, และซ่อนเมนู products ของ station-6
  - เพิ่ม `/api/admin/gas/stale-shifts` สำหรับ preview/force close กะ GAS ค้างแบบ admin-only, ต้อง confirm string, และสร้าง audit log ต่อ shift
  - เพิ่ม tests `gas-station-hardening.test.ts` สำหรับ payment normalization และ stale-shift selection
- **สถานะ**: ✅ hardening หลักแล้ว; 2026-04-23 ปิด GAS `OPEN` shifts ค้างจริงครบ 70 กะ (`station-5` 57, `station-6` 13) ผ่าน Prisma batch พร้อม audit log 70 รายการ เหลือ `remainingOpen=0`

### Gas Station Post-Hardening Follow-ups (Apr 23, 2026)
- **ปัญหา**: หลัง hardening หลัก ยังมี follow-up เชิงความถูกต้อง/ความทนทานของ GAS v2 ที่ไม่ถูกครอบด้วย tests ตอนนี้
- **จุดเสี่ยงหลัก**:
  - หน้า `/gas/[stationId]/sell` ยังอ่านราคาแก๊สจาก global `/api/v2/gas/settings?key=gasPrice` ขณะที่ summary/reconciliation ใช้ `dailyRecord.gasPrice` และ `shift/open` ยัง seed วันใหม่ด้วยค่า hard-coded `16.09`; ถ้าราคาวันจริงไม่เท่าค่า settings จะเกิด price drift ระหว่างยอดขายกับยอดคาดจากมิเตอร์
  - `/api/v2/gas/[stationId]/shift/open` ยัง create `dailyRecord` → `shift` → `meterReadings` → `gaugeReadings` แบบหลาย query แยก ไม่มี transaction กลาง และ validate แค่จำนวน array; ถ้าพังกลางทางจะทิ้งกะเปิดบางส่วนไว้ใน DB
  - `/api/v2/gas/[stationId]/meters` และ `/api/v2/gas/[stationId]/gauge` ยังยอม update start readings/gauges ของกะเดิมได้ แม้เริ่มใช้งานกะไปแล้ว; ถ้ามีคนแก้ baseline หลังมีรายการขาย จะทำให้ reconciliation และ expected liters เปลี่ยนย้อนหลัง
  - tests ปัจจุบันของ GAS ยังครอบแค่ payment helper/stale-shift selection กับ mock expectations; ยังไม่มี route-level/integration tests สำหรับ price source, atomic open shift, หรือ immutability ของ start readings
- **แก้ไขรอบ follow-up**:
  - รวม source of truth ของราคาแก๊สใน GAS v2 ให้ยึด `dailyRecord.gasPrice` เป็นหลัก: หน้า `/gas/[stationId]/sell` อ่านราคาจาก summary ของ station/day, route `sell` คำนวณ `pricePerLiter`/`amount` ฝั่ง server ใหม่จาก `dailyRecord` แทนการเชื่อ client, และ route `summary`/`shift/close` ใช้ fallback เดียวกัน
  - ทำ `shift/open` ให้เป็น atomic ด้วย `prisma.$transaction`, validate meter/gauge ให้ครบและไม่ซ้ำทุกหัวจ่าย/ทุกถัง, และ seed `dailyRecord.gasPrice` จาก station/global default แค่ตอนสร้างวันใหม่หรือเติม record ที่ยังไม่มีราคา
  - ล็อก start meter/gauge ของ GAS v2 เมื่อกะมี transaction แล้ว, มี end data แล้ว, หรือเริ่ม reconciliation แล้ว; route `meters`/`gauge` ยังบังคับเพิ่มว่าแก้ได้เฉพาะกะ `OPEN`
  - เพิ่ม route-level tests สำหรับ v2 `shift/open`, `sell`, `meters`, และ `gauge` เพื่อกัน regression ของ price source, atomic open, และ baseline immutability
- **สถานะ**: ✅ follow-up หลักของ GAS v2 core flow ถูก patch แล้ว; งานใหญ่ที่ยังเหลือคือ route consolidation ระหว่าง `/gas` กับ `/gas-station/[id]/new`

### Gas Admin Analytics Follow-ups (Apr 23, 2026)
- **ปัญหา**: report/admin dashboard ของ GAS ยังใช้ logic แยกกันหลายจุด ทำให้ daily/shift/reconciliation/executive มีสิทธิ์ตัวเลขไม่ตรงกัน, payment mix ยังไม่ครบจริง, หน้า shift report เรียก `PUT /api/v2/gas/admin/reconciliation/[shiftId]` ทั้งที่ไม่มี route, และ date grouping บางจุดยังอิง `toISOString()` เสี่ยงเลื่อนวันเพราะ Bangkok midnight
- **แก้ไขรอบ analytics**:
  - เพิ่ม helper กลาง `src/lib/gas/admin-analytics.ts` สำหรับ map transaction เข้า shift แบบใช้ `shiftId` ก่อนและ fallback ตาม dailyRecord/time window, aggregate facts ต่อกะ/ต่อวัน, normalize station alias, และ parse/build `cardReceived` ที่ถูก encode ใน `varianceNote`
  - เปลี่ยน `api/v2/gas/admin/reports/daily`, `reports/shift`, `reconciliation`, และ `executive` ให้ใช้ facts ชุดเดียวกัน ทำให้ payment mix, transaction count, liters variance, และ expected/received reconciliation มาจาก source เดียว
  - เพิ่ม route `PUT /api/v2/gas/admin/reconciliation/[shiftId]` ให้หน้า shift report แก้ received amounts ได้จริง โดยยังเก็บ `cardReceived` ผ่าน `varianceNote` และ sync `transferReceived` ใน `shift_reconciliations`
  - อัปเดตหน้า admin daily/shift/reconciliation/executive ให้โชว์ analytics เพิ่ม เช่น payment mix, avg ticket, liters variance, station/day breakdown, received-vs-sales comparison, inventory runout estimate, top staff/nozzle performance, และ action alerts
  - เปลี่ยน `api/v2/gas/admin/reports/meters` กับหน้ารายงานมิเตอร์ให้ใช้ fact layer เดียวกัน ทำให้ยอดมิเตอร์/ยอดขายจริง/ลิตรต่างไม่ drift จาก report ตัวอื่น
- **สถานะ**: ✅ analytics/reporting หลักของ GAS admin ถูกผูกกับ service กลางแล้ว; งานต่อไปถ้าจะเพิ่ม inventory intelligence หรือ alerts เพิ่มเติมให้ต่อบน fact layer นี้เท่านั้น

## ⚠️ Known Gotchas
1. **String vs Numeric Sort**: ทุก sort ที่เกี่ยวกับตัวเลข (book, number) ต้องใช้ parseInt
2. **Neon Data Transfer**: free tier จำกัด 5GB/month → ระวัง polling ถี่เกินไป
3. **Context ที่ลืมเรื่อง**: เมื่อไหร่ที่เปลี่ยนการ sort, ต้องเปลี่ยนทั้ง frontend และ backend
4. **API Auth Gap**: push-hardening รอบ 2026-04-18 เพิ่ม `/admin` server guard, `api-auth`, high-risk API guards, และ full legacy write API auth sweep แล้ว; quick scan ล่าสุดรายงาน `NO_UNGUARDED_WRITE_ROUTES`
5. **Audit Log Atomicity**: transaction update/delete บาง route แก้ข้อมูลก่อน create audit log และใช้ fallback `userId = "system"` ซึ่งเสี่ยงข้อมูลถูกแก้แล้ว audit fail
6. **Variance Sign Convention**: `shift-service` ใช้ `expected - received` แต่ `shift-reconciliation`/gas v2 ใช้ `received - expected`; ต้อง normalize ก่อนใช้ label OVER/SHORT
7. **FULL Station Shift Scope**: route/service ที่ทำงานระดับกะของแท๊งลอยต้องใช้ `shiftId` หรือ shift time window เท่านั้น; ห้ามอิง `dailyRecord.transactions` ตรงๆ เพราะจะปนหลายกะทันที
8. **Tank Loy Daily Print Path**: ถ้าต้องการ “รายงานทั้งวัน” ของแท๊งลอยหลังปิดกะ ให้ดึงจาก `/api/station/[id]/daily?date=...` หรือ source ที่เป็น station-wide daily data; ห้ามใช้ `/api/station/[id]/transactions` ตรงๆ เพราะ STAFF route นั้นกรอง `recordedById`
9. **Tank Loy Daily Price Source**: ราคาน้ำมันประจำวันของหน้าใหม่ต้องใช้ `dailyRecord.retailPrice/wholesalePrice` ผ่าน `/api/station/[id]/daily` เท่านั้น; ห้ามเพิ่ม source แยกใน `localStorage` หรือ route เฉพาะอย่าง `/fuel-prices`
10. **Tank Loy Transaction UI Contract**: ถ้าหน้าใหม่ของแท๊งลอยใช้ transaction data จาก station API ให้ preserve alias/shape ที่ UI ใช้ (`billBookNo` + `bookNo`, `date` + `createdAt`, `transferProofUrl`) และการแนบสลิปต้องวิ่งผ่าน `/api/upload/transfer-proof`; ห้ามอ้าง `/api/upload/slip` เพราะไม่มี route จริง
11. **GAS Route Consolidation**: `/gas` v2 มี gauge/auth/shift/payment hardening แล้ว แต่ยังเป็น route stack แยกจาก `/gas-station/[id]/new`; งานต่อไปควรเลือก source of truth ระยะยาวก่อนเพิ่ม feature ใหญ่
12. **GAS Stale Open Shifts**: กะ GAS ค้างเก่าถูกปิดจริงแล้วเมื่อ 2026-04-23 พร้อม audit log; งานต่อไปถ้าเจอกะค้างใหม่ให้ใช้ `/api/admin/gas/stale-shifts` เพื่อ preview/close แบบมี confirmation และ audit log
13. **GAS Price Source**: flow หลักของ GAS v2 (`open`/`sell`/`summary`/`close`) ต้องยึด `dailyRecord.gasPrice` เป็น source เดียวต่อ station/day; global settings ใช้ได้แค่เป็น default ตอนสร้างวันใหม่หรือเติม record ที่ยังไม่มีราคา
14. **GAS Shift Open Atomicity**: route เปิดกะ GAS ถูกห่อ transaction แล้ว; งานต่อไปห้ามดึงการสร้าง dailyRecord/shift/meters/gauges ออกมานอก transaction เดียว
15. **GAS Start Reading Immutability**: start meter/start gauge ของ GAS v2 ถูกล็อกหลังกะเริ่มถูกใช้งาน (มี sale/end/reconciliation) แล้ว; ถ้าจำเป็นต้องแก้ย้อนหลังควรเปิดเป็น admin flow ที่มี audit ชัดเจนเท่านั้น
16. **GAS Route-Level Tests**: งานที่แตะ price source/open shift/baseline guard ของ GAS v2 ต้องอัปเดต route-level tests ควบคู่กับ helper tests ไม่พึ่ง mock-only assertions อย่างเดียว
17. **GAS Admin Analytics Source of Truth**: daily/shift/reconciliation/executive ของ GAS ควรอ่านผ่าน `src/lib/gas/admin-analytics.ts` เท่านั้น; ถ้าจะเพิ่ม metric ใหม่ให้เพิ่มใน fact layer ก่อน ไม่คำนวณซ้ำใน route/page แต่ละตัว
18. **GAS Card Received Storage**: ตอนนี้ `cardReceived` ของ reconciliation ยังเก็บแฝงใน `shift.varianceNote` และรวมอยู่ใน `shift_reconciliations.transferReceived`; ทุก flow read/write ต้อง parse/build ผ่าน helper กลาง ห้ามแยก encode/decode เอง
19. **GAS Meter Reports**: `api/v2/gas/admin/reports/meters` ต้องอิง shift facts ชุดเดียวกับ daily/shift/reconciliation เพื่อให้ยอดมิเตอร์, transaction liters, และ liters variance ตรงกันทุกหน้า

## Changelog
- 2026-02-24: สร้างไฟล์ brain topic นี้จากประวัติ conversations
- 2026-04-18: เพิ่ม audit gotchas เรื่อง API auth gap, audit atomicity, และ variance sign convention
- 2026-04-18: implement push-hardening รอบแรก: `/admin` layout guard, `api-auth`, high-risk API guards, upload validation, LINE webhook fail-closed, และ atomic transaction audit
- 2026-04-18: ทำ final legacy write API auth sweep: gas/simple station write routes, invoices/payments, owners/trucks, products/price-books, dispenser/nozzle config, และ gas admin data-entry มี session/admin/station guard แล้ว
- 2026-04-18: แก้แท๊งลอย FULL station ให้ใช้ shift-scoped transaction/reconciliation, anomaly preview จากค่ามิเตอร์ที่กรอก, meter summary แยกตาม shift จริง, และหา old unclosed shift ผ่าน station route
- 2026-04-19: เพิ่ม flow หลังปิดกะแท๊งลอยให้พิมพ์รายงานสรุปทั้งวันได้ทันทีผ่าน success modal และ station-wide daily print helper
- 2026-04-19: แก้หน้าใหม่ของแท๊งลอยให้ราคาน้ำมันประจำวันเชื่อมกับหน้าเก่าผ่าน `dailyRecord` ชุดเดียวกัน และเลิกพึ่ง `localStorage`/route `fuel-prices` ที่ไม่มีจริง
- 2026-04-19: แก้ contract ของ transaction/slip flow ในหน้าใหม่แท๊งลอยให้ตรงกับ route เดิม, เพิ่ม `transferProofUrl` ใน list API, เปลี่ยนแนบสลิปให้ใช้ `/api/upload/transfer-proof`, และเปิด payment types/receipt flow ให้ครบแบบหน้าเก่า
- 2026-04-23: audit ปั๊มแก๊สทั้ง 2 สาขา พบ route/API ซ้อนกัน, `/api/v2/gas/[stationId]/gauge` ขาด, auth/ownership gaps ใน GAS v2/legacy routes, payment type drift, transaction ไม่ผูก `shiftId` ใน v2 sell, station-5 `hasProducts` config/DB ไม่ตรง, และ DB จริงมีกะ GAS ค้างจำนวนมาก
- 2026-04-23: implement GAS hardening ตาม audit: เพิ่ม v2 gauge route, helper guard กลาง, station ownership checks, v2 sell/summary shift scope, payment normalize `CREDIT_CARD`/`TRANSFER`, product guard เฉพาะ station-5 พร้อม sync DB, admin stale-shift cleanup endpoint, eslint ignore สำหรับ ad hoc scripts, และ tests เฉพาะ GAS
- 2026-04-23: ปิด GAS `OPEN` shifts ค้างใน DB จริงครบ 70 กะ (`station-5` 57, `station-6` 13), เติม end meter ที่ว่าง 16 จุดด้วยค่า start เดิม, ปิด daily records ที่ไม่มี open shift เหลือ 67 records, และสร้าง audit log ครบ 70 รายการ
- 2026-04-23: post-hardening review พบ follow-up สำคัญของ GAS v2: price source ยังแยกกันระหว่าง settings กับ `dailyRecord.gasPrice`, route เปิดกะยังไม่ atomic และ validate ไม่พอ, start meter/gauge ยังแก้ย้อนหลังได้, และ tests ยังไม่ครอบ route-level regressions
- 2026-04-23: patch follow-up ของ GAS v2 core flow: รวม price source ให้ยึด `dailyRecord.gasPrice`, ทำ `shift/open` เป็น transaction เดียวพร้อม exact payload validation, ล็อก start meter/gauge หลังกะเริ่มถูกใช้งาน, ปรับ `/gas` UI ให้ไม่เปิดทางแก้ baseline ที่ backend บล็อก, และเพิ่ม route-level tests สำหรับ `open`/`sell`/`meters`/`gauge`
- 2026-04-23: patch GAS admin analytics/reporting: เพิ่ม shared fact layer `src/lib/gas/admin-analytics.ts`, ย้าย daily/shift/reconciliation/executive ให้ใช้ source เดียวกัน, เติม route `PUT /api/v2/gas/admin/reconciliation/[shiftId]`, อัปเดต admin pages ให้เห็น payment mix / avg ticket / liters variance / day breakdown ชัดขึ้น, และต่อยอด inventory runout, top staff/nozzle performance, action alerts, กับ meter report ให้ใช้ fact layer เดียวกัน
