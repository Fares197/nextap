#!/bin/bash

# تحديد مسار قاعدة البيانات
DB_PATH="/home/ubuntu/nextap/database.sqlite"

# تحديد مسار مجلد النسخ الاحتياطي
BACKUP_DIR="/home/ubuntu/nextap/backups"

# إنشاء مجلد النسخ الاحتياطي إذا لم يكن موجوداً
mkdir -p "$BACKUP_DIR"

# تحديد اسم ملف النسخة الاحتياطية مع التاريخ والوقت
BACKUP_FILE="$BACKUP_DIR/database_$(date +%Y%m%d_%H%M%S).sqlite"

# نسخ قاعدة البيانات
cp "$DB_PATH" "$BACKUP_FILE"

# حذف النسخ الاحتياطية القديمة (الاحتفاظ بآخر 7 نسخ)
find "$BACKUP_DIR" -name "database_*.sqlite" -type f -mtime +7 -delete

echo "تم إنشاء نسخة احتياطية لقاعدة البيانات في: $BACKUP_FILE"
