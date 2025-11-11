# Memory System Enhancement Plan

## Current Implementation

The basic resource memory system is working:
- Pawns observe and remember resource locations during exploration
- `rememberResource(entity)` records location with timestamp
- `recallResourcesByType(type)` returns sorted array by distance
- Memory cap at 100 locations
- Age-based decay (older memories sorted lower)

## Issues to Address

### 1. **Stale Memory Problem**
- Pawns remember depleted resource locations
- No feedback when gathering fails
- Wastes time traveling to empty sites

### 2. **Memory Redundancy**
- Multiple memories for same resource cluster
- Inefficient when 5 rocks are within 10 units
- Should remember "rock cluster" not each rock

### 3. **No Success Tracking**
- Can't distinguish reliable vs unreliable locations
- No confidence scores
- Equal priority for all memories

### 4. **Inefficient Gathering Routes**
- Gathers one type completely, then searches for next
- No consideration of travel distance between types
- Should plan multi-stop routes

### 5. **No Knowledge Sharing**
- Each pawn builds independent memory
- Wastes exploration effort
- Social interactions don't transfer knowledge

## Enhancement Proposals

### Phase 1: Smart Memory Decay

**Add visit tracking:**
```javascript
resourceMemory: [
  {
    type: 'rock',
    x: 100, y: 200,
    rememberedAt: 500,
    lastVisited: null,
    successCount: 0,    // Times gathered successfully
    failCount: 0,       // Times found depleted
    confidence: 1.0     // 0.0 - 1.0 reliability score
  }
]
```

**Update on gathering:**
- Success: Increment `successCount`, update `lastVisited`, boost `confidence`
- Fail: Increment `failCount`, reduce `confidence`
- Confidence < 0.2: Remove from memory

**Benefits:**
- Forgets bad locations automatically
- Prioritizes proven sites
- Self-cleaning memory

### Phase 2: Memory Clustering

**Cluster nearby resources:**
```javascript
function rememberResource(entity) {
  // Check for nearby memories of same type
  const nearby = this.resourceMemory.filter(mem => {
    if (mem.type !== entity.type) return false
    const dx = mem.x - entity.x
    const dy = mem.y - entity.y
    return Math.sqrt(dx * dx + dy * dy) <= 30 // Cluster radius
  })
  
  if (nearby.length > 0) {
    // Update existing cluster center
    const cluster = nearby[0]
    cluster.x = (cluster.x + entity.x) / 2
    cluster.y = (cluster.y + entity.y) / 2
    cluster.rememberedAt = this.world.clock.currentTick
    cluster.count = (cluster.count || 1) + 1
  } else {
    // New memory
    this.resourceMemory.push({
      type: entity.type,
      x: entity.x,
      y: entity.y,
      rememberedAt: this.world.clock.currentTick,
      count: 1,
      successCount: 0,
      failCount: 0,
      confidence: 1.0
    })
  }
}
```

**Benefits:**
- Reduces memory bloat
- Represents resource density
- More realistic "area knowledge"

### Phase 3: Multi-Resource Path Planning

**Plan efficient gathering routes:**
```javascript
function planGatheringRoute(requirements) {
  // requirements: [{ type: 'rock', count: 2 }, { type: 'fiber_plant', count: 3 }]
  
  const route = []
  let currentPos = { x: this.x, y: this.y }
  
  // For each required resource type
  requirements.forEach(req => {
    const memories = this.recallResourcesByType(req.type)
    
    // Find closest memory to current position
    memories.sort((a, b) => {
      const distA = Math.sqrt((a.x - currentPos.x) ** 2 + (a.y - currentPos.y) ** 2)
      const distB = Math.sqrt((b.x - currentPos.x) ** 2 + (b.y - currentPos.y) ** 2)
      return distA - distB
    })
    
    if (memories.length > 0) {
      route.push({
        type: req.type,
        location: memories[0],
        count: req.count
      })
      currentPos = memories[0] // Update position for next calculation
    }
  })
  
  return route
}
```

**Usage in GoalPlanner:**
```javascript
function decomposeGoal(pawn, goal) {
  if (goal.type.startsWith('craft_')) {
    const recipe = getRecipe(goal.recipeId || goal.type.replace('craft_', ''))
    
    // Calculate what's needed
    const needs = []
    for (const [type, count] of Object.entries(recipe.inputs)) {
      const have = pawn.inventory.filter(i => i.type === type).length
      if (have < count) {
        needs.push({ type, count: count - have })
      }
    }
    
    // Plan efficient route
    const route = pawn.planGatheringRoute(needs)
    
    // Create gather goals in route order
    const subgoals = route.map(stop => ({
      type: 'gather_specific',
      targetResourceType: stop.type,
      targetLocation: stop.location,
      count: stop.count,
      priority: goal.priority + 1
    }))
    
    return subgoals
  }
}
```

**Benefits:**
- Minimizes travel time
- Gathers multiple types in one trip
- More realistic foraging behavior

### Phase 4: Knowledge Sharing

**Share memories during socialization:**
```javascript
function shareResourceMemory(otherPawn) {
  // Share top 5 most confident memories
  const toShare = this.resourceMemory
    .filter(mem => mem.confidence > 0.6)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
  
  toShare.forEach(mem => {
    // Other pawn learns location (but with reduced confidence)
    otherPawn.learnResourceLocation(mem.type, mem.x, mem.y, mem.confidence * 0.7)
  })
  
  console.log(`${this.name} shared ${toShare.length} resource locations with ${otherPawn.name}`)
}

function learnResourceLocation(type, x, y, confidence = 0.5) {
  // Check if already know this location
  const existing = this.resourceMemory.find(mem => {
    if (mem.type !== type) return false
    const dx = mem.x - x
    const dy = mem.y - y
    return Math.sqrt(dx * dx + dy * dy) <= 20
  })
  
  if (existing) {
    // Boost confidence with corroboration
    existing.confidence = Math.min(1.0, existing.confidence + 0.2)
  } else {
    // New learned location
    this.resourceMemory.push({
      type,
      x,
      y,
      rememberedAt: this.world.clock.currentTick,
      learned: true, // Didn't discover personally
      confidence,
      successCount: 0,
      failCount: 0
    })
  }
}
```

**Integration with social goals:**
```javascript
// In PawnGoals.js, when socializing
if (goal.type === 'socialize' && goal.target) {
  const other = goal.target
  
  // Share knowledge
  if (Math.random() < 0.3) { // 30% chance per tick
    this.pawn.shareResourceMemory(other)
  }
}
```

**Benefits:**
- Faster learning for new pawns
- Community knowledge emerges
- Realistic information exchange
- Reduces redundant exploration

## Implementation Priority

1. **Phase 1 (Critical)** - Smart decay with success tracking
   - Fixes stale memory bug immediately
   - Foundation for other improvements
   - Minimal complexity

2. **Phase 2 (High)** - Memory clustering
   - Prevents memory bloat
   - More efficient recall
   - Natural with Phase 1

3. **Phase 3 (Medium)** - Multi-resource routing
   - Noticeable behavior improvement
   - Requires Phases 1-2 for reliability
   - More complex logic

4. **Phase 4 (Low)** - Knowledge sharing
   - Nice emergent behavior
   - Not critical for single-pawn gameplay
   - Important for multi-pawn society

## Testing Strategy

### Phase 1 Test
```javascript
// Deplete a resource cluster
const pawn = getPawn()
const rock = findNearestRock(pawn)
rock.gather(pawn) // Deplete it

// Verify memory degrades
setTimeout(() => {
  const mem = pawn.resourceMemory.find(m => m.type === 'rock')
  console.log('Confidence after fail:', mem.confidence) // Should be < 1.0
}, 5000)
```

### Phase 2 Test
```javascript
// Spawn 10 rocks close together
spawnRockCluster(100, 100, 10, 20) // center x, y, count, radius

// Pawn observes area
pawn.observeNearbyResources(50)

// Check memory count
console.log('Rock memories:', pawn.resourceMemory.filter(m => m.type === 'rock').length)
// Should be ~1-2 clustered memories, not 10
```

### Phase 3 Test
```javascript
// Inject craft goal requiring multiple resource types
pawn.goals.goalQueue.push({
  type: 'craft_poultice',
  recipeId: 'poultice'
})

// Watch route planning in console
// Should gather fiber_plant and forage_food in optimal order
```

### Phase 4 Test
```javascript
// Two pawns
const pawn1 = getPawn()
const pawn2 = spawnPawn(pawn1.x + 50, pawn1.y)

// Pawn1 discovers resources
pawn1.observeNearbyResources(100)
console.log('Pawn1 memories:', pawn1.resourceMemory.length)
console.log('Pawn2 memories:', pawn2.resourceMemory.length) // Should be 0

// Force social interaction
pawn1.goals.goalQueue.push({
  type: 'socialize',
  target: pawn2
})

// After interaction
setTimeout(() => {
  console.log('Pawn2 memories after social:', pawn2.resourceMemory.length)
  // Should have learned some locations
}, 10000)
```

## Long-term Vision

Eventually, memory system should support:
- **Trade networks**: Share knowledge of valuable resources
- **Territory marking**: Remember "my hunting grounds"
- **Danger memory**: Avoid predator locations
- **Seasonal patterns**: Resources respawn at known locations
- **Teaching**: Elders pass knowledge to apprentices
- **Maps**: Convert memory to shareable map items
- **Specialization**: Traders know markets, gatherers know nature
