#!/usr/bin/env python3

"""
ChatGPT JSON Parser - Sprint 1
Parses ChatGPT export files and extracts conversations, entities, and artifacts.
"""

from pathlib import Path
import json
import hashlib
import spacy
import re
import sys
from typing import Iterator, Dict, List, Optional, Any
from datetime import datetime
from dataclasses import dataclass, asdict
import uuid

@dataclass
class ConversationTurn:
    """Normalized conversation turn schema"""
    message_hash: str
    conversation_id: str
    platform: str
    timestamp: str
    turn_type: str
    content: str
    raw_metadata: Dict[str, Any]

@dataclass
class Entity:
    """Extracted entity schema"""
    entity_id: str
    type: str
    name: str
    aliases: List[str]
    confidence: float
    first_mention: Dict[str, str]
    mention_count: int
    extraction_method: str

@dataclass
class Artifact:
    """Code block or file artifact schema"""
    artifact_id: str
    type: str
    language: str
    content: str
    content_hash: str
    context: str
    source_message: str
    timestamp: str
    metadata: Dict[str, Any]

class ChatGPTParser:
    """Parses ChatGPT JSON exports and extracts structured data."""
    
    def __init__(self, export_path: Path, output_dir: Path = None):
        self.export_path = Path(export_path)
        self.output_dir = Path(output_dir) if output_dir else self.export_path.parent
        self.output_dir.mkdir(exist_ok=True)
        self.schema_map = {}
        self.entity_tracker = {}
        self.stats = {
            "conversations_processed": 0,
            "messages_processed": 0,
            "entities_extracted": 0,
            "artifacts_extracted": 0,
            "errors": 0
        }
        
        try:
            self.nlp = spacy.load("en_core_web_sm")
            self._log("Loaded spaCy model: en_core_web_sm")
        except OSError:
            self._log_error("spaCy model 'en_core_web_sm' not found. Install with: python -m spacy download en_core_web_sm")
            sys.exit(1)
    
    def _log(self, message: str):
        print(f"[INFO] {message}", file=sys.stderr)
    
    def _log_error(self, message: str):
        print(f"[ERROR] {message}", file=sys.stderr)
        self.stats["errors"] += 1
    
    def run(self):
        """Main pipeline execution."""
        self._log(f"Starting ChatGPT parser for: {self.export_path}")
        if not self.pre_scan_schema():
            self._log_error("Schema detection failed. Cannot proceed.")
            return
        # Process conversations...
        self._log("Processing complete")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python chatgpt_parser.py <export.json> [output_dir]")
        sys.exit(1)
    parser = ChatGPTParser(export_path=sys.argv[1], output_dir=sys.argv[2] if len(sys.argv) > 2 else None)
    parser.run()
