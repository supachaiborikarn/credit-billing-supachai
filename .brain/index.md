# 🧠 Brain Index - Credit Billing Supachai

> **AI Instructions**: อ่านไฟล์นี้ก่อนเสมอเมื่อเริ่ม session ใหม่
> ใช้สรุปด้านล่างตอบคำถาม ถ้าข้อมูลไม่พอค่อยเปิดอ่านไฟล์ที่เกี่ยวข้อง
> หลังทำงานเสร็จ ให้ update brain ตาม workflow `brain-system`

## 📋 Topics

| Topic | สรุป | ไฟล์ |
|-------|------|------|
| **Billing System** | ระบบออกบิลน้ำมัน/แก๊ส, book/number sorting แบบ numeric, 7 ประเภทการชำระ, การรวมบิลยึด `ownerId` เป็นหลัก, hardening เงินเชื่อ 2026-04-25 ให้ invoice/pending รวม `OIL_TRUCK_SUPACHAI` + บังคับ owner/truck/book/bill, และเติมเลขบิลถัดไปอัตโนมัติให้ Tank Loy 2026-04-27 | [→ billing-system.md](topics/billing-system.md) |
| **Database** | Prisma + PostgreSQL (Neon), 30+ models, migrate ด้วย `prisma db push`, backup, และ `meter_readings` unique ต่อ `shiftId+nozzleNumber` เพื่อรองรับหลายกะในวันเดียว | [→ database.md](topics/database.md) |
| **Deployment** | Vercel auto-deploy จาก main, Cloudinary สำหรับรูป | [→ deployment.md](topics/deployment.md) |
| **Station Types** | 6 สถานี: FULL station-1 ย้าย Overview/Sales/Operations/History ครบถึง S96 และผ่าน S97 canonical browser acceptance 105/105; `/station/1` ไป canonical Overview และ `/station/1/v2` ไป canonical History โดยคง receipt thermal เป็น print compatibility. SIMPLE station-2/3/4 retired operational ครบ S45-S52 โดยคง read/history/receipt/API. GAS station-5/6 sell + open/close ย้าย canonical ถึง S63; S64-S68 ล็อก correction/inventory ตาม capability จริง; S98 ย้าย meter/gauge recovery เข้า canonical Operations, S99 ย้าย LPG supplies และ S100 ย้าย station-5 products เข้า canonical Inventory แล้ว; S69-S72 ปิด tool/price/live-summary parity, S73 retire root `/gas/5|6`, S74 flatten older landing/new/home, S75-S76 ยืนยัน older meters/supplies ให้ map ไป current compatibility routes, และ S77 แก้ older products ตาม capability: station-5 ไป product inventory, station-6 ไป canonical Overview. S78 flatten monthly-balance UI; S79 เติม meter detail + recent transactions จน summary parity ready; S80 retire current/older summary UI ไป canonical พร้อม auth/query normalization แต่คง summary API เป็น read source. S81 pass 1 เพิ่ม auth protection/capability boundary; pass 2 authenticated read UAT ผ่านบน port 3005, เพิ่ม Today retry เฉพาะ transient Prisma read และ canonical stale-shift warning หลังพบ GAS station-5/6 มี OPEN ค้างจาก 2026-04-24; pass 3 browser QA เพิ่ม `/sales` canonical station chooser และ normalize STAFF nav เป็น `station-X`; pass 3 แก้ root/login/exact `/dashboard` ให้ canonical landing เป็น `/today` จริง; pass 4 mobile Sales/Operations QA ปิด bottom-nav/Save overlap และทำ stale-vs-current GAS shift warning ให้ชัด; หลัง S100 งาน GAS frontline ทั้ง recovery + LPG + station-5 products อยู่ canonical แล้ว; legacy ที่เหลือเป็น admin/report/API compatibility. GAS กะ 07:00-19:00 / 19:00-07:00 | [→ station-types.md](topics/station-types.md) |
| **Bugs & Fixes** | bugs/gotchas สำคัญ รวมถึง API auth gap, audit atomicity, variance sign convention, fix แท๊งลอยให้ใช้ shift scope ถูกต้อง, Tank Loy duplicate OPEN shift/admin meter backfill fix 2026-07-11, Windows auto-print รายงานเมื่อวานเข้า Epson Wi-Fi เวลา 07:00 เพิ่ม 2026-07-19, sync หน้าใหม่ของแท๊งลอย, harmonize UI/ตัด flow น้ำมันเครื่อง, bottom nav/daily report, V2 daily print reconciliation + thermal 58/80mm 2026-04-28, per-transaction thermal print/reprint 58/80mm, Android Epson direct ePOS daily print fix 2026-05-03, Android Epson direct daily summary hierarchy/admin A4 print polish 2026-05-06, Android Epson direct receipt original/copy cut fix 2026-05-06, S96 retire `/station/1/v2` ไป canonical History และกรอง zero-placeholder rows ใน FULL opening recovery, Tank Loy stale staff session force logout, Tank Loy V2 meter-start/no-shift auto-repair 2026-04-28, GAS hardening/analytics 2026-04-23, GAS price/credit/orphan/amount-based fixes, GAS overnight shift business-date fix 2026-05-03, GAS fixed shift schedule 07:00-19:00/19:00-07:00 2026-05-12, GAS admin executive print report 2026-05-03, GAS admin data-entry/operations/open-shift hardening 2026-04-28, GAS afternoon meter unique fix 2026-04-29, GAS supply receiving + meter continuity + admin v1 redirect 2026-05-01, GAS admin reconciliation edit จากรายงานมิเตอร์ 2026-05-06, GAS admin opening-meter repair 2026-07-15, GAS sell duplicate guard 2026-05-07, GAS net cash display 2026-05-11, และ GAS close shift client crash 2026-05-20 | [→ bugs-and-fixes.md](topics/bugs-and-fixes.md) |
| **Design System** | `DESIGN.md` เป็น source of truth สำหรับ UI agents: Thai-first Sarabun, operational console, primary orange, compact mobile station flows, bottom nav ต้องเผื่อ safe-area/ไม่บัง CTA, thermal receipts ต้องรองรับ 58/80mm, S41 ล็อก keyboard/focus/labels/modal semantics + contrast-safe action/text tokens; S42 ล็อก initial skeleton + stale-while-refresh และ fail-closed operational writes เมื่อ context ไม่สด, no default-purple drift, และ Tank Loy ไม่มี engine-oil/product flow | [→ design-system.md](topics/design-system.md) |
| **Attendance** | ระบบลงเวลา, ลาหยุด, shift swap, overlap detection | [→ attendance.md](topics/attendance.md) |
| **Watchara Shared Dispenser** | external diesel source ของ Watchara ต้องเก็บ raw แยก, map เข้า `station-2`, และ patch หลายจุดที่ query `transactions` ตรง | [→ watchara-shared-dispenser.md](topics/watchara-shared-dispenser.md) |
| **Product Ideas** | backlog ไอเดีย 2026-05-17: daily action center, stock จริงของ SIMPLE, LINE payment flow, owner cleanup, credit risk, Watchara rollout, print/device health, OCR รูปมิเตอร์/สลิป, และ staff UX cleanup | [→ product-ideas.md](topics/product-ideas.md) |

## 🔗 Recent Decisions

| วันที่ | เรื่อง | ไฟล์ |
|-------|--------|------|
| 2026-04-23 | Modernized GAS Station Dashboard UI (Linear style) | [→ station-types.md](topics/station-types.md) |
| 2026-04-18 | Safe rollout สำหรับ Watchara shared dispenser: เก็บ raw แยก, map เข้า `station-2`, และ align reporting กับ anomaly/reconciliation ก่อนเปิดใช้ | [→ decisions/2026-04-18-watchara-shared-dispenser-safe-rollout.md](decisions/2026-04-18-watchara-shared-dispenser-safe-rollout.md) |
| 2026-02-23 | เปลี่ยน billing sort เป็น numeric comparison | [→ decisions/](decisions/) |
| 2026-02-23 | Migrate database ไป Neon account ใหม่ | [→ decisions/](decisions/) |
| 2026-02-19 | เพิ่ม overlap detection ในระบบลาหยุด | [→ decisions/](decisions/) |

## 📅 Last Updated
2026-08-29
