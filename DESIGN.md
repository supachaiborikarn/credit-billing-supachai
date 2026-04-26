---
version: alpha
name: Credit Billing Supachai Operations UI
description: Visual identity and UI rules for the Credit Billing Supachai fuel, gas, billing, and admin system.
colors:
  primary: "#F97316"
  primary-hover: "#EA580C"
  primary-soft: "#FFEDD5"
  background: "#0F172A"
  background-raised: "#111827"
  surface: "#FFFFFF"
  surface-muted: "#F8FAFC"
  surface-dark: "#1E293B"
  border: "#E2E8F0"
  border-dark: "#334155"
  text: "#0F172A"
  text-muted: "#64748B"
  text-inverse: "#F8FAFC"
  success: "#16A34A"
  warning: "#D97706"
  danger: "#DC2626"
  info: "#2563EB"
  credit: "#7C3AED"
typography:
  h1:
    fontFamily: Sarabun
    fontSize: 1.875rem
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: 0
  h2:
    fontFamily: Sarabun
    fontSize: 1.25rem
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0
  body:
    fontFamily: Sarabun
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  label:
    fontFamily: Sarabun
    fontSize: 0.875rem
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0
  metric:
    fontFamily: Sarabun
    fontSize: 2rem
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: 0
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-inverse}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.text-inverse}"
  button-secondary:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 12px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 12px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: 16px
  card-dark:
    backgroundColor: "{colors.background-raised}"
    textColor: "{colors.text-inverse}"
    rounded: "{rounded.md}"
    padding: 16px
  bottom-nav:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.xs}"
    height: 64px
---

## Overview

Credit Billing Supachai is an operational system for fuel sales, gas shifts, credit billing, reconciliation, and station reporting. The UI should feel like a reliable work console for staff who repeat the same flows many times per day: scan quickly, tap confidently, avoid surprise, and make errors obvious before they become accounting problems.

The visual identity is practical and quiet. Use fuel-orange as the primary action color, strong neutral surfaces for legibility, and status colors only when they carry operational meaning. Avoid decorative design that competes with numbers, meter readings, bill numbers, or payment status.

## Colors

Use orange for primary actions, active navigation, and station-operation emphasis. Use green for success/cash/complete states, red for destructive or variance risk, amber for warnings, blue for neutral information, and violet only for credit/payment grouping when it clarifies meaning.

Dark slate screens are acceptable for station staff dashboards and shift workflows when they improve focus on live operation. Admin tables, billing queues, and dense management pages may use light surfaces for readability. Do not mix radically different themes inside the same station flow.

## Typography

Use Sarabun for Thai-first UI. Keep letter spacing at `0`. Use large numeric type for money, liters, meter readings, and counts. Keep labels short and concrete because staff often operate on mobile while standing at the station.

Do not use marketing-scale headings inside forms, bottom sheets, cards, or dashboards. Operational pages need compact hierarchy: page title, section label, field value, action.

## Layout

Mobile station screens are the primary surface. Keep bottom navigation stable at 64px and leave enough bottom padding for it. Forms should be single-column on mobile with clear section grouping. Repeated rows such as transactions, meter heads, and payment filters should be easy to scan with strong alignment of numbers to the right.

Admin pages can be denser and desktop-first, but filters, totals, and risky actions must stay visible near the data they affect.

## Elevation & Depth

Use subtle borders and restrained shadows. Glass effects are allowed in dark station flows, but keep contrast high enough for outdoor mobile use. Avoid stacking card inside card; use full-width sections or repeated item cards instead.

## Shapes

Default radius is 8px. Use 12px only for major repeated mobile cards or modal surfaces. Avoid oversized pill/card shapes unless the component is a status chip, segmented control, or bottom nav item.

## Components

Buttons should include lucide icons when the action benefits from recognition: print, download, refresh, edit, delete, back, save, close, calendar. Primary actions are orange. Destructive actions are red. Disabled actions must look clearly unavailable.

Inputs must show numeric intent with right-aligned values for money, liters, meter readings, and prices. Date fields should preserve Bangkok business-day behavior and never silently shift by timezone.

Bottom navigation must reflect station capability. For Tank Loy Watcharakiat (`station-1`), do not show engine-oil/product navigation or product sale entry because that station does not operate that flow.

Shift pages must keep their step order stable for each station type. If a station does not sell products, remove product steps from both the visible stepper and the submitted payload.

## Do's and Don'ts

Do use one visual direction per workflow. `home`, `sell`, `summary`, and `shift-end` for the same station should feel like the same product.

Do keep critical values visible: total amount, total liters, payment type, bill book/number, customer/truck, shift status, and variance.

Do use the same source of truth as the backend or legacy UI when a value affects accounting, especially daily price, payment type, shift id, meter reading, and transaction fields.

Don't introduce purple as the default action color. Purple is reserved for credit/payment grouping or legacy areas that already use it.

Don't add product, engine-oil, or inventory UI to Tank Loy Watcharakiat unless the business explicitly enables that capability.

Don't hide validation errors behind generic alerts when the user can fix a specific field.
