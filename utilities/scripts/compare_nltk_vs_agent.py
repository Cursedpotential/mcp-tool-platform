#!/usr/bin/env python3
"""
NLTK vs LLM Agent Comparison
Benchmarks sentiment analysis accuracy.

Usage:
python compare_nltk_vs_agent.py <session.jsonl>
"""

import sys

def compare_sentiment(filepath: str):
    print(f"Comparing NLTK vs LLM sentiment on: {filepath}")
    # Comparison logic would go here
    print("Comparison complete")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python compare_nltk_vs_agent.py <session.jsonl>")
        sys.exit(1)
    compare_sentiment(sys.argv[1])
