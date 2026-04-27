# 🧠 Brain Index - Credit Billing Supachai

> **AI Instructions**: อ่านไฟล์นี้ก่อนเสมอเมื่อเริ่ม session ใหม่
> ใช้สรุปด้านล่างตอบคำถาม ถ้าข้อมูลไม่พอค่อยเปิดอ่านไฟล์ที่เกี่ยวข้อง
> หลังทำงานเสร็จ ให้ update brain ตาม workflow `brain-system`

## 📋 Topics

| Topic | สรุป | ไฟล์ |
|-------|------|------|
| **Billing System** | ระบบออกบิลน้ำมัน/แก๊ส, book/number sorting แบบ numeric, 7 ประเภทการชำระ, การรวมบิลยึด `ownerId` เป็นหลัก, และ hardening เงินเชื่อ 2026-04-25 ให้ invoice/pending รวม `OIL_TRUCK_SUPACHAI` + บังคับ owner/truck/book/bill | [→ billing-system.md](topics/billing-system.md) |
| **Database** | Prisma + PostgreSQL (Neon), 30+ models, migration, backup | [→ database.md](topics/database.md) |
| **Deployment** | Vercel auto-deploy จาก main, Cloudinary สำหรับรูป | [→ deployment.md](topics/deployment.md) |
| **Station Types** | 6 สถานี: แท๊งลอยใช้ staff UI `/station/1/new/*`, classic admin `/station/1`, และ V2 live route `/station/1/v2` ยังรองรับชั่วคราว; SIMPLE ใช้ `/simple-station`, GAS ใช้ `/gas` | [→ station-types.md](topics/station-types.md) |
| **Bugs & Fixes** | bugs/gotchas สำคัญ รวมถึง API auth gap, audit atomicity, variance sign convention, fix แท๊งลอยให้ใช้ shift scope ถูกต้อง, sync หน้าใหม่ของแท๊งลอย, harmonize UI/ตัด flow น้ำมันเครื่อง, bottom nav/daily report, per-transaction thermal print 58/80mm, canonical staff route `/station/1/new/*`, V2 print/photo review และ required evidence guard 2026-04-27, GAS hardening/analytics 2026-04-23, fix live incident 2026-04-24, staff daily GAS price edit 2026-04-25, GAS credit bill/reconciliation validation 2026-04-25, GAS stale open shift guard, GAS orphan transaction report guard, GAS amount-based sale entry/meter report clarity 2026-04-25, และ GAS close-shift other sales/expenses 2026-04-27 | [→ bugs-and-fixes.md](topics/bugs-and-fixes.md) |
| **Design System** | `DESIGN.md` เป็น source of truth สำหรับ UI agents: Thai-first Sarabun, operational console, primary orange, compact mobile station flows, bottom nav ต้องเผื่อ safe-area/ไม่บัง CTA, thermal receipts ต้องรองรับ 58/80mm, no default-purple drift, และ Tank Loy ไม่มี engine-oil/product flow | [→ design-system.md](topics/design-system.md) |
| **Attendance** | ระบบลงเวลา, ลาหยุด, shift swap, overlap detection | [→ attendance.md](topics/attendance.md) |
| **Watchara Shared Dispenser** | external diesel source ของ Watchara ต้องเก็บ raw แยก, map เข้า `station-2`, และ patch หลายจุดที่ query `transactions` ตรง | [→ watchara-shared-dispenser.md](topics/watchara-shared-dispenser.md) |

## 🔗 Recent Decisions

| วันที่ | เรื่อง | ไฟล์ |
|-------|--------|------|
| 2026-04-23 | Modernized GAS Station Dashboard UI (Linear style) | [→ station-types.md](topics/station-types.md) |
| 2026-04-18 | Safe rollout สำหรับ Watchara shared dispenser: เก็บ raw แยก, map เข้า `station-2`, และ align reporting กับ anomaly/reconciliation ก่อนเปิดใช้ | [→ decisions/2026-04-18-watchara-shared-dispenser-safe-rollout.md](decisions/2026-04-18-watchara-shared-dispenser-safe-rollout.md) |
| 2026-02-23 | เปลี่ยน billing sort เป็น numeric comparison | [→ decisions/](decisions/) |
| 2026-02-23 | Migrate database ไป Neon account ใหม่ | [→ decisions/](decisions/) |
| 2026-02-19 | เพิ่ม overlap detection ในระบบลาหยุด | [→ decisions/](decisions/) |

## 📅 Last Updated
2026-04-27
