#!/bin/bash
# Credit Billing - Database Backup Script
# สคริปต์ Backup ฐานข้อมูล Neon PostgreSQL
#
# วิธีใช้: ./scripts/backup-db.sh
#
# ต้องตั้ง environment variable DATABASE_URL ก่อนใช้

set -e

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"
KEEP_DAYS=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "  Credit Billing - Database Backup"
echo "======================================"
echo ""

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    # Try to load from .env.local
    if [ -f ".env.local" ]; then
        export $(cat .env.local | grep DATABASE_URL | xargs)
    fi
    
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}❌ Error: DATABASE_URL not set${NC}"
        echo "กรุณาตั้ง DATABASE_URL ก่อน"
        echo ""
        echo "วิธี 1: export DATABASE_URL='postgresql://...'"
        echo "วิธี 2: สร้างไฟล์ .env.local"
        exit 1
    fi
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"
echo -e "${YELLOW}📁 Backup directory: $BACKUP_DIR${NC}"

# Run backup
echo -e "${YELLOW}⏳ กำลัง backup...${NC}"
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"

# Check if backup was successful
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    # Compress the backup
    gzip "$BACKUP_FILE"
    FINAL_FILE="${BACKUP_FILE}.gz"
    
    # Get file size
    SIZE=$(du -h "$FINAL_FILE" | cut -f1)
    
    echo -e "${GREEN}✅ Backup สำเร็จ!${NC}"
    echo "   ไฟล์: $FINAL_FILE"
    echo "   ขนาด: $SIZE"
else
    echo -e "${RED}❌ Backup ล้มเหลว${NC}"
    exit 1
fi

# Cleanup old backups
echo ""
echo -e "${YELLOW}🧹 ลบ backup เก่ากว่า $KEEP_DAYS วัน...${NC}"
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$KEEP_DAYS -delete 2>/dev/null || true

# List remaining backups
echo ""
echo "📋 Backup ที่มีอยู่:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "   (ยังไม่มี backup)"

echo ""
echo "======================================"
echo -e "${GREEN}  เสร็จสิ้น!${NC}"
echo "======================================"
