# S81 pass 5 — Customer/Billing mobile QA

วันที่: 2026-08-28

## Findings
- Customers ACTIVE 713 รายถูก render พร้อมกันทั้งหมด; mobile breakpoint page สูง ~122,783px
- Billing workspace 180 งานถูก render พร้อมกัน; page สูง ~16,610px
- Invoice detail sample มี 238 source items render พร้อมกัน; page สูง ~20,878px
- Customer 360 sample ไม่มี blocker รายการยาวในรอบนี้

## Changes
- Customers: render 50 รายแรก + แสดงเพิ่มทีละ 50; search/status/attention ยัง filter dataset เต็ม
- Billing: render 50 งานแรก + แสดงเพิ่มทีละ 50; pipeline/kind/search/exception ยัง filter dataset เต็ม
- Billing detail: source items 50 รายแรก + แสดงเพิ่มทีละ 50; totals/payment behavior ไม่เปลี่ยน

## Verification
- browser re-check: Customers 50/713 (~9,470px), Billing 50/180 (~5,360px), Billing detail 50/238 (~5,334px)
- targeted Customer/Billing tests 7 files / 30 tests passed
- TypeScript passed
- targeted ESLint passed
- no API query, financial formula, billing lifecycle, or write change

## Isolation
- มี Tank Loy auto-print changes จากงานอื่นค้างใน working tree ก่อน session นี้; ไม่แตะ/ไม่ stage/ไม่ commit ไฟล์เหล่านั้น
- ไม่ push / ไม่ deploy
