# Expanded Pattern Library
## Research-Backed Additions to Analysis Library

Based on forensic communication research and NLP best practices, here are additional pattern categories to detect:

---

## 1. **Overelaboration / Microregulation Compliance**
**Source:** Linguistic Indicators of Coercive Control (Pomerantz et al., 2021)

**Description:** Victims of coercive control exhibit "discursive overelaboration" - providing excessive, unsolicited details about location, activity, and timing to justify their actions as work-relevant or acceptable.

**Detection Strategy:**
- **Linguistic markers:**
  - Excessive use of location details ("I'm at X, I'll be at Y in 10 minutes, then heading to Z")
  - Time-stamping behavior ("It's 3:15pm now, I left at 2:45pm, I'll be back by 4:00pm")
  - Justification phrases ("I'm doing this because...", "I had to...", "I needed to...")
  - Pre-emptive explanations (answering questions that weren't asked)

**NLP Tools:**
- **spaCy:** Extract location entities, time entities
- **NLTK:** Count justification phrases, measure sentence length (overelaboration = longer sentences)
- **Pattern Analyzer:** Detect pre-emptive explanation patterns

**Patterns to add:**
```json
{
  "overelaboration": {
    "location_reporting": [
      "i'm at", "i'm still at", "i'm heading to", "i'll be at",
      "i'm on my way to", "i just left", "i just arrived at"
    ],
    "time_reporting": [
      "it's [time] now", "i left at", "i'll be back by",
      "i've been here since", "i'll be done in"
    ],
    "justification": [
      "i'm doing this because", "i had to", "i needed to",
      "the reason is", "i'm just", "i was just"
    ],
    "pre_emptive": [
      "before you ask", "i know you're wondering",
      "just so you know", "for the record", "to be clear"
    ]
  }
}
```

**Severity:** 7-8 (indicates fear-based compliance)
**MCL Factor:** k (coercive control)

---

## 2. **Positive Manipulation Patterns** (Expanded)

### 2a. **Excessive Gratitude / Indebtedness**
**Description:** Creating obligation through exaggerated expressions of gratitude or reminders of past favors.

**Patterns:**
```json
{
  "excessive_gratitude": [
    "i owe you everything", "i could never repay you",
    "i don't deserve you", "you've done so much for me",
    "i'm so grateful", "thank you for everything",
    "i don't know what i'd do without you",
    "you saved me", "i owe you my life"
  ],
  "debt_reminders": [
    "remember when i", "after all i've done",
    "i was there for you when", "don't forget i",
    "i helped you", "i gave you"
  ]
}
```

**Tool:** Pattern Analyzer + TextBlob (detect excessive positivity)
**Severity:** 6-7 (context-dependent)
**MCL Factor:** Emotional manipulation

### 2b. **Premature Intimacy / Boundary Violation**
**Description:** Rushing emotional intimacy, sharing secrets too early, creating false sense of closeness.

**Patterns:**
```json
{
  "premature_intimacy": [
    "i've never told anyone this", "you're the only one who knows",
    "i feel like i've known you forever", "we have such a deep connection",
    "i can tell you anything", "you get me like no one else",
    "we're so alike", "it's like we're the same person"
  ],
  "boundary_testing": [
    "can i ask you something personal", "this might be too much but",
    "i know we just met but", "i don't usually do this but"
  ]
}
```

**Tool:** Pattern Analyzer + Sentence Transformers (semantic similarity to known boundary violations)
**Severity:** 5-7
**MCL Factor:** Manipulation, grooming

### 2c. **Mirroring / Agreement Bombing**
**Description:** Excessive agreement, adopting victim's interests/opinions, creating false compatibility.

**Patterns:**
```json
{
  "mirroring": [
    "i love that too", "me too", "same here", "exactly",
    "i was just thinking that", "we think the same way",
    "i agree with everything you said", "you took the words out of my mouth"
  ],
  "interest_adoption": [
    "i've always wanted to try that", "i'm really into that too",
    "that's my favorite", "i love [thing you mentioned]"
  ]
}
```

**Tool:** NLTK (count agreement phrases) + Pattern Analyzer
**Severity:** 4-6
**MCL Factor:** False compatibility, manipulation

### 2d. **Protective Savior Complex**
**Description:** Positioning self as protector/savior, creating dependency.

**Patterns:**
```json
{
  "savior_complex": [
    "i'll protect you", "i'll keep you safe", "i won't let anyone hurt you",
    "you need me", "i'll take care of you", "i'll fix this",
    "let me handle it", "i'll make it better", "trust me to protect you"
  ],
  "world_as_dangerous": [
    "everyone else will hurt you", "the world is dangerous",
    "you can't trust anyone but me", "they're all out to get you",
    "i'm the only one who cares"
  ]
}
```

**Tool:** Pattern Analyzer + spaCy (detect protective language)
**Severity:** 7-9
**MCL Factor:** Isolation, dependency creation

---

## 3. **Linguistic Markers** (Research-Backed)

### 3a. **Power Asymmetry Indicators**
**Source:** Pomerantz et al. (2021) - Coercive control research

**Detection:**
- **Victim linguistic patterns:**
  - Longer, more elaborate responses
  - Frequent justifications
  - Deferential language ("if that's okay", "if you don't mind")
  - Apologetic tone ("sorry", "my bad", "i didn't mean to")
  
- **Abuser linguistic patterns:**
  - Short, directive statements
  - Questions demanding accountability ("where are you", "what are you doing")
  - Imperatives ("do this", "go there", "stop that")
  - Lack of justification (no need to explain)

**NLP Tools:**
- **NLTK:** Sentence length analysis, question type detection
- **spaCy:** Imperative detection (verb-first sentences)
- **TextBlob:** Apologetic tone detection

**Patterns:**
```json
{
  "victim_deference": [
    "if that's okay", "if you don't mind", "is that alright",
    "sorry", "my bad", "i didn't mean to", "i apologize",
    "i hope that's fine", "let me know if"
  ],
  "abuser_directives": [
    "where are you", "what are you doing", "who are you with",
    "come here", "go there", "do this", "stop that",
    "tell me", "show me", "prove it"
  ]
}
```

**Severity:** 8-10 (strong indicator of coercive control)
**MCL Factor:** k (power imbalance)

### 3b. **Interruption Patterns**
**Source:** Anderson & Leaper (1998) - Gender and power in conversation

**Detection:** In multi-party conversations, track who interrupts whom.
- Abusers interrupt victims more frequently
- Victims rarely interrupt abusers
- Victims complete abuser's sentences (compliance)

**NLP Tools:**
- **spaCy:** Sentence boundary detection, incomplete sentences
- **Custom analysis:** Track speaker turns, interruption frequency

**Implementation:** Requires conversation-level analysis (not single message)

---

## 4. **Temporal Pattern Detection**

### 4a. **Cycle of Abuse Markers**
**Description:** Detect the cycle: tension building → incident → reconciliation → calm

**Linguistic markers by phase:**

**Tension Building:**
- Increased criticism
- Passive-aggressive language
- Withdrawal ("fine", "whatever")
- Victim walking on eggshells (overelaboration increases)

**Incident:**
- Explosive language
- Threats
- Blame shifting
- Gaslighting

**Reconciliation (Honeymoon):**
- Love bombing
- Apologies
- Promises to change
- Future faking

**Calm:**
- Normal conversation
- Reduced manipulation language
- False sense of safety

**NLP Tools:**
- **LangChain Memory:** Track sentiment over time
- **Neo4j:** Map temporal relationships between message types
- **Pattern Analyzer:** Detect phase-specific patterns

**Implementation:** Requires timeline analysis (not single message)

### 4b. **Escalation Detection**
**Description:** Track severity increase over time.

**Indicators:**
- Frequency of abusive language increases
- Severity of threats increases
- Isolation tactics intensify
- Financial control tightens

**NLP Tools:**
- **LangChain Memory:** Track severity scores over time
- **Statistical analysis:** Compute trend lines

---

## 5. **Context-Specific Patterns**

### 5a. **Medical Abuse / Weaponization**
**Description:** Using medical conditions, medications, or treatment as control mechanism.

**Patterns:**
```json
{
  "medical_control": [
    "you need your meds", "did you take your pills",
    "you're not thinking clearly", "it's the medication talking",
    "you can't make decisions", "you're not well enough",
    "i'm holding your meds", "you can't be trusted with"
  ],
  "diagnosis_weaponization": [
    "you're bipolar", "you're borderline", "you're schizophrenic",
    "that's your [condition] talking", "you're having an episode",
    "you need to be hospitalized", "you're unstable"
  ]
}
```

**Tool:** Pattern Analyzer + spaCy (medical entity extraction)
**Severity:** 9-10
**MCL Factor:** Medical abuse

### 5b. **Pregnancy / Reproductive Coercion**
**Description:** Controlling reproductive choices, pregnancy as manipulation.

**Patterns:**
```json
{
  "reproductive_coercion": [
    "i want you pregnant", "you should get pregnant",
    "stop taking birth control", "i'll get you pregnant",
    "you can't leave if you're pregnant", "a baby will fix us",
    "you owe me a child", "i sabotaged your birth control"
  ],
  "pregnancy_weaponization": [
    "i'll take the baby", "you'll never see the baby",
    "i'll prove you're unfit", "you're a bad mother",
    "the baby doesn't need you"
  ]
}
```

**Tool:** Pattern Analyzer + Priority Screener (HIGH severity)
**Severity:** 10
**MCL Factor:** Reproductive coercion

---

## 6. **Utilities Folder Integration**

### Tools We're Missing:

1. **Text Miner (ugrep/ripgrep)**
   - **Use:** Fast pattern search across large document sets
   - **Integration:** Use for bulk pattern matching before detailed NLP analysis
   - **Benefit:** Pre-filter documents, find all instances of specific phrases

2. **NotebookLM Client**
   - **Use:** Generate audio summaries, create study guides from evidence
   - **Integration:** Create forensic report summaries for court
   - **Benefit:** Convert technical analysis to accessible format

3. **Mem0 (Long-term Memory)**
   - **Use:** Persistent project context storage
   - **Integration:** Store case background, participant info, ongoing hypotheses
   - **Benefit:** Maintain context across sessions (not just 72hr TTL)

4. **N8n Workflows**
   - **Use:** Automate evidence processing pipelines
   - **Integration:** Trigger analysis when new documents uploaded
   - **Benefit:** Hands-free processing

5. **ML Plugin (Custom Models)**
   - **Use:** Train custom classifiers on your specific patterns
   - **Integration:** Fine-tune models on your 200-hour library
   - **Benefit:** Better accuracy than generic NLP

6. **Summarization Plugin**
   - **Use:** Generate executive summaries of conversations
   - **Integration:** Summarize long message threads
   - **Benefit:** Quick overview for investigators

7. **Evidence Hasher**
   - **Use:** Create cryptographic hashes of evidence
   - **Integration:** Chain of custody verification
   - **Benefit:** Prove evidence hasn't been tampered with

8. **Format Converter**
   - **Use:** Convert between document formats
   - **Integration:** Normalize all inputs to common format
   - **Benefit:** Handle PDF, DOCX, HTML, etc. uniformly

---

## 7. **Statistical Linguistic Markers**

### 7a. **Pronoun Ratio Analysis**
**Research:** High "I" usage correlates with narcissism, high "you" usage correlates with blame projection.

**Implementation:**
```python
def analyze_pronouns(text):
    i_count = count_pronouns(text, ['i', 'me', 'my', 'mine', 'myself'])
    you_count = count_pronouns(text, ['you', 'your', 'yours', 'yourself'])
    
    i_ratio = i_count / total_words
    you_ratio = you_count / total_words
    
    if i_ratio > 0.08:  # High I-talk
        flags.append('narcissistic_language')
    if you_ratio > 0.12:  # High you-talk
        flags.append('blame_projection')
```

**Tool:** NLTK POS tagging + custom analysis

### 7b. **Hedge Words / Certainty Analysis**
**Research:** Abusers use more certainty language ("always", "never"), victims use more hedge words ("maybe", "perhaps").

**Patterns:**
```json
{
  "certainty_absolutes": [
    "always", "never", "nothing", "everything", "everyone",
    "nobody", "fact", "obviously", "clearly", "literally"
  ],
  "hedge_words": [
    "maybe", "perhaps", "possibly", "might", "could",
    "i think", "i guess", "sort of", "kind of", "probably"
  ]
}
```

**Tool:** Pattern Analyzer + statistical analysis

---

## Action Items

1. **Import all patterns to database** (existing + expanded)
2. **Wire Text Miner** for bulk pattern search
3. **Wire Mem0** for persistent project context
4. **Wire Evidence Hasher** for chain of custody
5. **Implement pronoun ratio analysis** (NLTK)
6. **Implement overelaboration detection** (sentence length + justification phrases)
7. **Implement temporal analysis** (LangChain Memory + Neo4j)
8. **Create custom ML models** (fine-tune on your patterns)

---

## Priority Order

### **Immediate (Phase 1):**
1. Import existing + expanded patterns to database
2. Fix multi-pass classifier to use tools correctly
3. Add overelaboration detection
4. Add positive manipulation patterns

### **Short-term (Phase 2):**
5. Wire Text Miner for bulk search
6. Wire Evidence Hasher for chain of custody
7. Implement pronoun ratio analysis
8. Implement temporal analysis framework

### **Long-term (Phase 3):**
9. Wire Mem0 for persistent context
10. Train custom ML models
11. Build full cycle-of-abuse detector
12. Build escalation tracker

---

**STOP. Present this to user for approval before implementing.**
