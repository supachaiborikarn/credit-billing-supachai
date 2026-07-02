# การแยกยอดรับตามประเภทสินค้า (ปั๊มแก๊สพงษ์อนันต์)

## ปัญหาเดิม
เงินขายเครื่องดื่ม/สินค้าอื่นรวมอยู่ในเงินสดส่ง โดยกรอกเป็นก้อนเดียวในช่อง "ขายอื่น" ตอนปิดกะ แยกไม่ได้ว่ามาจากสินค้าอะไร และค่า `nonGasSalesAmount`/`otherExpensesAmount` ถูกเก็บแบบฝังใน string ของ `varianceNote`

## หลักการใหม่: แยกยอดรับเป็น 4 ประเภท
1. **แก๊ส** — คำนวณจากมิเตอร์หัวจ่าย × ราคา (เหมือนเดิม)
2. **สินค้า (เครื่องดื่มฯ)** — คำนวณจากการนับสต็อกตอนปิดกะ: `ขายได้ = ยกมา + รับเข้า − นับคงเหลือ` แล้วคูณราคาขาย ระบบคิดให้อัตโนมัติ
3. **รายรับอื่น** — กรอกเอง + หมายเหตุ (เช่น ค่าเช่าพื้นที่)
4. **ค่าใช้จ่ายจากเงินสด** — กรอกเอง + หมายเหตุ

สูตร: `ยอดที่ควรได้ = แก๊ส + สินค้า + รายรับอื่น − ค่าใช้จ่าย`
`เงินสดควรส่ง = เงินสดแก๊ส + (สินค้า − ส่วนที่รับโอน/สแกน) + รายรับอื่น − ค่าใช้จ่าย`

## การเปลี่ยนแปลง

### Schema (`prisma/schema.prisma`) — เพิ่มอย่างเดียว ไม่กระทบข้อมูลเดิม
- `ProductSale.shiftId` (nullable) + index — ผูกยอดขายเข้ากับกะ
- `ShiftReconciliation` เพิ่ม: `productSalesAmount`, `productTransferAmount`, `otherIncomeAmount`, `otherIncomeNote`, `otherExpensesAmount`, `otherExpenseNote`

### API
- `POST /api/v2/gas/[stationId]/shift/close` — รับ `products[]` (productId, received, closingQty), `productTransferAmount`, `otherIncomeAmount/Note`, `otherExpensesAmount/Note` ใน transaction เดียว: สร้าง `ProductSale` (ผูก shiftId), `ProductReceipt`, อัปเดตสต็อก, บันทึก reconciliation แบบแยกคอลัมน์ (ยังเขียน varianceNote แบบเก่าไว้เพื่อ backward compat) — client เก่าที่ส่ง `nonGasSalesAmount` ก้อนเดียวยังใช้ได้ (map เป็นรายรับอื่น)
- `POST /api/gas-station/[id]/products` — เพิ่ม action `create` (สร้างสินค้า+สต็อกในขั้นเดียว) และ `update` (แก้ราคา/จุดแจ้งเตือน)
- รายงาน admin (`reports/shift`, `reconciliation`, `data-entry`) — อ่าน/เขียนคอลัมน์ใหม่ก่อน ถ้าเป็นข้อมูลเก่า fallback ไป parse จาก varianceNote

### UI
- **หน้าปิดกะ** — เพิ่มตารางนับสต็อก (ยกมา → รับเข้า → คงเหลือ → ขายได้อัตโนมัติ), ช่อง "ส่วนที่รับโอน/สแกน", แยกช่องรายรับอื่น + ค่าใช้จ่าย พร้อมหมายเหตุ
- **หน้าสินค้า** (เมนูใหม่ `/gas/[stationId]/products`) — เพิ่มสินค้า, รับของเข้า, แก้ราคา/จุดแจ้งเตือน, ป้ายเตือนใกล้หมด, ประวัติรับ/ขาย
- **รายงานกะ admin** — แสดงยอดแยก: สินค้า (นับสต็อก) / รับโอน / รายรับอื่น

### หมายเหตุการชำระเงิน
รายการ `ProductSale` จากการนับสต็อกบันทึกเป็น CASH (ไม่รู้วิธีชำระรายชิ้น) — ยอดเงินสด vs โอนที่ถูกต้องดูจาก `productTransferAmount` ใน reconciliation

## ขั้นตอน deploy
```bash
npx prisma generate   # regenerate client (แก้ TS error 8 จุดที่เหลือ)
npx prisma db push    # เพิ่มคอลัมน์ใหม่ (additive ปลอดภัยต่อข้อมูลเดิม)
```
จากนั้นเข้าหน้า "สินค้า" เพิ่มรายการเครื่องดื่มพร้อมจำนวนตั้งต้นก่อนเปิดกะแรก
