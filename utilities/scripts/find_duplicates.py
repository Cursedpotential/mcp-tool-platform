#!/usr/bin/env python3
"""
Find Duplicates
Hash-based duplicate file finder.

Usage:
python find_duplicates.py <directory>
"""

import hashlib
import sys
from pathlib import Path
from collections import defaultdict

def hash_file(filepath: Path) -> str:
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        hasher.update(f.read())
    return hasher.hexdigest()

def find_duplicates(directory: str):
    hashes = defaultdict(list)
    for file in Path(directory).rglob('*'):
        if file.is_file():
            file_hash = hash_file(file)
            hashes[file_hash].append(file)
    
    duplicates = {h: files for h, files in hashes.items() if len(files) > 1}
    print(f"Found {len(duplicates)} duplicate groups")
    for files in duplicates.values():
        print(f"\nDuplicates:")
        for f in files:
            print(f"  {f}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python find_duplicates.py <directory>")
        sys.exit(1)
    find_duplicates(sys.argv[1])
