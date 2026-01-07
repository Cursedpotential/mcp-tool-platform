#!/usr/bin/env python3
"""
Graphiti Runner - Python bridge for temporal graph operations
Requires: graphiti-core, neo4j
"""

import sys
import json
import os
from datetime import datetime

try:
    from graphiti_core import Graphiti
    from graphiti_core.nodes import EntityNode, EpisodeNode
    from graphiti_core.edges import EntityEdge
    GRAPHITI_AVAILABLE = True
except ImportError:
    GRAPHITI_AVAILABLE = False

def get_graphiti_client():
    """Initialize Graphiti client with Neo4j connection"""
    neo4j_url = os.getenv('NEO4J_URL', 'bolt://localhost:7687')
    neo4j_user = os.getenv('NEO4J_USERNAME', 'neo4j')
    neo4j_password = os.getenv('NEO4J_PASSWORD', 'password')
    
    if not GRAPHITI_AVAILABLE:
        raise ImportError("graphiti-core not installed. Run: pip install graphiti-core neo4j")
    
    return Graphiti(
        neo4j_uri=neo4j_url,
        neo4j_user=neo4j_user,
        neo4j_password=neo4j_password
    )

def add_entity(args):
    """Add an entity to the temporal graph"""
    client = get_graphiti_client()
    
    entity = EntityNode(
        name=args['name'],
        entity_type=args.get('type', 'Entity'),
        properties=args.get('properties', {}),
        created_at=datetime.now()
    )
    
    result = client.add_entity(entity)
    
    return {
        'id': result.id,
        'name': result.name,
        'type': result.entity_type,
        'created_at': result.created_at.isoformat()
    }

def add_relationship(args):
    """Add a temporal relationship between entities"""
    client = get_graphiti_client()
    
    edge = EntityEdge(
        source_id=args['source_id'],
        target_id=args['target_id'],
        relationship_type=args['type'],
        properties=args.get('properties', {}),
        created_at=datetime.fromisoformat(args.get('timestamp', datetime.now().isoformat()))
    )
    
    result = client.add_edge(edge)
    
    return {
        'id': result.id,
        'source_id': result.source_id,
        'target_id': result.target_id,
        'type': result.relationship_type,
        'timestamp': result.created_at.isoformat()
    }

def search_entities(args):
    """Search for entities by name or type"""
    client = get_graphiti_client()
    
    query = args.get('query', '')
    entity_type = args.get('type')
    limit = args.get('limit', 10)
    
    results = client.search_entities(
        query=query,
        entity_type=entity_type,
        limit=limit
    )
    
    return {
        'entities': [
            {
                'id': e.id,
                'name': e.name,
                'type': e.entity_type,
                'properties': e.properties,
                'created_at': e.created_at.isoformat()
            }
            for e in results
        ],
        'count': len(results)
    }

def get_entity_timeline(args):
    """Get temporal timeline for an entity"""
    client = get_graphiti_client()
    
    entity_id = args['entity_id']
    start_time = args.get('start_time')
    end_time = args.get('end_time')
    
    if start_time:
        start_time = datetime.fromisoformat(start_time)
    if end_time:
        end_time = datetime.fromisoformat(end_time)
    
    timeline = client.get_entity_timeline(
        entity_id=entity_id,
        start_time=start_time,
        end_time=end_time
    )
    
    return {
        'entity_id': entity_id,
        'events': [
            {
                'timestamp': event.timestamp.isoformat(),
                'type': event.event_type,
                'description': event.description,
                'related_entities': event.related_entities
            }
            for event in timeline
        ],
        'count': len(timeline)
    }

def detect_contradictions(args):
    """Detect contradictions in entity relationships over time"""
    client = get_graphiti_client()
    
    entity_id = args['entity_id']
    relationship_type = args.get('relationship_type')
    
    contradictions = client.detect_contradictions(
        entity_id=entity_id,
        relationship_type=relationship_type
    )
    
    return {
        'entity_id': entity_id,
        'contradictions': [
            {
                'timestamp1': c.timestamp1.isoformat(),
                'timestamp2': c.timestamp2.isoformat(),
                'relationship1': c.relationship1,
                'relationship2': c.relationship2,
                'conflict_type': c.conflict_type
            }
            for c in contradictions
        ],
        'count': len(contradictions)
    }

def query_as_of(args):
    """Query graph state as of a specific timestamp"""
    client = get_graphiti_client()
    
    entity_id = args['entity_id']
    timestamp = datetime.fromisoformat(args['timestamp'])
    
    state = client.query_as_of(
        entity_id=entity_id,
        timestamp=timestamp
    )
    
    return {
        'entity_id': entity_id,
        'timestamp': timestamp.isoformat(),
        'state': {
            'name': state.name,
            'type': state.entity_type,
            'properties': state.properties,
            'relationships': [
                {
                    'target_id': r.target_id,
                    'type': r.relationship_type,
                    'properties': r.properties
                }
                for r in state.relationships
            ]
        }
    }

def main():
    if len(sys.argv) < 3:
        print(json.dumps({
            'success': False,
            'error': 'Usage: graphiti_runner.py <command> <args_json>'
        }))
        sys.exit(1)
    
    command = sys.argv[1]
    args = json.loads(sys.argv[2])
    
    try:
        if command == 'add_entity':
            result = add_entity(args)
        elif command == 'add_relationship':
            result = add_relationship(args)
        elif command == 'search_entities':
            result = search_entities(args)
        elif command == 'get_entity_timeline':
            result = get_entity_timeline(args)
        elif command == 'detect_contradictions':
            result = detect_contradictions(args)
        elif command == 'query_as_of':
            result = query_as_of(args)
        else:
            result = {'error': f'Unknown command: {command}'}
        
        print(json.dumps({
            'success': True,
            'data': result
        }))
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
            'type': type(e).__name__
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
