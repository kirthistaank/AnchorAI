// ============================================================================
// NEO4J CBT FRAMEWORK LOADER
// ============================================================================
// Purpose: Load cognitive distortions, coping strategies, and CBT structures
// into Neo4j for the wellness agent to reference
//
// Usage: Copy and paste into Neo4j Browser (http://localhost:7474)
// or run via: cypher-shell < neo4j_cbt_load.cypher
// ============================================================================

// ============================================================================
// 1. CREATE COGNITIVE DISTORTION NODES
// ============================================================================

CREATE (d1:CognitiveDistortion {
  id: "all_or_nothing",
  name: "All-or-Nothing Thinking",
  definition: "Viewing situations in black/white categories with no middle ground",
  example: "I made one mistake on the presentation, so I'm a total failure",
  manifestation: "Perfectionism, harsh self-judgment",
  severity: "high"
})

CREATE (d2:CognitiveDistortion {
  id: "catastrophizing",
  name: "Catastrophizing",
  definition: "Assuming the worst will happen or that current situation is unbearable",
  example: "My boss didn't smile at me, I'm getting fired",
  manifestation: "Anxiety, panic, hypervigilance",
  severity: "high"
})

CREATE (d3:CognitiveDistortion {
  id: "mind_reading",
  name: "Mind Reading",
  definition: "Believing you know what others think without evidence",
  example: "They think I'm boring",
  manifestation: "Social anxiety, self-consciousness",
  severity: "high"
})

CREATE (d4:CognitiveDistortion {
  id: "should_statements",
  name: "Should Statements",
  definition: "Using rigid rules (should, must, ought) about self and others",
  example: "I should be able to work 12 hours a day without getting tired",
  manifestation: "Guilt, resentment, burnout",
  severity: "high"
})

CREATE (d5:CognitiveDistortion {
  id: "personalization",
  name: "Personalization",
  definition: "Assuming you caused events outside your control or taking criticism too personally",
  example: "My friend didn't text back, it must be something I did",
  manifestation: "Guilt, shame, anxiety",
  severity: "high"
})

CREATE (d6:CognitiveDistortion {
  id: "overgeneralization",
  name: "Overgeneralization",
  definition: "Taking one negative event and treating it as never-ending pattern",
  example: "I bombed that interview, I'll never get a job",
  manifestation: "Hopelessness, giving up",
  severity: "high"
})

CREATE (d7:CognitiveDistortion {
  id: "emotional_reasoning",
  name: "Emotional Reasoning",
  definition: "Treating feelings as facts",
  example: "I feel like a failure, therefore I am a failure",
  manifestation: "Low mood, paralysis",
  severity: "high"
})

CREATE (d8:CognitiveDistortion {
  id: "jumping_to_conclusions",
  name: "Jumping to Conclusions",
  definition: "Making conclusions without sufficient evidence",
  example: "They probably hate me",
  manifestation: "Anxiety, social withdrawal",
  severity: "high"
})

CREATE (d9:CognitiveDistortion {
  id: "labeling",
  name: "Labeling",
  definition: "Using single negative characteristic to define entire identity",
  example: "Made a social mistake, therefore I'm socially awkward",
  manifestation: "Low self-esteem, avoidance",
  severity: "medium"
})

CREATE (d10:CognitiveDistortion {
  id: "comparison",
  name: "Comparison",
  definition: "Comparing yourself unfavorably to others",
  example: "Everyone else has their life together, I'm the only one struggling",
  manifestation: "Inadequacy, envy, low mood",
  severity: "medium"
})

CREATE (d11:CognitiveDistortion {
  id: "mental_filter",
  name: "Mental Filter",
  definition: "Filtering out all positive evidence and focusing only on negatives",
  example: "Got 19/20 on test but only thinks about the one wrong answer",
  manifestation: "Low self-esteem, missing positive feedback",
  severity: "medium"
})

CREATE (d12:CognitiveDistortion {
  id: "discounting_positive",
  name: "Discounting the Positive",
  definition: "Dismissing positive experiences as exceptions or flukes",
  example: "They only complimented my work because they felt sorry for me",
  manifestation: "Imposter syndrome, not internalizing success",
  severity: "medium"
})

CREATE (d13:CognitiveDistortion {
  id: "magnification",
  name: "Magnification/Minimization",
  definition: "Exaggerating importance of negatives or shrinking importance of positives",
  example: "Small mistake = disaster; big achievement = no big deal",
  manifestation: "Anxiety, low mood",
  severity: "medium"
})

CREATE (d14:CognitiveDistortion {
  id: "awfulizing",
  name: "Awfulizing",
  definition: "Viewing situations as terrible or awful beyond actual severity",
  example: "This is the worst thing that could ever happen",
  manifestation: "Despair, overwhelm",
  severity: "high"
})

CREATE (d15:CognitiveDistortion {
  id: "what_ifs",
  name: "What-Ifs",
  definition: "Endless chain of anxious what if questions",
  example: "What if I have a panic attack? What if I can't handle it?",
  manifestation: "Anxiety loops, avoidance",
  severity: "high"
})

CREATE (d16:CognitiveDistortion {
  id: "rejection_sensitivity",
  name: "Rejection Sensitivity",
  definition: "Expecting rejection and interpreting neutral social cues as rejection",
  example: "They probably hate me, no one wants to spend time with me",
  manifestation: "Social withdrawal, anxiety, low self-worth",
  severity: "medium"
})

CREATE (d17:CognitiveDistortion {
  id: "false_responsibility",
  name: "False Responsibility",
  definition: "Assuming responsibility for others' feelings or outcomes",
  example: "My parent is sad, it's my job to fix it",
  manifestation: "Guilt, anxiety, over-functioning",
  severity: "high"
})

CREATE (d18:CognitiveDistortion {
  id: "helplessness",
  name: "Helplessness/Hopelessness",
  definition: "Believing you have no control and nothing will change",
  example: "There's no point trying, it won't matter",
  manifestation: "Depression, giving up, learned helplessness",
  severity: "high"
})

CREATE (d19:CognitiveDistortion {
  id: "perfectionism",
  name: "Perfectionism",
  definition: "Setting unrealistic standards and treating anything less as failure",
  example: "One typo in email = I'm not good at writing",
  manifestation: "Anxiety, procrastination, burnout",
  severity: "high"
})

CREATE (d20:CognitiveDistortion {
  id: "rumination",
  name: "Rumination",
  definition: "Repetitive, circular thinking about problems without resolution",
  example: "Going over an embarrassing moment 100 times",
  manifestation: "Anxiety, depression, insomnia",
  severity: "medium"
})

// ============================================================================
// 2. CREATE COPING STRATEGY NODES
// ============================================================================

CREATE (c1:CopingStrategy {
  id: "backyard_walk",
  name: "Mini Walk in Backyard",
  description: "Take a 5-20 minute walk in your backyard to clear your mind",
  category: "Physical Activity",
  personal: true,
  effectiveness_rating: 9
})

CREATE (c2:CopingStrategy {
  id: "yoga_30min",
  name: "30-Minute Yoga Session",
  description: "Gentle yoga practice that grounds and regulates emotions",
  category: "Physical Activity",
  personal: true,
  effectiveness_rating: 9
})

CREATE (c3:CopingStrategy {
  id: "gardening_water",
  name: "Gardening - Water Plants & Tend Garden",
  description: "Water your plants, observe them growing, talk to them. Connects you to growth and nature",
  category: "Physical Activity",
  personal: true,
  effectiveness_rating: 8
})

CREATE (c4:CopingStrategy {
  id: "talk_to_husband",
  name: "Talk to Your Supportive Husband",
  description: "Lean on his emotional support and presence",
  category: "Social Connection",
  personal: true,
  effectiveness_rating: 10
})

CREATE (c5:CopingStrategy {
  id: "gratitude_husband",
  name: "Practice Gratitude for Your Husband",
  description: "Actively acknowledge his support and presence in your life",
  category: "Gratitude/Reflection",
  personal: true,
  effectiveness_rating: 9
})

CREATE (c6:CopingStrategy {
  id: "talk_plants",
  name: "Talk to Your Plants While Caring for Them",
  description: "Express care and gratitude to your plants while watering/tending them",
  category: "Social Connection",
  personal: true,
  effectiveness_rating: 8
})

CREATE (c7:CopingStrategy {
  id: "backyard_view",
  name: "Watch Your Backyard View",
  description: "Sit and observe the natural beauty of your backyard view. Brings calm and perspective",
  category: "Environment/Sensory",
  personal: true,
  effectiveness_rating: 8
})

CREATE (c8:CopingStrategy {
  id: "light_candle",
  name: "Light a Candle in the Evening",
  description: "Create warmth, comfort, and a calming ritual in the evening",
  category: "Environment/Sensory",
  personal: true,
  effectiveness_rating: 8
})

CREATE (c9:CopingStrategy {
  id: "observe_plants_grow",
  name: "Observe Plants Growing",
  description: "Watch your plants grow over time. Connects to growth, patience, and natural processes",
  category: "Reflection/Mindfulness",
  personal: true,
  effectiveness_rating: 8
})

CREATE (c10:CopingStrategy {
  id: "youtube_speakers",
  name: "Watch YouTube Videos from Favorite Speakers",
  description: "Absorbs attention and provides intellectual stimulation + inspiration",
  category: "Attention Shifting",
  personal: true,
  effectiveness_rating: 8
})

CREATE (c11:CopingStrategy {
  id: "reflect_positive_outcomes",
  name: "Reflect on Positive Outcomes",
  description: "Review how past struggles turned out okay, building confidence and perspective",
  category: "Reflection/Cognitive",
  personal: true,
  effectiveness_rating: 9
})

CREATE (c12:CopingStrategy {
  id: "gratitude_practice",
  name: "Practice Gratitude for What You Have",
  description: "Consciously acknowledge the good things in your life (supportive husband, beautiful backyard, time for self-care)",
  category: "Gratitude/Reflection",
  personal: true,
  effectiveness_rating: 9
})

CREATE (c13:CopingStrategy {
  id: "encouraging_words",
  name: "Give Yourself Encouraging Words",
  description: "Speak to yourself with kindness and affirmation, like your husband does for you",
  category: "Self-Talk",
  personal: true,
  effectiveness_rating: 8
})

CREATE (c14:CopingStrategy {
  id: "gentle_reflection",
  name: "Gentle Reflection & Mindfulness in Backyard",
  description: "Sit with your feelings in your backyard, watch nature, breathe",
  category: "Mindfulness",
  personal: true,
  effectiveness_rating: 8
})

// General coping strategies
CREATE (c15:CopingStrategy {
  id: "general_exercise",
  name: "Exercise or Workout",
  description: "Cardio, strength training, or other vigorous exercise",
  category: "Physical Activity",
  personal: false,
  effectiveness_rating: 8
})

CREATE (c16:CopingStrategy {
  id: "grounding_5_4_3_2_1",
  name: "5-4-3-2-1 Grounding Technique",
  description: "Notice 5 things you see, 4 things you hear, 3 things you touch, 2 things you smell, 1 thing you taste",
  category: "Grounding",
  personal: false,
  effectiveness_rating: 8
})

CREATE (c17:CopingStrategy {
  id: "thought_record",
  name: "Thought Record Technique",
  description: "Write down and analyze automatic thoughts using the CBT thought record structure",
  category: "Cognitive",
  personal: false,
  effectiveness_rating: 9
})

CREATE (c18:CopingStrategy {
  id: "reframing",
  name: "Reframing",
  description: "Look for helpful aspects of a difficult situation; consider realistic perspectives",
  category: "Cognitive",
  personal: false,
  effectiveness_rating: 8
})

CREATE (c19:CopingStrategy {
  id: "journal",
  name: "Journal About Feelings",
  description: "Write freely about your thoughts and emotions",
  category: "Reflection/Cognitive",
  personal: false,
  effectiveness_rating: 8
})

CREATE (c20:CopingStrategy {
  id: "breathing",
  name: "Practice Mindful Breathing",
  description: "Slow, intentional breathing to calm the nervous system",
  category: "Grounding/Mindfulness",
  personal: false,
  effectiveness_rating: 8
})

// ============================================================================
// 3. CREATE RELATIONSHIPS: DISTORTION -> COUNTERED_BY -> COPING_STRATEGY
// ============================================================================

MATCH (d:CognitiveDistortion {id: "catastrophizing"}), (c:CopingStrategy {id: "backyard_walk"})
CREATE (d)-[:COUNTERED_BY {strength: 9}]->(c)

MATCH (d:CognitiveDistortion {id: "catastrophizing"}), (c:CopingStrategy {id: "talk_plants"})
CREATE (d)-[:COUNTERED_BY {strength: 8}]->(c)

MATCH (d:CognitiveDistortion {id: "catastrophizing"}), (c:CopingStrategy {id: "encouraging_words"})
CREATE (d)-[:COUNTERED_BY {strength: 8}]->(c)

MATCH (d:CognitiveDistortion {id: "catastrophizing"}), (c:CopingStrategy {id: "grounding_5_4_3_2_1"})
CREATE (d)-[:COUNTERED_BY {strength: 8}]->(c)

MATCH (d:CognitiveDistortion {id: "all_or_nothing"}), (c:CopingStrategy {id: "reflect_positive_outcomes"})
CREATE (d)-[:COUNTERED_BY {strength: 9}]->(c)

MATCH (d:CognitiveDistortion {id: "all_or_nothing"}), (c:CopingStrategy {id: "talk_to_husband"})
CREATE (d)-[:COUNTERED_BY {strength: 9}]->(c)

MATCH (d:CognitiveDistortion {id: "all_or_nothing"}), (c:CopingStrategy {id: "yoga_30min"})
CREATE (d)-[:COUNTERED_BY {strength: 8}]->(c)

MATCH (d:CognitiveDistortion {id: "mind_reading"}), (c:CopingStrategy {id: "talk_to_husband"})
CREATE (d)-[:COUNTERED_BY {strength: 9}]->(c)

MATCH (d:CognitiveDistortion {id: "mind_reading"}), (c:CopingStrategy {id: "backyard_view"})
CREATE (d)-[:COUNTERED_BY {strength: 8}]->(c)

MATCH (d:CognitiveDistortion {id: "should_statements"}), (c:CopingStrategy {id: "yoga_30min"})
CREATE (d)-[:COUNTERED_BY {strength: 8}]->(c)

MATCH (d:CognitiveDistortion {id: "should_statements"}), (c:CopingStrategy {id: "gratitude_practice"})
CREATE (d)-[:COUNTERED_BY {strength: 8}]->(c)

MATCH (d:CognitiveDistortion {id: "should_statements"}), (c:CopingStrategy {id: "youtube_speakers"})
CREATE (d)-[:COUNTERED_BY {strength: 7}]->(c)

MATCH (d:CognitiveDistortion {id: "personalization"}), (c:CopingStrategy {id: "observe_plants_grow"})
CREATE (d)-[:COUNTERED_BY {strength: 8}]->(c)

MATCH (d:CognitiveDistortion {id: "personalization"}), (c:CopingStrategy {id: "reflect_positive_outcomes"})
CREATE (d)-[:COUNTERED_BY {strength: 9}]->(c)

MATCH (d:CognitiveDistortion {id: "overgeneralization"}), (c:CopingStrategy {id: "gardening_water"})
CREATE (d)-[:COUNTERED_BY {strength: 8}]->(c)

MATCH (d:CognitiveDistortion {id: "overgeneralization"}), (c:CopingStrategy {id: "reflect_positive_outcomes"})
CREATE (d)-[:COUNTERED_BY {strength: 9}]->(c)

MATCH (d:CognitiveDistortion {id: "emotional_reasoning"}), (c:CopingStrategy {id: "backyard_walk"})
CREATE (d)-[:COUNTERED_BY {strength: 8}]->(c)

MATCH (d:CognitiveDistortion {id: "emotional_reasoning"}), (c:CopingStrategy {id: "yoga_30min"})
CREATE (d)-[:COUNTERED_BY {strength: 8}]->(c)

MATCH (d:CognitiveDistortion {id: "emotional_reasoning"}), (c:CopingStrategy {id: "light_candle"})
CREATE (d)-[:COUNTERED_BY {strength: 7}]->(c)

MATCH (d:CognitiveDistortion {id: "jumping_to_conclusions"}), (c:CopingStrategy {id: "talk_to_husband"})
CREATE (d)-[:COUNTERED_BY {strength: 9}]->(c)

MATCH (d:CognitiveDistortion {id: "jumping_to_conclusions"}), (c:CopingStrategy {id: "backyard_walk"})
CREATE (d)-[:COUNTERED_BY {strength: 8}]->(c)

MATCH (d:CognitiveDistortion {id: "rejection_sensitivity"}), (c:CopingStrategy {id: "talk_to_husband"})
CREATE (d)-[:COUNTERED_BY {strength: 10}]->(c)

MATCH (d:CognitiveDistortion {id: "rejection_sensitivity"}), (c:CopingStrategy {id: "gratitude_husband"})
CREATE (d)-[:COUNTERED_BY {strength: 9}]->(c)

MATCH (d:CognitiveDistortion {id: "perfectionism"}), (c:CopingStrategy {id: "yoga_30min"})
CREATE (d)-[:COUNTERED_BY {strength: 8}]->(c)

MATCH (d:CognitiveDistortion {id: "perfectionism"}), (c:CopingStrategy {id: "reflect_positive_outcomes"})
CREATE (d)-[:COUNTERED_BY {strength: 8}]->(c)

MATCH (d:CognitiveDistortion {id: "rumination"}), (c:CopingStrategy {id: "backyard_walk"})
CREATE (d)-[:COUNTERED_BY {strength: 9}]->(c)

MATCH (d:CognitiveDistortion {id: "rumination"}), (c:CopingStrategy {id: "youtube_speakers"})
CREATE (d)-[:COUNTERED_BY {strength: 8}]->(c)

MATCH (d:CognitiveDistortion {id: "comparison"}), (c:CopingStrategy {id: "observe_plants_grow"})
CREATE (d)-[:COUNTERED_BY {strength: 8}]->(c)

MATCH (d:CognitiveDistortion {id: "comparison"}), (c:CopingStrategy {id: "gratitude_practice"})
CREATE (d)-[:COUNTERED_BY {strength: 9}]->(c)

// ============================================================================
// 4. CREATE CORE BELIEF NODES
// ============================================================================

CREATE (b1:CoreBelief {
  id: "not_good_enough",
  name: "I'm not good enough",
  description: "Fundamental belief that you don't meet standards",
  manifestations: ["Perfectionism", "Low self-esteem"],
  related_distortions: ["all_or_nothing", "labeling", "discounting_positive"]
})

CREATE (b2:CoreBelief {
  id: "must_be_perfect",
  name: "I must be perfect",
  description: "Unrealistic standard that anything less is failure",
  manifestations: ["Anxiety", "Procrastination"],
  related_distortions: ["perfectionism", "should_statements"]
})

CREATE (b3:CoreBelief {
  id: "unlovable",
  name: "I'm unlovable",
  description: "Belief that you are not worthy of love or connection",
  manifestations: ["Relationship issues", "Low self-worth"],
  related_distortions: ["personalization", "rejection_sensitivity"]
})

CREATE (b4:CoreBelief {
  id: "powerless",
  name: "I'm powerless/helpless",
  description: "Belief that you have no control over your life",
  manifestations: ["Depression", "Learned helplessness"],
  related_distortions: ["helplessness"]
})

CREATE (b5:CoreBelief {
  id: "must_please_everyone",
  name: "I must please everyone",
  description: "Belief that your worth depends on others' approval",
  manifestations: ["Boundary issues", "Burnout"],
  related_distortions: ["should_statements", "false_responsibility"]
})

// ============================================================================
// 5. CREATE THOUGHT RECORD TEMPLATE STRUCTURE
// ============================================================================

CREATE (tr:ThoughtRecordTemplate {
  id: "cbt_thought_record",
  name: "CBT Thought Record",
  description: "Standard CBT tool for analyzing and reframing thoughts",
  steps: ["Situation", "AutomaticThought", "Emotion", "Behavior", "Consequence", "EvidenceFor", "EvidenceAgainst", "AlternativeThought", "NewEmotion", "ActionPlan"],
  purpose: "Help identify and challenge unhelpful thought patterns"
})

// ============================================================================
// 6. CREATE RELATIONSHIPS: CORE_BELIEF -> MANIFESTS_AS -> THOUGHT_DISTORTION
// ============================================================================

MATCH (b:CoreBelief {id: "not_good_enough"}), (d:CognitiveDistortion {id: "all_or_nothing"})
CREATE (b)-[:MANIFESTS_AS {likelihood: 0.9}]->(d)

MATCH (b:CoreBelief {id: "must_be_perfect"}), (d:CognitiveDistortion {id: "perfectionism"})
CREATE (b)-[:MANIFESTS_AS {likelihood: 0.95}]->(d)

MATCH (b:CoreBelief {id: "unlovable"}), (d:CognitiveDistortion {id: "rejection_sensitivity"})
CREATE (b)-[:MANIFESTS_AS {likelihood: 0.85}]->(d)

MATCH (b:CoreBelief {id: "powerless"}), (d:CognitiveDistortion {id: "helplessness"})
CREATE (b)-[:MANIFESTS_AS {likelihood: 0.9}]->(d)

MATCH (b:CoreBelief {id: "must_please_everyone"}), (d:CognitiveDistortion {id: "should_statements"})
CREATE (b)-[:MANIFESTS_AS {likelihood: 0.8}]->(d)

// ============================================================================
// 7. CREATE USER NODE (placeholder for your data)
// ============================================================================

CREATE (user:User {
  id: "kirthi_001",
  name: "Kirthi",
  created_at: datetime(),
  primary_goal: "Build resilience, practice self-compassion, handle daily struggles"
})

// ============================================================================
// 8. VERIFICATION QUERIES (run these to confirm data loaded)
// ============================================================================

// Check all distortions loaded
MATCH (d:CognitiveDistortion) RETURN COUNT(d) as total_distortions;

// Check all coping strategies loaded
MATCH (c:CopingStrategy) RETURN COUNT(c) as total_coping_strategies;

// Check relationships
MATCH (d:CognitiveDistortion)-[r:COUNTERED_BY]->(c:CopingStrategy)
RETURN COUNT(r) as total_relationships;

// Sample query: Show catastrophizing and its coping strategies
MATCH (d:CognitiveDistortion {id: "catastrophizing"})-[r:COUNTERED_BY]->(c:CopingStrategy)
RETURN d.name, c.name, r.strength ORDER BY r.strength DESC;

// Sample query: Show personal coping strategies
MATCH (c:CopingStrategy {personal: true})
RETURN c.name, c.category, c.effectiveness_rating ORDER BY c.effectiveness_rating DESC;
