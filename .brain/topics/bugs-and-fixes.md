<!-- SUMMARY: บันทึก bugs/gotchas ที่เจอ รวมถึงประเด็น audit สำคัญ:
     push-hardening 2026-04-18 ปิด `/admin`, high-risk API, และ legacy write API auth gap ตาม static scan แล้ว;
     รอบเดียวกันยังแก้แท๊งลอยให้ใช้ shift-scoped transactions, anomaly preview จากค่าปัจจุบัน, flow ปิดกะเก่าที่ไม่ต้องพึ่ง admin route,
     เพิ่ม post-close daily report printing ที่ต้องอิง station-wide `/daily` แทน `/transactions`,
     และ fix หน้าใหม่ของแท๊งลอยให้เชื่อมทั้ง daily price, transaction contract, receipt/slip flow กับ backend/source ชุดเดียวกับหน้าเก่า -->

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

## Changelog
- 2026-02-24: สร้างไฟล์ brain topic นี้จากประวัติ conversations
- 2026-04-18: เพิ่ม audit gotchas เรื่อง API auth gap, audit atomicity, และ variance sign convention
- 2026-04-18: implement push-hardening รอบแรก: `/admin` layout guard, `api-auth`, high-risk API guards, upload validation, LINE webhook fail-closed, และ atomic transaction audit
- 2026-04-18: ทำ final legacy write API auth sweep: gas/simple station write routes, invoices/payments, owners/trucks, products/price-books, dispenser/nozzle config, และ gas admin data-entry มี session/admin/station guard แล้ว
- 2026-04-18: แก้แท๊งลอย FULL station ให้ใช้ shift-scoped transaction/reconciliation, anomaly preview จากค่ามิเตอร์ที่กรอก, meter summary แยกตาม shift จริง, และหา old unclosed shift ผ่าน station route
- 2026-04-19: เพิ่ม flow หลังปิดกะแท๊งลอยให้พิมพ์รายงานสรุปทั้งวันได้ทันทีผ่าน success modal และ station-wide daily print helper
- 2026-04-19: แก้หน้าใหม่ของแท๊งลอยให้ราคาน้ำมันประจำวันเชื่อมกับหน้าเก่าผ่าน `dailyRecord` ชุดเดียวกัน และเลิกพึ่ง `localStorage`/route `fuel-prices` ที่ไม่มีจริง
- 2026-04-19: แก้ contract ของ transaction/slip flow ในหน้าใหม่แท๊งลอยให้ตรงกับ route เดิม, เพิ่ม `transferProofUrl` ใน list API, เปลี่ยนแนบสลิปให้ใช้ `/api/upload/transfer-proof`, และเปิด payment types/receipt flow ให้ครบแบบหน้าเก่า
