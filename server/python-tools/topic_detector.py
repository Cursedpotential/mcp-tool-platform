#!/usr/bin/env python3
"""
BERTopic-based Topic Detection
Detects conversation topics and assigns topic codes
"""

import sys
import json
from bertopic import BERTopic
from sentence_transformers import SentenceTransformer
import numpy as np

# Topic code mapping (reverse lookup from detected topics)
TOPIC_MAPPING = {
    'kailah': 'KAILAH',
    'daughter': 'KAILAH',
    'child': 'KAILAH',
    'baby': 'KAILAH',
    'parenting': 'VISITS',
    'custody': 'VISITS',
    'visitation': 'VISITS',
    'visit': 'VISITS',
    'call': 'CALLS',
    'phone': 'CALLS',
    'contact': 'CALLS',
    'school': 'SCHOOL',
    'education': 'SCHOOL',
    'teacher': 'SCHOOL',
    'money': 'MONEY',
    'financial': 'MONEY',
    'bills': 'MONEY',
    'rent': 'MONEY',
    'payment': 'MONEY',
    'health': 'HEALTH',
    'medical': 'HEALTH',
    'doctor': 'HEALTH',
    'hospital': 'HEALTH',
    'medication': 'HEALTH',
    'alcohol': 'SUBST',
    'drug': 'SUBST',
    'adderall': 'SUBST',
    'substance': 'SUBST',
    'drunk': 'SUBST',
    'cheat': 'INFID',
    'affair': 'INFID',
    'infidelity': 'INFID',
    'loyal': 'INFID',
    'threat': 'THREAT',
    'hurt': 'THREAT',
    'kill': 'THREAT',
    'harm': 'THREAT',
}

class TopicDetector:
    def __init__(self):
        # Use sentence-transformers for embeddings
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Initialize BERTopic with minimal settings for speed
        self.topic_model = BERTopic(
            embedding_model=self.embedding_model,
            min_topic_size=2,  # Small clusters allowed
            nr_topics='auto',
            calculate_probabilities=False,  # Faster
            verbose=False
        )
        
        self.is_fitted = False
    
    def fit_and_detect(self, messages: list[str]) -> dict:
        """
        Fit BERTopic model on messages and detect topics
        
        Args:
            messages: List of message texts
            
        Returns:
            {
                'topics': [topic_id, ...],  # Topic ID per message (-1 = outlier)
                'topic_labels': {topic_id: 'label', ...},
                'topic_codes': ['KAILAH', 'VISITS', ...],  # 6-char code per message
                'embeddings': [[...], ...]  # Embeddings for similarity calc
            }
        """
        if len(messages) < 2:
            # Not enough messages for clustering
            return {
                'topics': [-1] * len(messages),
                'topic_labels': {},
                'topic_codes': ['GENRL'] * len(messages),
                'embeddings': self.embedding_model.encode(messages).tolist()
            }
        
        # Fit and transform
        topics, probs = self.topic_model.fit_transform(messages)
        self.is_fitted = True
        
        # Get topic labels
        topic_info = self.topic_model.get_topic_info()
        topic_labels = {}
        for _, row in topic_info.iterrows():
            topic_id = row['Topic']
            if topic_id == -1:
                continue
            # Get top words for this topic
            topic_words = self.topic_model.get_topic(topic_id)
            if topic_words:
                # Use top 3 words as label
                label = '_'.join([word for word, _ in topic_words[:3]])
                topic_labels[topic_id] = label
        
        # Map topics to 6-char codes
        topic_codes = []
        for topic_id in topics:
            if topic_id == -1:
                topic_codes.append('GENRL')
            else:
                label = topic_labels.get(topic_id, '')
                code = self._map_to_code(label)
                topic_codes.append(code)
        
        # Get embeddings for similarity calculation
        embeddings = self.embedding_model.encode(messages)
        
        return {
            'topics': topics.tolist(),
            'topic_labels': topic_labels,
            'topic_codes': topic_codes,
            'embeddings': embeddings.tolist()
        }
    
    def _map_to_code(self, label: str) -> str:
        """Map BERTopic label to 6-char code"""
        label_lower = label.lower()
        
        # Check for keyword matches
        for keyword, code in TOPIC_MAPPING.items():
            if keyword in label_lower:
                return code
        
        # Default to GENRL
        return 'GENRL'
    
    def get_embedding(self, text: str) -> list[float]:
        """Get embedding for a single text"""
        return self.embedding_model.encode([text])[0].tolist()

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No messages provided'}))
        sys.exit(1)
    
    # Parse input JSON
    try:
        messages = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(json.dumps({'error': f'Invalid JSON: {e}'}))
        sys.exit(1)
    
    if not isinstance(messages, list):
        print(json.dumps({'error': 'Messages must be a list'}))
        sys.exit(1)
    
    # Detect topics
    detector = TopicDetector()
    result = detector.fit_and_detect(messages)
    
    # Output JSON
    print(json.dumps(result))

if __name__ == '__main__':
    main()
