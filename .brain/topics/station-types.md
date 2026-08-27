<!-- SUMMARY: 6 สถานี: แท๊งลอยวัชรเกียรติ (FULL) ยังคง operational workspace `/station/1/v2` และ classic admin `/station/1`, S55-S56 retire legacy sale entries ไป canonical sales และ S57 retire `/station/1/new/open-shift` ไป canonical `/stations/station-1/operations`; admin แก้มิเตอร์ย้อนหลังใช้ exact start/end shift scope, daily report รวมเลขเปิดแรกกับเลขปิดสุดท้าย, และ Windows agent พิมพ์สรุปเมื่อวานเข้า Epson TM-m30III ผ่าน Wi-Fi เวลา 07:00;
     วัชรเกียรติออยล์/พงษ์อนันต์ปิโตรเลียม/ศุภชัยบริการ (SIMPLE) ย้ายงานหน้าปั๊มไป POS แล้ว โดย S45 redirect legacy landing `/simple-station/[id]` ของ 2/3/4 ไป canonical read-only workspace, ปั๊มแก๊สพงษ์อนันต์/ปั๊มแก๊สศุภชัย (GAS) ใช้ operational landing `/gas/[id]` แต่ S53-S54 retire ทั้ง current `/gas/5|6/sell` และ older `/gas-station/5|6/new/sell` ไป canonical `/stations/station-5|6/sales`, GAS มี 2 กะตายตัว 07:00-19:00 และ 19:00-07:00 โดยกะ 2 ข้ามวันได้, supply receiving `/gas/[id]/supplies`, meter continuity ใน admin report, admin แก้เลขเปิดมิเตอร์และยอดกระทบยอดจากรายงานมิเตอร์พร้อม Audit Log, executive print report `/admin/gas/reports/executive`, และ admin `/admin/gas/*`; legacy admin gas-control redirect ไป v2 -->

# Station Types

## Overview
ระบบรองรับ 3 ประเภทสถานี โดยแต่ละประเภทมี UI และฟีเจอร์ต่างกัน

## Stations

| # | สถานี | ประเภท | Route | คุณสมบัติ |
|---|-------|--------|-------|-----------|
| 1 | แท๊งลอยวัชรเกียรติ | FULL | `/station/1/v2` | มิเตอร์ 4 หัวจ่าย + บันทึกบิล + สรุปยอด |
| 2 | วัชรเกียรติออยล์ | SIMPLE | canonical `/stations/station-2` | ย้ายงานหน้าปั๊มไป POS; legacy landing/home redirect แล้ว |
| 3 | พงษ์อนันต์ปิโตรเลียม | SIMPLE | canonical `/stations/station-3` | ย้ายงานหน้าปั๊มไป POS; legacy landing/home redirect แล้ว |
| 4 | ศุภชัยบริการ | SIMPLE | canonical `/stations/station-4` | ย้ายงานหน้าปั๊มไป POS; legacy landing/home redirect แล้ว |
| 5 | ปั๊มแก๊สพงษ์อนันต์ | GAS | `/gas/[id]` | แก๊ส + สินค้า |
| 6 | ปั๊มแก๊สศุภชัย | GAS | `/gas/[id]` | แก๊สอย่างเดียว |

## Station Type Features

### FULL Station
- มิเตอร์ 4 หัวจ่าย (Nozzle system)
- Shift management (กะเช้า/กะบ่าย)
- Meter reading (มิเตอร์เริ่มต้น/สิ้นสุด)
- Daily anomaly detection
- Shift reconciliation (ตรวจยอดปิดกะ)
- Supported operational workspace: `/station/1/v2`; S55-S56 ทำให้ legacy sale entries ไป canonical SaleFlow และ S57 ทำให้ `/station/1/new/open-shift` ไป canonical `/stations/station-1/operations` โดยตรงหลัง S38-S40 parity/regression
- Admin classic route: `/station/1`
- Legacy `/station/1/new/*` อื่นและ `/simple-station/1/new/*` ยัง redirect เข้า `/station/1/v2` เพื่อปิดทางเข้าหน้าดำ; `/station/1/new/receipt` ยังเป็น thermal print surface, sale entries ไป canonical sales และ `/station/1/new/open-shift` ไป canonical operations (simple-station aliases ยังไป V2)
- V2 meter start ต้องสร้าง/ผูก `Shift OPEN` ด้วยเสมอ เพราะ transaction API ต้องผูก `shiftId`; ถ้ามี daily meter start แล้วแต่ shift หาย ให้ auto-repair ผ่าน `full-station-shift-sync`
- Windows auto print รัน 07:00 ทุกวัน ดึง station-wide report ของเมื่อวาน รอเลขเปิด-ปิดมิเตอร์ครบ 4 หัว แล้วส่ง ePOS XML เข้า Epson TM-m30III ผ่าน Wi-Fi

### SIMPLE Station
- station-2/3/4 ย้ายงานหน้าปั๊มไป POS แล้ว; S45-S52 retire legacy operational/create routes ครบทั้งหมด (`landing`, `home`, `sell`, `oil-sell`, `open-shift`, `close-shift`, `shift-end`, `products`) ด้วย server redirect ไป canonical `/stations/station-[id]` ก่อน hydrate
- canonical station-2/3/4 เป็น read-only workspace; ระบบนี้คงข้อมูลเดิมเพื่อ history/report/customer/billing และยังเก็บ legacy API/source compatibility
- read-only `/new/shift-history`, `/new/meter-summary`, `/new/summary`, `/new/receipt` ยังไม่ retire จนมี explicit read-compatibility task
- historical capability เดิม: บันทึกบิลอย่างเดียว, เลือกชนิดน้ำมัน และไม่มี meter workflow แบบ FULL

### GAS Station
- S53: current sell entry `/gas/5/sell` และ `/gas/6/sell` redirect server-side ไป canonical `/stations/station-5/sales` และ `/stations/station-6/sales`; current GAS landing/layout ชี้ canonical sales ตรง และเก็บ v2 sell API/legacy source ไว้
- S54: older `/gas-station/5|6/new/sell` redirect canonical sales โดยตรงทั้ง middleware/page และ login redirect normalization; ไม่ผ่าน current GAS sell อีกต่อไป และ non-sell older routes ยัง compatibility ตามเดิม
- บันทึกแก๊ส (กิโลกรัม + ราคา/กก.)
- Shift management (กะ 1 = 07:00-19:00, กะ 2 = 19:00-07:00; กะ 2 ข้ามวันได้และ business date ช่วง 00:00-06:59 ยังนับเป็นวันก่อนหน้า)
- Gauge reading (เกจวัดถังแก๊ส)
- Supply receiving: พนักงาน/แอดมินบันทึกสั่ง-ลงแก๊สเข้าถังผ่าน `gas_supplies` โดยใช้ v2 routes เท่านั้น
- Meter continuity: admin meter report/executive alert ตรวจเลขเปิดกะว่าต่อจากเลขปิดกะก่อนหน้าต่อหัวจ่ายหรือไม่
- Admin meter report: `/admin/gas/reports/meters` แสดงกะ 2 ก่อนกะ 1 ในวันเดียวกัน, ยุบคอลัมน์ให้ไม่ต้องเลื่อนขวา, และช่องยอดเงินใช้ยอดรับจริงจาก reconciliation ถ้าปิดกะแล้ว
- Admin meter edit: `/admin/gas/reports/meters` มีปุ่ม `แก้มิเตอร์` ต่อกะไปที่ `/admin/gas/meters/[shiftId]/edit`; แอดมินแก้เลขเปิด 4 หัว, ใช้เลขปิดกะก่อนหน้าเป็นค่าอ้างอิง, ใส่เหตุผล, และระบบคำนวณ `soldQty`/reconciliation ใหม่พร้อม Audit Log
- Admin reconciliation edit: `/admin/gas/reconciliation` แก้ยอดรับจริงหลังปิดกะได้ และ `/admin/gas/reports/meters` มีปุ่ม `แก้ยอด` เพื่อเปิดกะนั้นโดยตรง
- Executive print report: แอดมินพิมพ์รายงานเสนอผู้บริหารตามช่วงวันที่ได้ที่ `/admin/gas/reports/executive` โดยรวมรายได้, รายงานเลขมิเตอร์, payment mix, รายการลงแก๊ส, และ management notes
- บางสถานีมี Products (สินค้าเสริม)

## Key Files
- **FULL staff UI implementation**: `/src/app/station/[id]/v2/page.tsx` และ components ใต้ `/src/app/station/[id]/v2/components` โดยมี `OperationsCommandPanel` เป็น command center สำหรับสถานะมิเตอร์/หลักฐาน/ยอดขาย
- **FULL admin health implementation**: `/src/app/station/[id]/page.tsx` มี `Admin Data Health` panel เพื่อแสดงข้อมูลจาก V2 ครบทั้งรูปมิเตอร์, สลิปโอน, เลขบิล, ลูกค้าเงินเชื่อ, ยอดลิตร/เงิน และผลต่างมิเตอร์
- **FULL daily print report**: `/src/lib/daily-report-print.ts` ใช้กับ V2 และ classic admin เพื่อพิมพ์สรุปวันพร้อมเลขเปิด-ปิดมิเตอร์, รายการเติมทั้งหมด, ยอดเงินรวม และผลต่างลิตรระหว่างมิเตอร์กับรายการเติม ทั้ง A4 professional report และ Android Epson direct thermal 58/80mm สำหรับ TM-m30III
- **FULL Windows auto print**: API `/src/app/api/automation/tank-loy/daily-report/route.ts`, report source `/src/lib/tank-loy-auto-print.ts`, Windows worker/installer `/scripts/tank-loy-auto-print.ps1` + `/scripts/install-tank-loy-auto-print.ps1` + `/scripts/install-tank-loy-auto-print.cmd`, และคู่มือ `/docs/TANK_LOY_AUTO_PRINT_WINDOWS.md`
- **FULL thermal receipt implementation**: `/src/app/station/[id]/new/receipt/page.tsx` (re-export จาก simple receipt สำหรับ V2 print) และ Android Epson direct XML helper `/src/lib/thermal-receipt-print.ts` สำหรับตัดต้นฉบับ/สำเนาอัตโนมัติ
- **GAS staff UI**: `/src/app/gas/[stationId]/page.tsx`
- **GAS staff supply receiving**: `/src/app/gas/[stationId]/supplies/page.tsx`
- **GAS admin operations**: `/src/app/admin/gas/operations/page.tsx`
- **GAS admin meter edit**: `/src/app/admin/gas/meters/[shiftId]/edit/page.tsx`, API `/src/app/api/v2/gas/admin/meters/[shiftId]/route.ts`
- **GAS admin supply receiving**: `/src/app/admin/gas/supplies/page.tsx`
- **GAS executive print report**: `/src/app/admin/gas/reports/executive/page.tsx`, API `/src/app/api/v2/gas/admin/reports/executive/route.ts`, builder `/src/lib/gas/executive-report.ts`
- **Constants**: `/src/constants/index.ts`

## Changelog
- 2026-08-27: S57 retire FULL `/station/1/new/open-shift` ไป canonical `/stations/station-1/operations` หลัง operational pre-gate 123/123 + financial gate 81/81; canonical ใช้ daily/shift APIs เดิมและบังคับ start meter 4 หัว + รูปก่อนขาย ขณะที่ V2/close/shift-end/receipt ยัง compatibility
- 2026-08-27: S56 retire FULL `/station/1/new/oil-sell` ไป canonical `/stations/station-1/sales` หลัง financial gate 81/81; route เดิมเป็น redirect-only และไม่เพิ่ม product capability; คง V2/home/receipt/simple-station alias compatibility
- 2026-08-27: S55 retire FULL `/station/1/new/sell` ไป canonical `/stations/station-1/sales` หลัง financial gate 81/81; คง V2/home/receipt/oil-sell และ simple-station alias compatibility ตามเดิม
- 2026-08-27: S54 retire older GAS `/gas-station/5|6/new/sell` ไป canonical sales โดยตรงหลัง final financial gate 81/81; preserve older non-sell routes และ API/read/report compatibility
- 2026-08-27: S53 retire current GAS sell `/gas/5|6/sell` ไป canonical sales หลัง rerun financial gate 81/81; เก็บ current GAS landing/open/close และ older `/gas-station/[id]/new/sell` เป็น compatibility/future retirement แยก family
- 2026-07-19: เพิ่ม Windows Scheduled Task พิมพ์สรุปวันแท๊งลอยของเมื่อวานเวลา 07:00 เข้า Epson TM-m30III ผ่าน Wi-Fi พร้อม retry เมื่อมิเตอร์ยังไม่ครบและ duplicate guard
- 2026-07-15: ซ่อมเลขเปิดกะ 1 ของ `station-5` ให้ต่อจากเลขปิดกะก่อนหน้า 4 หัวพร้อม Audit Log และเพิ่มหน้า admin แก้เลขเปิดมิเตอร์จากรายงานมิเตอร์โดยคำนวณลิตร/reconciliation ใหม่อัตโนมัติ
- 2026-07-11: แก้ Tank Loy admin meter backfill ให้แยก live shift กับ daily start/end scope, รวมมิเตอร์รายวันข้าม split shift และกัน duplicate OPEN shift race
- 2026-02-24: สร้างไฟล์ brain topic นี้
- 2026-01: แยกมิเตอร์ตามกะ, แก้ shift filter, fuel price sync
- 2026-04-23: Modernized GAS UI (Linear-inspired, card-based layout) for /gas-station/[id]
- 2026-04-26: Consolidate Tank Loy routes ให้เหลือ staff UI เดียวที่ `/station/1/new/*` และ classic admin ที่ `/station/1`; route legacy `/simple-station/1/new/*` redirect เข้าหน้า staff จริง
- 2026-04-27: เปิด `/station/1/v2` กลับเป็น supported live mobile flow ชั่วคราวหลังพบ production ยังใช้หน้านี้จริง; เพิ่มปุ่มพิมพ์ transaction และปุ่มดูรูปมิเตอร์เปิด/ปิดใน V2
- 2026-04-27: เปลี่ยน canonical staff route ของแท๊งลอยเป็น `/station/1/v2`; ปุ่มจาก admin/login/sidebar/dashboard ชี้ V2 และ legacy `/station/1/new/*` redirect เข้า V2 ยกเว้น receipt
- 2026-04-27: ยกระดับ V2 เป็น operational command UI และเพิ่ม admin data health panel ให้แอดมินเห็นข้อมูลจาก V2 ครบในหน้าเดียว
- 2026-04-27: บังคับ logout session พนักงาน `station-1` ที่สร้างก่อน 18:36 +07 เพื่อปิดหน้าเดิมที่เปิดค้าง และให้ login ใหม่เข้า `/station/1/v2`
- 2026-04-28: อัปเดต route note ของ GAS ให้ใช้ `/gas/[id]` เป็น staff UI หลัก และเพิ่ม admin operations page สำหรับแก้ราคาหลัก/จัดการกะค้าง
- 2026-04-28: ซ่อม V2 meter-start/no-shift incident และเพิ่ม auto shift sync ให้ transaction ไม่เจอ false “กรุณาเปิดกะก่อน”
- 2026-04-28: เพิ่มปุ่มพิมพ์สรุปวันใน V2 พร้อมกระทบยอดมิเตอร์เทียบรายการเติมในรายงานเดียว
- 2026-04-28: เพิ่ม thermal daily summary 58/80mm สำหรับ Epson TM-m30III ในหน้า V2
- 2026-04-28: ปรับ Tank Loy V2 layout ให้แผงพิมพ์สรุปวันอยู่เฉพาะแท็บ `สรุป` และย้ายปุ่มบันทึกการเติมเข้า content flow แทน fixed overlay เพื่อไม่บังหน้าทำงาน
- 2026-04-28: harden GAS staff open-shift ให้ไม่กดแล้วเงียบ, รองรับตัวเลขแบบ comma/เลขไทย, auto-scroll error, และให้เลือกกะบ่ายได้เมื่อยังไม่มีกะของวันนั้นในระบบ
- 2026-05-01: เพิ่ม v2 supply receiving สำหรับ GAS ทั้ง staff/admin, เพิ่ม meter continuity ใน admin analytics/report/executive alerts, และปิด `/admin/gas-control` ให้ redirect ไป `/admin/gas`
- 2026-05-03: ปรับ GAS v2 ให้รองรับกะค่ำข้ามวัน: active/current/summary/sell/price/open guard ใช้ช่วงเมื่อวานถึงวันนี้ และ analytics ดึง transactions ตาม `shiftId` เพื่อเก็บยอดหลังเที่ยงคืนไว้กับ business day ของกะเดิม
- 2026-05-03: เพิ่มหน้า GAS executive print report `/admin/gas/reports/executive` สำหรับรายงานเสนอผู้บริหารตามช่วงเวลา รวมรายได้ เลขมิเตอร์ และรายการลงแก๊สในหน้า A4 print-friendly
- 2026-05-06: เพิ่ม Android Epson direct thermal receipt/credit bill print สำหรับ Tank Loy ให้ใช้พื้นที่ 80mm กว้างขึ้นและ cut แยกต้นฉบับ/สำเนาอัตโนมัติ
- 2026-05-06: ปรับ Tank Loy daily summary print hierarchy: mobile thermal เน้นยอดรวม/มิเตอร์/ผลต่าง และ classic admin ใช้ A4 professional report template
- 2026-05-06: ปรับ Tank Loy mobile daily summary ใช้ font หลักแบบไม่หนาใน direct XML และให้รายการย่อยใช้ `font_b` เพื่ออ่านง่ายบนเครื่องจริง
- 2026-05-06: ปรับตามรูปหน้างาน direct print: daily summary ถอด `em=true` ให้ตัวบางลง และ receipt/credit direct print ลด columns+เติม left padding เพื่อขยับเข้ากลางกระดาษ
- 2026-05-06: ปรับ GAS admin meter report ให้ตารางไม่ล้นกรอบ, เรียงกะ 2 ก่อนกะ 1 และแสดงยอดรับจริงจาก reconciliation เมื่อมีข้อมูลปิดกะ
- 2026-05-06: เพิ่มปุ่มแก้ยอดสรุปกะ GAS ใน `/admin/gas/reconciliation` และลิงก์จาก `/admin/gas/reports/meters` เพื่อให้แอดมินแก้เงินสด/เครดิต/บัตร/โอนหลังปิดกะได้
- 2026-05-12: ปรับ GAS shift schedule กลางเป็นกะ 1 07:00-19:00 และกะ 2 19:00-07:00, ให้ business date ก่อน 07:00 นับเป็นวันก่อนหน้า, และให้รายงานแสดงช่วงเวลากะชัดเจน
