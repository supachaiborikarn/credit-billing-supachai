<!-- SUMMARY: บันทึก bugs/gotchas ที่เจอ รวมถึงประเด็น audit สำคัญ:
     push-hardening 2026-04-18 ปิด `/admin`, high-risk API, และ legacy write API auth gap ตาม static scan แล้ว; audit เชิงลึกยังควรทำต่อ -->

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

## ⚠️ Known Gotchas
1. **String vs Numeric Sort**: ทุก sort ที่เกี่ยวกับตัวเลข (book, number) ต้องใช้ parseInt
2. **Neon Data Transfer**: free tier จำกัด 5GB/month → ระวัง polling ถี่เกินไป
3. **Context ที่ลืมเรื่อง**: เมื่อไหร่ที่เปลี่ยนการ sort, ต้องเปลี่ยนทั้ง frontend และ backend
4. **API Auth Gap**: push-hardening รอบ 2026-04-18 เพิ่ม `/admin` server guard, `api-auth`, high-risk API guards, และ full legacy write API auth sweep แล้ว; quick scan ล่าสุดรายงาน `NO_UNGUARDED_WRITE_ROUTES`
5. **Audit Log Atomicity**: transaction update/delete บาง route แก้ข้อมูลก่อน create audit log และใช้ fallback `userId = "system"` ซึ่งเสี่ยงข้อมูลถูกแก้แล้ว audit fail
6. **Variance Sign Convention**: `shift-service` ใช้ `expected - received` แต่ `shift-reconciliation`/gas v2 ใช้ `received - expected`; ต้อง normalize ก่อนใช้ label OVER/SHORT

## Changelog
- 2026-02-24: สร้างไฟล์ brain topic นี้จากประวัติ conversations
- 2026-04-18: เพิ่ม audit gotchas เรื่อง API auth gap, audit atomicity, และ variance sign convention
- 2026-04-18: implement push-hardening รอบแรก: `/admin` layout guard, `api-auth`, high-risk API guards, upload validation, LINE webhook fail-closed, และ atomic transaction audit
- 2026-04-18: ทำ final legacy write API auth sweep: gas/simple station write routes, invoices/payments, owners/trucks, products/price-books, dispenser/nozzle config, และ gas admin data-entry มี session/admin/station guard แล้ว
