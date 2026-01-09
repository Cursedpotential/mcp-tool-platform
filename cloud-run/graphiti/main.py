#!/usr/bin/env python3
"""
Graphiti Knowledge Graph API - Google Cloud Run Deployment
Salem Forensics Platform

Provides REST API for Graphiti operations:
- Entity management (add, search, get timeline)
- Relationship management
- Contradiction detection
- Temporal queries (as-of)

Connects to Neo4j Aura (cloud-hosted) for graph storage.
"""

import os
import json
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime
from fastapi import FastAPI, HTTPException, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Graphiti Knowledge Graph API",
    description="Salem Forensics - Entity and relationship management via Neo4j",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
API_KEY = os.environ.get("API_KEY", "")
NEO4J_URI = os.environ.get("NEO4J_URI", "")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "")

# Graphiti client (lazy initialization)
graphiti_client = None

def get_graphiti():
    """Lazy initialize Graphiti client"""
    global graphiti_client
    if graphiti_client is None:
        try:
            from graphiti_core import Graphiti
            from graphiti_core.llm_client import OpenAIClient
            
            # Use OpenAI-compatible endpoint (LiteLLM or direct)
            llm_client = OpenAIClient(
                api_key=os.environ.get("OPENAI_API_KEY", ""),
                base_url=os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")
            )
            
            graphiti_client = Graphiti(
                uri=NEO4J_URI,
                user=NEO4J_USER,
                password=NEO4J_PASSWORD,
                llm_client=llm_client
            )
            logger.info("Graphiti client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Graphiti: {e}")
            raise
    return graphiti_client

def verify_api_key(authorization: Optional[str] = Header(None)):
    """Verify API key from Authorization header"""
    if not API_KEY:
        return  # No auth required if API_KEY not set
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = authorization.replace("Bearer ", "")
    if token != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")

# Request/Response Models
class EntityRequest(BaseModel):
    name: str
    entity_type: str
    properties: Dict[str, Any] = {}
    source_description: Optional[str] = None

class RelationshipRequest(BaseModel):
    source_entity: str
    target_entity: str
    relationship_type: str
    properties: Dict[str, Any] = {}
    source_description: Optional[str] = None

class SearchRequest(BaseModel):
    query: str
    entity_types: Optional[List[str]] = None
    limit: int = 10

class TimelineRequest(BaseModel):
    entity_name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class ContradictionRequest(BaseModel):
    entity_name: str
    claim: str

class AsOfRequest(BaseModel):
    query: str
    as_of_date: str  # ISO format

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "graphiti-api",
        "neo4j_configured": bool(NEO4J_URI),
        "timestamp": datetime.utcnow().isoformat()
    }

# Entity operations
@app.post("/entity/add")
async def add_entity(request: EntityRequest, authorization: str = Header(None)):
    verify_api_key(authorization)
    try:
        client = get_graphiti()
        
        # Add entity episode
        await client.add_episode(
            name=request.name,
            episode_body=json.dumps({
                "type": request.entity_type,
                "properties": request.properties
            }),
            source_description=request.source_description or f"Entity: {request.name}",
            reference_time=datetime.utcnow()
        )
        
        return {
            "success": True,
            "entity": request.name,
            "type": request.entity_type,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error adding entity: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/entity/search")
async def search_entities(request: SearchRequest, authorization: str = Header(None)):
    verify_api_key(authorization)
    try:
        client = get_graphiti()
        
        results = await client.search(
            query=request.query,
            num_results=request.limit
        )
        
        return {
            "success": True,
            "query": request.query,
            "results": [
                {
                    "name": r.name if hasattr(r, 'name') else str(r),
                    "score": r.score if hasattr(r, 'score') else 1.0,
                    "facts": r.facts if hasattr(r, 'facts') else []
                }
                for r in results
            ],
            "count": len(results)
        }
    except Exception as e:
        logger.error(f"Error searching entities: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/entity/timeline")
async def get_entity_timeline(request: TimelineRequest, authorization: str = Header(None)):
    verify_api_key(authorization)
    try:
        client = get_graphiti()
        
        # Get episodes related to entity
        results = await client.search(
            query=request.entity_name,
            num_results=100
        )
        
        # Filter by date range if provided
        timeline = []
        for r in results:
            entry = {
                "name": r.name if hasattr(r, 'name') else str(r),
                "facts": r.facts if hasattr(r, 'facts') else [],
                "timestamp": r.created_at.isoformat() if hasattr(r, 'created_at') else None
            }
            timeline.append(entry)
        
        return {
            "success": True,
            "entity": request.entity_name,
            "timeline": timeline,
            "count": len(timeline)
        }
    except Exception as e:
        logger.error(f"Error getting timeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Relationship operations
@app.post("/relationship/add")
async def add_relationship(request: RelationshipRequest, authorization: str = Header(None)):
    verify_api_key(authorization)
    try:
        client = get_graphiti()
        
        # Add relationship as episode
        await client.add_episode(
            name=f"{request.source_entity}-{request.relationship_type}-{request.target_entity}",
            episode_body=json.dumps({
                "source": request.source_entity,
                "target": request.target_entity,
                "type": request.relationship_type,
                "properties": request.properties
            }),
            source_description=request.source_description or f"Relationship: {request.relationship_type}",
            reference_time=datetime.utcnow()
        )
        
        return {
            "success": True,
            "source": request.source_entity,
            "target": request.target_entity,
            "relationship": request.relationship_type,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error adding relationship: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Contradiction detection
@app.post("/detect/contradictions")
async def detect_contradictions(request: ContradictionRequest, authorization: str = Header(None)):
    verify_api_key(authorization)
    try:
        client = get_graphiti()
        
        # Search for existing facts about entity
        existing = await client.search(
            query=request.entity_name,
            num_results=50
        )
        
        # Compare claim against existing facts
        # This is a simplified version - full implementation would use LLM
        contradictions = []
        for r in existing:
            facts = r.facts if hasattr(r, 'facts') else []
            for fact in facts:
                # Simple keyword contradiction check
                if any(neg in request.claim.lower() for neg in ['not', 'never', 'didn\'t', 'wasn\'t']):
                    if any(word in fact.lower() for word in request.claim.lower().split()):
                        contradictions.append({
                            "existing_fact": fact,
                            "new_claim": request.claim,
                            "confidence": 0.7
                        })
        
        return {
            "success": True,
            "entity": request.entity_name,
            "claim": request.claim,
            "contradictions": contradictions,
            "has_contradictions": len(contradictions) > 0
        }
    except Exception as e:
        logger.error(f"Error detecting contradictions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Temporal query
@app.post("/query/as_of")
async def query_as_of(request: AsOfRequest, authorization: str = Header(None)):
    verify_api_key(authorization)
    try:
        client = get_graphiti()
        
        as_of = datetime.fromisoformat(request.as_of_date.replace('Z', '+00:00'))
        
        # Search with temporal context
        results = await client.search(
            query=request.query,
            num_results=20
        )
        
        # Filter results by as_of date
        filtered = []
        for r in results:
            created = r.created_at if hasattr(r, 'created_at') else None
            if created and created <= as_of:
                filtered.append({
                    "name": r.name if hasattr(r, 'name') else str(r),
                    "facts": r.facts if hasattr(r, 'facts') else [],
                    "timestamp": created.isoformat()
                })
        
        return {
            "success": True,
            "query": request.query,
            "as_of": request.as_of_date,
            "results": filtered,
            "count": len(filtered)
        }
    except Exception as e:
        logger.error(f"Error in as_of query: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Run with uvicorn
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
