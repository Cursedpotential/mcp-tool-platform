#!/usr/bin/env python3
"""
MCP Tool Shop - Python NLP Runner
Called via subprocess from Node.js for heavy NLP/ML operations.

Usage:
  python nlp_runner.py <command> <json_args>

Commands:
  detect_language, extract_entities, extract_keywords, analyze_sentiment,
  split_sentences, generate_outline, embed_text, classify_text
"""

import sys
import json
import hashlib
from typing import Any, Dict, List, Optional

# Lazy imports to speed up startup for simple commands
_spacy_nlp = None
_sentence_model = None
_langdetect = None

def get_spacy():
    """Lazy load spaCy with English model."""
    global _spacy_nlp
    if _spacy_nlp is None:
        try:
            import spacy
            try:
                _spacy_nlp = spacy.load("en_core_web_sm")
            except OSError:
                # Model not installed, use blank
                _spacy_nlp = spacy.blank("en")
        except ImportError:
            _spacy_nlp = None
    return _spacy_nlp

def get_sentence_model():
    """Lazy load sentence-transformers model."""
    global _sentence_model
    if _sentence_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
        except ImportError:
            _sentence_model = None
    return _sentence_model

def get_langdetect():
    """Lazy load langdetect."""
    global _langdetect
    if _langdetect is None:
        try:
            import langdetect
            _langdetect = langdetect
        except ImportError:
            _langdetect = None
    return _langdetect


# ============================================================================
# NLP Commands
# ============================================================================

def detect_language(args: Dict[str, Any]) -> Dict[str, Any]:
    """Detect the language of input text."""
    text = args.get("text", "")
    
    ld = get_langdetect()
    if ld is None:
        # Fallback: simple heuristic
        return {
            "language": "en",
            "confidence": 0.5,
            "method": "fallback"
        }
    
    try:
        from langdetect import detect_langs
        results = detect_langs(text)
        if results:
            top = results[0]
            return {
                "language": top.lang,
                "confidence": top.prob,
                "alternatives": [{"lang": r.lang, "prob": r.prob} for r in results[1:5]],
                "method": "langdetect"
            }
    except Exception as e:
        pass
    
    return {"language": "unknown", "confidence": 0.0, "method": "error"}


def extract_entities(args: Dict[str, Any]) -> Dict[str, Any]:
    """Extract named entities using spaCy."""
    text = args.get("text", "")
    entity_types = args.get("types", None)  # Filter to specific types
    
    nlp = get_spacy()
    if nlp is None:
        return {"entities": [], "method": "unavailable"}
    
    doc = nlp(text)
    entities = []
    
    for ent in doc.ents:
        if entity_types and ent.label_ not in entity_types:
            continue
        entities.append({
            "text": ent.text,
            "type": ent.label_,
            "start": ent.start_char,
            "end": ent.end_char,
            "confidence": 0.9  # spaCy doesn't provide confidence scores
        })
    
    return {
        "entities": entities,
        "count": len(entities),
        "types_found": list(set(e["type"] for e in entities)),
        "method": "spacy"
    }


def extract_keywords(args: Dict[str, Any]) -> Dict[str, Any]:
    """Extract keywords using TF-IDF-like scoring."""
    text = args.get("text", "")
    top_k = args.get("topK", 10)
    
    nlp = get_spacy()
    if nlp is None:
        # Fallback: simple word frequency
        words = text.lower().split()
        freq = {}
        for w in words:
            if len(w) > 3:
                freq[w] = freq.get(w, 0) + 1
        sorted_words = sorted(freq.items(), key=lambda x: -x[1])[:top_k]
        return {
            "keywords": [{"keyword": w, "score": c/len(words), "frequency": c} for w, c in sorted_words],
            "method": "frequency"
        }
    
    doc = nlp(text)
    
    # Extract noun chunks and named entities as keywords
    keyword_scores = {}
    
    for chunk in doc.noun_chunks:
        key = chunk.text.lower().strip()
        if len(key) > 2:
            keyword_scores[key] = keyword_scores.get(key, 0) + 1
    
    for ent in doc.ents:
        key = ent.text.lower().strip()
        keyword_scores[key] = keyword_scores.get(key, 0) + 2  # Entities weighted higher
    
    # Normalize scores
    max_score = max(keyword_scores.values()) if keyword_scores else 1
    keywords = [
        {"keyword": k, "score": v/max_score, "frequency": v}
        for k, v in sorted(keyword_scores.items(), key=lambda x: -x[1])[:top_k]
    ]
    
    return {"keywords": keywords, "method": "spacy"}


def analyze_sentiment(args: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze sentiment of text."""
    text = args.get("text", "")
    
    # Simple lexicon-based sentiment (can be enhanced with transformers)
    positive_words = {'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 
                      'love', 'happy', 'best', 'perfect', 'beautiful', 'awesome'}
    negative_words = {'bad', 'terrible', 'awful', 'horrible', 'hate', 'worst', 
                      'poor', 'disappointing', 'sad', 'angry', 'ugly', 'boring'}
    
    words = set(text.lower().split())
    pos_count = len(words & positive_words)
    neg_count = len(words & negative_words)
    
    total = pos_count + neg_count
    if total == 0:
        return {"label": "neutral", "score": 0.0, "confidence": 0.5, "method": "lexicon"}
    
    score = (pos_count - neg_count) / total
    
    if score > 0.2:
        label = "positive"
    elif score < -0.2:
        label = "negative"
    else:
        label = "neutral"
    
    return {
        "label": label,
        "score": score,
        "confidence": min(0.5 + abs(score) * 0.5, 1.0),
        "positive_matches": pos_count,
        "negative_matches": neg_count,
        "method": "lexicon"
    }


def split_sentences(args: Dict[str, Any]) -> Dict[str, Any]:
    """Split text into sentences."""
    text = args.get("text", "")
    
    nlp = get_spacy()
    if nlp is None:
        # Fallback: simple split on sentence-ending punctuation
        import re
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return {
            "sentences": [{"text": s.strip(), "start": 0, "end": len(s)} for s in sentences if s.strip()],
            "count": len(sentences),
            "method": "regex"
        }
    
    doc = nlp(text)
    sentences = []
    
    for sent in doc.sents:
        sentences.append({
            "text": sent.text.strip(),
            "start": sent.start_char,
            "end": sent.end_char,
            "index": len(sentences)
        })
    
    return {"sentences": sentences, "count": len(sentences), "method": "spacy"}


def generate_outline(args: Dict[str, Any]) -> Dict[str, Any]:
    """Generate document outline from text structure."""
    text = args.get("text", "")
    max_depth = args.get("maxDepth", 3)
    
    lines = text.split('\n')
    outline = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        
        # Detect headings (markdown style or all caps)
        level = 0
        title = line
        
        if line.startswith('#'):
            level = len(line) - len(line.lstrip('#'))
            title = line.lstrip('#').strip()
        elif line.isupper() and len(line) > 3:
            level = 1
            title = line.title()
        elif line.endswith(':') and len(line) < 100:
            level = 2
            title = line.rstrip(':')
        
        if level > 0 and level <= max_depth:
            outline.append({
                "level": level,
                "title": title,
                "line": i + 1
            })
    
    return {"outline": outline, "depth": max_depth, "sections": len(outline)}


def embed_text(args: Dict[str, Any]) -> Dict[str, Any]:
    """Generate embeddings for text using sentence-transformers."""
    text = args.get("text", "")
    texts = args.get("texts", [text] if text else [])
    
    model = get_sentence_model()
    if model is None:
        # Return placeholder embeddings
        return {
            "embeddings": [[0.0] * 384 for _ in texts],
            "model": "unavailable",
            "dimensions": 384
        }
    
    embeddings = model.encode(texts, convert_to_numpy=True)
    
    return {
        "embeddings": embeddings.tolist(),
        "model": "all-MiniLM-L6-v2",
        "dimensions": embeddings.shape[1] if len(embeddings.shape) > 1 else 384
    }


def classify_text(args: Dict[str, Any]) -> Dict[str, Any]:
    """Classify text into categories."""
    text = args.get("text", "")
    categories = args.get("categories", ["positive", "negative", "neutral"])
    
    # Simple keyword-based classification (can be enhanced with zero-shot models)
    text_lower = text.lower()
    scores = {}
    
    for cat in categories:
        # Count occurrences of category-related words
        score = text_lower.count(cat.lower())
        scores[cat] = score
    
    total = sum(scores.values())
    if total == 0:
        # Equal probability
        probs = {cat: 1.0/len(categories) for cat in categories}
    else:
        probs = {cat: score/total for cat, score in scores.items()}
    
    top_category = max(probs.items(), key=lambda x: x[1])
    
    return {
        "category": top_category[0],
        "confidence": top_category[1],
        "scores": probs,
        "method": "keyword"
    }


# ============================================================================
# Main Entry Point
# ============================================================================

COMMANDS = {
    "detect_language": detect_language,
    "extract_entities": extract_entities,
    "extract_keywords": extract_keywords,
    "analyze_sentiment": analyze_sentiment,
    "split_sentences": split_sentences,
    "generate_outline": generate_outline,
    "embed_text": embed_text,
    "classify_text": classify_text,
}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command specified", "available": list(COMMANDS.keys())}))
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command not in COMMANDS:
        print(json.dumps({"error": f"Unknown command: {command}", "available": list(COMMANDS.keys())}))
        sys.exit(1)
    
    # Parse JSON args from stdin or argv
    if len(sys.argv) > 2:
        try:
            args = json.loads(sys.argv[2])
        except json.JSONDecodeError:
            args = {"text": sys.argv[2]}
    else:
        try:
            args = json.loads(sys.stdin.read())
        except:
            args = {}
    
    try:
        result = COMMANDS[command](args)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e), "command": command}))
        sys.exit(1)


if __name__ == "__main__":
    main()
