# Decision: Watchara Shared Dispenser Safe Rollout

วันที่: 2026-04-18

## Context

มี external dispenser source ของ Watchara ที่ต้องรวมเข้าระบบนี้เร็วๆ นี้ แต่ draft integration plan เดิมยังไม่ตรงกับ codebase จริง และมีความเสี่ยงทำให้ยอด dashboard/report/anomaly ไม่ตรงกัน

## Decision

ใช้แนวทาง rollout แบบปลอดภัยดังนี้:

- map external source `station-1` ไป local `station-2`
- เก็บ raw external data ใน tables แยก
- ห้าม merge ปนลง `transactions`
- สร้าง aggregated helper สำหรับ operational sales
- patch consumer ที่ใช้ยอดขายจริงให้ครบก่อนเปิดใช้
- ห้ามเปิด production ถ้ายังไม่ได้ align reconciliation/anomaly กับ merged sales

## Rationale

- codebase นี้มีหลาย route/service ที่ query `prisma.transaction` ตรง
- ถ้า merge แค่ report บางตัว ยอดแต่ละหน้าจะไม่ตรงกัน
- ถ้าเปิด report ก่อน patch anomaly/reconciliation จะเกิด false alert
- source ภายนอกยังมี caveat เรื่อง stale data, missing `productType`, missing `shiftId`, และ business-date anchor

## Follow-up

- ดูเอกสาร implement-ready ที่ `docs/WATCHARA_SHARED_DISPENSER_SAFE_ROLLOUT.md`
- เริ่มจาก schema + sync + status endpoint ก่อน
