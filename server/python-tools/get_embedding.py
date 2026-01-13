#!/usr/bin/env python3
"""
Get sentence embedding using sentence-transformers
"""

import sys
import json
from sentence_transformers import SentenceTransformer

# Load model (cached after first run)
model = SentenceTransformer('all-MiniLM-L6-v2')

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No text provided'}))
        sys.exit(1)
    
    text = sys.argv[1]
    embedding = model.encode([text])[0]
    
    # Output as JSON array
    print(json.dumps(embedding.tolist()))
