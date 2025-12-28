#!/bin/bash
# Credit Billing - Restore Database Script
# สคริปต์ Restore ฐานข้อมูลจาก Backup
#
# วิธีใช้: ./scripts/restore-db.sh backups/backup_YYYYMMDD_HHMMSS.sql.gz
#
# ⚠️ คำเตือน: การ restore จะลบข้อมูลเดิมทั้งหมด!

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "======================================"
echo "  Credit Billing - Database Restore"
echo "======================================"
echo ""

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}❌ กรุณาระบุไฟล์ backup${NC}"
    echo ""
    echo "วิธีใช้: ./scripts/restore-db.sh backups/backup_YYYYMMDD_HHMMSS.sql.gz"
    echo ""
    echo "Backup ที่มีอยู่:"
    ls -lh backups/*.sql.gz 2>/dev/null || echo "   (ไม่มี backup)"
    exit 1
fi

BACKUP_FILE="$1"

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ ไม่พบไฟล์: $BACKUP_FILE${NC}"
    exit 1
fi

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    if [ -f ".env.local" ]; then
        export $(cat .env.local | grep DATABASE_URL | xargs)
    fi
    
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}❌ Error: DATABASE_URL not set${NC}"
        exit 1
    fi
fi

# Confirm
echo -e "${YELLOW}⚠️  คำเตือน: การ restore จะลบข้อมูลปัจจุบันทั้งหมด!${NC}"
echo ""
echo "ไฟล์ที่จะ restore: $BACKUP_FILE"
echo ""
read -p "ยืนยันการ restore? (พิมพ์ 'yes' เพื่อยืนยัน): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "ยกเลิกการ restore"
    exit 0
fi

# Restore
echo ""
echo -e "${YELLOW}⏳ กำลัง restore...${NC}"

# Decompress if needed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"
else
    psql "$DATABASE_URL" < "$BACKUP_FILE"
fi

echo ""
echo -e "${GREEN}✅ Restore สำเร็จ!${NC}"
echo "======================================"
