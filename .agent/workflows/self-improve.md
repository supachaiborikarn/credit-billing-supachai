---
description: Multi-agent self improvement workflow สำหรับตรวจสอบและปรับปรุง codebase อัตโนมัติ
---

# SELF IMPROVE THIS PROJECT

เมื่อผู้ใช้พิมพ์ "SELF IMPROVE THIS PROJECT" ให้ดำเนินการตาม workflow นี้โดยอัตโนมัติ

## บทบาท (Agents)

| Agent | Role |
|-------|------|
| **MAIN AGENT** | ทำงานหลัก (เขียนโค้ด, refactor, เพิ่มฟีเจอร์) |
| **SUB AGENT 1** | Code Quality - ความสะอาด/อ่านง่าย |
| **SUB AGENT 2** | Architecture & Design - โครงสร้างโปรเจค |
| **SUB AGENT 3** | DX & Maintenance - การดูแล/ขยายในอนาคต |
| **REFLECTOR AGENT** | สรุปปัญหา/ข้อบกพร่องจาก SUB AGENT ทั้งหมด |
| **REFINER AGENT** | ปรับปรุงโค้ดตามคำแนะนำของ REFLECTOR |

## Workflow Steps

### Step 1: MAIN AGENT - Project Overview
// turbo
```
- สรุปภาพรวมโปรเจค (stack, structure, key files)
- ระบุไฟล์ที่เกี่ยวข้องหลักๆ
- ความยาวไม่เกิน 1-2 หน้า
- บันทึกใน artifacts/brain/<conversation-id>/self-improve-overview.md
```

### Step 2: SUB AGENTS - Review
แต่ละ SUB AGENT รีวิวโค้ดในมุมของตัวเอง:

**SUB AGENT 1 - Code Quality:**
- ตรวจ naming conventions
- ดู code duplication
- ตรวจ error handling
- เขียน feedback เป็น bullet list

**SUB AGENT 2 - Architecture & Design:**
- ตรวจ folder structure
- ดู separation of concerns
- ตรวจ API design patterns
- เขียน feedback เป็น bullet list

**SUB AGENT 3 - DX & Maintenance:**
- ตรวจ documentation
- ดู test coverage
- ตรวจ dependency management
- เขียน feedback เป็น bullet list

### Step 3: REFLECTOR AGENT - Consolidate
- รวม feedback จาก SUB AGENT ทั้งหมด
- จัดลำดับความสำคัญ (🔴 High / 🟠 Medium / 🟡 Low)
- เลือกสิ่งที่ควรทำในรอบนี้ **ไม่เกิน 5 ข้อ**
- บันทึกเป็น table format

### Step 4: REFINER AGENT - Implement
- เขียน patch / diff ให้ชัด
- อธิบายว่า code เปลี่ยนตรงไหน ทำไม
- Commit changes พร้อม message ที่อธิบายได้

### Step 5: Iterate (ทำซ้ำ 3 รอบ)
ทำขั้นตอน 2-4 ซ้ำทั้งหมด **3 รอบ (iterations)**

### Step 6: Final Summary
บันทึกไฟล์สรุปใน `self-improve-summary.md`:
- ⏰ เวลาเริ่ม/จบ
- 📁 ไฟล์ที่แก้ไข (list)
- 🔴 ปัญหาหลักก่อนปรับปรุง
- ✅ สิ่งที่แก้ไปแล้ว
- ⏳ สิ่งที่ยังไม่ได้ทำ (backlog)

## Output Format

### During iteration
```markdown
## 🔄 Iteration X/3

### [MAIN AGENT] Overview
...

### [SUB AGENT 1] Code Quality Review
- ✅ Good: ...
- ⚠️ Issue: ...

### [SUB AGENT 2] Architecture Review
- ✅ Good: ...
- ⚠️ Issue: ...

### [SUB AGENT 3] DX & Maintenance Review
- ✅ Good: ...
- ⚠️ Issue: ...

### [REFLECTOR] Priority Actions
| # | Issue | Priority | Action |
|---|-------|----------|--------|
| 1 | ... | 🔴 High | ... |

### [REFINER] Changes Made
- File: `path/to/file.ts`
- Change: Description
- Diff: (code block)
```

### Final Summary
```markdown
# 🎯 Self Improvement Summary

**Started:** YYYY-MM-DD HH:MM
**Ended:** YYYY-MM-DD HH:MM
**Iterations:** 3

## Files Modified
- file1.ts
- file2.tsx

## Issues Fixed
1. ...
2. ...

## Backlog (Not Done)
1. ...
```
