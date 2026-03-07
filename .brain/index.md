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
| **Bugs & Fixes** | ประวัติ bugs ที่เจอและวิธีแก้ไข | [→ bugs-and-fixes.md](topics/bugs-and-fixes.md) |
| **Attendance** | ระบบลงเวลา, ลาหยุด, shift swap, overlap detection | [→ attendance.md](topics/attendance.md) |

## 🔗 Recent Decisions

| วันที่ | เรื่อง | ไฟล์ |
|-------|--------|------|
| 2026-02-23 | เปลี่ยน billing sort เป็น numeric comparison | [→ decisions/](decisions/) |
| 2026-02-23 | Migrate database ไป Neon account ใหม่ | [→ decisions/](decisions/) |
| 2026-02-19 | เพิ่ม overlap detection ในระบบลาหยุด | [→ decisions/](decisions/) |

## 📅 Last Updated
2026-02-24
