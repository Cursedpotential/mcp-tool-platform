#!/usr/bin/env python3
"""
Conversation JSON Splitter
Splits conversation export files by number of conversations.

Usage:
python conversation_splitter.py <file.json> [--conversations-per-chunk N]
"""

import json
import sys
import argparse
from pathlib import Path

if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'ignore')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'ignore')

class ConversationSplitter:
    def __init__(self, input_file: str, convs_per_chunk: int = 50, output_dir: str = None):
        self.input_file = Path(input_file)
        self.convs_per_chunk = convs_per_chunk
        self.output_dir = Path(output_dir) if output_dir else self.input_file.parent / f"{self.input_file.stem}_chunks"
        self.output_dir.mkdir(exist_ok=True)
    
    def split(self):
        print(f"Loading: {self.input_file.name}")
        with open(self.input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, dict) and 'conversations' in data:
            conversations = data['conversations']
        elif isinstance(data, list):
            conversations = data
        else:
            raise ValueError("Unable to find conversations array")
        
        total_convs = len(conversations)
        total_chunks = (total_convs + self.convs_per_chunk - 1) // self.convs_per_chunk
        
        for chunk_num in range(total_chunks):
            start_idx = chunk_num * self.convs_per_chunk
            end_idx = min(start_idx + self.convs_per_chunk, total_convs)
            chunk_convs = conversations[start_idx:end_idx]
            
            output_file = self.output_dir / f"chunk_{chunk_num + 1:04d}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(chunk_convs if isinstance(data, list) else {'conversations': chunk_convs}, f, indent=2)
            print(f"Created chunk {chunk_num + 1}: {len(chunk_convs)} conversations")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Split conversation JSON files')
    parser.add_argument('input_file', help='Input JSON file')
    parser.add_argument('--conversations-per-chunk', type=int, default=50)
    parser.add_argument('--output-dir', type=str, default=None)
    args = parser.parse_args()
    
    splitter = ConversationSplitter(args.input_file, args.conversations_per_chunk, args.output_dir)
    splitter.split()
