#!/usr/bin/env python3
"""
Unstructured.io Document Parser
Parses PDF, DOCX, HTML, and other document formats with layout detection.
"""

import sys
import json
from pathlib import Path
from typing import List, Dict, Any, Optional

# Unstructured imports
try:
    from unstructured.partition.auto import partition
    from unstructured.partition.pdf import partition_pdf
    from unstructured.partition.docx import partition_docx
    from unstructured.partition.html import partition_html
    from unstructured.chunking.title import chunk_by_title
    from unstructured.staging.base import elements_to_json
except ImportError:
    print("ERROR: unstructured library not installed", file=sys.stderr)
    print("Install with: pip install unstructured[all-docs]", file=sys.stderr)
    sys.exit(1)


class UnstructuredParser:
    """Parser for documents using Unstructured.io"""
    
    def __init__(self):
        self.supported_formats = ['.pdf', '.docx', '.doc', '.html', '.htm', '.txt', '.md']
    
    def parse_document(
        self,
        file_path: str,
        strategy: str = "auto",
        extract_tables: bool = True,
        extract_images: bool = False,
        chunk_size: int = 1000,
        chunk_overlap: int = 200
    ) -> Dict[str, Any]:
        """
        Parse document and return structured data
        
        Args:
            file_path: Path to document
            strategy: Parsing strategy ('auto', 'fast', 'hi_res')
            extract_tables: Whether to extract tables
            extract_images: Whether to extract images
            chunk_size: Target chunk size in characters
            chunk_overlap: Overlap between chunks
        
        Returns:
            Dict with parsed content, metadata, chunks, and tables
        """
        path = Path(file_path)
        
        if not path.exists():
            return {"error": f"File not found: {file_path}"}
        
        if path.suffix.lower() not in self.supported_formats:
            return {"error": f"Unsupported format: {path.suffix}"}
        
        try:
            # Parse document based on type
            if path.suffix.lower() == '.pdf':
                elements = partition_pdf(
                    filename=str(path),
                    strategy=strategy,
                    extract_images_in_pdf=extract_images,
                    infer_table_structure=extract_tables
                )
            elif path.suffix.lower() in ['.docx', '.doc']:
                elements = partition_docx(
                    filename=str(path),
                    infer_table_structure=extract_tables
                )
            elif path.suffix.lower() in ['.html', '.htm']:
                elements = partition_html(filename=str(path))
            else:
                # Auto-detect for other formats
                elements = partition(filename=str(path))
            
            # Extract metadata
            metadata = self._extract_metadata(elements, path)
            
            # Extract tables
            tables = self._extract_tables(elements) if extract_tables else []
            
            # Chunk elements
            chunks = self._chunk_elements(elements, chunk_size, chunk_overlap)
            
            # Get full text
            full_text = "\n\n".join([str(el) for el in elements])
            
            return {
                "success": True,
                "file_path": str(path),
                "filename": path.name,
                "file_size": path.stat().st_size,
                "format": path.suffix.lower(),
                "metadata": metadata,
                "full_text": full_text,
                "element_count": len(elements),
                "chunks": chunks,
                "tables": tables,
                "statistics": {
                    "total_characters": len(full_text),
                    "total_chunks": len(chunks),
                    "total_tables": len(tables),
                    "avg_chunk_size": sum(len(c['text']) for c in chunks) / len(chunks) if chunks else 0
                }
            }
        
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "file_path": str(path)
            }
    
    def _extract_metadata(self, elements: List, path: Path) -> Dict[str, Any]:
        """Extract metadata from elements"""
        metadata = {
            "filename": path.name,
            "file_size": path.stat().st_size,
            "format": path.suffix.lower()
        }
        
        # Try to extract document-level metadata
        for element in elements:
            if hasattr(element, 'metadata') and element.metadata:
                elem_meta = element.metadata
                if hasattr(elem_meta, 'filename'):
                    metadata['original_filename'] = elem_meta.filename
                if hasattr(elem_meta, 'page_number'):
                    metadata['total_pages'] = max(
                        metadata.get('total_pages', 0),
                        elem_meta.page_number
                    )
        
        return metadata
    
    def _extract_tables(self, elements: List) -> List[Dict[str, Any]]:
        """Extract tables from elements"""
        tables = []
        
        for i, element in enumerate(elements):
            if element.category == "Table":
                table_data = {
                    "index": i,
                    "text": str(element),
                    "html": getattr(element.metadata, 'text_as_html', None) if hasattr(element, 'metadata') else None
                }
                
                # Try to parse table structure
                if hasattr(element, 'metadata') and hasattr(element.metadata, 'text_as_html'):
                    table_data['structured'] = self._parse_html_table(element.metadata.text_as_html)
                
                tables.append(table_data)
        
        return tables
    
    def _parse_html_table(self, html: str) -> Optional[Dict[str, Any]]:
        """Parse HTML table into structured format"""
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            table = soup.find('table')
            
            if not table:
                return None
            
            rows = []
            headers = []
            
            # Extract headers
            thead = table.find('thead')
            if thead:
                header_row = thead.find('tr')
                if header_row:
                    headers = [th.get_text(strip=True) for th in header_row.find_all(['th', 'td'])]
            
            # Extract rows
            tbody = table.find('tbody') or table
            for tr in tbody.find_all('tr'):
                cells = [td.get_text(strip=True) for td in tr.find_all(['td', 'th'])]
                if cells:
                    rows.append(cells)
            
            return {
                "headers": headers,
                "rows": rows,
                "row_count": len(rows),
                "column_count": len(headers) if headers else (len(rows[0]) if rows else 0)
            }
        
        except Exception as e:
            return {"error": str(e)}
    
    def _chunk_elements(
        self,
        elements: List,
        chunk_size: int,
        chunk_overlap: int
    ) -> List[Dict[str, Any]]:
        """Chunk elements into manageable pieces"""
        try:
            # Use unstructured's chunking
            chunked = chunk_by_title(
                elements,
                max_characters=chunk_size,
                overlap=chunk_overlap,
                combine_text_under_n_chars=100
            )
            
            chunks = []
            for i, chunk in enumerate(chunked):
                chunk_data = {
                    "index": i,
                    "text": str(chunk),
                    "type": chunk.category if hasattr(chunk, 'category') else "unknown",
                    "metadata": {}
                }
                
                # Extract chunk metadata
                if hasattr(chunk, 'metadata') and chunk.metadata:
                    meta = chunk.metadata
                    if hasattr(meta, 'page_number'):
                        chunk_data['metadata']['page_number'] = meta.page_number
                    if hasattr(meta, 'filename'):
                        chunk_data['metadata']['filename'] = meta.filename
                
                chunks.append(chunk_data)
            
            return chunks
        
        except Exception as e:
            # Fallback to simple text chunking
            full_text = "\n\n".join([str(el) for el in elements])
            return self._simple_chunk(full_text, chunk_size, chunk_overlap)
    
    def _simple_chunk(
        self,
        text: str,
        chunk_size: int,
        chunk_overlap: int
    ) -> List[Dict[str, Any]]:
        """Simple text chunking fallback"""
        chunks = []
        start = 0
        index = 0
        
        while start < len(text):
            end = start + chunk_size
            chunk_text = text[start:end]
            
            chunks.append({
                "index": index,
                "text": chunk_text,
                "type": "text",
                "metadata": {
                    "start_offset": start,
                    "end_offset": end
                }
            })
            
            start = end - chunk_overlap
            index += 1
        
        return chunks


def main():
    """CLI interface"""
    if len(sys.argv) < 2:
        print("Usage: unstructured_parser.py <file_path> [options]")
        print("\nOptions:")
        print("  --strategy <auto|fast|hi_res>  Parsing strategy (default: auto)")
        print("  --chunk-size <int>             Chunk size in characters (default: 1000)")
        print("  --chunk-overlap <int>          Chunk overlap (default: 200)")
        print("  --no-tables                    Skip table extraction")
        print("  --extract-images               Extract images from PDF")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    # Parse options
    strategy = "auto"
    chunk_size = 1000
    chunk_overlap = 200
    extract_tables = True
    extract_images = False
    
    for i, arg in enumerate(sys.argv[2:], start=2):
        if arg == "--strategy" and i + 1 < len(sys.argv):
            strategy = sys.argv[i + 1]
        elif arg == "--chunk-size" and i + 1 < len(sys.argv):
            chunk_size = int(sys.argv[i + 1])
        elif arg == "--chunk-overlap" and i + 1 < len(sys.argv):
            chunk_overlap = int(sys.argv[i + 1])
        elif arg == "--no-tables":
            extract_tables = False
        elif arg == "--extract-images":
            extract_images = True
    
    # Parse document
    parser = UnstructuredParser()
    result = parser.parse_document(
        file_path,
        strategy=strategy,
        extract_tables=extract_tables,
        extract_images=extract_images,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )
    
    # Output JSON
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
