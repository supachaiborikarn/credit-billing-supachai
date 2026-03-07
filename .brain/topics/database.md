<!-- SUMMARY: PostgreSQL บน Neon (free tier), ORM: Prisma, 30+ models,
     migrate ด้วย prisma db push, backup ด้วย pg_dump,
     ข้อจำกัด: data transfer 5GB/month (free tier), ใช้ connection pooling -->

# Database

## Overview
ใช้ PostgreSQL ผ่าน Neon serverless database พร้อม Prisma ORM

## Tech Stack
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Prisma
- **Schema**: `/prisma/schema.prisma` (568 lines, 30+ models)
- **Env var**: `DATABASE_URL` ใน `.env.local`

## Key Models (สำคัญ)
| Model | ตาราง | หน้าที่ |
|-------|-------|---------|
| Station | stations | สถานีบริการ (FULL/SIMPLE/GAS) |
| Transaction | transactions | รายการขาย |
| DailyRecord | daily_records | บันทึกประจำวัน |
| Shift | shifts | กะทำงาน |
| MeterReading | meter_readings | อ่านค่ามิเตอร์ |
| Owner | owners | เจ้าของรถ/ลูกค้า |
| Truck | trucks | ทะเบียนรถ |
| Invoice | invoices | ใบแจ้งหนี้ |
| User | users | ผู้ใช้งาน (ADMIN/STAFF) |
| PriceBook | price_books | ราคาน้ำมัน |

## Neon Free Tier Limits
- **Storage**: 512 MB
- **Compute**: 0.25 CU (auto-suspend)
- **Data Transfer**: 5 GB/month ← ⚠️ ต้องระวัง
- **Branching**: 10 branches

## Migration History
- 2026-02-23: migrate จาก Neon account เก่าไป account ใหม่
  - ขั้นตอน: pg_dump → create new project → prisma db push → psql import
  - อัปเดต `.env` + Vercel env vars

## Backup
- Script: `./scripts/backup-db.sh`
- Restore: `./scripts/restore-db.sh`
- Manual: `pg_dump "DATABASE_URL" > backup_$(date +%Y%m%d).sql`

## Performance Notes
- ใช้ connection pooling ผ่าน Neon
- ลด polling frequency เพื่อประหยัด data transfer
- Consolidate API queries เพื่อลด round trips

## Changelog
- 2026-02-24: สร้างไฟล์ brain topic นี้
- 2026-02-23: migrate ไป Neon account ใหม่
- 2026-02-22: วิเคราะห์ data transfer usage เพื่อ optimize
