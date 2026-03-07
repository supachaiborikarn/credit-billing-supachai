<!-- SUMMARY: ระบบออกบิลน้ำมัน/แก๊ส ใช้ Prisma + Neon, sort ด้วย numeric comparison (parseInt),
     รองรับ 7 ประเภทการชำระ (CASH/CREDIT/TRANSFER/BOX_TRUCK/OIL_TRUCK_SUPACHAI/CREDIT_CARD/EXPENSE),
     มี book/number format (billBookNo/billNo), deploy บน Vercel -->

# Billing System

## Overview
ระบบบันทึกการขายน้ำมัน/แก๊ส สำหรับ 6 สถานีบริการ โดยแต่ละสถานีมี UI และ workflow ต่างกันตามประเภท

## Core Concepts

### Transaction Model
- **ตาราง**: `transactions`
- **Key fields**: `stationId`, `paymentType`, `liters`, `pricePerLiter`, `amount`, `billBookNo`, `billNo`
- **Soft delete**: ใช้ `deletedAt` field
- **Void**: ใช้ `isVoided`, `voidReason`, `voidedAt`

### Payment Types
| Enum | ชื่อ | สี (UI) |
|------|------|---------|
| CASH | เงินสด | เขียว |
| CREDIT | เงินเชื่อ | ม่วง |
| TRANSFER | โอนเงิน | ฟ้า (ต้องแนบรูป) |
| BOX_TRUCK | รถตู้ทึบ | ส้ม |
| OIL_TRUCK_SUPACHAI | รถน้ำมันศุภชัย | แดง |
| CREDIT_CARD | บัตรเครดิต | ชมพู |
| EXPENSE | ค่าใช้จ่าย | - |

### Billing Sort Logic
- ⚠️ **สำคัญ**: ต้อง sort ด้วย `parseInt()` ไม่ใช่ string comparison
- เรียงตาม: วันที่ → เล่มที่ (numeric) → เลขที่ (numeric)
- Bug เดิม: string comparison ทำให้ "9" > "10"
- แก้แล้ว: ใช้ `parseInt(a.billBookNo) - parseInt(b.billBookNo)` ทั้ง frontend sort และ creation

### Invoice System
- **ตาราง**: `invoices` + `payments`
- ผูกกับ `Owner` (เจ้าของรถ/ลูกค้า)
- สถานะ: PENDING → PARTIAL → PAID
- มี `invoiceNumber` unique

## Owner & Truck Management
- **Owner groups**: SUGAR_FACTORY, GENERAL_CREDIT, BOX_TRUCK, OIL_TRUCK, OOY_TRUCK
- **Credit system**: `creditLimit` + `currentCredit` ใน Owner model
- **Truck**: ผูกกับ Owner ผ่าน `ownerId`

## Changelog
- 2026-02-24: สร้างไฟล์ brain topic นี้จากประวัติการทำงานจริง
- 2026-02-23: แก้ sort order billing จาก string เป็น numeric (parseInt)
- 2026-02-21: แก้ sort ของ billing notes
