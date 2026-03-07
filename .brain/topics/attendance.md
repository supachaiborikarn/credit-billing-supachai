<!-- SUMMARY: ระบบลงเวลา/ลาหยุด ของพนักงาน มี shift swap, overlap detection,
     แสดงชื่อพนักงานที่ลาในปฏิทิน, backfill ข้อมูลย้อนหลัง -->

# Attendance & Leave System

## Overview
ระบบจัดการเวลาทำงานและการลาของพนักงาน (อยู่ในโปรเจกต์ที่เกี่ยวข้อง)

## Features

### Shift Swap
- พนักงานสามารถสลับกะกันได้
- มีการแจ้งเตือนเมื่อมีการขอสลับ

### Overlap Detection
- ตรวจจับเมื่อมีพนักงานลาพร้อมกันในสถานีเดียวกัน
- แสดง warning ใน UI
- แสดงชื่อพนักงานที่ลาตรงๆ แทนที่จะแสดงแค่ icon + จำนวน

### Leave Request Display
- แสดง leave status badges ใน UI
- แสดง overlap warnings ใน absent employees dialog

### Backfill
- หน้าสำหรับเพิ่มข้อมูลเวลาทำงานย้อนหลัง
- Bug เดิม: ข้อมูลที่มีอยู่ใน DB ไม่แสดง → แก้แล้ว

## Changelog
- 2026-02-24: สร้างไฟล์ brain topic นี้
- 2026-02-21: แสดงชื่อพนักงานที่ลาแทน icon+count
- 2026-02-21: แก้ backfill data not loading
- 2026-02-19: เพิ่ม overlap detection + leave status badges
