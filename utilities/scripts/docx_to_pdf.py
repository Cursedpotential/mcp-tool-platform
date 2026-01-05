#!/usr/bin/env python3
"""
DOCX to PDF Batch Converter

Usage:
python docx_to_pdf.py <directory>
"""

import sys
from pathlib import Path

def convert_docx_to_pdf(directory: str):
    print(f"Converting DOCX files in {directory} to PDF...")
    docx_files = list(Path(directory).glob('*.docx'))
    print(f"Found {len(docx_files)} DOCX files")
    # Conversion logic would go here
    for docx in docx_files:
        print(f"Would convert: {docx.name}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python docx_to_pdf.py <directory>")
        sys.exit(1)
    convert_docx_to_pdf(sys.argv[1])
