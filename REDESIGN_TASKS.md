# Credit Billing Redesign — 30-Minute Session Backlog

เอกสารนี้เป็นแผนหลักสำหรับ redesign ระบบ Credit Billing แบบค่อยเป็นค่อยไป โดยแต่ละ session จำกัดไม่เกิน 30 นาที และต้องจบเป็นชิ้นที่ตรวจสอบได้

## เป้าหมายหลัก

เปลี่ยนระบบจากโครงสร้างแบบ “เลือกโมดูล/เลือกเวอร์ชันของหน้า” ไปเป็น “ทำงานตามสิ่งที่ต้องทำตอนนี้” โดยไม่ Big Bang rewrite และไม่ทำลายข้อมูล/flow การเงินเดิม

แนวคิดหลัก:

- หน้าเริ่มต้นใหม่คือ Today workspace
- Staff active station: เปิดกะ → ขาย → ตรวจความผิดปกติ → ปิดกะ → กระทบยอด
- Unified Sale Flow ใช้กับสถานีที่ยัง active คือ station-1 และ GAS station-5/6
- station-2/3/4 ย้ายงานหน้าปั๊มไป POS แล้ว จึงเป็น retired/read-only ในระบบนี้
- Billing UX รวม Invoice + BillingCollection ในพื้นที่เดียวก่อน โดยยังไม่ merge database model
- Customer 360 รวมเครดิต รถ การซื้อ วางบิล และการชำระเงิน
- ลด legacy routes ทีละส่วนหลัง parity/financial validation หรือปิดได้ทันทีเมื่อเป็น route ของสถานีที่ธุรกิจยืนยันว่าเลิกใช้แล้ว

---

# กติกาการทำแต่ละ Session

1. จำกัดเวลาไม่เกิน 30 นาที
2. ทำ 1 เป้าหมายหลักต่อ session
3. ก่อนแก้ code ให้ดู `git status`
4. ห้ามรื้อ flow ที่ยังใช้งานจริงจนกว่าของใหม่จะ feature parity
5. ถ้างานใหญ่เกิน 30 นาที ให้หยุดที่ checkpoint และแตก session ใหม่
6. ทุก session ต้องจบด้วยอย่างน้อยหนึ่งอย่าง:
   - code ที่ typecheck/build ตาม baseline ได้
   - wireframe/decision ที่บันทึกแล้ว
   - test/checklist ที่ชัดเจน
   - commit-ready checkpoint
7. อัปเดต Session Log ทุกครั้ง

สถานะ:

- `[ ]` ยังไม่เริ่ม
- `[~]` กำลังทำ / ค้าง
- `[x]` เสร็จ
- `[!]` ติดปัญหา

---

# PHASE 0 — Safety & Baseline

## S01 — สร้าง branch และ baseline
- [x] ตรวจ `git status`
- [x] บันทึก branch ปัจจุบัน (`main`)
- [x] สร้าง branch `redesign/ux-v2`
- [x] ตรวจว่าไม่มี production source ของ AI ตัวก่อนค้างโดยไม่ตั้งใจ

**Done เมื่อ:** มี branch แยกสำหรับ redesign และรู้ baseline ชัดเจน

## S02 — ตรวจ build / lint / typecheck baseline
- [x] ดู scripts ใน `package.json`
- [x] รัน checks ที่เหมาะสม
- [x] บันทึก error ที่มีอยู่ก่อน redesign

**Baseline:**
- `npx tsc --noEmit` ผ่าน
- ESLint เดิม: 38 errors / 106 warnings
- `next build` compile + TypeScript ผ่าน แต่ล้มตอน prerender `/admin/low-stock`
- baseline build error: `Cannot read properties of null (reading 'useState')`

## S03 — Route Inventory ฉบับใช้งานจริง
- [x] สรุป routes station / gas / simple / billing / customers
- [x] ระบุ canonical route เป้าหมาย
- [x] ทำตาราง Old Route → Future Route
- [x] ทำเครื่องหมาย operational routes station-2/3/4 เป็น retired และกำหนดปลายทาง read-only/notice

**Done เมื่อ:** `ROUTE_MIGRATION_PLAN.md` เป็น source-of-truth ของ canonical destination + Old Route → Future Route + disposition แยก FULL/GAS/SIMPLE/Billing/Customers

---

# PHASE 1 — UX Foundation

## S04 — นิยาม Navigation ใหม่
- [x] กำหนดเมนูหลัก
- [x] แยก STAFF กับ ADMIN
- [x] ระบุเมนูที่ย้ายเข้า More
- [x] ซ่อน operational entry ของ station-2/3/4

**Done เมื่อ:** navigation map ชัดก่อนสร้าง shell

### S04 Navigation Decision

#### ADMIN — primary navigation
1. **Today** → `/today`
   - work queue, exceptions, active-station status
2. **Sales** → `/sales`
   - ค้น/ดูรายการขายข้าม active station
   - station context เลือกภายในหน้า ไม่ทำ station list เป็นเมนูหลัก
3. **Customers** → `/customers`
   - customer list + Customer 360 + trucks + credit context
4. **Billing** → `/billing`
   - invoice, billing collection, outstanding, receive payment, credit-limit workflow
5. **More**
   - Reports
   - Stations & history
   - Operations / anomaly / reconciliation / audit tools
   - Users & permissions
   - Settings
   - Integrations

#### STAFF — active station (`station-1`, `station-5`, `station-6`)
1. **Today** → `/today`
2. **Sales** → `/stations/[id]/sales`
3. **Customers** → `/customers` ตาม permission ที่จำเป็นกับงานขาย
4. **History** → `/stations/[id]/history`
5. **More** → profile, station info, secondary tools, logout

STAFF ไม่แสดง Billing เป็น primary navigation; credit fields ที่ต้องใช้ตอนขายยังอยู่ใน Sale Flow ตาม permission

#### Retired station (`station-2`, `station-3`, `station-4`)
- ไม่มีปุ่มขายใหม่ / เปิดกะ / ปิดกะ / operations
- ADMIN เข้าข้อมูลเดิมผ่าน More → Stations & history แบบ read-only
- STAFF account ที่ยังผูกสาขาเหล่านี้ให้ Today แสดง “ย้ายการใช้งานไป POS แล้ว” และไม่มี CTA สร้าง transaction ใหม่
- historical transactions ยังต้องค้นได้จาก Sales/Customers/Billing/Reports เมื่อเกี่ยวข้อง

#### Shell behavior
- Desktop: sidebar มี 5 primary domains ไม่แสดง station list ยาว
- Mobile ADMIN: Today / Sales / Customers / Billing / More
- Mobile STAFF: Today / Sales / Customers / History / More
- ไม่มี FAB `+` ที่ hard-code ไป station-1
- ปุ่ม “ขายใหม่” เป็น contextual action จาก Today/Sales ตาม current station
- current station selector อยู่ใน page header/context area
- legacy/admin tools ย้ายเข้า domain หรือ More แทนการเป็นเมนูระดับแรก

## S05 — นิยาม Design Tokens ใหม่
- [x] สี background / surface / border / text / primary / semantic
- [x] spacing scale
- [x] radius
- [x] typography hierarchy
- [x] shadow rules

**Done เมื่อ:** runtime token ชุดใหม่พร้อมให้ primitives/shell ใช้

### S05 Token Decision
- runtime source: `src/styles/design-tokens.css`
- namespace ใหม่: `--ui-*`
- primary/action: orange
- neutral: slate
- violet ใช้เฉพาะ semantic credit/payment grouping
- font: Sarabun
- radius default: 8px; major dialog/card 12px
- 4px spacing grid
- borders/surface contrast มาก่อน shadow
- no glow / decorative gradient ใน UI ใหม่
- legacy globals ยังเก็บไว้ชั่วคราวเพื่อไม่ทำหน้าเดิมพัง

## S06 — UI Primitive: Button + Input
- [x] Button variants
- [x] Input / Label / Error state
- [x] loading / disabled

**Done เมื่อ:** หน้าใหม่ไม่เขียน button/input style ซ้ำ

## S07 — UI Primitive: Card + Section + Empty State
- [x] Section header
- [x] surface/card
- [x] empty state
- [x] alert/notice pattern

**Done เมื่อ:** หน้าใหม่ใช้ Section/Card/EmptyState/Notice ชุดเดียวกัน ลด page-local card patterns

## S08 — UI Primitive: Table/List responsive
- [x] desktop table pattern
- [x] mobile list/card transformation
- [x] row action pattern

**Done เมื่อ:** หน้า Sales/Billing/Customers ใช้ `ResponsiveDataView` แทนการบังคับเลื่อนตารางบนมือถือ

## S09 — Dialog / Toast / Confirm pattern
- [x] dialog มาตรฐาน
- [x] destructive confirm
- [x] toast success/error
- [x] แนวทางเลิก browser `alert()` / `confirm()`

**Done เมื่อ:** หน้า redesign ใหม่ใช้ `Dialog` / `ConfirmDialog` / ToastProvider และไม่เพิ่ม browser alert/confirm ใหม่

## S10 — App Shell ใหม่
- [x] desktop sidebar/topbar
- [x] mobile navigation
- [x] page container
- [x] active navigation state
- [x] role-based menu
- [x] current station context area

**Done เมื่อ:** shell ใหม่พร้อมให้ prototype ใช้งานโดยไม่ลบ shell เก่า

---

# PHASE 2 — TODAY WORKSPACE

## S11 — Define Today information architecture
- [x] ระบุสถานะก่อนเปิดกะ / ระหว่างกะ / รอปิดกะ / ปิดแล้ว
- [x] primary action ของแต่ละสถานะ
- [x] exception ที่ต้องเด่น
- [x] retired-station notice state

### S11 Today IA Decision

#### STAFF — active station
ลำดับข้อมูลจากบนลงล่าง:
1. **สถานะงานตอนนี้** — แสดงกะ/สถานี/วันที่ และ primary action เพียงหนึ่งอัน
2. **สิ่งที่ต้องทำก่อนจบงาน** — missing meter/gauge/evidence, anomaly, incomplete transaction
3. **รายการล่าสุด** — รายการขายล่าสุด 3–5 รายการ พร้อม action ที่เกี่ยวข้อง
4. **สรุปวันนี้แบบย่อ** — ยอดเงิน/จำนวนรายการ/ลิตร โดยไม่ใช้ metric cards จำนวนมาก

State + primary action:
- `NO_SHIFT` → **เปิดกะ**
- `SHIFT_OPEN` → **ขายใหม่**
- `SHIFT_NEEDS_ATTENTION` → **แก้รายการที่ต้องตรวจ** ก่อนขาย/ปิดกะตาม severity
- `READY_TO_CLOSE` → **ปิดกะ**
- `STALE_SHIFT` → **จัดการกะค้าง** (exception สูงสุด)
- `CLOSED` → **ดูสรุปวันนี้**

Exceptions ที่ต้องอยู่เหนือ summary:
- กะค้างจากวันก่อน
- มิเตอร์/เกจหรือรูปหลักฐานไม่ครบ
- transfer ไม่มี slip / credit data ไม่ครบ
- reconciliation variance เกิน threshold
- transaction ที่ไม่ผูก shift หรือข้อมูลผิดปกติ

#### ADMIN
ลำดับข้อมูลจากบนลงล่าง:
1. **ต้องจัดการตอนนี้** — work queue รวม exception ที่มี next action ชัด
2. **Active stations** — station-1, station-5, station-6 แสดงสถานะสั้นๆ และกดเข้า context ได้
3. **Billing attention** — รอวางบิล / เกินกำหนด / รอรับเงิน เฉพาะรายการที่ต้องทำ ไม่แสดง dashboard metric ทั่วไป
4. **Recent activity** — activity ล่าสุดที่มีประโยชน์ต่อการตรวจสอบ

ADMIN Today ไม่ใช้กราฟเป็น default; รายงาน/แนวโน้มย้ายไป Reports

#### Retired station staff
- แสดง notice: **สาขานี้ย้ายการใช้งานหน้าปั๊มไป POS แล้ว**
- ไม่มี CTA เปิดกะ/ขาย/ปิดกะ
- มีทางเข้า read-only history และข้อมูลลูกค้าที่ได้รับสิทธิ์

#### Interaction rules
- หนึ่ง section ต้องตอบคำถามว่า “ต้องทำอะไรต่อ” ไม่ใช่แค่โชว์ตัวเลข
- primary action ต้องมีหนึ่งอันต่อ state
- exception ต้องมาก่อน metrics
- mobile ต้องเห็น primary action โดยไม่ scroll ยาว
- summary เป็นรองจาก work queue และใช้ตัวเลขเท่าที่ช่วยตัดสินใจ

## S12 — Today data contract
- [x] Shift / DailyRecord / Transaction / Meter / anomaly
- [x] map API ปัจจุบัน
- [x] ระบุข้อมูลที่ขาด

### S12 Contract Decision
- หน้าใหม่อ่านข้อมูลผ่าน `GET /api/today` contract เดียว ไม่ fetch legacy station APIs หลายชุดจาก UI
- STAFF ได้ state: `NO_SHIFT / SHIFT_OPEN / SHIFT_NEEDS_ATTENTION / READY_TO_CLOSE / STALE_SHIFT / CLOSED / RETIRED`
- GAS ใช้ business date 07:00 boundary และ meter + gauge เป็น close requirements ตาม V2 backend
- FULL station-1 ใช้ canonical shift helper + daily transactions/meter data เดิม
- Work item ที่ยืนยันได้จาก backend ปัจจุบัน: stale shift, opening/closing data ไม่ครบ, meter/daily anomaly, transfer ไม่มี proof, credit ไม่มี owner, GAS transaction ไม่ผูก shift, reconciliation variance
- ADMIN รวม active station 1/5/6 + billing attention + pending anomalies + recent activity
- Billing attention แยก Invoice กับ BillingCollection ไม่รวมยอดข้าม workflow เพื่อไม่ double-count
- station-2/3/4 คืน state `RETIRED` และไม่ expose operational CTA
- ข้อมูลที่ยังไม่ควรเดา: photo evidence requirement (backend ไม่ได้บังคับทุก flow), readiness จากเวลาอย่างเดียว, billing lifecycle unified status — รอ phase billing adapter

**Contract files:** `src/types/today.ts`, `src/app/api/today/route.ts`

## S13 — Today page skeleton
- [x] สร้าง `/today`
- [x] header + current station/shift
- [x] primary action area
- [x] work queue placeholders

## S14 — Today work queue
- [x] สิ่งที่ต้องทำตอนนี้
- [x] anomaly / incomplete items
- [x] quick action ตาม state จริง
- [x] STAFF recent transactions + summary จริง
- [x] ADMIN active stations + billing attention + recent activity

**Done เมื่อ:** Today ตอบคำถาม “ตอนนี้ต้องทำอะไร” ได้จาก `GET /api/today` contract

## S15 — Today responsive polish
- [ ] desktop
- [ ] mobile
- [ ] touch targets
- [ ] loading/empty/error

---

# PHASE 3 — UNIFIED SALE FLOW

## S16 — Map active sale flows (FULL / GAS) + retired SIMPLE
- [x] map FULL station-1
- [x] map GAS station-5/6
- [x] mark SIMPLE station-2/3/4 read-only/legacy
- [x] shared fields vs conditional fields

### S16 Active Sale Map
**Shared invariant**
- ต้องเป็น active station และมี open shift ก่อน save
- transaction ต้องผูก `stationId`, `shiftId`, business date/date, payment, price, liters, amount, recordedBy
- customer/truck/bill เป็น conditional ตาม payment type
- backend เป็น source of truth สำหรับราคา/ลิตร/duplicate validation ก่อนบันทึก

**FULL — station-1**
- input หลัก = ลิตร; amount = liters × price
- เลือก nozzle 1–4
- price source = daily retail/wholesale rule
- credit-like = CREDIT / BOX_TRUCK / OIL_TRUCK_SUPACHAI
- credit-like ต้อง owner + truck/license plate + bill book/no
- TRANSFER ต้อง transfer proof
- API ปัจจุบัน = `/api/station/1/transactions`
- ใช้ Bangkok calendar date
- ไม่เพิ่ม product UI ใน redesign ของแท๊งลอย

**GAS — station-5/6**
- input หลัก = amount; backend คำนวณ liters จาก daily gas price
- transaction sale ไม่เลือก nozzle
- payment = CASH / CREDIT / CREDIT_CARD / TRANSFER
- CREDIT ต้อง owner + truck + bill book/no
- TRANSFER backend ปัจจุบันยังไม่บังคับ proof; ห้ามเพิ่ม requirement ฝั่ง UI จน business rule/backend ตรงกัน
- API ปัจจุบัน = `/api/v2/gas/[stationId]/sell`
- ใช้ GAS business day boundary 07:00
- station-5 product stock flow แยกจาก LPG sale; ไม่ยัดสินค้าเสริมใน main LPG form รอบแรก

**Retired SIMPLE — station-2/3/4**
- ไม่มี create-sale capability ใน redesign; read-only history/report/billing only

## S17 — Define SaleFlow data model
- [x] customer/truck
- [x] product/fuel
- [x] quantity/liters/amount
- [x] payment
- [x] bill/slip/evidence

**Done เมื่อ:** `src/lib/sales/sale-flow.ts` เป็น capability + draft model กลางสำหรับ active station 1/5/6

## S18 — SaleFlow customer/truck step
- [x] search plate/customer
- [x] selection state
- [x] permission-aware customer action

**Done เมื่อ:** `CustomerTruckStep` รองรับค้นหาชื่อ/รหัส/ทะเบียน, เลือกรถตาม station capability และผ่าน TypeScript + targeted ESLint

## S19 — SaleFlow product/quantity step
- [x] fuel/product selection
- [x] amount/liters behavior by station capability
- [x] price source rules

**Done เมื่อ:** `FuelQuantityStep` แยก FULL/GAS ตาม capability, คง legacy price behavior และให้ GAS backend เป็น source of truth ตอนบันทึก

## S20 — SaleFlow payment conditional fields
- [x] CREDIT → bill book/no + customer/truck requirements
- [x] TRANSFER → slip/evidence
- [x] CASH/card → hide irrelevant fields

**Done เมื่อ:** `PaymentStep` ใช้ capability กลาง, FULL transfer เลือกรูปสลิปแต่ยังไม่ upload จน S22, GAS ไม่บังคับ/ไม่ส่งสลิป และ credit แสดง bill requirements

## S21 — SaleFlow review/validation
- [x] summary before save
- [x] field-level errors
- [x] financial values prominent

**Done เมื่อ:** มี `validateSaleFlowDraft` + `SaleReviewStep`, error ส่งกลับไปยังแต่ละ step และ regression test ครอบคลุม financial/credit/transfer rules

## S22 — Integrate Transaction API
- [x] adapter to existing API
- [x] preserve existing financial contract
- [x] compare saved output

**Done เมื่อ:** `SaleFlowForm` เรียก adapter จริง, request-shape tests ตรง legacy FULL/GAS และ authenticated GAS real-save smoke ยืนยัน amount/liters จาก backend ก่อน void rollback กลับเป็นยอดเดิม; FULL runtime smoke ไม่ฝืนทำเพราะไม่มี current open shift

## S23 — SaleFlow mobile polish
- [x] one-hand operation
- [x] numeric keyboards
- [x] sticky CTA
- [x] safe-area

**Done เมื่อ:** CTA มือถืออยู่เหนือ bottom nav/safe-area, controls คง touch target, quantity/bill ใช้ numeric keyboard และ desktop ไม่ติด sticky CTA

---

# PHASE 4 — BILLING PIPELINE

## S24 — Map Invoice + BillingCollection lifecycle
- [x] รอวางบิล
- [x] เตรียมเอกสาร
- [x] วางบิลแล้ว
- [x] รอรับเงิน
- [x] จ่ายบางส่วน
- [x] ปิดยอด

**Done เมื่อ:** มี lifecycle contract 6 ขั้น โดยระบุชัดว่า PREPARING_DOCUMENTS/BILLED ยังไม่มี persisted signal; overdue เป็น derived attention overlay ไม่ใช่ pipeline stage

## S25 — Billing adapter
- [x] normalize Invoice/Payment
- [x] normalize BillingCollection/PaymentSlip
- [x] ไม่ merge DB model

**Done เมื่อ:** `adapter.ts` ให้ contract กลางที่ยังเก็บ source kind แยก, derive settlement จากยอดจริง, แยก pending/rejected slip และ flag data mismatch โดยไม่เขียน DB

## S26 — Billing list
- [x] pipeline tabs/filter
- [x] due/overdue
- [x] next action

**Done เมื่อ:** `/api/billing` + `/billing` ใช้ unified work-item contract, มี 6-stage tabs, search/source filter, overdue/attention และ next action โดยแยกยอด Invoice/Collection เพื่อไม่ double-count

## S27 — Billing detail
- [x] documents
- [x] customer
- [x] source transactions
- [x] payment state

**Done เมื่อ:** `/api/billing/[id]` + `/billing/[id]` อ่าน Invoice/Collection ผ่าน adapter เดียว แสดง document/customer/source/payment state และเตือน missing source links; งานรับชำระยังส่งกลับ legacy จน S28

## S28 — Receive payment
- [x] full payment
- [x] partial payment
- [x] evidence
- [x] confirmation

**Done เมื่อ:** unified detail มี admin-only receive dialog, Invoice ใช้ atomic payment route พร้อม concurrency guard, Collection สร้าง PENDING slip รอตรวจ, server/client บล็อก overpay และ invalid pending state

## S29 — Billing exceptions
- [x] missing docs
- [x] mismatch
- [x] overdue
- [x] duplicate/invalid state

**Done เมื่อ:** exception engine map missing source, paid/status mismatch, overdue, pending/rejected evidence และ multiple pending slips เป็น duplicate-invalid state; Billing list มี filter “เฉพาะต้องตรวจ”

---

# PHASE 5 — CUSTOMER 360

## S30 — Customer data contract
- [x] owner/customer
- [x] trucks
- [x] transactions
- [x] invoices/collections
- [x] payments
- [x] credit context

**Done เมื่อ:** `/api/customers/[id]` คืน Customer 360 contract เดียวพร้อม trucks/recent transactions/billing/payment timeline/credit buckets; `currentCredit` ถูกระบุเป็น legacy indicator และไม่รวม unbilled + Invoice + Collection เป็นยอดเดียว

## S31 — Customer list redesign
- [x] search
- [x] credit attention indicator
- [x] outstanding balance
- [x] contextual action

**Done เมื่อ:** `/api/customers` + `/customers` รองรับค้นหาชื่อ/รหัส/โทร/ทะเบียน, status/attention filter, แสดงยอดค้างแยก 3 bucket และจัด next action จาก overdue/payment-review/unbilled priority

## S32 — Customer 360 detail
- [x] overview
- [x] trucks
- [x] purchases
- [x] billing
- [x] payment history

**Done เมื่อ:** `/customers/[id]` ใช้ Customer 360 API contract เดียว แสดง overview/credit/trucks/recent purchases/billing/payment history และ link เอกสารกลับ unified Billing detail

---

# PHASE 6 — STATION CANONICAL ROUTES

## S33 — Define StationContext
- [x] current station
- [x] Station.type
- [x] active/retired status
- [x] permissions
- [x] current shift

**Done เมื่อ:** `StationContextPayload` + `/api/stations/[stationId]/context` เป็น source กลางของ station identity/type/status/permissions/current shift/canonical paths และ sale price context

## S34 — Canonical station route skeleton
- [x] `/stations/[id]`
- [x] `/stations/[id]/sales` active only
- [x] `/stations/[id]/operations` active only
- [x] `/stations/[id]/history`
- [x] station-2/3/4 ไม่มี entry สร้างงานใหม่

**Done เมื่อ:** canonical routes ทั้ง 4 เส้นใช้ workspace/context เดียวกัน; active routes มี legacy fallback ระหว่าง migration และ retired station แสดง read-only notice โดยไม่มี sale/operations CTA

## S35 — Move sales entry to canonical route
- [x] SaleFlow ใหม่
- [x] preserve old active route
- [x] compare output

**Done เมื่อ:** `/stations/[id]/sales` mount `SaleFlowForm` สำหรับ station-1/5/6 เมื่อมี OPEN shift + valid price context, บล็อกก่อน form เมื่อไม่พร้อม, legacy route ยังอยู่เป็น fallback และ SaleFlow request regression tests คงผ่าน

## S36 — Active station adapters + retired SIMPLE guard
- [x] FULL station-1
- [x] GAS station-5/6
- [x] retired guard station-2/3/4
- [x] conditional capabilities

**Done เมื่อ:** StationContext + SaleFlow capabilities แยก FULL/GAS/retired โดย runtime smoke ยืนยัน station-1/5/6 active, station-2 retired และ unit tests ครอบคลุม retired 2/3/4

## S37 — Legacy redirect plan
- [x] list `/new`, `/v2`, simple/gas routes
- [x] routes ที่ redirect ได้
- [x] routes ที่เก็บสำหรับ history/print/compatibility

**Done เมื่อ:** `ROUTE_MIGRATION_PLAN.md` ล็อก disposition ว่า active FULL/GAS ยังไม่ retire ก่อน parity/financial regression, retired station-2/3/4 ปิด create/operate entry ได้ และ history/receipt/API compatibility ยังเก็บไว้

---

# PHASE 7 — OPERATIONS / SHIFT WORKFLOW

## S38 — Opening shift workflow (active stations only)
- [x] required opening data
- [x] opening meter/gauge when relevant
- [x] clear primary action

**Done เมื่อ:** canonical `/stations/[id]/operations` เปิดกะ station-1 ด้วย daily price → start meter 4 หัว + รูป และ GAS station-5/6 ด้วย price + 4 meters + 3 gauges ผ่าน existing atomic API; StationContext derive opening readiness จาก DB และ `/sales` ถูกบล็อกจน `openingState=READY`

## S39 — Closing shift workflow (active stations only)
- [x] closing meter/gauge
- [x] expected vs actual
- [x] anomalies
- [x] reconciliation summary

**Done เมื่อ:** canonical `/stations/[id]/operations` ใช้ closing flow สำหรับกะ OPEN ที่พร้อมขาย: FULL บังคับ end meter 4 หัว + รูป, GAS บังคับ end meter 4 หัว + end gauge 3 ถัง, แสดง expected/actual/variance + anomaly preview ก่อนยืนยัน และใช้ existing FULL/GAS close APIs เป็น financial source of truth สำหรับ reconciliation/ปิดกะ

## S40 — Operations history
- [x] shift history
- [x] meter/gauge history
- [x] anomalies
- [x] filters
- [x] retired station read-only history

**Done เมื่อ:** canonical `/stations/[id]/history` ใช้ GET-only read model จาก Shift/DailyRecord โดยตรง, มี date/status/attention filters, meter/gauge/reconciliation/anomaly detail และรองรับ station-2/3/4 แบบ read-only โดยไม่เรียก legacy GAS history ที่อาจสร้าง Station row ระหว่าง GET

---

# PHASE 8 — QUALITY & RETIRE LEGACY

## S41 — Accessibility pass
- [x] keyboard navigation
- [x] labels
- [x] contrast
- [x] focus state

**Done เมื่อ:** shared Button/Input/Notice/Dialog + redesign shell/forms/filters ใช้ contrast-safe action/text tokens, visible focus state, accessible labels/pressed/required semantics, drawer/dialog focus trap + Escape + restore focus และ Sale/open/close validation พา focus ไป field/error ที่แก้ได้

## S42 — Loading / Empty / Error consistency
- [x] Today
- [x] Sale
- [x] Billing
- [x] Customer

**Done เมื่อ:** redesign ใช้ pattern เดียวกัน: initial load = accessible skeleton, refresh = เก็บ last-successful data, refresh failure = stale-data warning + retry, empty = EmptyState; canonical Sales/Operations fail-closed และไม่ render write flow จน station context refresh สำเร็จ

## S43 — Permission cleanup
- [x] ADMIN / STAFF ปัจจุบัน
- [x] ร่องรอย PURCHASE / OWNER เก่า
- [x] ระบุสิ่งที่ลบ/ย้ายได้

**Done เมื่อ:** runtime role model ยืนยันเหลือ ADMIN/STAFF ตาม Prisma, Users UI/API ไม่รับ MANAGER/OWNER/PURCHASE, legacy dashboard ตัด fake OWNER role และ `/api/dashboard` ใช้ admin guard จริง; คำว่า Owner ที่เหลือเป็น customer/vehicle domain entity ไม่ใช่ user role

## S44 — Financial regression checklist
- [x] transaction totals
- [x] bill number/book
- [x] payment type
- [x] invoice/collection totals
- [x] partial payment
- [x] Bangkok business date
- [x] station/shift scope

**Done เมื่อ:** `FINANCIAL_REGRESSION_CHECKLIST.md` เป็น release gate ของ S45+, canonical FULL เทียบ current `/station/1/v2` (ไม่ใช้ classic price rule), GAS amount/shift/business-date คง server source of truth, Billing แยก Invoice/Collection และ S44 เพิ่ม verification guard ไม่ให้ VERIFIED collection slips ทำ `paidAmount` เกินยอดรวม; financial gate ผ่าน 16 files / 81 tests

## S45 — Retire first legacy route
- [x] เลือก route ที่ parity/ธุรกิจยืนยันแล้ว
- [x] redirect
- [x] smoke test

**Done เมื่อ:** retired SIMPLE landing `/simple-station/[id]` redirect เฉพาะ station-2/3/4 แบบ server-side ไป `/stations/station-[id]`; legacy implementation ยังเก็บไว้, read-only subroutes ไม่ถูก redirect และ HTTP smoke ยืนยัน 2/3/4 = 307 canonical ขณะที่ `/simple-station/2/new/shift-history` ยัง 200

## S46+ — Retire one legacy route per session
- [x] S46: retired SIMPLE `/new/home` เฉพาะ station-2/3/4
- [x] S47: retired SIMPLE `/new/sell` เฉพาะ station-2/3/4
- [x] S48: retired SIMPLE `/new/oil-sell` เฉพาะ station-2/3/4
- [x] S49: retired SIMPLE `/new/open-shift` เฉพาะ station-2/3/4
- [x] S50: retired SIMPLE `/new/close-shift` เฉพาะ station-2/3/4
- [x] S51: retired SIMPLE `/new/shift-end` เฉพาะ station-2/3/4
- [x] S52: retired SIMPLE `/new/products` เฉพาะ station-2/3/4 — operational retirement ครบ
- [x] S53: active GAS `/gas/[stationId]/sell` ของ station-5/6 → canonical sales หลัง S44 gate 81/81
- [x] S54: older GAS `/gas-station/[id]/new/sell` ของ station-5/6 → canonical sales โดยตรง
- [x] S55: active FULL `/station/1/new/sell` → canonical `/stations/station-1/sales` โดยตรง
- [x] S56: active FULL `/station/1/new/oil-sell` → canonical `/stations/station-1/sales` โดยตรง
- [x] S57: active FULL `/station/1/new/open-shift` → canonical `/stations/station-1/operations` โดยตรง
- [x] S58: active FULL `/station/1/new/close-shift` → canonical `/stations/station-1/operations` โดยตรง
- [x] S59: active FULL `/station/1/new/shift-end` → canonical `/stations/station-1/operations` โดยตรง
- [x] S60: active FULL `/station/1/new/meters` → canonical `/stations/station-1/operations` โดยตรง (legacy route เดิมเป็น redirect-only)
- [x] S61: active FULL `/station/1/new/home` → canonical `/stations/station-1` โดยตรง; คง `/station/1` + `/station/1/v2` เป็น admin compatibility
- [x] S62: active GAS `/gas/5|6/shift/open` → canonical `/stations/station-5|6/operations` โดยตรง
- [x] S63: active GAS `/gas/5|6/shift/close` → canonical `/stations/station-5|6/operations` โดยตรง หลังเติม zero-received parity guard
- [x] S64: review GAS `/gas/[id]/meters` → **KEEP** เป็น guarded correction/recovery route; ยังไม่ redirect
- [x] S65: review GAS `/gas/[id]/gauge` → **KEEP** เป็น guarded correction/recovery route; ยังไม่ redirect
- [x] S66: review GAS `/gas/[id]/supplies` → **KEEP** เป็น LPG inventory receipt/history domain; ยังไม่มี canonical replacement
- [ ] ทำ legacy route/family กลุ่มถัดไปทีละชุด
- [x] preserve read/print compatibility ที่ยังจำเป็นใน S46-S60

---

# Recommended Sequence

1. S01 ✅
2. S02 ✅
3. S04 ✅
4. S05 ✅
5. S06
6. S10
7. S11
8. S13
9. S14
10. S16–23
11. S24–29
12. S30–32
13. S33–40
14. S41–46+

S03 ทำก่อน route migration จริงได้ ไม่จำเป็นต้องขวาง visual prototype

---

# Session Log

## 2026-08-26 — S01 — สร้าง branch และ baseline
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - ยกเลิก source changes ของ AI ตัวก่อน
  - เก็บ task plan ของเรา
  - สร้าง branch `redesign/ux-v2`
- ตรวจสอบแล้ว:
  - tracked production source กลับ baseline
- Session ถัดไป: `S02`

## 2026-08-26 — S02 — ตรวจ build / lint / typecheck baseline
- Status: `[x]`
- ตรวจสอบแล้ว:
  - TypeScript ผ่าน
  - ESLint baseline 38 errors / 106 warnings
  - build compile/typecheck ผ่าน แต่ prerender `/admin/low-stock` ล้มจาก baseline bug
- Decision:
  - redesign ต้องไม่เพิ่ม TypeScript error หรือ build failure ใหม่
- Session ถัดไป: `S04`

## 2026-08-26 — Scope Update — ปิด operational flow ปั๊มน้ำมัน 3 สาขา
- Status: `[x]`
- Mapping:
  - station-2 วัชรเกียรติออยล์
  - station-3 พงษ์อนันต์ปิโตรเลียม
  - station-4 ศุภชัยบริการ
- Decision:
  - ทั้ง 3 สาขาย้ายไป POS
  - ระบบนี้เก็บ history/report/customer/billing read-only
  - active operations เหลือ station-1 และ station-5/6

## 2026-08-26 — S04 — นิยาม Navigation ใหม่
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - ADMIN = Today / Sales / Customers / Billing / More
  - STAFF active = Today / Sales / Customers / History / More
  - ตัด station list ออกจาก primary nav
  - ย้าย admin tools เข้า domain/More
  - กำหนด retired-station behavior
- ตรวจสอบแล้ว:
  - code ปัจจุบันมี role ADMIN / STAFF
  - BottomNav เดิม hard-code add ไป station-1
- Session ถัดไป: `S05`

## 2026-08-26 — S05 — Design Tokens ใหม่
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - เปลี่ยน token runtime เป็น namespace `--ui-*`
  - primary orange, neutral slate, semantic status/credit
  - Sarabun typography, 4px spacing grid, 8px default radius
  - shadow แบบ restrained ไม่มี glow
  - รองรับ light/dark semantic surfaces
  - import token file เข้า global stylesheet
- ไฟล์ที่แก้:
  - `src/styles/design-tokens.css`
  - `src/app/globals.css`
  - `REDESIGN_TASKS.md`
- ตรวจสอบ:
  - ต้องรัน TypeScript + CSS smoke หลังเขียนไฟล์
- Session ถัดไป: `S06`

## 2026-08-26 — S06 — UI Primitive: Button + Input
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - รักษา Button API เดิม แต่ย้าย variant/size/focus/disabled/loading ไปใช้ `--ui-*` tokens
  - เปลี่ยน primary button จาก blue เป็น orange ตาม design system
  - ปรับ Input ให้ใช้ semantic surface/border/text/focus tokens
  - เพิ่ม `Label` และ `FieldMessage` แบบ standalone
  - ผูก label/error/helper ด้วย id + aria-describedby/aria-invalid
- ไฟล์ที่แก้:
  - `src/components/ui/button.tsx`
  - `src/components/ui/input.tsx`
  - `src/components/ui/index.tsx`
- ตรวจสอบแล้ว:
  - targeted ESLint ผ่าน
  - `npx tsc --noEmit` ผ่าน
- สิ่งที่ยังค้าง:
  - Card/Section/Empty state และ shell ยังไม่ได้ migrate
- Session ถัดไปที่แนะนำ: `S10` (ตาม recommended sequence; S07-S09 ทำเมื่อหน้า prototype เริ่มต้องใช้)
- หมายเหตุ/Decision:
  - primitives ใหม่ต้องไม่ hard-code brand colors; ใช้ `--ui-*` เป็นหลัก

## 2026-08-26 — S10 — App Shell ใหม่
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง `RedesignAppShell` แยกจาก legacy shell
  - desktop sidebar ใช้ task-first navigation
  - mobile bottom nav แยก ADMIN/STAFF และไม่มี hard-coded FAB
  - เพิ่ม More drawer สำหรับ reports/admin tools/settings/logout
  - อ่าน user/station จาก `/api/auth/me`
  - retired station-2/3/4 ไม่แสดง Sales ใน staff navigation
  - รองรับ page title, description, contextual station badge และ actions
- ไฟล์ที่แก้:
  - `src/components/layout/RedesignAppShell.tsx`
  - `src/components/layout/index.ts`
- ตรวจสอบแล้ว:
  - targeted ESLint ผ่าน
  - `npx tsc --noEmit` ผ่าน
  - dev CSS smoke `/login` ตอบ 200
- สิ่งที่ยังค้าง:
  - shell ยังไม่ได้ผูกกับ production routes; จะเริ่มใช้กับ `/today` prototype
- Session ถัดไปที่แนะนำ: `S11`
- หมายเหตุ/Decision:
  - legacy AppLayout/Sidebar/BottomNav ยังอยู่ครบจนกว่าหน้าใหม่พร้อม

## 2026-08-26 — S11 — Today information architecture
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - กำหนด Today state machine สำหรับ STAFF active station
  - กำหนด ADMIN work queue + active stations + billing attention
  - กำหนด retired-station notice state
  - ล็อกหลัก exception-first / one-primary-action / metrics-secondary
- ไฟล์ที่แก้:
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - สอดคล้องกับ navigation และ active operational scope ที่ล็อกไว้
- สิ่งที่ยังค้าง:
  - API/data contract และหน้า `/today` จริง
- Session ถัดไปที่แนะนำ: `S13` (prototype skeleton ก่อน แล้วค่อย S12 data wiring)
- หมายเหตุ/Decision:
  - Today ไม่ใช่ executive dashboard และไม่ใช้กราฟเป็น default

## 2026-08-26 — S13 — Today page skeleton
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง route `/today` บน `RedesignAppShell`
  - อ่าน user/station จริงจาก `/api/auth/me`
  - แยก ADMIN / active STAFF / retired STAFF skeleton
  - ADMIN มี work queue, active stations, billing attention, recent activity placeholders
  - active STAFF มี current-work area, primary bridge action, exception queue, recent transactions, compact summary
  - retired STAFF แสดง notice ย้ายไป POS และไม่มี operational CTA
- ไฟล์ที่แก้:
  - `src/app/today/page.tsx`
- ตรวจสอบแล้ว:
  - targeted ESLint ผ่าน
  - `npx tsc --noEmit` ผ่าน
  - `GET /today` บน dev server ตอบ 200
- สิ่งที่ยังค้าง:
  - S12 data contract เพื่อเปลี่ยน placeholder เป็นสถานะกะ/exception/transaction จริง
- Session ถัดไปที่แนะนำ: `S12` แล้ว `S14`
- หมายเหตุ/Decision:
  - ระหว่างยังไม่ wire data ห้ามแสดงตัวเลขหรือสถานะสมมติเป็นข้อมูลจริง

## 2026-08-26 — S12 — Today data contract + adapter
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง typed Today contract สำหรับ STAFF/ADMIN
  - สร้าง `GET /api/today` adapter จาก Prisma source เดิม
  - รองรับ FULL station-1, GAS station-5/6 และ retired station-2/3/4
  - เพิ่ม work-item detection และ billing attention แบบไม่ merge workflow
- ไฟล์ที่แก้:
  - `src/types/today.ts`
  - `src/app/api/today/route.ts`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ของ Today API/types ผ่าน
- สิ่งที่ยังค้าง:
  - เชื่อม `/today` UI กับ contract จริงใน S14
  - runtime DB smoke ต้องทดสอบผ่าน dev-server/browser path เพราะ standalone shell process ถูก sandbox จาก Neon
- Session ถัดไปที่แนะนำ: `S14`
- หมายเหตุ/Decision:
  - UI ใหม่ห้าม derive business rules จาก legacy payload เอง ให้ Today adapter เป็น orchestration boundary

## 2026-08-26 — S14 — Today work queue + live contract UI
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - ถอด placeholder จาก `/today` และเชื่อม `GET /api/today`
  - STAFF แสดง state/CTA, work queue, recent transactions, summary จากข้อมูลจริง
  - ADMIN แสดง exception queue, active station 1/5/6, billing attention และ recent activity
  - retired station ยังเป็น read-only notice ไม่มี operational CTA
  - เพิ่ม error/retry และ loading state
- ไฟล์ที่แก้:
  - `src/app/today/page.tsx`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint Today page/API/types ผ่าน
  - `/today` ตอบ 200
  - `/api/health` ยืนยัน Next dev server ต่อ Neon ได้ (`database: connected`)
  - `/api/today` ไม่มี session ตอบ 401 ตาม auth guard
- สิ่งที่ยังค้าง:
  - authenticated visual smoke จาก browser profile ที่ล็อกอินจริง (managed browser ของเครื่องมือแยก profile จึงไม่ bypass auth)
  - responsive visual polish ใน S15
- Session ถัดไปที่แนะนำ: `S07` แล้ว `S15`
- หมายเหตุ/Decision:
  - ไม่เพิ่ม dev auth bypass หรือ session test backdoor เพื่อทดสอบ Today

## 2026-08-26 — S07 — Card / Section / Empty / Notice primitives
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - tokenized Card เดิมโดยรักษา component API
  - เพิ่ม `Section`, `EmptyState`, `Notice` primitives
  - ย้าย Today จาก local Panel/empty patterns มาใช้ primitives กลาง
- ไฟล์ที่แก้:
  - `src/components/ui/card.tsx`
  - `src/components/ui/section.tsx`
  - `src/components/ui/empty-state.tsx`
  - `src/components/ui/notice.tsx`
  - `src/components/ui/index.tsx`
  - `src/app/today/page.tsx`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
- สิ่งที่ยังค้าง:
  - table/list responsive primitive ใน S08
- Session ถัดไปที่แนะนำ: `S08`
- หมายเหตุ/Decision:
  - Section ใช้แบ่ง workflow; Card ใช้ item/summary ที่ต้องการขอบเขต ไม่ซ้อน Card ใน Card โดยไม่จำเป็น

## 2026-08-26 — S08 — Responsive table/list primitives
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - เพิ่ม tokenized Table primitives สำหรับ desktop
  - เพิ่ม `ResponsiveDataView` สลับ desktop table ↔ mobile list ตาม breakpoint
  - เพิ่ม `MobileDataList`, `MobileDataRow`, `RowAction` เป็นมาตรฐาน action บนรายการ
- ไฟล์ที่แก้:
  - `src/components/ui/table.tsx`
  - `src/components/ui/responsive-data-view.tsx`
  - `src/components/ui/index.tsx`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
- สิ่งที่ยังค้าง:
  - นำ primitive ไปใช้จริงเมื่อทำ Sales/Billing/Customers
- Session ถัดไปที่แนะนำ: `S09`
- หมายเหตุ/Decision:
  - mobile data-heavy pages ต้อง transform เป็น list ไม่ใช่เพียง `overflow-x-auto`; ตารางแนวนอนใช้เป็น fallback เฉพาะกรณีที่คอลัมน์สัมพันธ์กันจริง

## 2026-08-26 — S09 — Dialog / Confirm / Toast pattern
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - เพิ่ม `Dialog` แบบ controlled พร้อม Escape, focus trap/restore, scroll lock และ mobile bottom-sheet layout
  - เพิ่ม `ConfirmDialog` รองรับ destructive tone และ async submit/loading
  - tokenized Toast เดิมและแก้ global toast helper ให้ผูกกับ ToastProvider จริง
  - กำหนด rule ว่า code redesign ใหม่ห้ามเพิ่ม browser `alert()` / `confirm()`
- ไฟล์ที่แก้:
  - `src/components/ui/dialog.tsx`
  - `src/components/Toast.tsx`
  - `src/components/ui/index.tsx`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
- สิ่งที่ยังค้าง:
  - legacy alert/confirm จำนวนมากจะทยอย migrate เมื่อแตะหน้าส่วนนั้น ไม่ทำ Big Bang
- Session ถัดไปที่แนะนำ: `S16`
- หมายเหตุ/Decision:
  - ห้าม rewrite legacy dialogs ทั้งระบบในครั้งเดียว; migrate ตาม feature ที่ย้ายเข้าระบบใหม่

## 2026-08-26 — S16 — Map active sale flows
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - เทียบ station-1 V2 refill flow/API กับ GAS V2 sell flow/API
  - ล็อก shared invariants และ capability differences
  - ยืนยัน station-2/3/4 ไม่มี create-sale scope
- ไฟล์ที่แก้:
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - FULL ใช้ liters/nozzle/calendar day/transfer proof
  - GAS ใช้ amount/no nozzle/07:00 business day และ backend-derived liters
  - GAS station-5 product flow แยกจาก LPG sale
- สิ่งที่ยังค้าง:
  - สร้าง typed SaleFlow model ใน S17
- Session ถัดไปที่แนะนำ: `S17`
- หมายเหตุ/Decision:
  - unified UX หมายถึง shared mental model + components ไม่ใช่บังคับ financial behavior ให้เหมือนกัน

## 2026-08-26 — S17 — SaleFlow capability/data model
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง typed capabilities สำหรับ station-1/5/6
  - model station/customer/fuel/payment/evidence draft
  - เพิ่ม computed payment requirements และ empty draft factory
  - แยก truck selection rule: FULL เพิ่มทะเบียนใหม่ให้ owner เดิมได้, GAS existing truck only
- ไฟล์ที่แก้:
  - `src/lib/sales/sale-flow.ts`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่านก่อน capability extension
  - targeted ESLint ผ่านก่อน capability extension
- สิ่งที่ยังค้าง:
  - customer/truck UI step S18
- Session ถัดไปที่แนะนำ: `S18`
- หมายเหตุ/Decision:
  - station-specific behavior อยู่ใน capability config ไม่กระจายใน form component

## 2026-08-26 — S18 — SaleFlow customer/truck step
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง customer/truck step สำหรับ flow ใหม่
  - ค้นหาชื่อ/รหัสลูกค้า/ทะเบียนและเลือกรถของ owner
  - FULL อนุญาตทะเบียนใหม่ของ owner เดิม; GAS เลือก existing truck เท่านั้น
- ไฟล์ที่แก้:
  - `src/components/sales/CustomerTruckStep.tsx`
  - `src/components/ui/input.tsx`
  - `src/lib/sales/sale-flow.ts`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
- สิ่งที่ยังค้าง:
  - product/quantity UI step S19
- Session ถัดไปที่แนะนำ: `S19`
- หมายเหตุ/Decision:
  - ไม่สร้าง customer ใหม่จาก STAFF flow; master data action แสดงเฉพาะ ADMIN

## 2026-08-26 — S19 — SaleFlow product/quantity step
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง `FuelQuantityStep` สำหรับ active station 1/5/6
  - FULL: diesel + nozzle 1–4 + liters + editable price + calculated amount
  - FULL price default: CASH/CREDIT ใช้ retail, payment อื่นใช้ wholesale ตาม legacy
  - GAS: LPG + amount input + liters estimate 5 decimals + daily gas price read-only
  - ยืนยัน GAS backend คำนวณราคา/liters ซ้ำจาก open shift ตอนบันทึก
- ไฟล์ที่แก้:
  - `src/components/sales/FuelQuantityStep.tsx`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
- สิ่งที่ยังค้าง:
  - payment conditional fields S20
- Session ถัดไปที่แนะนำ: `S20`
- หมายเหตุ/Decision:
  - UI ไม่เปลี่ยน financial contract: FULL ยังแก้ราคาต่อลิตรได้เหมือนเดิม, GAS ยึด backend daily price ตอน save

## 2026-08-26 — S20 — SaleFlow payment conditional fields
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง `PaymentStep` จาก station capability และ allowed payment types
  - credit-like แสดง requirement ลูกค้า/รถ + เล่มที่/เลขที่บิล
  - station-1 มี helper เลขบิลถัดไปและ TRANSFER บังคับเลือกรูปสลิป
  - GAS TRANSFER ไม่บังคับและไม่แสดง upload เพราะ backend ปัจจุบันไม่ได้บันทึกหลักฐาน
  - ตรวจรูปสลิปเฉพาะ image และขนาดไม่เกิน 8 MB ก่อนส่ง
- ไฟล์ที่แก้:
  - `src/components/sales/PaymentStep.tsx`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
- สิ่งที่ยังค้าง:
  - upload รูปจริงและ transaction submit อยู่ S22
- Session ถัดไปที่แนะนำ: `S21`
- หมายเหตุ/Decision:
  - ไม่ upload สลิปทันทีตอนเลือกไฟล์ เพื่อไม่สร้าง orphan upload หากผู้ใช้ยกเลิกรายการ

## 2026-08-26 — S21 — SaleFlow review/validation
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง pure validation กลางสำหรับ shift/payment/customer/truck/fuel/amount/bill/evidence
  - FULL ตรวจ amount = liters × price ภายใน tolerance 0.01 ก่อน save
  - GAS credit บังคับ existing truck; FULL credit อนุญาตทะเบียนใหม่ของ owner เดิม
  - สร้าง `SaleReviewStep` เน้นยอดเงิน/ลิตร/ราคาและข้อมูลสำคัญก่อนบันทึก
  - ส่ง field errors กลับไปแสดงใน CustomerTruckStep, FuelQuantityStep และ PaymentStep
  - เพิ่ม regression tests สำหรับกฎการเงินและ transfer/credit
- ไฟล์ที่แก้:
  - `src/lib/sales/sale-validation.ts`
  - `src/components/sales/SaleReviewStep.tsx`
  - `src/components/sales/CustomerTruckStep.tsx`
  - `src/components/sales/FuelQuantityStep.tsx`
  - `src/components/sales/PaymentStep.tsx`
  - `tests/sale-flow-validation.test.ts`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
  - `npx vitest run tests/sale-flow-validation.test.ts` ผ่าน 4/4
- สิ่งที่ยังค้าง:
  - S22 adapter/upload/submit กับ existing station APIs
- Session ถัดไปที่แนะนำ: `S22`
- หมายเหตุ/Decision:
  - validation ฝั่ง UI เป็น guard เพิ่มเติม; backend เดิมยังเป็น final source of truth

## 2026-08-26 — S22 — Integrate Transaction API
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง `sale-api.ts` เป็น adapter จาก SaleFlowDraft ไป legacy FULL/GAS API
  - FULL ใช้ `/api/station/1/transactions`; GAS ใช้ `/api/v2/gas/5|6/sell` ผ่าน legacy route-id helper
  - FULL ส่ง liters/price/amount ตามเดิมและ upload transfer proof ก่อน POST เฉพาะ TRANSFER
  - GAS ส่ง amount เป็น input หลักและไม่ส่ง liters/price เพื่อให้ backend คำนวณจาก daily price
  - ซ่อน/ไม่ส่ง stale customer/bill fields สำหรับ payment ที่ไม่ต้องใช้
  - สร้าง `SaleFlowForm` ให้ submit ผ่าน adapter + Toast ไม่มี browser alert/confirm
  - เพิ่ม mock integration tests ตรวจ upload order และ payload parity
  - 2026-08-27 ทำ authenticated real-save ผ่าน normal `/api/auth/login` แล้วเรียก `submitSaleFlowDraft` จริงกับ station-6
  - smoke CASH 1.00 บาท: backend ใช้ gas price 16.49 และบันทึก 0.06064 ลิตร ตรงกับค่าที่ adapter/review คาด
  - void smoke transaction แล้วตรวจ `/api/v2/gas/6/summary` กลับเป็น cash=0, transactionCount=0, liters=0
  - logout temporary smoke session หลังตรวจเสร็จ
- ไฟล์ที่แก้:
  - `src/lib/sales/sale-api.ts`
  - `src/lib/sales/sale-flow.ts`
  - `src/components/sales/SaleFlowForm.tsx`
  - `src/components/sales/PaymentStep.tsx`
  - `tests/sale-flow-api.test.ts`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
  - SaleFlow tests ผ่าน 10/10
  - `git diff --check` ผ่าน
  - authenticated GAS real-save + read-back + void rollback ผ่าน
- สิ่งที่ยังค้าง:
  - FULL real-save ไม่รัน เพราะ station-1 ไม่มี current open shift; ไม่เปิดกะเทียมเพื่อ smoke test
- Session ถัดไปที่แนะนำ: `S24`
- หมายเหตุ/Decision:
  - request path ใหม่ต้องแปลง `station-1` เป็น legacy route id `1` (GAS เช่นเดียวกันเป็น 5/6)
  - runtime smoke ต้องใช้ normal auth และ rollback test transaction; ห้ามสร้าง auth bypass หรือเปิดกะปลอมเพื่อการทดสอบ

## 2026-08-26 — S23 — SaleFlow mobile polish
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - submit CTA เต็มความกว้างบนมือถือและ sticky เหนือ app bottom nav
  - ใช้ safe-area inset ของอุปกรณ์ร่วมกับ bottom-nav height
  - quantity/amount เดิมใช้ decimal keyboard และ bill book/no เพิ่ม numeric keyboard โดยยังเก็บเป็น string เพื่อรักษา leading zero
  - touch controls ใช้ `--ui-touch-target` และ desktop CTA กลับเป็น static
- ไฟล์ที่แก้:
  - `src/components/sales/SaleFlowForm.tsx`
  - `src/components/sales/PaymentStep.tsx`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
  - SaleFlow tests ผ่าน 10/10
- สิ่งที่ยังค้าง:
  - authenticated visual browser smoke ยังเป็นข้อจำกัดเดียวกับ S15
- Session ถัดไปที่แนะนำ: `S22 real-save smoke` หรือ `S24` หากยังไม่มี authenticated smoke
- หมายเหตุ/Decision:
  - mobile sticky CTA ใช้ offset จาก redesign bottom nav เพื่อไม่บังกัน

## 2026-08-27 — S24 — Map billing lifecycle
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - map UX pipeline 6 ขั้น: รอวางบิล → เตรียมเอกสาร → วางบิลแล้ว → รอรับเงิน → จ่ายบางส่วน → ปิดยอด
  - ยืนยันจาก schema/API ว่า WAITING_TO_BILL/AWAITING_PAYMENT/PARTIAL/CLOSED derive ได้จากข้อมูลปัจจุบัน
  - PREPARING_DOCUMENTS และ BILLED ยังไม่มี field/timestamp ที่เชื่อถือได้ จึงห้าม adapter เดาสถานะ
  - overdue เป็น attention overlay จาก dueDate + remaining balance; DB OVERDUE ไม่ใช่ source of truth เดียว
  - PaymentSlip PENDING/REJECTED ไม่เพิ่ม paidAmount; VERIFIED เท่านั้นที่นับเป็นเงินรับ
- ไฟล์ที่แก้:
  - `src/lib/billing/lifecycle.ts`
  - `tests/billing-lifecycle.test.ts`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
  - lifecycle tests ผ่าน 4/4
- สิ่งที่ยังค้าง:
  - หากต้องการแยก เตรียมเอกสาร/วางบิลแล้ว จริง ต้องเพิ่ม explicit workflow metadata ในรอบหลัง ไม่ infer จาก createdAt/dueDate
- Session ถัดไปที่แนะนำ: `S25`
- หมายเหตุ/Decision:
  - invoice payment write path ปัจจุบันมี 2 API ที่ behavior ต่างกัน; ห้าม UX ใหม่เลือกใช้จน S28 ล็อก canonical payment write path
  - `/api/invoices/[id]/payments` ไม่อัปเดต Owner.currentCredit; `/api/payments` อัปเดต แต่ไม่ atomic กับ payment/invoice update
  - `Owner.currentCredit` ไม่ถูกเพิ่มจาก active sale APIs ที่ตรวจพบ จึงไม่ใช้เป็น AR source of truth ใน redesign
  - monthly invoice generator สร้าง Invoice แต่ไม่ link source Transaction ต่างจาก `/api/invoices` หลัก

## 2026-08-27 — S25 — Billing adapter
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง adapter กลางสำหรับ Invoice/Payment และ BillingCollection/PaymentSlip
  - คง `kind=INVOICE|BILLING_COLLECTION` เพื่อไม่ merge DB model
  - normalize total/paid/remaining, due/overdue, source item count และ payment events
  - Invoice Payment = CONFIRMED ทันทีตาม backend ปัจจุบัน
  - Collection slip = CONFIRMED เฉพาะ VERIFIED; PENDING/REJECTED เป็น attention
  - derive settlement stage จากยอดเงิน ไม่เชื่อ raw status string อย่างเดียว
  - flag `PAID_AMOUNT_MISMATCH`, `STATUS_AMOUNT_MISMATCH`, `OVERPAID_AMOUNT`, `MISSING_SOURCE_ITEMS`
- ไฟล์ที่แก้:
  - `src/lib/billing/adapter.ts`
  - `tests/billing-adapter.test.ts`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
  - billing adapter/lifecycle tests ผ่าน 8/8
- สิ่งที่ยังค้าง:
  - S26 unified billing list/work queue
- Session ถัดไปที่แนะนำ: `S26`
- หมายเหตุ/Decision:
  - adapter เป็น read normalization เท่านั้น; ไม่แก้/ย้ายข้อมูลเดิม และไม่ใช้ currentCredit เป็นยอดลูกหนี้หลัก

## 2026-08-27 — S26 — Unified billing list
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง `/api/billing` รวม unbilled credit work + Invoice + BillingCollection ผ่าน adapter กลาง
  - สร้าง `/billing` เป็น task-first list พร้อม pipeline tabs 6 ขั้น, search และ source filter
  - แสดง due/overdue, pending slip, data-quality flags และ next action ต่อรายการ
  - แยก summary เป็น รอวางบิล / Invoice ค้างรับ / Collection ค้างรับ / สลิปรอตรวจ
  - ไม่สร้าง combined outstanding เพราะ Invoice กับ BillingCollection ยังไม่มี relation ป้องกัน double-count
- ไฟล์ที่แก้:
  - `src/app/api/billing/route.ts`
  - `src/app/billing/page.tsx`
  - `src/types/billing.ts`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
  - authenticated `/api/billing` smoke ผ่าน HTTP 200 และ temporary session logout แล้ว
  - `/billing` route ตอบ HTTP 200
- สิ่งที่ยังค้าง:
  - visual authenticated smoke ยังไม่มี managed browser
  - S27 unified billing detail
- Session ถัดไปที่แนะนำ: `S27`
- หมายเหตุ/Decision:
  - real data smoke ณ 2026-08-27 พบ 165 ลูกค้ารอวางบิล / 6372 transactions และ 15 Invoice ค้างรับ; ไม่ใช้จำนวนนี้เป็น hard-coded UI
  - PREPARING_DOCUMENTS/BILLED tabs แสดงได้แต่ไม่มี record ถูก infer เข้าไปจนกว่าจะมี explicit workflow signal

## 2026-08-27 — S27 — Unified billing detail
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง `/api/billing/[id]?kind=...` อ่านรายละเอียด Invoice หรือ BillingCollection
  - สร้าง `/billing/[id]` แสดง document totals, due/overdue, customer, source items และ payment state
  - Invoice source แสดง transactions; Collection source แสดง collection items
  - Payment/PaymentSlip ถูก normalize เป็น confirmed/pending-review/rejected ตาม adapter
  - ถ้าไม่มี source links จะแสดง warning และ data-quality flag แทนการถือว่าข้อมูลครบ
  - list S26 เปลี่ยน document next action ให้เข้า unified detail ก่อน
  - ปุ่ม write/payment ใน detail ยังกลับ legacy เพื่อไม่ใช้ payment API ที่ behavior ขัดกันก่อน S28
- ไฟล์ที่แก้:
  - `src/app/api/billing/[id]/route.ts`
  - `src/app/billing/[id]/page.tsx`
  - `src/app/api/billing/route.ts`
  - `src/types/billing.ts`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
  - billing tests ผ่าน 8/8
  - `git diff --check` ผ่าน
  - authenticated Invoice detail smoke ผ่าน HTTP 200: source items อ่านได้และ session logout แล้ว
- สิ่งที่ยังค้าง:
  - BillingCollection real-data detail smoke ไม่มี open collection ในข้อมูล smoke รอบนี้ แต่ adapter tests ครอบคลุม
  - S28 canonical receive-payment write path
- Session ถัดไปที่แนะนำ: `S28`
- หมายเหตุ/Decision:
  - S28 ต้องแก้ financial write semantics ก่อนเปิดปุ่มรับชำระใหม่ ไม่ reuse สอง payment endpoints แบบสุ่ม

## 2026-08-27 — S28 — Receive payment
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง `billing/payment.ts` เป็น canonical receive-payment adapter
  - Invoice ใช้เฉพาะ `/api/invoices/[id]/payments`; ไม่ใช้ `/api/payments` และไม่แตะ Owner.currentCredit
  - รองรับรับเต็มยอด/บางส่วน + TRANSFER/CASH/CHECK + หมายเหตุ
  - BillingCollection บังคับรูปหลักฐาน แล้วสร้าง PaymentSlip PENDING เพื่อรอ verify
  - สร้าง `ReceivePaymentDialog` + confirmation + Toast; ไม่มี browser alert/confirm ใน flow ใหม่
  - block receive เมื่อเอกสารปิดยอด, data-quality flags มีปัญหา, ไม่ใช่ ADMIN หรือ Collection มีสลิปรอตรวจอยู่
  - harden Invoice route ด้วย optimistic concurrency guard กันรับเงินซ้ำพร้อมกัน
  - harden Collection slip route ด้วย server-side overpay guard + pending-slip conflict guard
- ไฟล์ที่แก้:
  - `src/lib/billing/payment.ts`
  - `src/components/billing/ReceivePaymentDialog.tsx`
  - `src/app/api/invoices/[id]/payments/route.ts`
  - `src/app/api/billing-collections/[id]/payment-slips/route.ts`
  - `src/app/api/billing/[id]/route.ts`
  - `src/app/billing/[id]/page.tsx`
  - `src/types/billing.ts`
  - `tests/billing-payment.test.ts`
  - `tests/billing-payment-routes.test.ts`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
  - billing tests ผ่าน 17/17
  - safe authenticated real API overpay smoke ตอบ 400 และ paidAmount ก่อน/หลังไม่เปลี่ยน; logout แล้ว
- สิ่งที่ยังค้าง:
  - ไม่ทำ real valid payment smoke เพราะไม่มี clean rollback path สำหรับ Payment และไม่ควรสร้าง financial mutation เพื่อทดสอบ
  - S29 billing exceptions
- Session ถัดไปที่แนะนำ: `S29`
- หมายเหตุ/Decision:
  - Owner.currentCredit ไม่ใช่ AR source of truth ของ redesign และจะไม่ถูก mutate จาก receive flow ใหม่
  - Collection evidence ต้อง VERIFIED ก่อนจึงนับเป็น paidAmount

## 2026-08-27 — S29 — Billing exceptions
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง `billing/exceptions.ts` เป็น exception classifier กลาง
  - missing source → critical; paid/status/overpaid mismatch → financial exceptions
  - overdue → warning attention overlay
  - pending/rejected evidence → payment-review exceptions
  - multiple PENDING slips → `DUPLICATE_PENDING_EVIDENCE` critical โดยไม่เดา duplicate document จากเลขอ้างอิง
  - ต่อ `exceptions[]` เข้า `/api/billing` และ `/api/billing/[id]`
  - เพิ่ม Billing list filter “เฉพาะต้องตรวจ”
- ไฟล์ที่แก้:
  - `src/lib/billing/exceptions.ts`
  - `src/types/billing.ts`
  - `src/app/api/billing/route.ts`
  - `src/app/api/billing/[id]/route.ts`
  - `src/app/billing/page.tsx`
  - `tests/billing-exceptions.test.ts`
  - `REDESIGN_TASKS.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
  - billing test suite ผ่าน 21/21
- สิ่งที่ยังค้าง:
  - duplicate document detection แบบข้าม Invoice/Collection ยังไม่ทำ เพราะไม่มี reliable source relation และไม่ควรเดาจากเลขอ้างอิง
  - Phase 5 Customer 360 เริ่ม S30 รอบถัดไป
- Session ถัดไปที่แนะนำ: `S30`
- หมายเหตุ/Decision:
  - exception engine ใช้เฉพาะสัญญาณที่พิสูจน์ได้จากข้อมูลปัจจุบัน เพื่อลด false positive ในงานการเงิน

## 2026-08-27 — S30–S32 — Customer 360
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง Customer 360 contract/API โดยแยก legacy currentCredit ออกจากยอดค้างที่ derive จากข้อมูลจริง
  - สร้าง `/customers` ใหม่พร้อม search/status/attention filter และ contextual next action
  - สร้าง `/customers/[id]` รวม overview, trucks, purchases, billing และ payment timeline
  - ห้ามรวม unbilled + Invoice + BillingCollection เป็นยอดเดียวเพราะ old monthly invoice path อาจไม่ link transaction ทำให้ double-count
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
  - customer + billing regression tests ผ่าน 16/16
  - authenticated read smoke `/api/customers` และ `/api/customers/[id]` ผ่าน 200 และ logout แล้ว
- สิ่งที่ยังค้าง:
  - Phase 6 canonical station routes
- Session ถัดไปที่แนะนำ: `S33`
- หมายเหตุ/Decision:
  - `currentCredit` เป็น legacy indicator ไม่ใช่ source of truth ใน redesign

## 2026-08-27 — S33–S36 — Canonical station routes + SaleFlow entry
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง StationContext กลางสำหรับ station identity/type/ACTIVE-RETIRED/permissions/current shift/canonical paths
  - สร้าง canonical routes `/stations/[id]`, `/sales`, `/operations`, `/history`
  - mount SaleFlow ใหม่บน canonical sales route สำหรับ station-1/5/6 และบล็อกเมื่อไม่มีกะ OPEN
  - station-2/3/4 ไม่มี sale/operations action และคง read-only history
  - เพิ่ม saleContext ราคา FULL/GAS จาก backend จริง โดยไม่ใช้ default มั่วเมื่อ FULL ไม่มี daily record
  - แก้ Next dynamic API slug conflict โดยใช้ existing `[stationId]` folder เดียว
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
  - station + SaleFlow tests ผ่าน 14/14
  - authenticated runtime context smoke: station-1/5/6 ACTIVE, station-2 RETIRED, canonical pages 200, logout แล้ว
- สิ่งที่ยังค้าง:
  - S37 legacy redirect plan และ S38–S40 operations workflow
- Session ถัดไปที่แนะนำ: `S37`
- หมายเหตุ/Decision:
  - canonical URL ใช้ station DB id เช่น `/stations/station-6/...`; API dynamic slug ใช้ `[stationId]` ให้ตรง route tree เดิม

## 2026-08-27 — S39 — Closing shift + reconciliation
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง canonical closing flow บน `/stations/[id]/operations` สำหรับ station-1/5/6
  - FULL: end meter 4 หัว + รูปหลักฐานครบ, actual cash/card/transfer, expense/discount, anomaly preview และ confirmation
  - GAS: end meter 4 หัว + gauge 3 ถัง, product count ของ station-5, รายรับ/ค่าใช้จ่าย, variance note และ confirmation
  - UI preview ใช้สูตร/threshold ตาม backend แต่ close API เดิมยังเป็น source of truth และคำนวณ reconciliation ซ้ำตอนบันทึกจริง
  - retry FULL รองรับ end photo ที่บันทึกไว้แล้วโดยไม่บังคับ upload ซ้ำ
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
  - closing/opening/station/SaleFlow regression tests ผ่าน 28/28
  - งด real valid close-shift smoke เพราะจะปิดกะและสร้าง financial/operational mutation จริง
- สิ่งที่ยังค้าง:
  - S40 Operations history
- Session ถัดไปที่แนะนำ: `S40`
- หมายเหตุ/Decision:
  - FULL รักษากติกา legacy ที่ต้องมีรูปมิเตอร์ปิดครบ 4 หัว
  - GAS ใช้ meter/gauge write ก่อน close; ถ้า reconciliation close ไม่ผ่าน shift ยัง OPEN และแก้/ลองใหม่ได้

## 2026-08-27 — S40 — Operations history
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - เพิ่ม canonical GET-only station history API โดยใช้ Shift เป็นแกน
  - แสดง meter/gauge, transaction summary, reconciliation, persisted meter anomaly และ daily anomaly
  - เพิ่ม from/to/status/attention filters และจำกัดช่วง query ครั้งละ 93 วัน
  - station-2/3/4 ใช้ history contract เดียวกันแบบ read-only ไม่มี operational/edit CTA
  - normalize reconciliation variance เป็น `received - expected` เพื่อแก้ historical FULL/GAS sign convention ที่ต่างกัน
  - ไม่ reuse `/api/admin/gas-history` เพราะ legacy GET มี helper ที่สามารถสร้าง Station row ได้
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
  - station history + opening/closing/context regression ผ่าน 23/23
  - `git diff --check` ผ่าน
- สิ่งที่ยังค้าง:
  - Phase 8 quality pass เริ่ม S41
- Session ถัดไปที่แนะนำ: `S41`
- หมายเหตุ/Decision:
  - canonical history เป็น read-only surface; legacy edit/admin routes ยังไม่ retire จน S44/S45

## 2026-08-27 — S41 — Accessibility pass
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - ทำ keyboard/focus pass บน RedesignAppShell, More drawer, Dialog, Today, SaleFlow, Billing, Customers และ canonical station flows/history
  - More drawer/Dialog trap focus, Escape ปิด, restore focus และ lock background scroll
  - เพิ่ม accessible names, `aria-pressed`, `aria-required`, fieldset/legend และ decorative icon `aria-hidden` ในจุดสำคัญ
  - SaleFlow validation focus ไป first invalid control; shift open/close focus ไป error summary เมื่อ backend/validation ไม่ผ่าน
  - แยก brand orange `#F97316` ออกจาก CTA/text ที่ต้อง contrast: primary white-text CTA ใช้ `#C2410C`, semantic text/icon ใช้ `--ui-*-text`
  - เพิ่ม focus-visible ให้ raw navigation/action links และ loading/error regions มี status/alert semantics ในหน้าหลัก
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่าน
  - station/sale/customer/billing regression tests ผ่าน 49/49
  - `git diff --check` ผ่าน
- สิ่งที่ยังค้าง:
  - visual screen-reader/assistive-technology smoke ยังไม่ได้รัน เพราะ environment นี้ไม่มี managed browser/native accessibility support
  - S42 Loading / Empty / Error consistency
- Session ถัดไปที่แนะนำ: `S42`
- หมายเหตุ/Decision:
  - `#F97316` ยังเป็น brand/accent ได้ แต่ห้ามใช้เป็นพื้น CTA ตัวอักษรขาวขนาดปกติใน redesign; ใช้ contrast-safe action shade แทน
  - S41 ไม่เปลี่ยน business/financial write semantics

## 2026-08-27 — S42 — Loading / Empty / Error consistency
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - เพิ่ม shared `LoadingState`, `AsyncRefreshState`, `FatalErrorState` สำหรับ redesign
  - Today/Billing/Customers แยก initial load ออกจาก refresh: ระหว่าง refresh ยังเห็นข้อมูลล่าสุดที่โหลดสำเร็จ
  - refresh ล้มแล้วไม่ล้างข้อมูลเดิม; แสดง warning + retry แทน fatal screen
  - Customers filter/search ใช้ stale-while-refresh pattern เดียวกัน และ Sale customer lookup มี retry เมื่อโหลด owner ไม่สำเร็จ
  - canonical station workspace เก็บ context เดิมให้ดูได้ แต่ Sales/Operations fail-closed ระหว่าง refresh หรือเมื่อ context refresh ล้ม เพื่อไม่เขียนด้วย shift/price/context เก่า
  - empty lists ยังคงใช้ `EmptyState`; fatal error ใช้เฉพาะกรณียังไม่มี successful payload
- ไฟล์หลักที่แก้:
  - `src/components/ui/async-state.tsx`
  - `src/app/today/page.tsx`
  - `src/app/billing/page.tsx`
  - `src/app/customers/page.tsx`
  - `src/components/stations/CanonicalStationWorkspace.tsx`
  - `src/components/sales/CustomerTruckStep.tsx`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint ผ่านแบบไม่มี warning/error
  - station/sale/customer/billing regression tests ผ่าน 49/49
  - `git diff --check` ผ่าน
- สิ่งที่ยังค้าง:
  - S43 Permission cleanup
- Session ถัดไปที่แนะนำ: `S43`
- หมายเหตุ/Decision:
  - read-heavy screens ใช้ stale-while-refresh เพื่อลด layout jump และไม่ทำข้อมูลหายจากสายตา
  - financial/operational write flow ต้องมี fresh station context; stale context อ่านได้แต่ใช้เขียนไม่ได้

## 2026-08-27 — S43 — Permission cleanup
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - ยืนยัน Prisma `UserRole` มีเพียง `ADMIN` / `STAFF` และใช้ `src/constants/user-roles.ts` เป็น role vocabulary ฝั่งแอป
  - เพิ่ม `isUserRole()` และ validate create/update user API ให้ invalid role ตอบ 400 ก่อนถึง Prisma
  - ลบ `MANAGER` ออกจากหน้า `/users` ซึ่งเดิมเลือกได้ทั้งที่ Prisma ไม่รองรับ
  - ลบร่องรอย `OWNER` ที่ถูกใช้เป็น user role ใน legacy dashboard; `PURCHASE` ไม่พบใน production source
  - ปิด `/api/dashboard` ด้วย `requireAdminApi()` และให้ client redirect 401 → login, 403 → Today
  - แยกความหมายชัดเจนว่า `Owner` ที่ยังอยู่ในระบบคือ entity ลูกค้า/เจ้าของรถ ไม่ใช่สิทธิ์ผู้ใช้ จึงห้ามลบ model/flow เหล่านั้น
- ไฟล์หลักที่แก้:
  - `src/constants/user-roles.ts`
  - `src/app/api/dashboard/route.ts`
  - `src/app/dashboard/page.tsx`
  - `src/app/api/users/route.ts`
  - `src/app/api/users/[id]/route.ts`
  - `src/app/users/page.tsx`
  - `tests/permission-cleanup.test.ts`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted ESLint 0 errors (legacy dashboard/users มี warning เดิม 10 จุด)
  - permission + station/sale/customer/billing regression tests ผ่าน 53/53
  - production-source search ไม่พบ `MANAGER`, `PURCHASE`, หรือ `OWNER` ในบริบท user role
  - `git diff --check` ผ่าน
- สิ่งที่ยังค้าง:
  - S44 Financial regression checklist
- Session ถัดไปที่แนะนำ: `S44`
- หมายเหตุ/Decision:
  - runtime user roles ล็อกที่ `ADMIN` / `STAFF`; หากจะเพิ่ม role ใหม่ต้องแก้ Prisma enum + auth policy + UI/API validation พร้อมกัน ห้ามเพิ่มเฉพาะ UI
  - legacy `/dashboard` ถือเป็น admin-only surface; staff ใช้ Today/canonical station workspaces


## 2026-08-27 — S44 — Financial regression gate
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - สร้าง `FINANCIAL_REGRESSION_CHECKLIST.md` เป็น source of truth ก่อน retire active money-changing routes
  - ยืนยัน FULL canonical price parity กับ current `/station/1/v2`: CASH/CREDIT = retail, payment อื่น = wholesale; classic `/station/[id]` เป็น legacy rule เก่ากว่าและไม่ใช่ parity baseline
  - เพิ่ม regression สำหรับ station/book-scoped numeric bill sequence + zero padding, payment buckets และ Bangkok calendar boundaries
  - ตรวจ GAS server-calculated amount/liters, 07:00 business date, current OPEN shift scope และ duplicate guard ผ่าน existing route tests
  - ตรวจ Invoice/Collection แยก totals, partial lifecycle และ Invoice optimistic concurrency
  - harden BillingCollection slip verification: rollback + 409 ถ้า VERIFIED slips รวมแล้วเกิน totalAmount
  - พบ `/api/payments` เป็น legacy Invoice payment endpoint ที่ไม่มี production caller ใน source; canonical ต้องใช้ `/api/invoices/[id]/payments` ต่อ
- ไฟล์หลักที่แก้/เพิ่ม:
  - `FINANCIAL_REGRESSION_CHECKLIST.md`
  - `tests/financial-regression.test.ts`
  - `tests/billing-payment-routes.test.ts`
  - `src/app/api/billing-collections/[id]/payment-slips/[slipId]/route.ts`
  - `ROUTE_MIGRATION_PLAN.md`
- ตรวจสอบแล้ว:
  - financial gate 16 files / 81 tests ผ่าน
  - Billing payment route tests 6/6 ผ่าน รวม verification overpayment rollback
  - TypeScript / targeted ESLint / `git diff --check` รันใน final gate ของ session
- สิ่งที่ยังค้าง:
  - S45 retire first legacy route; ยังไม่มี redirect ใดเกิดขึ้นใน S44
  - backend/API compatibility ยังต้องคงไว้; S45+ retire UI route ทีละ route
- Session ถัดไปที่แนะนำ: `S45`
- หมายเหตุ/Decision:
  - Invoice, BillingCollection, unbilled credit และ legacy currentCredit ห้ามรวมเป็น grand total
  - S45+ ต้อง rerun financial gate เมื่อ route มีผลต่อ money/quantity/date/shift scope


## 2026-08-27 — S45 — Retire first legacy route
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - เลือก legacy SIMPLE landing `/simple-station/[id]` เป็น route แรก เพราะ station-2/3/4 ย้าย operational work ไป POS แล้วและ canonical overview เป็น read-only
  - เปลี่ยน route entry เป็น server guard: เฉพาะ `2/3/4` redirect ไป `/stations/station-[id]` ก่อน client hydrate
  - เก็บ UI เดิมไว้ใน `LegacySimpleStationPage.tsx`; ไม่ลบ source/API/history พร้อม redirect
  - เพิ่ม helper/test ให้ redirect เฉพาะ retired SIMPLE IDs และไม่จับ station อื่น
  - ไม่ redirect `/simple-station/[id]/new/*` ใน S45; read/history/receipt compatibility ยังอยู่ตาม migration plan
- ไฟล์หลักที่แก้/เพิ่ม:
  - `src/app/simple-station/[id]/page.tsx`
  - `src/app/simple-station/[id]/LegacySimpleStationPage.tsx`
  - `src/lib/stations/legacy-route-retirement.ts`
  - `tests/legacy-route-retirement.test.ts`
  - `ROUTE_MIGRATION_PLAN.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - route/context/history tests 17/17 ผ่าน
  - targeted ESLint ผ่าน
  - `git diff --check` ผ่าน
  - HTTP smoke: station-2/3/4 landing = 307 ไป canonical; station-2 shift-history = 200
- สิ่งที่ยังค้าง:
  - S46+ retire route/family ถัดไปทีละชุด; SIMPLE `/new/home` และ create routes ยังไม่ถูกแตะ
  - active FULL/GAS routes ยังต้อง rerun financial gate ตาม `FINANCIAL_REGRESSION_CHECKLIST.md` ก่อน redirect
- Session ถัดไปที่แนะนำ: `S46`
- หมายเหตุ/Decision:
  - retired operational landing ปิดได้โดยไม่ลบ historical/read surfaces
  - redirect ต้องเกิดก่อน hydrate เพื่อไม่ให้ legacy operational effects ยิง API ก่อนออกจากหน้า


## 2026-08-27 — S46 — Retire retired-SIMPLE `/new/home`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - retire เฉพาะ `/simple-station/2|3|4/new/home` ไป canonical `/stations/station-[id]` ก่อน client hydrate
  - ย้าย implementation เดิมไว้ใน `LegacySimpleStationHomePage.tsx`; ไม่ลบ source/API
  - ใช้ retired-station redirect helper เดียวกับ S45 เพื่อไม่กระจาย business rule 2/3/4 หลายจุด
  - คง `/new/sell` และ `/new/shift-history` ไว้ใน S46 เพื่อให้ retirement ยัง bounded ทีละ route/family
- ไฟล์หลักที่แก้/เพิ่ม:
  - `src/app/simple-station/[id]/new/home/page.tsx`
  - `src/app/simple-station/[id]/new/home/LegacySimpleStationHomePage.tsx`
  - `ROUTE_MIGRATION_PLAN.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - route/context/history regression 17/17 ผ่าน
  - targeted ESLint และ `git diff --check` ผ่าน
  - HTTP smoke: `/new/home` ของ station-2/3/4 = 307 canonical; `/new/sell` และ `/new/shift-history` ของ station-2 ยัง 200
- สิ่งที่ยังค้าง:
  - retired SIMPLE create route ถัดไป เช่น `/new/sell` ยังไม่ redirect
  - active FULL/GAS ต้องใช้ S44 financial gate ก่อนทุก money-changing redirect
- Session ถัดไปที่แนะนำ: `S47`
- หมายเหตุ/Decision:
  - operational landing/home ที่ retired ต้อง redirect ก่อน hydrate เพื่อไม่ให้ legacy page fetch/เขียน operational context
  - read/history/receipt compatibility ยังห้ามพ่วงมากับ create-route retirement


## 2026-08-27 — S47 — Retire retired-SIMPLE `/new/sell`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - retire เฉพาะ `/simple-station/2|3|4/new/sell` ไป canonical `/stations/station-[id]` ก่อน client hydrate
  - ย้าย implementation เดิมไว้ใน `LegacySimpleStationSellPage.tsx`; ไม่ลบ source/API และใช้ retired-station redirect helper เดิม
  - คง `/new/oil-sell`, `/new/open-shift` และ read-only `/new/shift-history` ไว้ เพื่อให้ retirement ยัง bounded ทีละ route/family
- ไฟล์หลักที่แก้/เพิ่ม:
  - `src/app/simple-station/[id]/new/sell/page.tsx`
  - `src/app/simple-station/[id]/new/sell/LegacySimpleStationSellPage.tsx`
  - `ROUTE_MIGRATION_PLAN.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - route/context/history regression 17/17 ผ่าน
  - targeted ESLint ผ่าน
  - HTTP smoke: `/new/sell` ของ station-2/3/4 = 307 canonical; `/new/oil-sell`, `/new/open-shift`, `/new/shift-history` ของ station-2 ยัง 200
  - `git diff --check` ผ่านใน final gate
- สิ่งที่ยังค้าง:
  - retired SIMPLE create route ถัดไป เช่น `/new/oil-sell` ยังไม่ redirect
  - active FULL/GAS ต้องใช้ S44 financial gate ก่อนทุก money-changing redirect
- Session ถัดไปที่แนะนำ: `S48`
- หมายเหตุ/Decision:
  - retired sale route ต้อง redirect ก่อน hydrate เพื่อไม่โหลด price/product/customer context ของระบบที่เลิกใช้หน้างานแล้ว
  - read/history/receipt compatibility ยังไม่พ่วงกับ create-route retirement


## 2026-08-27 — S48 — Retire retired-SIMPLE `/new/oil-sell`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - retire เฉพาะ `/simple-station/2|3|4/new/oil-sell` ไป canonical `/stations/station-[id]` ก่อน client hydrate
  - ย้าย implementation เดิมไว้ใน `LegacySimpleStationOilSellPage.tsx`; ไม่ลบ source/API และใช้ retired-station redirect helper เดิม
  - คง `/new/open-shift` และ read-only `/new/shift-history` ไว้ เพื่อให้ retirement ยัง bounded ทีละ route/family
- ไฟล์หลักที่แก้/เพิ่ม:
  - `src/app/simple-station/[id]/new/oil-sell/page.tsx`
  - `src/app/simple-station/[id]/new/oil-sell/LegacySimpleStationOilSellPage.tsx`
  - `ROUTE_MIGRATION_PLAN.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - route/context/history regression 17/17 ผ่าน
  - targeted ESLint ผ่าน
  - HTTP smoke: `/new/oil-sell` ของ station-2/3/4 = 307 canonical; `/new/open-shift` และ `/new/shift-history` ของ station-2 ยัง 200
  - `git diff --check` ผ่านใน final gate
- สิ่งที่ยังค้าง:
  - retired SIMPLE operational route ถัดไป เช่น `/new/open-shift` ยังไม่ redirect
  - active FULL/GAS ต้องใช้ S44 financial gate ก่อนทุก money-changing redirect
- Session ถัดไปที่แนะนำ: `S49`
- หมายเหตุ/Decision:
  - retired product-sale route ต้อง redirect ก่อน hydrate เพราะหน้าเดิมโหลด stock และสามารถ POST transaction/ตัด stock ได้
  - read/history/receipt compatibility ยังไม่พ่วงกับ operational-route retirement


## 2026-08-27 — S49 — Retire retired-SIMPLE `/new/open-shift`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - retire เฉพาะ `/simple-station/2|3|4/new/open-shift` ไป canonical `/stations/station-[id]` ก่อน client hydrate
  - ย้าย implementation เดิมไว้ใน `LegacySimpleStationOpenShiftPage.tsx`; ไม่ลบ source/API และใช้ retired-station redirect helper เดิม
  - คง `/new/close-shift`, `/new/shift-end` และ read-only `/new/shift-history` ไว้ เพื่อให้ retirement ยัง bounded ทีละ route/family
- ไฟล์หลักที่แก้/เพิ่ม:
  - `src/app/simple-station/[id]/new/open-shift/page.tsx`
  - `src/app/simple-station/[id]/new/open-shift/LegacySimpleStationOpenShiftPage.tsx`
  - `ROUTE_MIGRATION_PLAN.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - route/context/history regression 17/17 ผ่าน
  - targeted ESLint ผ่าน
  - HTTP smoke: `/new/open-shift` ของ station-2/3/4 = 307 canonical; `/new/close-shift`, `/new/shift-end`, `/new/shift-history` ของ station-2 ยัง 200
  - `git diff --check` ผ่านใน final gate
- สิ่งที่ยังค้าง:
  - retired SIMPLE operational route ถัดไป เช่น `/new/close-shift` ยังไม่ redirect
  - active FULL/GAS ต้องใช้ S44 financial gate ก่อนทุก money-changing redirect
- Session ถัดไปที่แนะนำ: `S50`
- หมายเหตุ/Decision:
  - retired open-shift route ต้อง redirect ก่อน hydrate เพราะหน้าเดิมโหลด daily price และสามารถ POST ราคา + เปิดกะได้
  - read/history/receipt compatibility ยังไม่พ่วงกับ operational-route retirement


## 2026-08-27 — S50 — Retire retired-SIMPLE `/new/close-shift`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - retire เฉพาะ `/simple-station/2|3|4/new/close-shift` ไป canonical `/stations/station-[id]` ก่อน client hydrate
  - ย้าย implementation เดิมไว้ใน `LegacySimpleStationCloseShiftPage.tsx`; ไม่ลบ source/API และใช้ retired-station redirect helper เดิม
  - คง `/new/shift-end` และ read-only `/new/shift-history` ไว้ เพื่อให้ retirement ยัง bounded ทีละ route/family
- ไฟล์หลักที่แก้/เพิ่ม:
  - `src/app/simple-station/[id]/new/close-shift/page.tsx`
  - `src/app/simple-station/[id]/new/close-shift/LegacySimpleStationCloseShiftPage.tsx`
  - `ROUTE_MIGRATION_PLAN.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - route/context/history regression 17/17 ผ่าน
  - targeted ESLint ผ่าน
  - HTTP smoke: `/new/close-shift` ของ station-2/3/4 = 307 canonical; `/new/shift-end` และ `/new/shift-history` ของ station-2 ยัง 200
  - `git diff --check` ผ่านใน final gate
- สิ่งที่ยังค้าง:
  - retired SIMPLE operational route ถัดไป เช่น `/new/shift-end` ยังไม่ redirect
  - active FULL/GAS ต้องใช้ S44 financial gate ก่อนทุก money-changing redirect
- Session ถัดไปที่แนะนำ: `S51`
- หมายเหตุ/Decision:
  - retired close-shift route ต้อง redirect ก่อน hydrate เพราะหน้าเดิมอ่าน shift status และสามารถ force-close กะได้
  - read/history/receipt compatibility ยังไม่พ่วงกับ operational-route retirement


## 2026-08-27 — S51 — Retire retired-SIMPLE `/new/shift-end`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - retire เฉพาะ `/simple-station/2|3|4/new/shift-end` ไป canonical `/stations/station-[id]` ก่อน client hydrate
  - ย้าย implementation เดิมไว้ใน `LegacySimpleStationShiftEndPage.tsx`; ไม่ลบ source/API และใช้ retired-station redirect helper เดิม
  - คง `/new/products` และ read-only `/new/shift-history` ไว้ เพื่อให้ retirement ยัง bounded ทีละ route/family
- ไฟล์หลักที่แก้/เพิ่ม:
  - `src/app/simple-station/[id]/new/shift-end/page.tsx`
  - `src/app/simple-station/[id]/new/shift-end/LegacySimpleStationShiftEndPage.tsx`
  - `ROUTE_MIGRATION_PLAN.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - route/context/history regression 17/17 ผ่าน
  - targeted ESLint ผ่าน
  - HTTP smoke: `/new/shift-end` ของ station-2/3/4 = 307 canonical; `/new/products` และ `/new/shift-history` ของ station-2 ยัง 200
  - `git diff --check` ผ่านใน final gate
- สิ่งที่ยังค้าง:
  - retired SIMPLE operational route สุดท้าย `/new/products` ยังไม่ redirect
  - active FULL/GAS ต้องใช้ S44 financial gate ก่อนทุก money-changing redirect
- Session ถัดไปที่แนะนำ: `S52`
- หมายเหตุ/Decision:
  - retired shift-end route ต้อง redirect ก่อน hydrate เพราะหน้าเดิมโหลด meter/product/cash context และสามารถ POST ปิดกะ/reconciliation ได้
  - read/history/receipt compatibility ยังไม่พ่วงกับ operational-route retirement


## 2026-08-27 — S52 — Retire retired-SIMPLE `/new/products`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - retire เฉพาะ `/simple-station/2|3|4/new/products` ไป canonical `/stations/station-[id]` ก่อน client hydrate
  - ย้าย implementation เดิมไว้ใน `LegacySimpleStationProductsPage.tsx`; ไม่ลบ source/API และใช้ retired-station redirect helper เดิม
  - ปิด operational/create entry ของ retired SIMPLE station-2/3/4 ครบทุก route ที่กำหนดใน migration plan
  - คง read-only `/new/shift-history`, `/new/meter-summary`, `/new/summary`, `/new/receipt` ไว้ตาม read compatibility gate
  - แก้ JSX quote escaping เดิมใน legacy products page 1 จุดเพื่อไม่ให้ไฟล์ที่ย้ายมาพก ESLint error; business logic ไม่เปลี่ยน
- ไฟล์หลักที่แก้/เพิ่ม:
  - `src/app/simple-station/[id]/new/products/page.tsx`
  - `src/app/simple-station/[id]/new/products/LegacySimpleStationProductsPage.tsx`
  - `ROUTE_MIGRATION_PLAN.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - route/context/history regression 17/17 ผ่าน
  - targeted ESLint 0 errors; เหลือ 2 legacy warnings เดิมใน products component
  - HTTP smoke: `/new/products` ของ station-2/3/4 = 307 canonical
  - read compatibility smoke: shift-history / meter-summary / summary / receipt ของ station-2 = 200 ครบ
  - `git diff --check` ผ่านใน final gate
- สิ่งที่ยังค้าง:
  - retired SIMPLE operational retirement ไม่มี route ค้างแล้ว
  - read/history/receipt compatibility ยังเก็บไว้จนมี explicit retirement task
  - active FULL/GAS route retirement ต้องใช้ S44 financial gate ก่อน money-changing redirect
- Session ถัดไปที่แนะนำ: `S53` เลือก legacy group ถัดไปจาก migration plan โดยไม่พ่วงหลาย family
- หมายเหตุ/Decision:
  - station-2/3/4 ไม่มี legacy operational/create entry ที่ใช้งานได้แล้ว; canonical เป็น read-only workspace
  - ไม่ลบ legacy source/API/history ในการ retire UI route


## 2026-08-27 — S53 — Retire current GAS `/gas/[stationId]/sell`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - rerun S44 financial gate ก่อนและหลังแก้; 16 files / 81 tests ผ่านทั้งรอบ final
  - retire เฉพาะ current GAS sell `/gas/5/sell` และ `/gas/6/sell` ไป `/stations/station-5/sales` และ `/stations/station-6/sales` แบบ server-side ก่อน hydrate
  - เก็บ implementation เดิมไว้ใน `LegacyGasSellPage.tsx`; ไม่ลบ `/api/v2/gas/[stationId]/sell` หรือข้อมูล transaction/shift
  - helper รองรับ numeric, canonical station ID และ GAS alias แต่ reject non-GAS/retired IDs
  - เปลี่ยน sell link ใน current GAS landing/layout ให้ชี้ canonical โดยตรง และซ่อน GAS legacy-sales fallback ใน canonical workspace เพื่อไม่เกิด redirect loop
  - older `/gas-station/[id]/new/sell` ยังไม่แก้ใน S53; ยัง redirect ไป current `/gas/[id]/sell` ตามเดิม
- ไฟล์หลักที่แก้/เพิ่ม:
  - `src/app/gas/[stationId]/sell/page.tsx`
  - `src/app/gas/[stationId]/sell/LegacyGasSellPage.tsx`
  - `src/app/gas/[stationId]/page.tsx`
  - `src/app/gas/[stationId]/layout.tsx`
  - `src/components/stations/CanonicalStationWorkspace.tsx`
  - `src/lib/stations/legacy-route-retirement.ts`
  - `tests/legacy-route-retirement.test.ts`
  - `FINANCIAL_REGRESSION_CHECKLIST.md`
  - `ROUTE_MIGRATION_PLAN.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted route/GAS/SaleFlow regression 54/54 ผ่าน
  - full S44 financial gate 16 files / 81 tests ผ่านหลังแก้
  - targeted ESLint 0 errors
  - HTTP smoke: `/gas/5/sell` และ `/gas/6/sell` = 307 canonical; `/stations/station-5/sales` = 200
  - boundary smoke: `/gas/5` และ `/gas/5/shift/open` ยัง 200; older `/gas-station/5/new/sell` ยัง 307 ไป `/gas/5/sell` ตามเดิม
- สิ่งที่ยังค้าง:
  - older GAS `/gas-station/[id]/new/sell` เป็น family แยกและยังไม่ flatten ไป canonical โดยตรง
  - FULL `/station/1/new/sell` ยังรอ bounded retirement พร้อม S44 rerun ของ session นั้น
  - GAS landing/open/close/meters/gauge/supplies/products/summary ยังไม่ retire
- Session ถัดไปที่แนะนำ: `S54` retire older GAS `/gas-station/[id]/new/sell` โดยตรงไป canonical sales เป็น family เดียว
- หมายเหตุ/Decision:
  - current GAS sell UI ไม่ใช่ fallback แล้วหลัง S53; canonical SaleFlow เป็น entry หลักสำหรับ station-5/6
  - API v2 GAS sell และ historical/report compatibility ต้องคงไว้


## 2026-08-27 — S54 — Retire older GAS `/gas-station/[id]/new/sell`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - rerun S44 financial gate ก่อนและหลังแก้; final 16 files / 81 tests ผ่าน
  - เปลี่ยน older GAS sell `/gas-station/5|6/new/sell` ให้ redirect ไป `/stations/station-5|6/sales` โดยตรง แทนการผ่าน `/gas/5|6/sell`
  - ใช้ `getActiveGasSellRedirect()` เดียวกับ S53 ใน route wrapper เพื่อรองรับ numeric/canonical/alias เมื่อ page ถูกเรียกโดยตรง
  - แก้ middleware sell mapping เฉพาะ station-5/6 ให้ canonical โดยตรง และแก้ login redirect normalization ให้ unauthenticated flow กลับ canonical พร้อม query string เดิม
  - คง older GAS home/meters/supplies/summary mapping เดิม และไม่แตะ API/transaction/shift data
- ไฟล์หลักที่แก้/เพิ่ม:
  - `src/app/gas-station/[id]/new/sell/page.tsx`
  - `src/middleware.ts`
  - `src/app/login/page.tsx`
  - `ROUTE_MIGRATION_PLAN.md`
  - `FINANCIAL_REGRESSION_CHECKLIST.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted route/GAS/SaleFlow regression 54/54 ผ่าน
  - targeted ESLint 0 errors
  - full S44 financial gate final 16 files / 81 tests ผ่าน
  - authenticated HTTP smoke: older sell station-5/6 = 307 ไป canonical โดยตรง; canonical station-5 sales = 200
  - unauthenticated smoke: older sell → `/login?redirect=/stations/station-5/sales...` โดย preserve query
  - boundary smoke: older `/new/home` ยัง → `/gas/5`; `/new/meters` ยัง → `/gas/5/meters`; current `/gas/5/sell` ยังคง S53 redirect canonical
- สิ่งที่ยังค้าง:
  - active FULL legacy sell entry ยังรอ bounded retirement พร้อม S44 rerun ใน session ถัดไป
  - GAS landing/open/close/meters/gauge/supplies/products/summary และ older non-sell routes ยังไม่ retire
- Session ถัดไปที่แนะนำ: `S55` review/retire active FULL legacy sell entry แบบ bounded
- หมายเหตุ/Decision:
  - GAS sell entry ทั้ง current และ older family ของ station-5/6 ตอนนี้ไป canonical SaleFlow โดยตรงแล้ว
  - API v2 GAS sell และ read/report compatibility ยังคงไว้; S54 เป็น UI-route retirement เท่านั้น


## 2026-08-27 — S55 — Retire active FULL `/station/1/new/sell`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - rerun S44 financial gate ก่อนและหลังแก้; final 16 files / 81 tests ผ่าน
  - เปลี่ยน `/station/1/new/sell` จาก legacy → V2 ให้ redirect ไป canonical `/stations/station-1/sales` โดยตรงทั้ง middleware และ page wrapper
  - เพิ่ม `getActiveFullSellRedirect()` เพื่อ resolve เฉพาะ active FULL station และ reject SIMPLE/GAS/non-station params
  - แก้ login redirect normalization ให้ unauthenticated `/station/1/new/sell?...` กลับ canonical sales พร้อม query เดิมหลัง login
  - คง `/station/1/v2`, `/station/1/new/home`, `/station/1/new/receipt`, `/station/1/new/oil-sell` และ `/simple-station/1/new/sell` ไว้ตาม compatibility/route scope เดิม
  - คง FULL V2 เป็น supported operational workspace/fallback; S55 retire เฉพาะ legacy sell entry ไม่ retire V2 sale capability
- ไฟล์หลักที่แก้/เพิ่ม:
  - `src/app/station/[id]/new/sell/page.tsx`
  - `src/lib/stations/legacy-route-retirement.ts`
  - `tests/legacy-route-retirement.test.ts`
  - `src/middleware.ts`
  - `src/app/login/page.tsx`
  - `ROUTE_MIGRATION_PLAN.md`
  - `FINANCIAL_REGRESSION_CHECKLIST.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted retirement/SaleFlow/FULL regression 49/49 ผ่าน
  - targeted ESLint 0 errors
  - full S44 financial gate final 16 files / 81 tests ผ่าน
  - authenticated HTTP smoke: `/station/1/new/sell` = 307 → `/stations/station-1/sales`; canonical sales = 200
  - unauthenticated smoke: sell → `/login?redirect=/stations/station-1/sales...` โดย preserve query
  - boundary smoke: V2 = 200, home → V2, receipt = 200, oil-sell → V2, `/simple-station/1/new/sell` → V2 ตามเดิม
- สิ่งที่ยังค้าง:
  - `/station/1/new/oil-sell` ยังเป็น bounded retirement candidate แยกต่างหาก
  - FULL V2/landing/open/close/shift-end/meters/history/receipt ยังไม่ retire
  - GAS non-sell operational/read routes ยังไม่ retire
- Session ถัดไปที่แนะนำ: `S56` review/retire FULL `/station/1/new/oil-sell` แบบ bounded โดยไม่พ่วง V2 หรือ operational routes อื่น
- หมายเหตุ/Decision:
  - canonical SaleFlow เป็น direct target ของ legacy FULL sell entry หลัง S55
  - V2 ยังเป็น supported operational workspace และยังไม่ใช่ route ที่ S55 retire


## 2026-08-27 — S56 — Retire active FULL `/station/1/new/oil-sell`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - rerun S44 financial gate ก่อนและหลังแก้; final 16 files / 81 tests ผ่าน
  - เปลี่ยน `/station/1/new/oil-sell` จาก redirect ไป legacy home/V2 ให้ redirect canonical `/stations/station-1/sales` โดยตรงทั้ง middleware และ page wrapper
  - reuse `getActiveFullSellRedirect()` จาก S55 เพื่อให้ direct page access รองรับเฉพาะ active FULL station และคง fallback เดิมสำหรับ station อื่น
  - แก้ login redirect normalization ให้ unauthenticated `/station/1/new/oil-sell?...` กลับ canonical sales พร้อม query เดิมหลัง login
  - คง `/station/1/v2`, `/station/1/new/home`, `/station/1/new/receipt`, S55 `/station/1/new/sell` และ `/simple-station/1/new/oil-sell` ตาม compatibility/route scope เดิม
  - ไม่เพิ่ม engine-oil/product capability: Tank Loy ไม่มี flow นี้อยู่แล้วและ oil-sell route เดิมเป็น redirect-only
- ไฟล์หลักที่แก้:
  - `src/app/station/[id]/new/oil-sell/page.tsx`
  - `src/middleware.ts`
  - `src/app/login/page.tsx`
  - `ROUTE_MIGRATION_PLAN.md`
  - `FINANCIAL_REGRESSION_CHECKLIST.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted retirement/SaleFlow/FULL regression 49/49 ผ่าน
  - targeted ESLint 0 errors
  - full S44 financial gate final 16 files / 81 tests ผ่าน
  - authenticated HTTP smoke: `/station/1/new/oil-sell` = 307 → `/stations/station-1/sales`; canonical sales = 200
  - unauthenticated smoke: oil-sell → `/login?redirect=/stations/station-1/sales...` โดย preserve query
  - boundary smoke: V2 = 200, home → V2, receipt = 200, S55 sell → canonical, `/simple-station/1/new/oil-sell` → V2 ตามเดิม
  - `git diff --check` ผ่านใน final gate
- สิ่งที่ยังค้าง:
  - FULL V2/landing/home/open/close/shift-end/meters/history/receipt ยังไม่ retire
  - GAS non-sell operational/read routes ยังไม่ retire
  - read/print routes ยังเก็บ compatibility ตาม migration gate
- Session ถัดไปที่แนะนำ: `S57` review FULL `/station/1/new/open-shift` แบบ bounded หลัง operational regression โดยไม่พ่วง close/history
- หมายเหตุ/Decision:
  - FULL legacy sale-entry pair `/new/sell` + `/new/oil-sell` ตอนนี้ไป canonical SaleFlow โดยตรงครบแล้ว
  - S56 เป็น UI-route retirement เท่านั้น; transaction API, V2 operational workspace และ receipt/history data ไม่เปลี่ยน


## 2026-08-27 — S57 — Retire active FULL `/station/1/new/open-shift`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - เทียบ legacy open-shift กับ canonical Operations หลัง S38-S40 และยืนยัน parity: ราคาประจำวัน → `/api/station/1/daily`, เปิดกะ → `/api/station/1/shifts`; canonical เพิ่ม guard ให้บันทึกมิเตอร์ต้นกะ 4 หัว + รูปก่อนขาย
  - rerun operational+financial pre-gate 19 files / 123 tests ผ่าน และ full S44 financial gate หลังแก้ 16 files / 81 tests ผ่าน
  - เปลี่ยน `/station/1/new/open-shift` จาก legacy/V2 mapping ให้ redirect canonical `/stations/station-1/operations` โดยตรงทั้ง middleware และ page wrapper
  - เพิ่ม `getActiveFullOperationsRedirect()` ให้ direct page access จำกัดเฉพาะ active FULL station และ reject SIMPLE/GAS/non-station params
  - แก้ login redirect normalization ให้ unauthenticated `/station/1/new/open-shift?...` กลับ canonical Operations พร้อม query เดิมหลัง login
  - คง `/station/1/v2`, home, close-shift, shift-end, receipt และ `/simple-station/1/new/open-shift` ตาม compatibility/route scope เดิม
- ไฟล์หลักที่แก้:
  - `src/app/station/[id]/new/open-shift/page.tsx`
  - `src/lib/stations/legacy-route-retirement.ts`
  - `tests/legacy-route-retirement.test.ts`
  - `src/middleware.ts`
  - `src/app/login/page.tsx`
  - `ROUTE_MIGRATION_PLAN.md`
  - `FINANCIAL_REGRESSION_CHECKLIST.md`
- ตรวจสอบแล้ว:
  - `npx tsc --noEmit` ผ่าน
  - targeted opening/closing/context/history/retirement/SaleFlow regression 78/78 ผ่าน
  - targeted ESLint 0 errors
  - pre-gate operational+financial 19 files / 123 tests ผ่าน
  - full S44 financial gate หลังแก้ 16 files / 81 tests ผ่าน
  - authenticated HTTP smoke: `/station/1/new/open-shift` = 307 → `/stations/station-1/operations`; canonical operations = 200
  - unauthenticated smoke: open-shift → `/login?redirect=/stations/station-1/operations...` โดย preserve query
  - boundary smoke: V2 = 200, home/close-shift/shift-end → V2, receipt = 200, `/simple-station/1/new/open-shift` → V2, S55 sell → canonical sales
- สิ่งที่ยังค้าง:
  - FULL `/station/1/new/close-shift` และ `/station/1/new/shift-end` ยังเป็น bounded operational candidates แยกกัน
  - FULL V2/landing/home/meters/history/receipt ยังไม่ retire
  - GAS non-sell operational/read routes ยังไม่ retire
- Session ถัดไปที่แนะนำ: `S58` review FULL `/station/1/new/close-shift` แบบ bounded หลัง closing regression โดยไม่พ่วง shift-end/history
- หมายเหตุ/Decision:
  - S38-S40 parity gate ของ FULL opening ผ่านแล้ว; migration note เดิมที่รอ S39/S40 จึงถูก supersede สำหรับ open-shift ใน S57
  - canonical opening ใช้ StationContext Bangkok business date แทน legacy `toISOString()` calendar date และ fail-closed เมื่อ context ไม่สด
  - S57 เป็น UI-route retirement เท่านั้น; daily/shift/meter APIs และ historical data ไม่ถูกลบหรือเปลี่ยน schema


## 2026-08-27 — S58 — Retire active FULL `/station/1/new/close-shift`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - ย้าย `/station/1/new/close-shift` ไป canonical `/stations/station-1/operations` แบบ server-side ก่อน hydrate
  - reuse `getActiveFullOperationsRedirect()` เดียวกับ S57 เพื่อจำกัดเฉพาะ active FULL station
  - ปรับ middleware และ login redirect normalization ให้ authenticated/unauthenticated flow ไป canonical Operations โดย preserve query string
  - คง `/station/1/v2`, shift-end, meters, history, receipt และ legacy APIs/data ไว้ตาม compatibility gate
- ตรวจสอบแล้ว:
  - targeted closing/opening/context/history/SaleFlow regression ผ่าน 7 files / 74 tests
  - S44 financial gate ผ่าน 16 files / 81 tests
  - final typecheck + diff check รันหลังอัปเดตเอกสาร
- สิ่งที่ยังค้าง:
  - FULL `/station/1/new/shift-end` เป็น bounded candidate ถัดไป
  - read/history/receipt routes ยังเก็บ compatibility
- Session ถัดไปที่แนะนำ: `S59` review FULL `/station/1/new/shift-end` แบบ bounded
- หมายเหตุ/Decision:
  - S58 เป็น UI-route retirement เท่านั้น ไม่ลบ API/schema/history และไม่ deploy production


## 2026-08-27 — S59 — Retire active FULL `/station/1/new/shift-end`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - ย้าย `/station/1/new/shift-end` ไป canonical `/stations/station-1/operations` แบบ server-side ก่อน hydrate
  - reuse `getActiveFullOperationsRedirect()` เพื่อจำกัด redirect เฉพาะ active FULL station
  - ปรับ middleware + login normalization ให้ preserve query และไม่กลับเข้า legacy V2 โดยไม่จำเป็น
  - คง meter/history/receipt routes และ backend APIs/data ทั้งหมดไว้
- ตรวจสอบแล้ว:
  - targeted closing/opening/context/history/SaleFlow regression ผ่าน 7 files / 74 tests
  - S44 financial gate ผ่าน 16 files / 81 tests
  - final typecheck + diff check รันหลังอัปเดตเอกสาร
- สิ่งที่ยังค้าง:
  - FULL `/station/1/new/meters` และ landing/V2/home เป็น bounded candidates แยกต่างหาก
  - read/history/receipt compatibility ยังไม่ retire
- Session ถัดไปที่แนะนำ: `S60` review FULL `/station/1/new/meters` ก่อนตัดสินใจ redirect
- หมายเหตุ/Decision:
  - S59 เป็น UI-route retirement เท่านั้น ไม่ deploy production


## 2026-08-27 — S60 — Retire active FULL `/station/1/new/meters`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - ตรวจ source จริงและยืนยันว่า `/station/1/new/meters` ไม่มี standalone meter UI; เดิม redirect ไป `/station/1/new/shift-end` เท่านั้น
  - หลัง S59 shift-end ไป canonical Operations แล้ว จึง flatten `/new/meters` ไป `/stations/station-1/operations` โดยตรงแบบ server-side
  - reuse `getActiveFullOperationsRedirect()` เพื่อจำกัด canonical redirect เฉพาะ active FULL station และคง fallback เดิมสำหรับ station อื่น
  - ปรับ middleware + login normalization ให้ preserve query และไม่ผ่าน redirect chain เก่า
  - ไม่ลบ meter/shift API, historical evidence หรือ read/print route ใด
- ตรวจสอบแล้ว:
  - targeted closing/opening/context/history/SaleFlow regression ผ่าน 7 files / 74 tests
  - S44 financial gate ผ่าน 16 files / 81 tests
  - final typecheck + diff check ผ่านหลังอัปเดตเอกสาร
- สิ่งที่ยังค้าง:
  - FULL landing `/station/1`, `/station/1/v2`, `/station/1/new/home` ต้อง review แยก เพราะเป็น workspace/navigation ไม่ใช่ bounded action route
  - meter-summary/shift-history/summary/list/record/receipt ยังเก็บ read/print compatibility
  - GAS non-sell operational routes ยังไม่ retire
- Session ถัดไปที่แนะนำ: `S61` review FULL landing/home/V2 disposition โดยยังไม่รวม read/print routes
- หมายเหตุ/Decision:
  - S60 เป็น UI-route retirement เท่านั้น ไม่ deploy production


## 2026-08-27 — S61 — Retire active FULL `/station/1/new/home` + review landing/V2
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - review `/station/1`, `/station/1/v2`, `/station/1/new/home` แยกตาม capability จริง
  - ยืนยันว่า `/station/1/new/home` เป็น navigation entry ที่ middleware เดิมส่งไป V2 อยู่แล้ว ไม่มี unique write/read capability จึง redirect ไป canonical `/stations/station-1` ได้
  - เพิ่ม `getActiveFullOverviewRedirect()` และ route wrapper เพื่อจำกัด direct canonical redirect เฉพาะ active FULL station; station อื่นยัง fallback เดิม
  - ปรับ middleware + login normalization ให้ `/station/1/new/home` ไป canonical overview โดย preserve query
  - ตัดสินใจคง `/station/1` และ `/station/1/v2`: classic ยังมี admin direct correction/report; V2 ยังมี admin settings, edit/delete transaction, print, history/audit และ historical meter correction
- ตรวจสอบแล้ว:
  - targeted route/closing/opening/context/history/SaleFlow regression ผ่าน 7 files / 84 tests
  - S44 financial gate ผ่าน 16 files / 81 tests
  - final typecheck + diff check ผ่านหลังอัปเดตเอกสาร
- สิ่งที่ยังค้าง:
  - FULL classic/V2 ไม่ retire จน admin edit/print/audit/historical correction มี canonical replacement
  - FULL read/print compatibility routes ยังไม่ retire
  - GAS non-sell operational routes เป็น candidate ชุดถัดไป
- Session ถัดไปที่แนะนำ: `S62` review GAS `/gas/[id]/shift/open` หลัง S38-S40 parity โดยจำกัดเฉพาะ open-shift family
- หมายเหตุ/Decision:
  - S61 เป็น navigation-route retirement เท่านั้น ไม่ deploy production


## 2026-08-27 — S62 — Retire active GAS `/gas/[id]/shift/open`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - เทียบ legacy GAS open กับ canonical S38 flow และยืนยัน request parity: business date 07:00, shift number, daily gas price, 4 opening meters, 3 opening gauges
  - canonical `openGasStationShift()` ใช้ `/api/v2/gas/[station]/shift/open` เดียวกับ legacy และ backend ยังเป็น atomic source of truth
  - StationContext หา next shift จาก Shift rows ของ GAS business-day โดยตรง แทน manual fallback choice ของหน้าเดิม
  - ย้าย legacy client implementation ไป `LegacyGasShiftOpenPage.tsx` และทำ server wrapper redirect active GAS ไป canonical Operations; non-active/non-GAS ยัง fallback source เดิม
  - เพิ่ม `getActiveGasOperationsRedirect()` พร้อม numeric/canonical/alias regression และปรับ middleware/login normalization สำหรับ `/gas/5|6/shift/open` โดย preserve query
  - ไม่แตะ GAS close/meters/gauge/supplies/products/read routes และไม่ลบ API/data
- ตรวจสอบแล้ว:
  - targeted GAS/opening/closing/context/history/SaleFlow regression ผ่าน 8 files / 116 tests
  - S44 financial gate ผ่าน 16 files / 81 tests
  - final typecheck + diff check ผ่านหลังอัปเดตเอกสาร
- สิ่งที่ยังค้าง:
  - GAS `/gas/[id]/shift/close` เป็น bounded candidate ถัดไป
  - meters/gauge/supplies/products ต้อง review แยกตาม capability ก่อน redirect
  - GAS summary/read compatibility ยังเก็บไว้
- Session ถัดไปที่แนะนำ: `S63` review GAS `/gas/[id]/shift/close` แบบ bounded หลัง closing parity/regression
- หมายเหตุ/Decision:
  - S62 เป็น UI-route retirement เท่านั้น ไม่ deploy production


## 2026-08-27 — S63 — Retire active GAS `/gas/[id]/shift/close`
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - เทียบ legacy GAS close กับ canonical S39 flow ทั้ง meter/gauge, product count, reconciliation, variance และ backend write path
  - ยืนยัน `/api/v2/gas/[station]/shift/close` คำนวณ expected fuel/other/variance จาก DB และ submitted product counts ใหม่เอง ไม่เชื่อ expected totals จาก UI
  - พบ behavior gap 1 จุด: legacy บล็อกเมื่อ cash/credit/card/transfer เป็นศูนย์ทั้งหมด; เพิ่ม guard เดียวกันใน canonical ก่อน retire route
  - canonical บันทึก end meters + end gauges ก่อนเรียก close API เดิม และ backend ยังตรวจ station/shift scope + meter/gauge completeness + product inventory + over/invalid amounts
  - ย้าย legacy client source ไป `LegacyGasShiftClosePage.tsx`, ทำ server wrapper active GAS → canonical Operations และขยาย middleware/login normalization จาก open ให้ครอบคลุม close โดย preserve query
  - ไม่แตะ standalone meters/gauge/supplies/products และ read/summary routes
- ตรวจสอบแล้ว:
  - targeted GAS/closing/opening/context/history/SaleFlow regression ผ่าน 8 files / 116 tests
  - S44 financial gate ผ่าน 16 files / 81 tests
  - final typecheck + diff check ผ่านหลังอัปเดตเอกสาร
- สิ่งที่ยังค้าง:
  - GAS `/gas/[id]/meters` และ `/gauge` ต้อง review ว่ามี admin/manual correction capability นอก canonical close หรือไม่ก่อน redirect
  - supplies/products เป็น separate operational domains ยังไม่ควรพ่วง
  - GAS summary/read compatibility ยังเก็บไว้
- Session ถัดไปที่แนะนำ: `S64` review GAS `/gas/[id]/meters` แบบ capability audit ก่อนตัดสินใจ retire
- หมายเหตุ/Decision:
  - S63 เป็น UI-route retirement เท่านั้น ไม่ deploy production


## 2026-08-27 — S64 — Review GAS `/gas/[id]/meters` correction capability
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - ตรวจ legacy meter page + `/api/v2/gas/[stationId]/meters` เทียบ canonical Opening/Closing
  - ยืนยันว่า route นี้ไม่ได้เป็นเพียงทางเข้าปกติ: สามารถแก้ START meter หลังเปิดกะได้ตราบใดที่ backend `getGasStartBaselineLock()` ยังอนุญาต
  - backend จะล็อก START baseline เมื่อมี transaction, end meter, end gauge หรือ reconciliation แล้ว และยังตรวจ station/shift scope + OPEN status
  - route เดิมยังรองรับ standalone END-meter save/retry แยกจาก full close flow
  - canonical GAS Opening เปิด meter+gauge แบบ atomic และถ้าพบ opening data ไม่ครบจะ fail-closed; ยังไม่มี UI repair START baseline แบบเดียวกัน
- Decision:
  - **ไม่ redirect `/gas/[id]/meters` ใน S64** เพื่อไม่ทำ recovery/correction capability หาย
  - เพิ่ม disposition `KEEP_GAS_CORRECTION`; จะ retire ได้เมื่อ canonical มี explicit guarded correction flow และ regression ครบ
- ตรวจสอบแล้ว:
  - เป็น review/docs-only session; ไม่มี production source behavior เปลี่ยนและไม่ต้อง rerun financial gate จาก S63
  - `git diff --check` ผ่านก่อน commit
- สิ่งที่ยังค้าง:
  - GAS `/gas/[id]/gauge` ต้อง capability audit แบบเดียวกัน
- Session ถัดไปที่แนะนำ: `S65` review GAS `/gas/[id]/gauge` ก่อนตัดสินใจ redirect
- หมายเหตุ/Decision:
  - การเก็บ legacy correction route ไม่ได้เปลี่ยน canonical เป็น fallback หลัก; normal open/close ยังใช้ canonical Operations
  - ไม่ deploy production


## 2026-08-27 — S65 — Review GAS `/gas/[id]/gauge` correction capability
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - ตรวจ legacy gauge page, current-shift contract และ `/api/v2/gas/[stationId]/gauge` เทียบ canonical Opening/Closing
  - ยืนยัน route เดิมสามารถแก้ START gauge ได้เฉพาะช่วงที่ backend `getGasStartBaselineLock()` ยังไม่ล็อก
  - lock ใช้สัญญาณเดียวกับ meter correction: transaction, end meter, end gauge, reconciliation หรือ shift state ที่ไม่ปลอดภัย
  - route เดิมยังรองรับ standalone END-gauge save/retry และอ่าน start/end evidence แยกกัน
  - canonical GAS Opening/Closing ครอบคลุม normal path แต่ยังไม่มี explicit repair UI เมื่อ atomic opening data ไม่ครบหรือจำเป็นต้อง correction ก่อนถูก lock
- Decision:
  - **ไม่ redirect `/gas/[id]/gauge` ใน S65**; ใช้ `KEEP_GAS_CORRECTION` เช่นเดียวกับ meters
  - retire ได้เมื่อ canonical recovery flow รองรับ meter+gauge correction พร้อม server-lock semantics เดิม
- ตรวจสอบแล้ว:
  - review/docs-only; ไม่มี production behavior เปลี่ยน และ financial gate ล่าสุดจาก S63 ยังใช้ได้
  - `git diff --check` ผ่านก่อน commit
- สิ่งที่ยังค้าง:
  - GAS `/gas/[id]/supplies` เป็น capability audit ถัดไป
- Session ถัดไปที่แนะนำ: `S66` review GAS supplies ว่า canonical มี replacement หรือยัง
- หมายเหตุ/Decision:
  - normal shift open/close ยังคง canonical Operations; legacy gauge มีไว้สำหรับ correction/recovery เท่านั้น
  - ไม่ deploy production


## 2026-08-27 — S66 — Review GAS `/gas/[id]/supplies` inventory workflow
- Status: `[x]`
- ทำอะไรไปแล้ว:
  - ตรวจ supply page + `/api/v2/gas/[stationId]/supplies` และเทียบกับ canonical station Operations
  - ยืนยันว่าเป็น domain รับแก๊สเข้าถัง ไม่ใช่ shift sub-step: บันทึกวันที่, ลิตร, supplier, invoice, ราคาทุน/ลิตร, total cost, notes
  - API เขียน `GasSupply` พร้อม AuditLog และหน้าเดิมมี date filter + summary ลิตร/ต้นทุน/จำนวนใบส่ง/ต้นทุนเฉลี่ย + history
  - canonical Opening/Closing ไม่มี LPG supply receipt/history และไม่ควรยัด capability นี้เข้า SaleFlow/shift form โดยไม่มี design แยก
- Decision:
  - **ไม่ redirect `/gas/[id]/supplies` ใน S66**
  - เพิ่ม `KEEP_GAS_INVENTORY`; migration รอบหลังควรสร้าง inventory/receiving workspace แล้วค่อย retire route
- ตรวจสอบแล้ว:
  - review/docs-only ไม่มี production behavior เปลี่ยน; financial gate ล่าสุด S63 ยังเป็น baseline
  - `git diff --check` ผ่านก่อน commit
- สิ่งที่ยังค้าง:
  - station-5 `/gas/5/products` ต้อง audit master-data/receive/history capability แยก
- Session ถัดไปที่แนะนำ: `S67` review GAS products inventory/master-data route
- หมายเหตุ/Decision:
  - supplies เป็น operational inventory domain แยกจาก fuel sale และ shift reconciliation
  - ไม่ deploy production


## Template

### YYYY-MM-DD — Sxx — ชื่อ Session
- Status: `[x] / [~] / [!]`
- ทำอะไรไปแล้ว:
  -
- ไฟล์ที่แก้:
  -
- ตรวจสอบแล้ว:
  -
- สิ่งที่ยังค้าง:
  -
- Session ถัดไปที่แนะนำ: `Sxx`
- หมายเหตุ/Decision:
  -

---

# Product Decisions ที่ล็อกไว้แล้ว

1. ไม่ rewrite database ทั้งระบบในรอบแรก
2. ไม่ merge Invoice/Payment กับ BillingCollection/PaymentSlip ทันที
3. ทำ UX orchestration/adaptor layer ก่อน แล้วค่อยประเมิน migration
4. ใช้ `Transaction` เป็นแกนข้อมูลการขาย
5. ใช้ station capability/context แทนการแยก UX ตาม URL FULL/SIMPLE/GAS
6. หน้าเริ่มต้นใหม่คือ Today workspace
7. Navigation เป็น role-based และ task-first
8. UI ใหม่ minimal, operational, responsive; ลด decorative gradients/shadows
9. Legacy route ที่ยังใช้งานจริงอยู่จน parity + financial validation ผ่าน
10. ทุก session จำกัดไม่เกิน 30 นาที
11. station-2/3/4 ย้ายงานหน้าปั๊มไป POS แล้ว: ปิด flow operational ใหม่ได้ แต่ห้ามลบข้อมูลเดิม
12. Active operational scope คือ station-1 และ GAS station-5/6
13. ADMIN nav = Today / Sales / Customers / Billing / More; STAFF active nav = Today / Sales / Customers / History / More
14. current station selector เป็น page context ไม่ใช่ station menu หลัก
15. ห้ามมี quick-add/FAB ที่ hard-code ไป station ใดสถานีหนึ่ง
16. Runtime design tokens ของ UI ใหม่ใช้ `--ui-*`; primary orange, neutral slate, violet เฉพาะ credit semantic
17. Runtime user roles ล็อกที่ `ADMIN` / `STAFF`; `Owner` เป็น customer-domain entity ไม่ใช่ role และ legacy dashboard เป็น admin-only
