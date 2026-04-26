<!-- SUMMARY: 6 สถานี: แท๊งลอยวัชรเกียรติ (FULL) ใช้ staff route เดียว `/simple-station/1/new/*` และคง classic admin ที่ `/station/1`;
     วัชรเกียรติออยล์/พงษ์อนันต์/ศุภชัยบริการ (SIMPLE), ปั๊มแก๊สพงษ์อนันต์/ปั๊มแก๊สศุภชัย (GAS), แต่ละแบบมี route และ features ต่างกัน -->

# Station Types

## Overview
ระบบรองรับ 3 ประเภทสถานี โดยแต่ละประเภทมี UI และฟีเจอร์ต่างกัน

## Stations

| # | สถานี | ประเภท | Route | คุณสมบัติ |
|---|-------|--------|-------|-----------|
| 1 | แท๊งลอยวัชรเกียรติ | FULL | `/simple-station/[id]/new/home` | มิเตอร์ 4 หัวจ่าย + บันทึกบิล + สรุปยอด |
| 2 | วัชรเกียรติออยล์ | SIMPLE | `/simple-station/[id]` | บันทึกบิลอย่างเดียว |
| 3 | พงษ์อนันต์ปิโตรเลียม | SIMPLE | `/simple-station/[id]` | บันทึกบิลอย่างเดียว |
| 4 | ศุภชัยบริการ | SIMPLE | `/simple-station/[id]` | บันทึกบิลอย่างเดียว |
| 5 | ปั๊มแก๊สพงษ์อนันต์ | GAS | `/gas-station/[id]` | แก๊ส + สินค้า |
| 6 | ปั๊มแก๊สศุภชัย | GAS | `/gas-station/[id]` | แก๊สอย่างเดียว |

## Station Type Features

### FULL Station
- มิเตอร์ 4 หัวจ่าย (Nozzle system)
- Shift management (กะเช้า/กะบ่าย)
- Meter reading (มิเตอร์เริ่มต้น/สิ้นสุด)
- Daily anomaly detection
- Shift reconciliation (ตรวจยอดปิดกะ)
- Staff canonical route: `/simple-station/1/new/*`
- Admin classic route: `/station/1`
- Legacy `/station/1/new/*` และ `/station/1/v2` ต้อง redirect ออก ห้ามเพิ่มฟีเจอร์ใหม่ใน route ชุดนั้น

### SIMPLE Station
- บันทึกบิลอย่างเดียว
- เลือก: ชนิดน้ำมัน (ดีเซล, เบนซิน91, เบนซิน95)
- ไม่มีระบบมิเตอร์/กะ

### GAS Station
- บันทึกแก๊ส (กิโลกรัม + ราคา/กก.)
- Shift management (เหมือน FULL)
- Gauge reading (เกจวัดถังแก๊ส)
- บางสถานีมี Products (สินค้าเสริม)

## Key Files
- **FULL/SIMPLE UI**: `/src/app/simple-station/[id]/new/home/page.tsx`
- **GAS UI**: `/src/app/gas-station/[id]/page.tsx`
- **Constants**: `/src/constants/index.ts`

## Changelog
- 2026-02-24: สร้างไฟล์ brain topic นี้
- 2026-01: แยกมิเตอร์ตามกะ, แก้ shift filter, fuel price sync
- 2026-04-23: Modernized GAS UI (Linear-inspired, card-based layout) for /gas-station/[id]
- 2026-04-26: Consolidate Tank Loy routes ให้เหลือ staff UI เดียวที่ `/simple-station/1/new/*` และ classic admin ที่ `/station/1`; route `/station/1/new/*` กับ `/station/1/v2` เป็น redirect เท่านั้น
