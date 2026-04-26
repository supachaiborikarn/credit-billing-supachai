<!-- SUMMARY: โปรเจกต์มี `DESIGN.md` เป็น source of truth สำหรับ visual identity และ UI agent context: Thai-first Sarabun, operational console, primary orange, restrained surfaces, compact mobile station flows, no default-purple drift, และ Tank Loy (`station-1`) ต้องไม่มี engine-oil/product flow ใน nav/sell/shift steps unless business explicitly enables it. -->

# Design System

## Overview

โปรเจกต์ใช้ `DESIGN.md` ที่ root เป็นไฟล์มาตรฐานสำหรับ AI/design agents ก่อนแก้งาน UI/UX ทุกครั้ง โดยอิงรูปแบบ DESIGN.md ของ Google Labs: YAML tokens สำหรับค่าที่เครื่องอ่านได้ และ markdown rationale สำหรับเหตุผล/ข้อห้ามที่คนอ่านได้

## Current Direction

- UI เป็น operational console สำหรับงานขายน้ำมัน/แก๊ส/บิล/ปิดกะ ไม่ใช่ landing page หรือ marketing site
- Thai-first typography ใช้ Sarabun และต้องรักษา `letterSpacing: 0`
- primary action ใช้ fuel orange (`#F97316`) ไม่ใช้ purple เป็นค่า default
- mobile station flows ต้อง compact, scan ง่าย, ค่าเงิน/ลิตร/มิเตอร์เด่น และ bottom nav คงที่
- admin/reporting pages ใช้ density ได้มากกว่า แต่ยังต้องเก็บสีและ hierarchy ให้ตรงกับ DESIGN.md

## Station Capability Rule

สำหรับแท๊งลอยวัชรเกียรติ (`station-1`) ห้ามเพิ่ม/โชว์ flow น้ำมันเครื่องหรือสินค้าใน nav, sell, shift-end stepper, หรือ payload เว้นแต่ business เปิด capability นี้จริง

## Files

- `DESIGN.md`: design tokens + rationale หลักของโปรเจกต์
- `AGENTS.md`: เพิ่ม instruction ให้ agent อ่าน `DESIGN.md` เมื่อทำงาน UI/UX/frontend

## Changelog

- 2026-04-26: เพิ่ม topic นี้หลังสร้าง root `DESIGN.md` และผูก quick start ใน `AGENTS.md`
