# Migration Guide - Manus to Salem Trinity (VPS3)

**Source**: Manus Hosting (MySQL / SQLite)  
**Target**: VPS3 (salem-platform) MySQL Container  
**Data types**: Application metadata, user accounts, case configurations, topic codes  

---

## 1. Preparation

### 1.1 Analyze Source Databases

**Manus MySQL**:
- Obtain host, port, username, password for the current Manus MySQL instance.
- Check database size and table list.

**Local SQLite (`data/salem.db`)**:
- Location: `01_MCP_Tool_Platform_Repo/data/salem.db`
- This file contains the latest development configuration and must be preserved.

### 1.2 Tooling Requirements

On your workstation or a jump host with access to both environments:
- `mysqldump` (for MySQL export)
- `mysql` client (for import)
- `sqlite3` (for analyzing/converting SQLite data)

---

## 2. Data Export

### 2.1 Export from Manus MySQL

```bash
mysqldump -h <manus_mysql_host> -u <user> -p <database_name> > manus_export.sql
```

### 2.2 Backup Local SQLite

```bash
cp data/salem.db data/salem.db.bak
```

---

## 3. SQLite to MySQL Conversion (If needed)

The `data/salem.db` file contains "good config". If this config is not in the Manus MySQL, you should migrate it.

### 3.1 Extract SQLite Data

You can use a tool like `sqlite3` to export tables as CSV or SQL inserts.

```bash
sqlite3 data/salem.db .dump > sqlite_dump.sql
```

*Note: SQL syntax between SQLite and MySQL differs. You may need to manually edit `sqlite_dump.sql` to remove SQLite-specific pragmas and fix auto-increment/type syntax.*

### 3.2 Recommended: Sync via Application logic

If the application has a sync or import feature, it might be safer to use that once the MySQL container is up. Otherwise, proceed with manual SQL import.

---

## 4. Data Import to VPS3

### 4.1 Copy Export to VPS3

```bash
scp manus_export.sql root@116.203.40.1:/tmp/
```

### 4.2 Import into MySQL Container

```bash
# Exec into mysql container or use docker exec
docker exec -i mysql mysql -u root -p${MYSQL_ROOT_PASSWORD} ${MYSQL_DATABASE} < /tmp/manus_export.sql
```

---

## 5. Merging SQLite Config

If `data/salem.db` has unique configuration:

1. Connect to the new MySQL instance.
2. Identify the configuration tables (e.g., `settings`, `topic_codes`).
3. Manually insert or update these values from the SQLite dump.

Example for a `settings` table:
```sql
-- Connect to MySQL
INSERT INTO settings (key, value) VALUES ('nlp_provider', 'litellm') ON DUPLICATE KEY UPDATE value='litellm';
```

---

## 6. Verification

### 6.1 Check Table Counts

```bash
# On MySQL VPS3
docker exec -it mysql mysql -u salem_user -p ${MYSQL_DATABASE} -e "SHOW TABLES; SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM cases;"
```

Compare these counts with the source environment.

### 6.2 Application Test

1. Start the `mcp-platform` container.
2. Log in at `https://app.mitechconsult.com`.
3. Verify that your cases, settings, and configurations are present.

---

## 7. Rollback

If migration fails:
1. Keep Manus hosting active.
2. Wipe VPS3 MySQL volume: `docker volume rm phase3-vps3-platform_mysql_data`.
3. Re-deploy MySQL and retry migration.

---

**Forensic Note**: Ensure all migration steps are documented for chain-of-custody if app data contains evidence metadata.
