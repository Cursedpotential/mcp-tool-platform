# Integration Notes for Pre-Made Tools & Conflict Analysis App

## ConflictAnalysisApp
- **Dependency:** It is already part of the application workflow.
- **Data source:** Uses the MySQL database (Tier 5 of the architecture) which runs the platform.
- **Action Required:** We MUST port the `ConflictAnalysisApp` codebase and analysis tools into the active `C:\Users\matts\Projects\TheBigOne\MCP_Tool_Platform` directory. Even though it runs on the DB, we need its underlying algorithms (e.g., how it resolves conflicts) to integrate smoothly with **Semantica** and the new **LlamaIndex** modular router.

## Pre-made Downloaded Tools
We have a vast collection of modular parsing tools that can plug directly into the LlamaIndex orchestration. Located in `D:\AI_Workspace\Tools` and `D:\AI_Workspace\External`:
- **ConversationExtractorModule.py**
- **chatgpt_parser.py**
- **xml-stream-processor**
- **AD1_Extractor**, **EML_Parser**, **Parse_Plist**, **Parse_SAM**, **Parse_SQLite_Databases** (from Autopsy plugins)
- **OpenBackupExtractor** / **YPA-master** (For pulling raw mobile backups into the pipeline).
- **Stirling-PDF** (Local robust PDF handling)

*Strategy:* We don't need to rebuild parsers for these formats. LlamaIndex allows us to take these exact scripts, wrap them in a `class MyCustomReader(BaseReader)`, and immediately hook them up to the automated chunking/embedding/Semantica validation pipeline.

## ⚠️ TraceIQ & GPS Timeline 
- **STATUS: MANGLED / BROKEN.**
- The `TraceIQ` and GPS timeline components suffered an architectural accident and are currently broken ("like Humpty Dumpty").
- **Action Required:** Do NOT attempt to integrate or port TraceIQ during the current sprint. It is a separate project that will require a dedicated agent to reconstruct later. 
- For Sprint 1, we rely strictly on the new Graphiti temporal memory and the new `timeline-parser.ts` to build timelines from scratch, ignoring the broken TraceIQ components.