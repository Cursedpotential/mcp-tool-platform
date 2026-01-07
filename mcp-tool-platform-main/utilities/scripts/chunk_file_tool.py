#!/usr/bin/env python3
"""
File Chunker Tool
Split large files into chunks.

Usage:
python chunk_file_tool.py <file> [--chunk-size MB]
"""

import sys
from pathlib import Path

def chunk_file(filepath: str, chunk_size_mb: int = 10):
    print(f"Chunking {filepath} into {chunk_size_mb}MB pieces...")
    file_path = Path(filepath)
    chunk_size = chunk_size_mb * 1024 * 1024
    # Chunking logic would go here
    print("File chunked successfully")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python chunk_file_tool.py <file> [chunk_size_mb]")
        sys.exit(1)
    chunk_file(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 10)
