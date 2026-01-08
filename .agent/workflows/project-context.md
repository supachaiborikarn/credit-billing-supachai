---
description: ข้อมูลสำคัญของโปรเจกต์ที่ต้องจำ
---

# Project Context - Credit Billing Supachai

## Deployment
- **Platform**: Vercel
- **Vercel Dashboard**: https://vercel.com/benzs-projects-2423502c/credit-billing-supachai/deployments
- **Auto-deploy**: เมื่อ push ไป `main` branch จะ auto-deploy ภายใน 1-2 นาที

## Station Types
- **Gas Station** (ปั๊มแก๊ส): station-5, station-6
  - ใช้ `/gas-station/[id]` route
  - เก็บ meters แยกตาม shift
- **Simple Station** (ปั๊มน้ำมัน): station-1 ถึง station-4
  - ใช้ `/simple-station/[id]` route

## Key Files
- **Gas Station UI**: `/src/app/gas-station/[id]/page.tsx`
- **Simple Station UI**: `/src/app/simple-station/[id]/new/home/page.tsx`
- **Constants**: `/src/constants/index.ts` (stations config)
- **Prisma Schema**: `/prisma/schema.prisma`

## Recent Fixes (Jan 2026)
- ✅ แยกมิเตอร์ตามกะ (shift-based meter storage)
- ✅ แก้ shift filter สำหรับกะเช้า/กะบ่าย
- ✅ แก้ไขเกจถังแก๊สไม่แสดง
- ✅ Fuel price sync from open-shift to sell page

## Database
- **Provider**: PostgreSQL
- **ORM**: Prisma

## User Roles
- **ADMIN**: เห็นทุกสถานี, แก้ไขได้ทั้งหมด
- **STAFF**: เห็นเฉพาะสถานีที่ได้รับมอบหมาย
