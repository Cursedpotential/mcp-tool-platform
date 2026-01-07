#!/usr/bin/env python3
"""
PDF Text Extractor
Uses pdfplumber to extract text from PDF files
"""

import sys
import json

try:
    import pdfplumber
except ImportError:
    print(json.dumps({'error': 'pdfplumber not installed. Run: pip3 install pdfplumber'}))
    sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No PDF file provided'}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            text = ''
            for page in pdf.pages:
                text += page.extract_text() + '\n'
            
            # Output extracted text
            print(text)
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
