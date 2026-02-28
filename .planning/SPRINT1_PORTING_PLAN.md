# Final Integration Plan (Revised from User Feedback)

## 1. The Custom Parsers (The "Goldmine")
- **STATUS:** Iterate & Port Best Elements.
- `xml-sms-parser.ts`, `pdf-imessage-parser.ts`, `enhanced-xml-chunker.py`, `chatgpt_parser.py`.
- **Action:** These are iterations and not 100% complete, but they are "pretty decent". We will evaluate these scripts, extract the best logic, and port them into the new LlamaIndex `BaseReader` format for Sprint 1.

## 2. TraceIQ & Timeline Apps
- **STATUS:** STRICTLY IGNORE for now.
- `timeline-parser.ts`, `timeline-explorer-pro`, `location-admin`.
- **Action:** These belong to the mangled TraceIQ project. Do NOT touch them during this sprint.

## 3. Forensic Data Refinery
- **STATUS:** Mine for Code (Not full port).
- This was a Google AI Studio app fed with raw files. 
- **Action:** We will have an agent analyze this directory specifically to extract parsing logic, ideas, and raw file handling methods. We won't port the whole app, just harvest the good code.

## 4. Voice Analysis & Context
- **STATUS:** Defer to Sprint 2.
- `Chronicle_Voice_App`, `story-voice-backend`, `Context_Analysis_Suite/Chat_Parser_App`.
- **Action:** Ignore for Sprint 1.

## 5. The `Tools` Directory (`D:\AI_Workspace\Tools`)
- **STATUS:** Selectively Port.
- **`Chunker` & `Chat_Parsers`:** Contains iterations/duplicates. We will cherry-pick the usable code.
- **`NLP / Manipulative-Expression-Recognition`:** **CRITICAL PRIORITY.** This contains custom language/verbiage modeling specific to the domain. This *must* be implemented, likely as a custom extractor in our LlamaIndex pipeline.
- **`DirectoryScanner`, `TetherPro`, `EnvManager`:** Ignore entirely.

## 7. The Desktop Experience / UI
- **STATUS:** Defer to Future Sprint.
- The `ConflictAnalysisApp` / UI frontend is NOT part of Sprint 1. We are purely building the headless MCP backend engine right now.