---
version: alpha
name: Credit Billing Supachai Operations UI
description: Visual identity and UI rules for the Credit Billing Supachai fuel, gas, billing, and admin system.
colors:
  primary: "#F97316"
  primary-hover: "#EA580C"
  primary-action: "#C2410C"
  primary-action-hover: "#9A3412"
  primary-text: "#C2410C"
  primary-soft: "#FFEDD5"
  focus-ring: "#C2410C"
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
  success-text: "#15803D"
  warning-text: "#B45309"
  danger-text: "#B91C1C"
  info-text: "#1D4ED8"
  credit-text: "#6D28D9"
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
    backgroundColor: "{colors.primary-action}"
    textColor: "{colors.text-inverse}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-action-hover}"
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
  thermal-receipt:
    widthOptions: [58mm, 80mm]
    backgroundColor: "#FFFFFF"
    textColor: "#000000"
    fontFamily: Sarabun
    printColorAdjust: exact
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

Thermal receipt and credit-bill screens are print-first surfaces. They must support both 58mm and 80mm paper, set `@page` to the chosen width, keep the receipt width exact with border-box sizing, and avoid relying on screen-only themes or gradients inside the printable area. Every transaction should be printable as either a receipt or a credit bill; document type is a user choice, not something inferred only from payment type.

## Accessibility

All redesign interactions must be usable by keyboard without losing context. Every interactive control needs a visible `focus-visible` state; modal and drawer surfaces must trap focus while open, close with Escape, and restore focus to the trigger when closed.

Do not use placeholder text as the only accessible name. Inputs/selects require a visible label or `aria-label`, validation must connect the error message to the field, and stateful filters/toggles must expose state with `aria-pressed` or equivalent semantics. When a submit fails validation, move focus to the first actionable invalid field or to an error summary that explains what to fix.

`#F97316` remains the brand/accent orange, but white normal-size text must not sit on that shade as a primary button. Use `primary-action` (`#C2410C`) for white-text CTA surfaces and `primary-text` for orange text on light backgrounds. Semantic fills may keep the base success/warning/danger/info colors, while semantic text/icons use the darker `*-text` tokens so light-mode contrast stays readable.

Decorative lucide icons use `aria-hidden="true"`. Loading regions that replace meaningful page content should expose status text/labels to assistive technology.

## Async Data States

Use one state model across redesign pages. The first load may replace the page body with an accessible skeleton. After a successful payload exists, refreshes must keep that last-successful data visible instead of replacing the whole page with a skeleton. Show a polite updating status while refreshing; if refresh fails, keep the last-successful data visible with a warning and retry action. Use a fatal error surface only when no successful payload exists, and use `EmptyState` when the request succeeded but the result set is empty.

Operational writes are stricter than read-only views. Canonical Sales and Operations may display the last-successful station context while a refresh is pending or failed, but must fail closed: do not render or enable sale/open/close write flows until the station context has refreshed successfully. This prevents stale shift, price, or capability state from being used for a financial or operational write.

## Do's and Don'ts

Do use one visual direction per workflow. `home`, `sell`, `summary`, and `shift-end` for the same station should feel like the same product.

Do keep critical values visible: total amount, total liters, payment type, bill book/number, customer/truck, shift status, and variance.

Do use the same source of truth as the backend or legacy UI when a value affects accounting, especially daily price, payment type, shift id, meter reading, and transaction fields.

Don't introduce purple as the default action color. Purple is reserved for credit/payment grouping or legacy areas that already use it.

Don't add product, engine-oil, or inventory UI to Tank Loy Watcharakiat unless the business explicitly enables that capability.

Don't hide validation errors behind generic alerts when the user can fix a specific field.
