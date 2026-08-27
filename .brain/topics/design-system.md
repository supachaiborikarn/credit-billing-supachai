<!-- SUMMARY: โปรเจกต์มี `DESIGN.md` เป็น source of truth สำหรับ visual identity และ UI agent context: Thai-first Sarabun, operational console, primary orange, restrained surfaces, compact mobile station flows, bottom nav ต้องเผื่อ safe-area/ไม่บัง CTA, thermal receipt/report views ต้องรองรับ 58/80mm printer context, accessibility ต้องมี keyboard/focus/label/modal semantics + contrast-safe `primary-action`/`*-text` tokens, async state ใช้ initial skeleton + stale-while-refresh และ operational writes fail-closed เมื่อ station context ไม่สด, no default-purple drift, และ Tank Loy (`station-1`) ต้องไม่มี engine-oil/product flow ใน nav/sell/shift steps unless business explicitly enables it. -->

# Design System

## Overview

โปรเจกต์ใช้ `DESIGN.md` ที่ root เป็นไฟล์มาตรฐานสำหรับ AI/design agents ก่อนแก้งาน UI/UX ทุกครั้ง โดยอิงรูปแบบ DESIGN.md ของ Google Labs: YAML tokens สำหรับค่าที่เครื่องอ่านได้ และ markdown rationale สำหรับเหตุผล/ข้อห้ามที่คนอ่านได้

## Current Direction

- UI เป็น operational console สำหรับงานขายน้ำมัน/แก๊ส/บิล/ปิดกะ ไม่ใช่ landing page หรือ marketing site
- Thai-first typography ใช้ Sarabun และต้องรักษา `letterSpacing: 0`
- primary action ใช้ fuel orange (`#F97316`) ไม่ใช้ purple เป็นค่า default
- mobile station flows ต้อง compact, scan ง่าย, ค่าเงิน/ลิตร/มิเตอร์เด่น และ bottom nav คงที่
- fixed bottom nav ต้องเผื่อ `env(safe-area-inset-bottom)` และ content padding มากพอไม่ให้บังปุ่ม CTA ท้ายหน้า; หลีกเลี่ยง fixed CTA ลอยทับ content ใน station staff flow ถ้าไม่จำเป็น
- sticky header ของ mobile station flow ต้อง compact และไม่ควรใส่ controls เสริมอย่าง print options; action สำหรับรายงานควรอยู่ในแท็บ/หน้าสรุปที่เป็นบริบทของงานนั้น
- thermal receipt/report views ต้องออกแบบเป็น print-first surface: รองรับกระดาษ 58mm/80mm, คุมความกว้างด้วย `@page` และไม่ผูกชนิดเอกสารกับสี/ธีมหน้าจอ รวมถึงการออกแบบตารางเลขมิเตอร์ให้อยู่ในบล็อกกะทัดรัด (Thermal Table) และโครงสร้างรายการธุรกรรม 3 บรรทัดย่อยเพื่อความสะดวกรวดเร็วในการสแกนข้อมูล
- รายงาน A4 Landscape ใช้ Google Fonts Sarabun จัดหน้าแบบ Grid Cards, ตาราง Zebra Striping, และแบ่งสรุปยอดชำระเงินเป็น Payment Chips เพื่อความสวยงาม เป็นระเบียบเรียบร้อย และประหยัดหมึกพิมพ์
- admin/reporting pages ใช้ density ได้มากกว่า แต่ยังต้องเก็บสีและ hierarchy ให้ตรงกับ DESIGN.md
- accessibility ของ redesign: interactive ทุกตัวต้องมี visible focus, drawer/dialog trap focus + Escape + restore focus, input/select ต้องมี accessible name, toggle/filter ใช้ `aria-pressed`, validation ต้องพา focus ไป error/field ที่แก้ได้ และ decorative icons ใช้ `aria-hidden`
- `#F97316` เป็น brand/accent; CTA ที่มีตัวอักษรขาวใช้ `primary-action` (`#C2410C`) และ semantic text/icon ใช้ contrast-safe `--ui-*-text` แยกจากสี fill/border
- async data state ของ redesign: initial load ใช้ accessible skeleton; หลังมี successful payload ให้เก็บข้อมูลเดิมระหว่าง refresh, refresh error แสดง warning+retry โดยไม่ล้างข้อมูล, empty ใช้ EmptyState; Sales/Operations ต้อง fail-closed ถ้า station context refresh ยังไม่สำเร็จ

## Station Capability Rule

สำหรับแท๊งลอยวัชรเกียรติ (`station-1`) ห้ามเพิ่ม/โชว์ flow น้ำมันเครื่องหรือสินค้าใน nav, sell, shift-end stepper, หรือ payload เว้นแต่ business เปิด capability นี้จริง

## Files

- `DESIGN.md`: design tokens + rationale หลักของโปรเจกต์
- `AGENTS.md`: เพิ่ม instruction ให้ agent อ่าน `DESIGN.md` เมื่อทำงาน UI/UX/frontend

## Changelog

- 2026-04-26: เพิ่ม topic นี้หลังสร้าง root `DESIGN.md` และผูก quick start ใน `AGENTS.md`
- 2026-04-26: เพิ่มข้อกำกับ bottom nav/safe-area หลังแก้แท๊งลอยที่ bottom bar บังปุ่มท้ายหน้า
- 2026-04-26: เพิ่มข้อกำกับ thermal receipt 58mm/80mm หลังเปิดให้พิมพ์ transaction เป็นใบเสร็จรับเงินหรือบิลเงินเชื่อได้ทุกรายการ
- 2026-04-28: เพิ่มข้อกำกับไม่ใช้ fixed CTA ทับ content และย้าย print/report actions ออกจาก sticky header ไปอยู่ในแท็บ/หน้าสรุปหลังแก้ Tank Loy V2
- 2026-05-20: เพิ่มข้อกำหนดการจัดดีไซน์รายงานสรุปวัน A4 (Grid Cards/Zebra Table/Payment Chips) และดีไซน์ Thermal Receipt Concept (Dashed Total Box/Reconcile Badge/3-Line Transaction/Thermal Table for Meters) หลังออกแบบปรับปรุงรายงานทั้งสองรูปแบบให้สวยงามและข้อมูลครบถ้วน
- 2026-08-27: S41 accessibility pass ล็อก keyboard/focus/label/modal semantics และแยก contrast-safe action/text tokens (`primary-action`, `primary-text`, `*-text`) ออกจาก brand/fill colors
- 2026-08-27: S42 ล็อก async data pattern เป็น initial skeleton + last-successful-data ระหว่าง refresh + stale warning/retry และให้ canonical Sales/Operations fail-closed เมื่อ station context ไม่สด
