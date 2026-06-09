# AlphaStryk PostgreSQL Backup & Restore Procedures

This document outlines the backup, rotation, and recovery strategies for the production Neon PostgreSQL database.

---

## 1. Automated Backup Strategy

To prevent data loss, we implement daily and weekly logical backups using `pg_dump` targeting our Neon database cluster.

### Backup Retention Policy
*   **Daily Backups**: Retained for **7 days**.
*   **Weekly Backups**: Retained for **4 weeks**.

### Automated Backup Script (`scripts/db-backup.sh`)
Deploy the following script to a secure VM (or run via a cron schedule pointing to the remote Neon DB connection string):

```bash
#!/bin/bash

# Configuration
DB_URL=${DATABASE_URL}
BACKUP_DIR="/var/backups/alphastryk"
DATE=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u) # 1-7 (Monday-Sunday)

mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"

# 1. Perform dump
echo "[$(date)] Starting logical database backup..."
pg_dump "$DB_URL" -F c -b -v -f "$BACKUP_DIR/daily/alphastryk_$DATE.dump"

# 2. Copy to weekly folder on Sundays
if [ "$DAY_OF_WEEK" -eq 7 ]; then
  echo "[$(date)] Sunday detected. Storing weekly backup archive..."
  cp "$BACKUP_DIR/daily/alphastryk_$DATE.dump" "$BACKUP_DIR/weekly/alphastryk_weekly_$DATE.dump"
fi

# 3. Clean up historical backups (Retention Enforcement)
echo "[$(date)] Enforcing retention limits..."
find "$BACKUP_DIR/daily" -type f -mtime +7 -name "*.dump" -delete
find "$BACKUP_DIR/weekly" -type f -mtime +28 -name "*.dump" -delete

echo "[$(date)] Database backup execution complete."
```

Configure a system crontab task to run this script every night at 2:00 AM:
```cron
0 2 * * * /bin/bash /path/to/scripts/db-backup.sh >> /var/log/alphastryk-backup.log 2>&1
```

---

## 2. Restore and Recovery Procedures

In the event of database corruption, table drops, or hardware issues, follow these recovery procedures.

### Prerequisite: Prepare Clean Database
Before running a restore, ensure the target database is clean. If restoring to a clean sandbox database, create it using:
```bash
createdb -h <neon-host> -U <username> alphastryk_restore
```

### Option A: Standard CLI Restore
To restore a logical binary format dump (`.dump`) file created by `pg_dump -F c`, execute `pg_restore`:

```bash
pg_restore --clean --no-owner --no-privileges \
  -h <neon-host-url> \
  -U <db-user> \
  -d <target-db-name> \
  /var/backups/alphastryk/daily/alphastryk_latest.dump
```

*Note: The `--clean` flag drops existing database objects before recreating them.*

### Option B: Point-in-Time Recovery (PITR) via Neon Console
Since AlphaStryk leverages Neon PostgreSQL:
1. Log in to the **Neon Dashboard** (`https://console.neon.tech`).
2. Navigate to your project, click on **Branches**, and select the **History** or **Timeline** tab.
3. Locate the point-in-time snapshot before the corruption occurred.
4. Click **Create Branch from this Point** to branch the database at that exact second.
5. Update your application's `DATABASE_URL` environment variable to point to the connection string of this newly restored branch.
