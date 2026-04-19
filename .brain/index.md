# 🧠 Brain Index - Credit Billing Supachai

> **AI Instructions**: อ่านไฟล์นี้ก่อนเสมอเมื่อเริ่ม session ใหม่
> ใช้สรุปด้านล่างตอบคำถาม ถ้าข้อมูลไม่พอค่อยเปิดอ่านไฟล์ที่เกี่ยวข้อง
> หลังทำงานเสร็จ ให้ update brain ตาม workflow `brain-system`

## 📋 Topics

| Topic | สรุป | ไฟล์ |
|-------|------|------|
| **Billing System** | ระบบออกบิลน้ำมัน/แก๊ส, book/number sorting แบบ numeric, 7 ประเภทการชำระ | [→ billing-system.md](topics/billing-system.md) |
| **Database** | Prisma + PostgreSQL (Neon), 30+ models, migration, backup | [→ database.md](topics/database.md) |
| **Deployment** | Vercel auto-deploy จาก main, Cloudinary สำหรับรูป | [→ deployment.md](topics/deployment.md) |
| **Station Types** | 6 สถานี: 1 FULL, 3 SIMPLE, 2 GAS แต่ละแบบมี route ต่างกัน | [→ station-types.md](topics/station-types.md) |
| **Bugs & Fixes** | bugs/gotchas สำคัญ รวมถึง API auth gap ที่ทำ push-hardening/full write sweep แล้ว, audit atomicity, variance sign convention, fix แท๊งลอยให้ใช้ shift scope ถูกต้อง, flow พิมพ์รายงานทั้งวันหลังปิดกะ, และ sync หน้าใหม่ของแท๊งลอยกับ daily price/transaction/slip contract เดิม | [→ bugs-and-fixes.md](topics/bugs-and-fixes.md) |
| **Attendance** | ระบบลงเวลา, ลาหยุด, shift swap, overlap detection | [→ attendance.md](topics/attendance.md) |
| **Watchara Shared Dispenser** | external diesel source ของ Watchara ต้องเก็บ raw แยก, map เข้า `station-2`, และ patch หลายจุดที่ query `transactions` ตรง | [→ watchara-shared-dispenser.md](topics/watchara-shared-dispenser.md) |

## 🔗 Recent Decisions

| วันที่ | เรื่อง | ไฟล์ |
|-------|--------|------|
| 2026-04-18 | Safe rollout สำหรับ Watchara shared dispenser: เก็บ raw แยก, map เข้า `station-2`, และ align reporting กับ anomaly/reconciliation ก่อนเปิดใช้ | [→ decisions/2026-04-18-watchara-shared-dispenser-safe-rollout.md](decisions/2026-04-18-watchara-shared-dispenser-safe-rollout.md) |
| 2026-02-23 | เปลี่ยน billing sort เป็น numeric comparison | [→ decisions/](decisions/) |
| 2026-02-23 | Migrate database ไป Neon account ใหม่ | [→ decisions/](decisions/) |
| 2026-02-19 | เพิ่ม overlap detection ในระบบลาหยุด | [→ decisions/](decisions/) |

## 📅 Last Updated
2026-04-19
