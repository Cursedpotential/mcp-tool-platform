# Neo4j/Graphiti Integration

## Overview

The Neo4j/Graphiti integration provides **temporal knowledge graph storage** for entities and relationships extracted from forensic evidence. It enables relationship traversal, pattern detection, timeline analysis, and contradiction detection across multi-platform messaging data.

## Purpose

Neo4j serves as the **graph layer** for relationship queries, pattern matching, and cluster analysis, while Supabase remains the **source of truth** for all raw data. This separation allows:

- **Relationship Traversal:** Find all connections between entities (e.g., "Who did Katrina contact before the incident?")
- **Path Finding:** Discover indirect relationships (e.g., "How is Person A connected to Person B?")
- **Pattern Matching:** Detect behavioral patterns (e.g., "Find all instances of parenting time denial")
- **Cluster Detection:** Group related entities (e.g., "Find all people associated with this address")
- **Temporal Analysis:** Track entity evolution over time (e.g., "When did this relationship start/end?")
- **Contradiction Detection:** Find conflicting statements (e.g., "Person A said X on Date 1, but Y on Date 2")

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Supabase (Postgres)                     │
│                      Source of Truth                         │
│  - All raw data                                              │
│  - Full text search                                          │
│  - PostGIS for spatial queries                               │
│  - API layer (auto-generated)                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Sync/ETL
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                        Neo4j                                 │
│                    Graph Analysis                            │
│  - Relationship traversal                                    │
│  - Path finding                                              │
│  - Pattern matching                                          │
│  - Cluster detection                                         │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle:** Supabase is source of truth for all raw data and lookups. Neo4j is the graph layer for relationship queries, pattern detection, and cluster analysis.

---

## How It Works

### 1. Entity Extraction
During document processing, the multi-pass NLP classifier extracts entities from messages:
- **People:** Names, aliases, relationships
- **Places:** Addresses, locations, venues
- **Organizations:** Companies, agencies, institutions
- **Events:** Incidents, appointments, significant dates
- **Contact Info:** Phone numbers, email addresses

### 2. Relationship Detection
The system detects relationships between entities:
- **Familial:** Parent-child, siblings, extended family
- **Romantic:** Dating, marriage, divorce, affairs
- **Professional:** Employment, coworkers, supervision
- **Residential:** Residence history, property ownership, neighbors
- **Contact:** Phone ownership, email ownership, messaging
- **Spatial:** Location visits, proximity, co-location
- **Temporal:** Event participation, timeline overlaps

### 3. Graph Storage
Entities and relationships are stored in Neo4j using Graphiti's temporal knowledge graph framework:
- **Nodes:** Entities with properties (Person, Address, Place, Organization, Event, etc.)
- **Edges:** Relationships with temporal metadata (start_date, end_date, source)
- **Constraints:** Unique IDs, spatial indexes for proximity queries
- **Temporal Tracking:** All relationships have timestamps for evolution tracking

### 4. Query & Analysis
The system provides tools for graph analysis:
- **Search Entities:** Find entities by name, type, or properties
- **Get Timeline:** Retrieve entity history with all relationships
- **Detect Contradictions:** Find conflicting statements across time
- **Query As Of:** Get graph state at a specific date (temporal queries)

---

## Node Labels (Entities)

### Person
Primary entity for all individuals in the case ecosystem.

**Properties:**
- **Identity:** `id`, `canonical_name`, `full_name`, `first_name`, `middle_name`, `last_name`, `suffix`, `aliases`
- **Demographics:** `dob_month`, `dob_year`, `age`, `gender`, `alive`
- **Classification:** `type`, `subtype`, `relationship_to_user`, `lookup_status`, `case_relevant`, `case_role`, `impact_on_case`
- **Metadata:** `source_app`, `source_urls`, `created_at`, `updated_at`

**Subtypes:**
- `opposing_party` - The respondent/defendant
- `child` - Minor child involved in case
- `witness` - Potential witness
- `expert` - Expert witness
- `family_petitioner` - Petitioner's family
- `family_respondent` - Respondent's family
- `associate` - Friend, coworker, acquaintance
- `romantic_interest` - Romantic partner (current or past)
- `professional` - Attorney, judge, FOC worker

**Relevance Tiers:**
- **Tier 1 (`subject`):** Direct lookup targets (Katrina, key witnesses) - Highest priority
- **Tier 2 (`promoted`):** Derived person manually flagged as important - High priority
- **Tier 3 (`derived`):** Auto-extracted (relatives, neighbors, associates) - Medium priority

---

### Address
Physical addresses with geocoding for spatial queries.

**Properties:**
- **Identity:** `id`, `full_address`, `street`, `city`, `state`, `zip`, `county`, `unit`
- **Precise Coordinates:** `lat`, `lon`, `location` (Neo4j Point type)
- **Fuzzy Coordinates:** `lat_fuzzy`, `lon_fuzzy` (rounded ~100m grid)
- **Geohash:** `geohash_5` (~5km), `geohash_6` (~1.2km), `geohash_7` (~150m)
- **Geocode Metadata:** `geocode_source`, `geocode_confidence`, `geocode_date`

**Geohash Precision Tiers:**
| Precision | Approximate Area | Use Case |
|-----------|------------------|----------|
| `geohash_7` | ~150m | Same building, adjacent lots |
| `geohash_6` | ~1.2km | Same neighborhood, walking distance |
| `geohash_5` | ~5km | Same part of town |
| `lat_fuzzy` (3 decimals) | ~100m | Quick SQL-style grouping |

---

### Place
Named locations (not residential addresses).

**Properties:**
- `id`, `canonical_name`, `type`, `subtype`, `address`, `lat`, `lon`, `source_app`

**Subtypes:**
- `court` - Courthouse, FOC office
- `school` - Schools, daycare
- `workplace` - Employers
- `medical` - Hospitals, clinics
- `business` - Restaurants, stores
- `residence` - (Use Address node instead)

---

### Organization
Companies, agencies, institutions.

**Properties:**
- `id`, `canonical_name`, `type`, `subtype`, `address`, `phone`, `source_app`

**Subtypes:**
- `court_agency` - FOC, Probation
- `employer` - Companies where parties work
- `school` - Schools, districts
- `medical` - Healthcare providers
- `legal` - Law firms
- `government` - Other government agencies

---

### Property
Real estate property details (linked to Address).

**Properties:**
- **Structure:** `bedrooms`, `bathrooms`, `sqft`, `year_built`, `lot_sqft`
- **Value:** `estimated_value`, `estimated_equity`, `last_sale_amount`, `last_sale_date`
- **Classification:** `land_use`, `property_class`, `subdivision`, `apn`, `occupancy_type`, `ownership_type`, `school_district`

---

### GpsPoint
Individual GPS location records from timeline data.

**Properties:**
- **Identity:** `point_id`
- **Coordinates:** `lat`, `lon`, `location` (Neo4j Point type)
- **Quality:** `accuracy`
- **Temporal:** `timestamp`
- **Source:** `source`, `owner`, `activity_type`
- **Precomputed:** `is_night`, `hour_of_day`, `day_of_week`
- **Fuzzy:** `geohash_7`

**Activity Types:**
- `STILL` - Stationary
- `WALKING` - On foot
- `RUNNING` - Running/jogging
- `IN_VEHICLE` - Driving/passenger
- `ON_BICYCLE` - Cycling
- `UNKNOWN` - Undetermined

---

### Phone
Phone number records.

**Properties:**
- `number`, `type`, `carrier`, `first_reported`

**Types:**
- `wireless` - Cell phone
- `landline` - Wired phone
- `voip` - Internet-based (Google Voice, etc.)

---

### Email
Email address records.

**Properties:**
- `address`, `domain`, `first_reported`

---

### VoterRecord
Public voter registration data.

**Properties:**
- `voter_id`, `registration_date`, `status`, `party`, `precinct`, `jurisdiction`, `county`, `state_house_district`, `state_senate_district`, `us_congress_district`, `school_district`

---

### Event
Discrete events that can be linked to people/places.

**Properties:**
- **Identity:** `id`, `event_type`, `description`
- **Temporal:** `date`, `date_raw`
- **Spatial:** `location`
- **Legal Relevance:** `mcl_factors`, `is_significant`
- **Source:** `source_app`, `source_document`

---

## Edge Types (Relationships)

### Familial Relationships
```cypher
-- Parent-child
(parent:Person)-[:PARENT_OF {
  start_date: "2019-05-15",
  source_app: "chronicle"
}]->(child:Person)

(child:Person)-[:CHILD_OF]->(parent:Person)

-- Siblings
(a:Person)-[:SIBLING_OF]->(b:Person)

-- Extended family
(a:Person)-[:RELATIVE_OF {
  relationship_type: "cousin"
}]->(b:Person)
```

---

### Romantic Relationships
```cypher
-- Dating
(a:Person)-[:DATED {
  start_date: "2016-03-01",
  end_date: "2024-08-15",
  source_app: "chronicle"
}]->(b:Person)

-- Marriage
(a:Person)-[:MARRIED_TO {
  start_date: "2018-06-20",
  end_date: "2023-01-15"
}]->(b:Person)

-- Divorce
(a:Person)-[:DIVORCED_FROM {
  date: "2023-01-15"
}]->(b:Person)

-- Affair
(a:Person)-[:AFFAIR_WITH {
  start_date: "2022-06-01",
  discovered_date: "2023-11-15"
}]->(b:Person)
```

---

### Professional Relationships
```cypher
-- Employment
(person:Person)-[:EMPLOYED_BY {
  start_date: "2019-03-01",
  end_date: "2023-08-30",
  position: "Electrician"
}]->(org:Organization)

-- Coworkers
(a:Person)-[:COWORKER_OF {
  at_organization: "uuid"
}]->(b:Person)

-- Supervision
(a:Person)-[:SUPERVISED_BY]->(b:Person)
```

---

### Residential Relationships
```cypher
-- Residence history
(person:Person)-[:RESIDED_AT {
  from_date: date("2018-06-15"),
  to_date: date("2023-08-01"),
  is_current: false,
  source_url: "https://...",
  extracted_date: date()
}]->(address:Address)

-- Property ownership
(person:Person)-[:OWNS {
  since_date: date("2018-06-15")
}]->(property:Property)

-- Address-Property link
(address:Address)-[:HAS_PROPERTY]->(property:Property)

-- Neighbors
(a:Person)-[:NEIGHBOR_OF {
  at_address: "uuid",
  during_period: "2019-2023"
}]->(b:Person)
```

---

### Contact Relationships
```cypher
-- Phone ownership
(person:Person)-[:HAS_PHONE {
  first_reported: date("2020-03-15")
}]->(phone:Phone)

-- Email ownership
(person:Person)-[:HAS_EMAIL {
  first_reported: date("2019-01-01")
}]->(email:Email)

-- Messaging
(sender:Person)-[:MESSAGED {
  timestamp: datetime("2024-03-15T14:23:00Z"),
  platform: "SMS",
  message_id: "uuid"
}]->(recipient:Person)

-- Phone contact
(caller:Person)-[:CONTACTED {
  timestamp: datetime("2024-03-15T14:23:00Z"),
  duration_seconds: 180,
  call_type: "outgoing"
}]->(callee:Person)
```

---

### Spatial Relationships
```cypher
-- Location visits
(person:Person)-[:VISITED {
  timestamp: datetime("2024-03-15T14:23:00Z"),
  duration_minutes: 45
}]->(place:Place)

-- GPS point location
(gps:GpsPoint)-[:LOCATED_AT]->(address:Address)

-- Proximity
(a:Person)-[:NEAR {
  distance_meters: 150,
  timestamp: datetime("2024-03-15T14:23:00Z")
}]->(b:Person)
```

---

### Temporal Relationships
```cypher
-- Event participation
(person:Person)-[:PARTICIPATED_IN {
  role: "witness"
}]->(event:Event)

-- Event location
(event:Event)-[:OCCURRED_AT]->(place:Place)

-- Entity mentions
(entity:Person)-[:MENTIONED_IN {
  timestamp: datetime("2024-03-15T14:23:00Z"),
  context: "Discussed parenting time"
}]->(message:Message)
```

---

## Parameters/Configuration

### Connection Configuration
- **NEO4J_URL:** Neo4j Aura connection URI (e.g., `neo4j+s://xxxxx.databases.neo4j.io`)
- **NEO4J_USERNAME:** Neo4j username (default: `neo4j`)
- **NEO4J_PASSWORD:** Neo4j password

### Graphiti Configuration
- **Temporal Tracking:** All relationships have `start_date` and `end_date` for evolution tracking
- **Source Tracking:** All entities have `source_app` and `source_urls` for provenance
- **Spatial Indexing:** Geohash precision tiers for fast proximity queries

---

## Usage Examples

### Example 1: Add Entity
```typescript
import { graphitiRunner } from './server/python-tools/graphiti_runner';

const result = await graphitiRunner('add_entity', {
  entity_type: 'Person',
  properties: {
    canonical_name: 'Katrina Kinzel',
    subtype: 'opposing_party',
    case_relevant: true
  }
});
```

### Example 2: Add Relationship
```typescript
const result = await graphitiRunner('add_relationship', {
  source_entity_id: 'person_uuid_1',
  target_entity_id: 'person_uuid_2',
  relationship_type: 'DATED',
  properties: {
    start_date: '2016-03-01',
    end_date: '2024-08-15',
    source_app: 'chronicle'
  }
});
```

### Example 3: Search Entities
```typescript
const result = await graphitiRunner('search_entities', {
  query: 'Katrina',
  entity_type: 'Person',
  limit: 10
});
```

### Example 4: Get Entity Timeline
```typescript
const result = await graphitiRunner('get_entity_timeline', {
  entity_id: 'person_uuid',
  start_date: '2024-01-01',
  end_date: '2024-12-31'
});
```

### Example 5: Detect Contradictions
```typescript
const result = await graphitiRunner('detect_contradictions', {
  entity_id: 'person_uuid',
  property_name: 'location'
});
```

### Example 6: Query As Of Date
```typescript
const result = await graphitiRunner('query_as_of', {
  entity_id: 'person_uuid',
  as_of_date: '2024-06-15'
});
```

---

## Return Values/Output

All Graphiti operations return:
```typescript
{
  success: boolean;
  data?: any;
  error?: string;
}
```

**Example Success Response:**
```json
{
  "success": true,
  "data": {
    "entity_id": "uuid",
    "entity_type": "Person",
    "properties": {
      "canonical_name": "Katrina Kinzel",
      "subtype": "opposing_party"
    }
  }
}
```

---

## Related Tools/Systems

- [Graph Add Entity](../tools/graph-add-entity.md) - Add entity to graph
- [Graph Add Relationship](../tools/graph-add-relationship.md) - Add relationship
- [Graph Search Entities](../tools/graph-search-entities.md) - Search entities
- [Graph Timeline](../tools/graph-timeline.md) - Get entity timeline
- [Graph Contradictions](../tools/graph-contradictions.md) - Detect contradictions
- [Supabase Integration](./supabase-integration.md) - Source of truth for raw data
- [Multi-Pass Classifier](./multi-pass-classifier.md) - Entity extraction from messages

---

## Troubleshooting

### Issue: Connection Failed
**Symptom:** `Neo4jError: Unable to connect to Neo4j`  
**Cause:** Invalid credentials or network issue  
**Solution:** Verify `NEO4J_URL`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` in environment variables. Ensure Neo4j Aura instance is running.

### Issue: Duplicate Entities
**Symptom:** Multiple entities with same name  
**Cause:** Entity deduplication not enabled  
**Solution:** Use `canonical_name` for entity matching. Implement entity resolution logic before adding to graph.

### Issue: Slow Proximity Queries
**Symptom:** Geohash queries taking >1s  
**Cause:** Missing spatial indexes  
**Solution:** Ensure spatial indexes are created: `CREATE POINT INDEX gps_location IF NOT EXISTS FOR (g:GpsPoint) ON (g.location);`

### Issue: Temporal Queries Returning Wrong Data
**Symptom:** `query_as_of` returns incorrect graph state  
**Cause:** Missing `start_date` or `end_date` on relationships  
**Solution:** Ensure all relationships have temporal metadata. Use `datetime()` for timestamps.

---

## See Also

- [Graphiti Documentation](https://github.com/graphiti-ai/graphiti) - Official Graphiti docs
- [Neo4j Cypher Manual](https://neo4j.com/docs/cypher-manual/current/) - Cypher query language
- [Forensic Investigation Workflow](../workflows/forensic-investigation.md) - How entities are extracted
- [Pattern Library](./pattern-library.md) - Behavioral patterns for entity classification
