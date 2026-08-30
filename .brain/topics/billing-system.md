<!-- SUMMARY: ระบบออกบิลน้ำมัน/แก๊ส ใช้ Prisma + Neon, sort ด้วย numeric comparison (parseInt),
     รองรับ 7 ประเภทการชำระ (CASH/CREDIT/TRANSFER/BOX_TRUCK/OIL_TRUCK_SUPACHAI/CREDIT_CARD/EXPENSE),
     ใบวางบิล/ใบแจ้งหนี้ยึด ownerId เป็นหลัก ส่วน ownerName เป็น snapshot/legacy fallback,
     external integration ต้อง map ลูกค้าให้ได้ ownerId ให้ชัดก่อนรวมบิล,
     และ audit 2026-04-25 patch ให้ invoice/pending/debt report รวม `OIL_TRUCK_SUPACHAI`,
     lock search APIs ด้วย session, บังคับ credit-like sale ต้องมี owner/truck/book/bill,
     และ 2026-04-27 เติมเลขที่บิลถัดไปอัตโนมัติให้ Tank Loy credit-like sale จากเล่มล่าสุด/เล่มที่เลือก -->

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
- คิวรอวางบิล (`/api/invoices/pending`) ดึงจาก `Owner.transactions`
- โหมดรวมหลายเจ้าของเป็นใบเดียวมีได้ แต่ยัง connect invoice ไว้กับ `ownerId` ตัวแรก

### Billing Collection System
- **ตาราง**: `billing_collections` + `billing_collection_items`
- ใบวางบิลรวมใหม่บังคับเลือก `ownerId`
- `ownerName` ในใบวางบิลรวมเป็น snapshot ตอนสร้าง ไม่ใช่ key หลัก

### Owner Identity & External Integration
- `Owner.name` ใน schema ยังไม่ unique ระดับ DB
- `Transaction.ownerId` และ `Transaction.ownerName` ยังเป็น nullable
- legacy write routes บางตัว resolve ลูกค้าจาก `ownerName` ด้วย `contains` search
- GAS v2 sell route ใหม่บังคับ `ownerId` สำหรับ CREDIT แล้ว ซึ่งปลอดภัยกว่าการพึ่งชื่อ
- ถ้าจะเชื่อมระบบภายนอก เช่น FuelStation ควรส่ง/แมปเข้ารหัสลูกค้า local (`ownerId` หรือ stable external mapping table) ก่อนสร้าง transaction
- ไม่ควร merge บิลจากชื่อ display อย่างเดียว เพราะชื่อซ้ำ/สะกดต่าง/มีคำนำหน้าต่างกันจะทำให้ยอดแตกคนหรือไปรวมผิดคนได้

### Live Audit Snapshot (2026-04-21)
- ตรวจ DB จริงพบรายการ CREDIT/BOX_TRUCK ที่มี `ownerName` แต่ไม่มี `ownerId` จำนวน `35` รายการ จากทั้งหมด `7066` รายการ (`0.5%`)
- พบ active owner name ที่ซ้ำ exact กัน `241` กลุ่ม
- พบ active owners `713` ราย โดยมี `owner.code` ไม่ว่าง `609` ราย (`85.41%`) แต่มี code ซ้ำ exact `237` กลุ่ม
- `venderCode` ของ active owners ปัจจุบันว่างทั้งหมด (`0` รายที่มีค่า)
- มี owner เครดิตที่ยัง active แต่ไม่มี `owner.code` จำนวน `93` ราย
- เคส `ownerId` หายมีทั้งแบบ:
  - มี owner exact match อยู่แล้วแต่ยังไม่ถูก link
  - ไม่มี exact match เพราะชื่อสะกด/เว้นวรรค/คำนำหน้าไม่ตรง
- ตัวอย่างชื่อที่ยังหลุด link: `บจก. มัชฌิมา ดิสทริบิวเตอร์`, `บจก.อ.อารยะวงศ์`, `มิตรเกษตร อุทัยธานี`, `พี่อ้อย`
- มี owner ชื่อซ้ำ exact ในระบบจริงหลายรายการ เช่นบางชื่อมีซ้ำ `4-13` records จึงห้ามใช้ `findFirst(name contains ...)` เป็นกลไกหลักสำหรับ external billing merge
- ณ ตอนนี้ทั้ง `ownerName`, `owner.code`, และ `venderCode` ยังไม่เหมาะจะใช้เป็น integration key กับ external billing โดยตรง

### Live Audit Snapshot (2026-04-25)
- ตรวจ DB จริงพบ active credit-like transactions:
  - `CREDIT` 5,800 รายการ / 21.70M บาท
  - `BOX_TRUCK` 1,268 รายการ / 42.93M บาท
  - `OIL_TRUCK_SUPACHAI` 57 รายการ / 321K บาท
- รายการยังไม่เข้า invoice:
  - `CREDIT` 5,739 รายการ / 21.10M บาท
  - `BOX_TRUCK` 12 รายการ / 352.8K บาท
  - `OIL_TRUCK_SUPACHAI` 57 รายการ / 321K บาท
- ก่อน patch, `/api/invoices`, `/api/invoices/pending`, และ report debt ดึงแค่ `CREDIT/BOX_TRUCK` ทำให้ `OIL_TRUCK_SUPACHAI` หลุดจากคิววางบิล แม้ `credit-service` ฝั่ง monthly invoice จะนับ type นี้อยู่แล้ว
- พบข้อมูลเก่าที่ connection ไม่ครบ:
  - missing `ownerId`: `CREDIT` 34, `BOX_TRUCK` 3, `OIL_TRUCK_SUPACHAI` 32
  - missing `truckId`: `CREDIT` 3,024, `BOX_TRUCK` 662, `OIL_TRUCK_SUPACHAI` 33
  - missing book/bill: `CREDIT` 351, `BOX_TRUCK` 143, `OIL_TRUCK_SUPACHAI` 4
- Invoice integrity:
  - มี invoices 15 ใบ, พบ total mismatch 4 ใบ, payment total mismatch 0 ใบ, และ cross-owner invoices 2 ใบ
  - `billing_collections` item/slip totals ตรงกับ paid/total ใน sample audit
- `owners.currentCredit` ไม่ควรใช้เป็น source of truth ตอนนี้: audit พบ 168 owners ที่ `currentCredit` ต่างจากยอดค้างคำนวณจริง (un-invoiced credit-like transactions + unpaid invoice balance) มากกว่า 1 บาท; ตัวเลขหน้า outstanding/credit-limit จึงอาจไม่ตรงกับคิววางบิลจริงจนกว่าจะมี backfill/recompute

### Credit Billing Hardening (Apr 25, 2026)
- Patch ให้ invoice queue/create และ debt report ใช้ `CREDIT_PAYMENT_TYPES` กลาง (`CREDIT`, `BOX_TRUCK`, `OIL_TRUCK_SUPACHAI`) และกรอง `deletedAt=null`, `isVoided=false`
- เพิ่ม session guard ให้ `/api/owners/search`, `/api/owners/check-duplicate`, `/api/trucks/search` เพราะ endpoint เหล่านี้เปิดเผยรายชื่อลูกค้า/ทะเบียนรถ
- Patch `BillEntryForm` และ station transaction APIs ให้ credit-like payment ต้องมี owner/truck/book/bill ครบ และตรวจว่า truck อยู่กับ owner ที่เลือกก่อนบันทึก
- Patch Tank Loy station transaction API ให้ credit-like sale ที่ไม่ส่ง `billNo` สามารถดึงเลขที่ถัดไปจาก `billBookNo` ที่เลือกได้ และถ้าไม่ส่งเล่มจะใช้เล่มล่าสุดของ station เป็น default; ถ้าไม่มีประวัติเล่มเลยยังต้องให้พนักงานกรอกเล่มครั้งแรก
- Patch `/api/invoices/[id]/payments` ให้ validate amount > 0, ห้ามจ่ายเกินยอดคงค้าง, และ create payment + update invoice ใน transaction เดียว
- Patch billing collection payment slip verify/delete ให้ recalc paid/status ใน transaction เดียว และเช็กว่า slipId อยู่ใต้ collectionId นั้นจริงก่อน delete


### Redesign Financial Regression Gate (Aug 27, 2026)
- S44 สร้าง `FINANCIAL_REGRESSION_CHECKLIST.md` เป็น gate ก่อน retire active legacy routes; baseline ผ่าน 16 test files / 81 tests
- Invoice และ BillingCollection ยังเป็นคนละ financial model และห้ามรวมกับ unbilled/currentCredit เป็น grand total
- `/api/invoices/[id]/payments` เป็น canonical Invoice payment write: validate overpay + optimistic concurrency + payment/invoice update atomic
- BillingCollection payment ยังใช้ evidence-first: create PENDING slip ก่อน; S44 เพิ่ม guard ตอน VERIFY ให้ rollback และ 409 ถ้า VERIFIED slips รวมเกิน `totalAmount`
- `/api/payments` เก่าไม่พบ production caller ใน source และไม่ใช่ canonical payment endpoint
- FULL canonical price parity ยึด current Tank Loy V2: CASH/CREDIT retail, payment อื่น wholesale; classic `/station/[id]` มี rule เก่ากว่าและไม่ใช้เป็น parity baseline

## Owner & Truck Management
- **Owner groups**: SUGAR_FACTORY, GENERAL_CREDIT, BOX_TRUCK, OIL_TRUCK, OOY_TRUCK
- **Credit system**: `creditLimit` + `currentCredit` ใน Owner model
- **Truck**: ผูกกับ Owner ผ่าน `ownerId`

## Changelog
- 2026-08-27: S44 financial regression gate ผ่าน 16 files/81 tests, เพิ่ม BillingCollection verification overpay rollback, ล็อก canonical Invoice payment endpoint และ current FULL V2 price parity
- 2026-04-27: เพิ่ม helper เลขบิลถัดไปสำหรับ station transactions และ Tank Loy UI เติมเลขที่บิลอัตโนมัติจากเล่มล่าสุด/เล่มที่เลือก
- 2026-04-25: audit ระบบบิลเงินเชื่อและ connection จริง พบ invoice/pending/debt report ตก `OIL_TRUCK_SUPACHAI`, search APIs ไม่มี auth, credit-like entry ยังพึ่ง ownerName/ทะเบียนแบบไม่ enforce, `owners.currentCredit` drift จากยอดค้างจริง 168 owners, และ patch hardening หลักโดยไม่แก้ข้อมูลเก่า
- 2026-04-21: บันทึกว่าใบวางบิล/ใบแจ้งหนี้ยึด `ownerId` เป็นหลัก, เพิ่มผล audit live DB เรื่อง missing `ownerId`, duplicate owner names, duplicate owner codes, `venderCode` ที่ยังว่าง, และย้ำว่าการเชื่อม external system ต้อง map ลูกค้าด้วย stable key ก่อน
- 2026-02-24: สร้างไฟล์ brain topic นี้จากประวัติการทำงานจริง
- 2026-02-23: แก้ sort order billing จาก string เป็น numeric (parseInt)
- 2026-02-21: แก้ sort ของ billing notes

### Canonical Customer master data (S102 — 2026-08-30)
- `/owners` ถูก retire ไป `/customers`; ADMIN เพิ่มลูกค้าได้จาก Customers และแก้ชื่อ/โทร/กลุ่ม/vendor code/วงเงิน + soft-deactivate ใน Customer 360.
- Customer 360 เพิ่มรถและแก้ทะเบียนของรถที่ยังผูกกับ owner เดิมได้ โดยใช้ Owner/Truck APIs เดิม ไม่สร้าง source of truth ใหม่.
- STAFF canonical permission `canManageMasterData=false`; `/trucks` ยัง KEEP สำหรับ cross-owner reassignment และ `/admin/owners` ยัง KEEP สำหรับ duplicate merge ไป S103.
- UAT จับ Neon P1001 ตอน Customer read; `/api/customers` list/detail จึงใช้ `withPrismaReadRetry` policy เดิมสำหรับ P1001/P2024.
- Gates: targeted 81/81, financial 90/90, full 424/424, build 127/127; isolated UAT create/edit/add truck/edit plate/deactivate ผ่านและ cleanup 0/0.

### Customer duplicate merge / truck reassignment (S103 — 2026-08-30)
- `/trucks` และ `/admin/owners` retire ไป `/customers`; ADMIN tools ใน Customers รองรับย้ายรถข้าม owner และ merge owner ซ้ำ.
- merge ต้องย้าย Truck + Transaction + Invoice + BillingCollection ใน transaction เดียว, AuditLog `MERGE`, และคง BillingCollection `ownerName` เป็น snapshot เดิม.
- source LINE mapping ย้ายได้เมื่อ target ยังไม่มีเท่านั้น; ถ้าทั้งคู่มี LINE ให้ 409 เพื่อกันผูกผิดคน.
- `currentCredit` legacy ของ source ถูกบวกเข้า target เพื่อไม่ทำ indicator เดิมหาย แต่ยอดหนี้ canonical ยัง derive จาก unbilled/invoice/collection records.
- UAT เจอ P2028 จาก default interactive timeout 5s; แก้ด้วย bounded `maxWait=5s`, `timeout=20s` โดยไม่ retry write แล้ว real merge ผ่านครบ relation + audit.
- Gates: targeted 87/87 + final route 68/68, financial 90/90, full 430/430, build 127/127; cleanup fixture ทุก relation = 0.
