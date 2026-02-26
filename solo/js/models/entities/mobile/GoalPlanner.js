// Goal decomposition: break complex goals into prerequisite subgoals

export function decomposeGoal(pawn, goal) {
    // Returns array of subgoals needed to achieve the main goal
    // Checks inventory, memory, and skills to determine what's missing
    
    const subgoals = []
    
    // Crafting goals need materials
    if (goal.type.startsWith('craft_') || goal.recipeId) {
        const recipeId = goal.recipeId || goal.type.replace('craft_', '')
        const recipe = getRecipeSync(recipeId)
        
        if (!recipe) return subgoals
        
        const requirements = []

        // Check each required item
        for (const req of recipe.requiredItems) {
            const haveCount = pawn.inventory?.filter(item => item.type === req.type).length ?? 0
            const needCount = req.count - haveCount
            
            if (needCount > 0) {
                requirements.push({ type: req.type, count: needCount })
            }
        }

        const route = pawn.planGatheringRoute?.(requirements) ?? requirements.map(req => {
            const remembered = pawn.recallResourcesByType?.(req.type) ?? []
            return {
                type: req.type,
                count: req.count,
                location: remembered[0] ? { x: remembered[0].x, y: remembered[0].y } : null,
                fromMemory: remembered.length > 0
            }
        })

        for (const stop of route) {
            if (stop.location) {
                subgoals.push({
                    type: 'gather_specific',
                    priority: goal.priority + 1,
                    description: `Gather ${stop.count}x ${stop.type}`,
                    targetType: 'resource',
                    targetLocation: stop.location,
                    targetResourceType: stop.type,
                    action: 'gather',
                    count: stop.count,
                    parentGoal: goal.type
                })
            } else {
                subgoals.push({
                    type: 'search_resource',
                    priority: goal.priority + 1,
                    description: `Search for ${stop.type}`,
                    targetType: 'location',
                    targetResourceType: stop.type,
                    action: 'explore',
                    parentGoal: goal.type
                })
            }
        }
        
        // Check skills
        for (const [skill, level] of Object.entries(recipe.requiredSkills ?? {})) {
            if ((pawn.skills?.[skill] ?? 0) < level) {
                // Need to train skill
                subgoals.push({
                    type: 'train_skill',
                    priority: goal.priority,
                    description: `Train ${skill} to ${level}`,
                    skill,
                    targetLevel: level,
                    parentGoal: goal.type
                })
            }
        }
    }

    if (goal.type === 'build_structure') {
        const requirements = Array.isArray(goal.materialRequirements)
            ? goal.materialRequirements
            : [
                { type: 'stick', count: 8 },
                { type: 'fiber', count: 4 }
            ]

        const buildSite = goal.buildSite ?? { x: pawn.x, y: pawn.y }
        goal.buildSite = buildSite
        goal.materialRequirements = requirements
        subgoals.push({
            type: 'stage_build_materials',
            priority: goal.priority + 1,
            description: 'Stage materials at build site cache',
            targetType: 'location',
            targetLocation: buildSite,
            requirements,
            cacheId: goal.cacheId ?? null,
            parentGoal: goal.type
        })
    }
    
    return subgoals
}

export function isGoalReachable(pawn, goal) {
    // Determines if a goal can be achieved with current knowledge/state
    
    // Crafting goals
    if (goal.type.startsWith('craft_') || goal.recipeId) {
        const recipeId = goal.recipeId || goal.type.replace('craft_', '')
        const recipe = getRecipeSync(recipeId)
        
        if (!recipe) return { reachable: false, reason: 'Unknown recipe' }
        
        // Check if unlocked
        if (!pawn.unlocked?.recipes?.has(recipeId)) {
            return { reachable: false, reason: 'Recipe not unlocked', canResearch: true }
        }
        
        // Check if materials exist in world or memory
        for (const req of recipe.requiredItems) {
            const haveCount = pawn.inventory?.filter(item => item.type === req.type).length ?? 0
            const remembered = pawn.recallResourcesByType?.(req.type) ?? []
            
            if (haveCount < req.count && remembered.length === 0) {
                // Don't know where to find this material
                return { 
                    reachable: false, 
                    reason: `Unknown source for ${req.type}`, 
                    needsExploration: true 
                }
            }
        }
        
        // Check skills
        for (const [skill, level] of Object.entries(recipe.requiredSkills ?? {})) {
            if ((pawn.skills?.[skill] ?? 0) < level) {
                const deficit = level - (pawn.skills?.[skill] ?? 0)
                if (deficit > 5) {
                    // Too far behind
                    return { 
                        reachable: false, 
                        reason: `${skill} too low (need ${level}, have ${pawn.skills?.[skill] ?? 0})`,
                        needsTraining: true
                    }
                }
            }
        }
        
        return { reachable: true }
    }
    
    // Gather goals - always reachable (they'll search as they go)
    if (goal.type === 'gather_materials') {
        // General gathering is always reachable - pawn will explore to find resources
        return { reachable: true }
    }
    
    if (goal.type === 'gather_specific') {
        // Specific gathering needs a target location
        if (goal.targetLocation) return { reachable: true }
        
        // Check if we know where this resource is
        if (goal.targetResourceType) {
            const remembered = pawn.recallResourcesByType?.(goal.targetResourceType) ?? []
            if (remembered.length === 0) {
                return { reachable: false, reason: `No known ${goal.targetResourceType}`, needsExploration: true }
            }
        }
        
        return { reachable: true }
    }

    if (goal.type === 'build_structure' || goal.type === 'stage_build_materials') {
        return { reachable: true }
    }
    
    // Search goals - always reachable
    if (goal.type === 'search_resource' || goal.type === 'explore') {
        return { reachable: true }
    }
    
    // Default: assume reachable
    return { reachable: true }
}

// Synchronous recipe lookup (avoid async in goal evaluation)
function getRecipeSync(id) {
    // This will be replaced with imported RECIPES
    return null
}

// Inject RECIPES reference
export function injectRecipes(recipes) {
    getRecipeSync = (id) => recipes.find(r => r.id === id)
}

export default { decomposeGoal, isGoalReachable, injectRecipes }
