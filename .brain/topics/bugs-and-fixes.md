<!-- SUMMARY: บันทึก bugs ที่เจอและแก้ไขแล้ว รวมถึง gotchas ที่ต้องระวัง
     เช่น billing sort bug, login failure, shift filter, data transfer -->

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

## Changelog
- 2026-02-24: สร้างไฟล์ brain topic นี้จากประวัติ conversations
