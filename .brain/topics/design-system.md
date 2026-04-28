<!-- SUMMARY: โปรเจกต์มี `DESIGN.md` เป็น source of truth สำหรับ visual identity และ UI agent context: Thai-first Sarabun, operational console, primary orange, restrained surfaces, compact mobile station flows, bottom nav ต้องเผื่อ safe-area/ไม่บัง CTA, thermal receipt/report views ต้องรองรับ 58/80mm printer context, no default-purple drift, และ Tank Loy (`station-1`) ต้องไม่มี engine-oil/product flow ใน nav/sell/shift steps unless business explicitly enables it. -->

# Design System

## Overview

โปรเจกต์ใช้ `DESIGN.md` ที่ root เป็นไฟล์มาตรฐานสำหรับ AI/design agents ก่อนแก้งาน UI/UX ทุกครั้ง โดยอิงรูปแบบ DESIGN.md ของ Google Labs: YAML tokens สำหรับค่าที่เครื่องอ่านได้ และ markdown rationale สำหรับเหตุผล/ข้อห้ามที่คนอ่านได้

## Current Direction

- UI เป็น operational console สำหรับงานขายน้ำมัน/แก๊ส/บิล/ปิดกะ ไม่ใช่ landing page หรือ marketing site
- Thai-first typography ใช้ Sarabun และต้องรักษา `letterSpacing: 0`
- primary action ใช้ fuel orange (`#F97316`) ไม่ใช้ purple เป็นค่า default
- mobile station flows ต้อง compact, scan ง่าย, ค่าเงิน/ลิตร/มิเตอร์เด่น และ bottom nav คงที่
- fixed bottom nav ต้องเผื่อ `env(safe-area-inset-bottom)` และ content padding มากพอไม่ให้บังปุ่ม CTA ท้ายหน้า; หลีกเลี่ยง fixed CTA ลอยทับ content ใน station staff flow ถ้าไม่จำเป็น
- sticky header ของ mobile station flow ต้อง compact โดยเฉพาะ controls เสริมอย่าง print options เพื่อไม่กินพื้นที่กรอกข้อมูล
- thermal receipt/report views ต้องออกแบบเป็น print-first surface: รองรับกระดาษ 58mm/80mm, คุมความกว้างด้วย `@page` และไม่ผูกชนิดเอกสารกับสี/ธีมหน้าจอ
- admin/reporting pages ใช้ density ได้มากกว่า แต่ยังต้องเก็บสีและ hierarchy ให้ตรงกับ DESIGN.md

## Station Capability Rule

สำหรับแท๊งลอยวัชรเกียรติ (`station-1`) ห้ามเพิ่ม/โชว์ flow น้ำมันเครื่องหรือสินค้าใน nav, sell, shift-end stepper, หรือ payload เว้นแต่ business เปิด capability นี้จริง

## Files

- `DESIGN.md`: design tokens + rationale หลักของโปรเจกต์
- `AGENTS.md`: เพิ่ม instruction ให้ agent อ่าน `DESIGN.md` เมื่อทำงาน UI/UX/frontend

## Changelog

- 2026-04-26: เพิ่ม topic นี้หลังสร้าง root `DESIGN.md` และผูก quick start ใน `AGENTS.md`
- 2026-04-26: เพิ่มข้อกำกับ bottom nav/safe-area หลังแก้แท๊งลอยที่ bottom bar บังปุ่มท้ายหน้า
- 2026-04-26: เพิ่มข้อกำกับ thermal receipt 58mm/80mm หลังเปิดให้พิมพ์ transaction เป็นใบเสร็จรับเงินหรือบิลเงินเชื่อได้ทุกรายการ
- 2026-04-28: เพิ่มข้อกำกับไม่ใช้ fixed CTA ทับ content และให้ sticky header controls ของ mobile station flow เป็น compact หลังแก้ Tank Loy V2
