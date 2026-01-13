# Analysis Library Architecture

## Overview
This document maps the 200-hour custom analysis library to the correct NLP tools and database structure.

---

## Pattern Categories (from Analysis Library)

### 1. **Core Manipulation Patterns**
These are **keyword/phrase-based** - perfect for **regex + pattern matching**.

#### Gaslighting
- "i never said that", "you imagined", "you're imagining"
- "you're paranoid", "that never happened", "no one will believe"
- "you're crazy", "you're just high", "just kidding"
- "you're overreacting", "this is the drugs talking"

**Tool:** Pattern Analyzer (regex matching)
**Severity:** 7-9
**MCL Factor:** Multiple (depends on context)

#### Blame Shifting
- "this is your fault", "you made me", "because of you"
- "you started this", "you always do this", "if you hadn't"
- "look what you made me do"

**Tool:** Pattern Analyzer + NLTK (pronoun analysis for "you" vs "I")
**Severity:** 6-8
**MCL Factor:** Blame projection

#### Minimizing
- "not a big deal", "you're too sensitive", "calm down"
- "you're being dramatic", "get over it", "stop making a scene"
- "it was just a joke", "relax"

**Tool:** Pattern Analyzer + TextBlob (detect dismissive tone)
**Severity:** 5-7
**MCL Factor:** Minimization of abuse

#### Circular Arguments
- "what even is the point", "that's not the point"
- "you keep changing", "you know what i mean"
- "anyway", "whatever", "we're not in high school"

**Tool:** Pattern Analyzer + spaCy (detect topic shifts, incomplete sentences)
**Severity:** 4-6
**MCL Factor:** Communication obstruction

---

### 2. **Contradiction Detection**
This requires **cross-document analysis** - not surface-level.

#### Platform Denials
- **Denials:** "i don't", "i do not", "i never", "i would never", "that's not me", "i don't use"
- **Platforms:** "snapchat", "snap", "instagram", "facebook", "tiktok"

**Detection Strategy:**
1. **Pass 1 (Surface):** Flag mentions of platforms
2. **Pass 1 (Surface):** Flag denial phrases
3. **Meta-Analysis (Later):** Cross-reference: Did they mention Snapchat earlier but deny using it later?

**Tool:** 
- Surface: Pattern Analyzer
- Meta: LangChain Memory (temporal queries) + Neo4j (relationship mapping)

**Severity:** 8-10 (if contradiction confirmed)
**MCL Factor:** Deception, credibility

---

### 3. **Auxiliary Context Markers**
These provide **context** but aren't abusive on their own.

#### Substance - Alcohol
- "drink", "drank", "drunk", "buzzed", "tipsy", "wasted"
- "bottle", "wine", "beer", "liquor", "vodka", "tequila"
- "hungover", "fireball"

**Tool:** Pattern Analyzer (keyword matching) + spaCy (entity extraction for brand names)
**Severity:** 0 (context only)
**Use:** Tag messages for timeline correlation

#### Substance - Weaponized Against You
- "crackhead", "tweaker", "addict", "junkie", "user"
- "you're just high", "are you on something"
- "this is the drugs talking"

**Tool:** Pattern Analyzer + NLTK VADER (detect hostile sentiment)
**Severity:** 7-9
**MCL Factor:** Character assassination

#### Adderall Control
- "adderall", "addy", "pills", "script", "share", "split"
- "your turn", "how many did you take"
- "i'm holding onto them for you", "you can't control yourself"

**Tool:** Pattern Analyzer + spaCy (detect control language)
**Severity:** 8-10
**MCL Factor:** Medical abuse, control

#### Infidelity - Places
- "huckleberry junction", "huck's", "hucks"

**Tool:** spaCy (named entity recognition for locations)
**Severity:** 0 (context only)
**Use:** Cross-reference with timeline, other evidence

#### Infidelity - General
- "cheating", "cheated", "slept with", "affair", "secret"
- "seeing someone", "loyal", "faithful"
- "he's just a friend", "we just work together"
- "you're being jealous", "why don't you trust me"

**Tool:** Pattern Analyzer + TextBlob (detect defensive tone in denials)
**Severity:** 6-9 (depending on context)
**MCL Factor:** Fidelity, trust

#### Financial - Domestic (Neutral)
- "work", "hours", "job", "tired", "exhausted"
- "broke", "bills", "rent", "money", "pay", "afford"
- "contribute", "clean", "cook", "laundry", "dishes"
- "groceries", "errands", "lunch"

**Tool:** spaCy (entity extraction for financial terms)
**Severity:** 0 (context only)
**Use:** Baseline for comparison with weaponized language

#### Financial - Weaponized
- "you don't do anything", "i'm the one who works hard"
- "what do i get out of this"
- "it's your responsibility to provide"

**Tool:** Pattern Analyzer + NLTK (detect accusatory pronouns) + TextBlob (hostile sentiment)
**Severity:** 6-8
**MCL Factor:** Financial abuse

#### Love Bombing
- "perfect", "amazing", "soulmate", "can't live without you"
- "always", "forever", "everything", "desperate", "need you"
- "you're the only one who understands me"
- "i've never felt this way before"
- "i want to give you everything"

**Tool:** Pattern Analyzer + TextBlob (detect excessive positive sentiment) + Sentence Transformers (semantic similarity to known love bombing)
**Severity:** 5-7 (context-dependent; HIGH if followed by abuse)
**MCL Factor:** Manipulation cycle

#### Sexual Shaming
- "slut", "whore", "pervert", "disgusting", "sick"
- "nasty", "freak", "used", "cheap"
- "no wonder everyone leaves you", "to think i ever did"

**Tool:** Pattern Analyzer + NLTK VADER (hostile sentiment) + Hurtlex (offensive language detection)
**Severity:** 9-10
**MCL Factor:** Sexual abuse, degradation

---

### 4. **Parental Alienation** (from later in file)
#### Classic Alienation
- "[Child's name] doesn't want to see you"
- "I have to protect the children from you"

**Tactics:**
- Sharing inappropriate info
- First-name references (calling parent by first name instead of "dad"/"mom")
- Fabricated quotes

**Tool:** Pattern Analyzer + spaCy (detect child name entities) + Priority Screener
**Severity:** 10
**MCL Factor:** k (willingness to facilitate relationship)

#### Autism Weaponization
- "You can't handle his autism"
- "Interfering with medical care"

**Medical Interference:**
- Appointment blocking
- Treatment undermining

**Tool:** Pattern Analyzer + spaCy (medical entity extraction)
**Severity:** 10
**MCL Factor:** k + medical neglect

---

### 5. **Linguistic Markers** (LIWC-style)
These require **statistical analysis** - not pattern matching.

#### Pronoun Usage
- **First-person singular:** "I", "me", "my", "mine", "myself"
- **Second-person:** "you", "your", "yours", "yourself"

**Analysis Flags:**
- High I-talk (narcissistic indicator)
- Blame projection (excessive "you")

**Tool:** NLTK (POS tagging) + spaCy (pronoun counting)
**Severity:** 0 (statistical marker only)
**Use:** Aggregate across messages for psychological profile

#### Certainty Absolutes
- "always", "never", "nothing", "everything"
- "fact", "obviously", "clearly", "literally"
- "completely", "impossible"

**Tool:** Pattern Analyzer + NLTK (detect absolutes)
**Severity:** 0 (linguistic marker)
**Use:** Correlate with gaslighting patterns

#### Emotional Dysregulation
**Manic Indicators:**
- "brilliant idea", "I can solve everything"
- Pressured speech, grandiosity

**Depressive Indicators:**
- "What's the point", "It will never get better"
- "I'm a failure", "I can't do anything right"

**Tool:** TextBlob (sentiment analysis) + Pattern Analyzer + NLTK (detect emotional language)
**Severity:** 0 (psychological marker)
**Use:** Track mood cycles, correlate with abuse patterns

---

## NLP Tool Assignment Matrix

| Pattern Type | Primary Tool | Secondary Tool | Tertiary Tool | Purpose |
|--------------|--------------|----------------|---------------|---------|
| **Gaslighting** | Pattern Analyzer | NLTK VADER | TextBlob | Keyword match + sentiment |
| **Blame Shifting** | Pattern Analyzer | NLTK (pronouns) | spaCy (syntax) | Detect accusatory language |
| **Minimizing** | Pattern Analyzer | TextBlob | - | Dismissive phrases + tone |
| **Circular Arguments** | Pattern Analyzer | spaCy (syntax) | - | Topic shifts, incomplete |
| **Contradiction** | Pattern Analyzer | LangChain Memory | Neo4j | Cross-document analysis |
| **Substance (alcohol)** | Pattern Analyzer | spaCy (NER) | - | Keyword + entity extraction |
| **Substance (weaponized)** | Pattern Analyzer | NLTK VADER | - | Hostile keywords |
| **Adderall Control** | Pattern Analyzer | spaCy (syntax) | - | Control language detection |
| **Infidelity (places)** | spaCy (NER) | - | - | Location entity extraction |
| **Infidelity (general)** | Pattern Analyzer | TextBlob | - | Defensive denials |
| **Financial (weaponized)** | Pattern Analyzer | NLTK (pronouns) | TextBlob | Accusatory + hostile |
| **Love Bombing** | Pattern Analyzer | TextBlob | Sentence Transformers | Excessive positivity |
| **Sexual Shaming** | Pattern Analyzer | NLTK VADER | Hurtlex | Offensive language |
| **Parental Alienation** | Priority Screener | Pattern Analyzer | spaCy (NER) | IMMEDIATE flagging |
| **Autism Weaponization** | Priority Screener | Pattern Analyzer | spaCy (medical NER) | IMMEDIATE flagging |
| **Pronoun Usage** | NLTK (POS) | spaCy | - | Statistical analysis |
| **Certainty Absolutes** | Pattern Analyzer | NLTK | - | Linguistic markers |
| **Emotional Dysregulation** | TextBlob | Pattern Analyzer | NLTK | Mood tracking |

---

## Database Schema Mapping

### Table: `behavioralPatterns`

```sql
CREATE TABLE behavioralPatterns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,  -- 'gaslighting', 'blame_shifting', etc.
  pattern TEXT NOT NULL,            -- The actual phrase/keyword
  description TEXT,
  severity INT DEFAULT 5 NOT NULL,  -- 1-10
  mclFactors TEXT,                  -- JSON array of MCL factors
  examples TEXT,                    -- JSON array of example sentences
  isActive ENUM('true','false') DEFAULT 'true' NOT NULL,
  isCustom ENUM('true','false') DEFAULT 'false' NOT NULL,
  matchCount INT DEFAULT 0 NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
);
```

### Import Strategy

For each pattern category:
1. **Category** = `gaslighting`, `blame_shifting`, `minimizing`, etc.
2. **Pattern** = Individual phrase (e.g., "i never said that")
3. **Severity** = Based on category (gaslighting=7-9, minimizing=5-7, etc.)
4. **MCL Factors** = JSON array (e.g., `["k", "manipulation"]`)
5. **Examples** = JSON array of full sentences showing pattern in context
6. **isCustom** = `'true'` (these are user-specific patterns)

---

## Multi-Pass Architecture (Corrected)

### **Pass 0: Priority Screener**
**Purpose:** IMMEDIATE flagging of custody/alienation
**Tools:** Regex pattern matching ONLY
**Patterns:**
- Parental alienation
- Child name mentions (Kailah/Kyla)
- Call/visit blocking
- Custody interference

**Output:** Priority flags with severity 8-10

---

### **Pass 1: Pattern Analyzer (Custom Patterns)**
**Purpose:** Match ALL custom patterns from database
**Tools:** Pattern Analyzer (loads user patterns from DB)
**Patterns:** ALL categories from analysis library
**Output:** 
- Negative matches (gaslighting, blame shifting, etc.)
- Positive matches (love bombing, apologies)
- MCL factors
- Confidence scores

---

### **Pass 2: spaCy (Structure & Entities)**
**Purpose:** Linguistic structure, entity extraction, speaker attribution
**Tools:** spaCy NLP pipeline
**Analysis:**
- Sentence segmentation
- Named entity recognition (people, places, organizations)
- Part-of-speech tagging
- Dependency parsing
- Speaker attribution (WHO said it)

**Output:**
- Entities (person names, locations, dates)
- Sentence structure
- Speaker identity
- Pronouns (I vs you counts)

---

### **Pass 3: NLTK VADER (Sentiment + Negation)**
**Purpose:** Sentiment analysis, negation handling
**Tools:** NLTK VADER lexicon
**Analysis:**
- Sentiment polarity (-1 to +1)
- Negation detection ("not good" vs "good")
- Intensity modifiers ("very", "extremely")

**Output:**
- Sentiment label (positive/negative/neutral)
- Polarity score
- Negation detected (boolean)
- Intensity modifiers (list)

---

### **Pass 4: TextBlob (Polarity + Subjectivity + Sarcasm)**
**Purpose:** Detect sarcasm, measure subjectivity
**Tools:** TextBlob
**Analysis:**
- Polarity (-1 to +1)
- Subjectivity (0 to 1)
- Sarcasm detection (high subjectivity + contradictory polarity)

**Output:**
- Polarity score
- Subjectivity score
- Sarcasm detected (boolean)

---

### **Pass 5: Sentence Transformers (Semantic Similarity)**
**Purpose:** Find semantically similar phrases to known patterns
**Tools:** Sentence Transformers (embedding model)
**Analysis:**
- Generate embedding for input text
- Compare to embeddings of known abuse patterns
- Find semantic matches (even if wording is different)

**Output:**
- Semantic matches (pattern name + similarity score)

---

### **Pass 6: Aggregation (Consensus)**
**Purpose:** Combine all signals into final classification
**Analysis:**
- Consensus sentiment (majority vote from all tools)
- Severity computation (pattern matches + sentiment + priority flags)
- Confidence score (agreement across tools)

**Output:**
- Final sentiment label
- Final severity (1-10)
- Confidence score (0-1)
- All source signals preserved

---

## What We Built vs What We Need

### ✅ **What's Correct:**
1. Priority Screener (Pass 0) - immediate custody/alienation flagging
2. Multi-pass architecture concept
3. Database schema for custom patterns
4. Pattern Analyzer integration

### ❌ **What's Wrong:**
1. **Custom patterns NOT imported** - database is empty
2. **Multi-pass classifier calls tools incorrectly** - not using each tool's strengths
3. **No Hurtlex integration** - sexual shaming detection missing
4. **No contradiction detection** - cross-document analysis not implemented
5. **No statistical analysis** - pronoun counting, linguistic markers missing

---

## Action Plan

### Phase 1: Import Custom Patterns
1. Parse analysis library (handle escaped brackets, UTF-8 issues)
2. Create seed script for `behavioralPatterns` table
3. Import ALL patterns with correct categories, severities, MCL factors
4. Verify import with pattern count queries

### Phase 2: Fix Multi-Pass Classifier
1. **Pass 1:** Load user patterns from DB, run Pattern Analyzer
2. **Pass 2:** Run spaCy for entities, structure, speaker attribution
3. **Pass 3:** Run NLTK VADER for sentiment, negation
4. **Pass 4:** Run TextBlob for polarity, subjectivity, sarcasm
5. **Pass 5:** Run Sentence Transformers for semantic similarity
6. **Pass 6:** Aggregate all signals, compute final classification

### Phase 3: Add Missing Tools
1. Integrate Hurtlex for offensive language detection
2. Add pronoun counting (NLTK POS tagging)
3. Add linguistic marker detection (certainty absolutes)
4. Add contradiction detection framework (for meta-analysis later)

### Phase 4: Test & Validate
1. Create test cases with real message examples
2. Verify priority flags trigger correctly
3. Verify custom patterns match
4. Verify multi-tool consensus works
5. Verify severity scoring is accurate

---

## Next Steps

**STOP CODING. DISCUSS WITH USER:**
1. Confirm this architecture is correct
2. Confirm pattern categories match expectations
3. Confirm NLP tool assignments make sense
4. Get approval to proceed with import + refactor

**DO NOT write more code until user confirms this plan.**
