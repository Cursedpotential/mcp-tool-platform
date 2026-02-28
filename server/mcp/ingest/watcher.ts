import * as fs from 'fs';
import * as path from 'path';
import chokidar from 'chokidar';
import { ingestEvidence } from './index';

const WATCH_DIR = process.env.EVIDENCE_DROP_DIR || '/app/data/evidence_drop';

// Keeps track of file sizes to detect when Rclone finishes writing
const fileSizes = new Map<string, number>();

/**
 * Initializes the daemon that watches the block storage for massive file uploads.
 */
export function startEvidenceWatcher() {
  if (!fs.existsSync(WATCH_DIR)) {
    console.log(`[Watcher] Directory ${WATCH_DIR} does not exist. Creating it...`);
    fs.mkdirSync(WATCH_DIR, { recursive: true });
  }

  console.log(`[Watcher] Daemon started. Monitoring ${WATCH_DIR} for new evidence...`);

  const watcher = chokidar.watch(WATCH_DIR, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 5000, // File must not change size for 5 seconds
      pollInterval: 1000      // Check size every 1 second
    }
  });

  watcher.on('add', async (filePath) => {
    console.log(`[Watcher] New file fully stabilized: ${filePath}`);
    
    try {
      const fileName = path.basename(filePath);
      const ext = path.extname(fileName).toLowerCase();
      
      let sourceType = 'unknown';
      if (ext === '.xml') sourceType = 'sms_backup_xml';
      else if (ext === '.pdf') sourceType = 'document_pdf';
      else if (['.png', '.jpg', '.jpeg'].includes(ext)) sourceType = 'image_screenshot';

      // 1. Kick off the headless ingestion pipeline
      const result = await ingestEvidence(sourceType, fileName, null, filePath, {
        ingested_via: 'rclone_watcher',
        original_path: filePath
      });

      console.log(`[Watcher] Processing complete. DocumentID: ${result.documentId}. Flags: ${result.flagsDetected}`);
      
      // 2. Safely move the file to an archive folder so we don't process it twice
      const archiveDir = path.join(WATCH_DIR, '_processed');
      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir);
      
      const archivePath = path.join(archiveDir, fileName);
      fs.renameSync(filePath, archivePath);
      console.log(`[Watcher] File archived to ${archivePath}`);

    } catch (err) {
      console.error(`[Watcher] Failed to process ${filePath}:`, err);
    }
  });

  watcher.on('error', (error) => {
    console.error(`[Watcher] Error:`, error);
  });
}
