#!/usr/bin/env python3
"""
Output Schema Validators
Validates parser output JSONL files.

Usage:
python output_schemas.py <file.jsonl> <type>
Types: conversation, entity, artifact
"""

import json
import sys
from typing import Dict, Any, List
from dataclasses import dataclass

@dataclass
class SchemaValidationError:
    field: str
    message: str
    value: Any

class OutputValidator:
    @staticmethod
    def validate_conversation_turn(data: Dict[str, Any]) -> List[SchemaValidationError]:
        errors = []
        required = ["message_hash", "conversation_id", "platform", "timestamp", "turn_type", "content"]
        for field in required:
            if field not in data:
                errors.append(SchemaValidationError(field, "Missing required field", None))
        return errors

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python output_schemas.py <file.jsonl> <type>")
        sys.exit(1)
    
    filepath = sys.argv[1]
    record_type = sys.argv[2]
    print(f"Validating {filepath} as {record_type} records...")
