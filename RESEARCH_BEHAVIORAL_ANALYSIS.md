# Behavioral Analysis Tool - Research Findings

## Tool Naming Options

Based on research of existing tools in this space:

| Tool Name | Used By | Focus |
|-----------|---------|-------|
| PatternProof | PatternProofAI | Pattern detection + evidence |
| Gaslighting Check | gaslightingcheck.com | Manipulation detection |
| Communication Analyzer | Generic | Neutral term |
| Behavioral Evidence Analysis | FBI/Forensic | Formal forensic term |

### Recommended Names for Our Tool:

1. **Communication Pattern Analyzer** - Neutral, professional
2. **Relational Dynamics Analyzer** - Academic/clinical feel
3. **Behavioral Evidence Detector** - Forensic/legal focus
4. **Pattern Evidence Analyzer** - Combines pattern + evidence
5. **Discourse Analysis Engine** - Technical/NLP focused

**Selected: "Communication Pattern Analyzer"** - Professional, neutral, covers both positive and negative patterns.

---

## Detection Module Taxonomy

### NEGATIVE PATTERN MODULES (Harmful Behaviors)

Based on PatternProof, GaslightingCheck, and clinical literature:

| Module ID | Module Name | Description | Key Indicators |
|-----------|-------------|-------------|----------------|
| `gaslighting` | Gaslighting | Reality denial, memory questioning | "That never happened", "You're imagining things", "You're too sensitive" |
| `darvo` | DARVO | Deny, Attack, Reverse Victim/Offender | Deflection, counter-accusations, playing victim |
| `projection` | Projection | Accusing others of own behaviors | Accusations that match accuser's behavior |
| `guilt_trip` | Guilt-Tripping | Inducing guilt for control | "After everything I've done", "You don't care about me" |
| `boundary_violation` | Boundary Violations | Ignoring stated limits | Intrusion, interrogation, schedule manipulation |
| `triangulation` | Triangulation | Using third parties to manipulate | "Everyone thinks you're...", bringing others into conflicts |
| `stonewalling` | Stonewalling | Silent treatment, withdrawal | Refusal to engage, ignoring messages |
| `threats` | Threats & Intimidation | Explicit or implied threats | Legal threats, custody threats, financial threats |
| `word_salad` | Word Salad | Circular, confusing communication | Topic shifting, contradictions, non-sequiturs |
| `minimization` | Minimization | Downplaying harm/concerns | "It wasn't that bad", "You're overreacting" |
| `blame_shift` | Blame Shifting | Redirecting responsibility | "You made me do this", "If you hadn't..." |
| `isolation` | Isolation Tactics | Separating from support | Criticizing friends/family, limiting contact |
| `financial_control` | Financial Control | Money as weapon | Withholding funds, demanding accounting |
| `parental_alienation` | Parental Alienation | Undermining other parent | Badmouthing, schedule sabotage, loyalty conflicts |

### POSITIVE PATTERN MODULES (For Contradiction Detection)

Critical for identifying manipulation cycles (idealize → devalue → discard):

| Module ID | Module Name | Description | Key Indicators |
|-----------|-------------|-------------|----------------|
| `love_bombing` | Love Bombing | Excessive affection/attention | Over-the-top compliments, constant contact, premature intimacy |
| `future_faking` | Future Faking | False promises of future | "When we...", "I promise I'll...", unrealistic plans |
| `hoovering` | Hoovering | Sucking back in after conflict | Apologies, gifts, sudden kindness after abuse |
| `intermittent_reinforcement` | Intermittent Reinforcement | Unpredictable rewards | Random kindness amid abuse, keeping off-balance |
| `affirmations` | Genuine Affirmations | Positive statements (baseline) | Compliments, appreciation, support |
| `apologies` | Apologies | Sorry statements | "I'm sorry", acknowledgment of harm |
| `promises` | Promises & Commitments | Future commitments | "I will...", "I promise..." |
| `gratitude` | Expressions of Gratitude | Thank you statements | Appreciation, acknowledgment |

---

## Detection Methods (from research)

### 1. Dictionary-Based (HurtLex + Custom)
- Predefined lists of words/phrases
- Weighted scores based on severity
- Good for known patterns, struggles with context

### 2. Machine Learning (BERT/Transformers)
- Supervised learning on labeled conversations
- NLP for contextual understanding
- Adapts to new patterns over time

### 3. Sentiment Analysis
- Emotional tone tracking
- Temporal emotion shifts
- Identifies destabilizing patterns (affection → criticism cycles)

---

## Module Selection UI Design

```
┌─────────────────────────────────────────────────────────────┐
│ Communication Pattern Analyzer                               │
├─────────────────────────────────────────────────────────────┤
│ ☑ NEGATIVE PATTERNS                                         │
│   ☑ Gaslighting          ☑ DARVO           ☑ Projection    │
│   ☑ Guilt-Tripping       ☑ Boundary Viol.  ☑ Triangulation │
│   ☑ Stonewalling         ☑ Threats         ☑ Word Salad    │
│   ☑ Minimization         ☑ Blame Shifting  ☐ Isolation     │
│   ☐ Financial Control    ☐ Parental Alien.                  │
├─────────────────────────────────────────────────────────────┤
│ ☑ POSITIVE PATTERNS (for contradiction analysis)            │
│   ☑ Love Bombing         ☑ Future Faking   ☑ Hoovering     │
│   ☑ Intermittent Reinf.  ☑ Affirmations    ☐ Apologies     │
│   ☐ Promises             ☐ Gratitude                        │
├─────────────────────────────────────────────────────────────┤
│ ☑ SEVERITY SCORING (MCL 722.23 mapping)                     │
│ ☑ TIMELINE GENERATION                                       │
│ ☑ CONTRADICTION DETECTION                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Contradiction Detection Logic

For meta-analysis, track:
1. **Positive → Negative Reversals**: "I love you" followed by "I never loved you"
2. **Promise → Broken**: "I'll pick up the kids" followed by no-show
3. **Affirmation → Devaluation**: "You're amazing" followed by "You're worthless"
4. **Apology → Repeat**: "I'm sorry, I won't do it again" followed by same behavior

This creates evidence of the manipulation cycle pattern.

---

## Implementation Priority

1. Database schema for modules and patterns
2. Module registry with enable/disable
3. Dictionary-based detection (HurtLex + custom)
4. Positive pattern detection (love bombing, etc.)
5. Contradiction detection engine
6. Timeline visualization
7. Severity scoring with legal mapping
