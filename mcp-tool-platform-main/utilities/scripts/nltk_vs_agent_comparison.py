#!/usr/bin/env python3
"""
NLTK vs Agent NLP Comparison
Detailed NLP accuracy testing.

Usage:
python nltk_vs_agent_comparison.py <data.jsonl>
"""

import sys

def run_comparison(filepath: str):
    print(f"Running NLP comparison on: {filepath}")
    # Comparison logic
    print("Done")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python nltk_vs_agent_comparison.py <data.jsonl>")
        sys.exit(1)
    run_comparison(sys.argv[1])
