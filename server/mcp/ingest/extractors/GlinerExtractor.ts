import { BaseExtractor, BaseNode } from 'llamaindex';
import { spawn } from 'child_process';
import path from 'path';

/**
 * LlamaIndex Extractor wrapper for the local Python GLiNER2 script.
 * Zero-shot NER for Names, Locations, and Custody Events.
 * Runs entirely on CPU.
 */
export class GlinerExtractor extends BaseExtractor {
  
  /**
   * Spawns the Python process, feeds it text chunks via stdin,
   * and parses the resulting JSON.
   */
  private async runPythonExtractor(chunks: string[]): Promise<any[][]> {
    return new Promise((resolve, reject) => {
      // Path to the Python script
      const scriptPath = path.join(process.cwd(), 'server', 'python-tools', 'enrichment', 'gliner_extractor.py');
      
      // Use the local virtual environment python if it exists, otherwise fallback to global python
      // Assuming a standard venv setup, or just 'python' if running globally.
      const pythonExec = 'python'; 

      const pyProcess = spawn(pythonExec, [scriptPath]);
      
      let stdoutData = '';
      let stderrData = '';

      pyProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      pyProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        // Log Python stderr (which has our logging.INFO output)
        console.log(`[GLiNER2] ${data.toString().trim()}`);
      });

      pyProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`GLiNER2 process exited with code ${code}: ${stderrData}`));
          return;
        }
        
        try {
          const results = JSON.parse(stdoutData);
          resolve(results);
        } catch (e) {
          reject(new Error(`Failed to parse GLiNER2 output: ${stdoutData}`));
        }
      });

      pyProcess.on('error', (err) => {
        reject(new Error(`Failed to start Python process: ${err.message}`));
      });

      // Feed chunks to stdin
      pyProcess.stdin.write(JSON.stringify(chunks));
      pyProcess.stdin.end();
    });
  }

  /**
   * Extract entities from nodes and append them to metadata
   */
  async extract(nodes: BaseNode[]): Promise<Record<string, unknown>[]> {
    if (nodes.length === 0) return [];

    const texts = nodes.map(node => node.getContent('text'));
    const extractedMetadataList: Record<string, unknown>[] = [];

    try {
      console.log(`[GlinerExtractor] Sending ${texts.length} chunks to Python GLiNER2 bridge...`);
      const allEntities = await this.runPythonExtractor(texts);

      for (let i = 0; i < nodes.length; i++) {
        const entities = allEntities[i] || [];
        
        if (entities.length > 0) {
          extractedMetadataList.push({ gliner_entities: entities });
        } else {
          extractedMetadataList.push({});
        }
      }
    } catch (error) {
      console.error(`[GlinerExtractor] Failed to extract entities:`, error);
      // Fallback to empty metadata so pipeline doesn't crash
      for (let i = 0; i < nodes.length; i++) {
        extractedMetadataList.push({});
      }
    }

    return extractedMetadataList;
  }
}
