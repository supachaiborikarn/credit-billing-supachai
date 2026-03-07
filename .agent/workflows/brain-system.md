---
description: ระบบสมอง AI - อ่าน .brain/index.md ก่อนทุก session เพื่อจดจำบริบทข้ามเซสชัน
---

# 🧠 Brain System - AI Persistent Memory

ระบบจดจำข้อมูลสำคัญข้ามเซสชัน เพื่อให้ AI ทำงานต่อเนื่องโดยไม่ลืมบริบท

## เมื่อเริ่มทุก Session (อ่านก่อนทำงาน)

// turbo
1. **อ่าน `.brain/index.md`** ก่อนเสมอ
2. ประเมินคำถาม/งานของ user ว่าเกี่ยวกับ topic ไหนใน index
3. ถ้ามี topic ที่ตรง → อ่านเฉพาะ `<!-- SUMMARY: ... -->` (บรรทัดแรกของไฟล์ topic)
4. ถ้า SUMMARY มีข้อมูลพอ → ใช้ข้อมูลนั้นทำงาน (ไม่ต้องอ่านทั้งไฟล์)
5. ถ้าต้องการรายละเอียดเพิ่ม → อ่านทั้งไฟล์ topic นั้น

## ระหว่างทำงาน

- **ก่อนแก้ไขโค้ด**: ตรวจสอบ `bugs-and-fixes.md` ว่ามี gotchas ที่เกี่ยวข้องหรือไม่
- **ก่อนตัดสินใจ**: ตรวจสอบ `decisions/` ว่ามีการตัดสินใจเรื่องนี้ไปแล้วหรือไม่

## เมื่อทำงานเสร็จ (Update Brain)

### กรณี Topic มีอยู่แล้ว
1. **Update ไฟล์ topic เดิม** (ไม่สร้างใหม่)
   - อัปเดต `<!-- SUMMARY: ... -->` ถ้าสรุปเปลี่ยน
   - เพิ่มข้อมูลใหม่ในเนื้อหา
   - เพิ่ม entry ใน `## Changelog` ท้ายไฟล์
2. **Update `index.md`** ถ้าสรุป topic เปลี่ยน

### กรณี Topic ใหม่
1. **สร้างไฟล์ใหม่** ใน `.brain/topics/[topic-name].md`
   - ต้องมี `<!-- SUMMARY: ... -->` บรรทัดแรก
   - ต้องมี `## Changelog` ท้ายไฟล์
2. **เพิ่ม entry ใน `index.md`**

### กรณีตัดสินใจสำคัญ
1. สร้างไฟล์ใน `.brain/decisions/YYYY-MM-DD-topic.md`
2. เพิ่มใน `index.md` → Recent Decisions

### ทุกกรณี
1. เพิ่ม entry ใน `.brain/changelog.md`
2. Update วันที่ `Last Updated` ใน `index.md`

## Git Sync (Optional)

หลัง update brain เสร็จ ถ้า user ต้องการ sync ไป GitHub:
```bash
bash .brain/sync.sh
```

## โครงสร้างไฟล์

```
.brain/
├── index.md              ← AI อ่านตัวนี้ก่อน (สารบัญ)
├── changelog.md          ← log ทุกการเปลี่ยนแปลง
├── sync.sh               ← git auto-sync script
├── topics/
│   ├── billing-system.md
│   ├── database.md
│   ├── deployment.md
│   ├── station-types.md
│   ├── bugs-and-fixes.md
│   └── attendance.md
└── decisions/
    └── README.md         ← template
```

## หลักการสำคัญ

1. **ประหยัด token**: อ่าน index → summary → full file (3 ชั้น)
2. **ไม่ซ้ำซ้อน**: เรื่องเดิม update ไฟล์เดิม ไม่สร้างใหม่
3. **ย้อนหลังได้**: ทุกไฟล์มี changelog, brain ทั้งหมดเก็บใน git
