import sys
import json
import logging

logging.basicConfig(level=logging.INFO, stream=sys.stderr, format='%(levelname)s: %(message)s')

try:
    from gliner import GLiNER
except ImportError:
    logging.error("GLiNER package not found. Please run: pip install gliner")
    sys.exit(1)

MODEL_NAME = "fastino/gliner2-base-v1"
logging.info(f"Loading {MODEL_NAME}...")

try:
    model = GLiNER.from_pretrained(MODEL_NAME)
except Exception as e:
    logging.error(f"Failed to load GLiNER model: {e}")
    sys.exit(1)

LABELS = [
    "Person", 
    "Location", 
    "Organization", 
    "Custody Event", 
    "Legal Proceeding", 
    "Communication",
    "Address"
]

def process_chunks(chunks):
    results = []
    for text in chunks:
        if not text or not text.strip():
            results.append([])
            continue
            
        try:
            entities = model.predict_entities(text, LABELS, threshold=0.5)
            
            cleaned_entities = []
            for ent in entities:
                cleaned_entities.append({
                    "text": ent["text"],
                    "label": ent["label"],
                    "score": float(ent["score"])
                })
            results.append(cleaned_entities)
        except Exception as e:
            logging.error(f"Error processing chunk: {e}")
            results.append([])
            
    return results

if __name__ == "__main__":
    try:
        input_data = sys.stdin.read().strip()
        if not input_data:
            print(json.dumps([]))
            sys.exit(0)
            
        chunks = json.loads(input_data)
        
        if isinstance(chunks, str):
            chunks = [chunks]
            
        logging.info(f"Processing {len(chunks)} chunks through GLiNER2...")
        extracted_data = process_chunks(chunks)
        
        print(json.dumps(extracted_data))
        
    except json.JSONDecodeError:
        logging.error("Invalid JSON input.")
        sys.exit(1)
    except Exception as e:
        logging.error(f"Fatal error: {e}")
        sys.exit(1)
