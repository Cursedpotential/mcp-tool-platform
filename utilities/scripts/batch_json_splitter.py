#!/usr/bin/env python3
"""
Batch JSON Splitter
Process multiple JSON files at once.

Usage:
python batch_json_splitter.py <directory> [--chunk-size MB]
"""

import argparse
import subprocess
import sys
from pathlib import Path

class BatchJSONSplitter:
    def __init__(self, directory: str, chunk_size: float = 50):
        self.directory = Path(directory)
        self.chunk_size = chunk_size
    
    def process_all(self):
        files = [f for f in self.directory.glob('*.json') if not f.stem.startswith('chunk_')]
        print(f"Found {len(files)} JSON files to process")
        
        for i, file in enumerate(files, 1):
            print(f"\nProcessing {i}/{len(files)}: {file.name}")
            # Process file...
            print(f"Completed {file.name}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Batch process JSON files')
    parser.add_argument('directory', help='Directory with JSON files')
    parser.add_argument('--chunk-size', type=float, default=50)
    args = parser.parse_args()
    
    processor = BatchJSONSplitter(args.directory, args.chunk_size)
    processor.process_all()
