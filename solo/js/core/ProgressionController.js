const PHASES = {
    PHASE0: 'phase0_embodied',
    PHASE1: 'phase1_situated',
    PHASE2: 'phase2_orienting',
    PHASE3: 'phase3_mapping',
    OVERSEER: 'overseer',
    GOD: 'god'
}

const PHASE_DEFAULTS = {
    [PHASES.PHASE0]: {
        validCamera: 'first_locked',
        compass: 'none',
        minimap: 'none',
        labels: 'nearby_class_only',
        mapOverlay: [],
        steering: 'need_nudges_only',
        interactionControls: ['nudge_basic'],
        feedbackChannels: ['thought_stream_basic', 'event_toast_survival'],
        pawnStatus: ['vitals_basic', 'task_intent'],
        perceptionModePolicy: 'disabled'
    },
    [PHASES.PHASE1]: {
        validCamera: 'third_lock',
        compass: 'heading_hint',
        minimap: 'radar_blips',
        labels: 'nearby_known_types',
        mapOverlay: ['resource_class'],
        steering: 'context_actions_basic',
        interactionControls: ['nudge_need_focus', 'target_interact_near', 'examine_basic'],
        feedbackChannels: ['thought_stream_weighted', 'thought_injection_prompt', 'intent_confirmation'],
        pawnStatus: ['vitals_trend', 'needs_stack', 'inventory_summary', 'loadout_summary', 'condition_flags', 'task_intent'],
        perceptionModePolicy: 'local_only'
    },
    [PHASES.PHASE2]: {
        validCamera: 'third_look',
        compass: 'cardinal_with_landmarks',
        minimap: 'radar_icons',
        labels: 'known_landmarks',
        mapOverlay: ['resource_known_types', 'route_traces'],
        steering: 'goal_bias_route',
        interactionControls: ['goal_pin_local', 'goal_pin_route', 'examine_detailed'],
        feedbackChannels: ['thought_competition_visible', 'capability_reflection', 'event_toast_social', 'intent_confirmation'],
        pawnStatus: ['inventory_detail', 'loadout_detail', 'skills_summary', 'memory_confidence', 'task_intent'],
        perceptionModePolicy: 'phase_aware'
    },
    [PHASES.PHASE3]: {
        validCamera: 'third_free',
        compass: 'cardinal_with_route_confidence',
        minimap: 'partial_recall_map',
        labels: 'named_landmarks',
        mapOverlay: ['biome_edges', 'terrain_features', 'route_traces', 'waypoints_local'],
        steering: 'goal_bias_route',
        interactionControls: ['goal_pin_route', 'waypoint_place', 'examine_detailed'],
        feedbackChannels: ['narrative_recap', 'achievement_log', 'system_dashboard_local', 'intent_confirmation'],
        pawnStatus: ['skills_detail', 'social_summary', 'memory_confidence', 'condition_flags', 'task_intent'],
        perceptionModePolicy: 'phase_aware'
    },
    [PHASES.OVERSEER]: {
        validCamera: 'pan_n_scan',
        compass: 'cardinal_with_route_confidence',
        minimap: 'local_full_map',
        labels: 'named_landmarks',
        mapOverlay: ['waypoints_local', 'resource_known_types', 'biome_edges', 'terrain_features', 'route_traces'],
        steering: 'waypoint_policy_local',
        interactionControls: ['waypoint_place', 'waypoint_edit', 'waypoint_remove', 'policy_local'],
        feedbackChannels: ['system_dashboard_local', 'achievement_log', 'intent_confirmation'],
        pawnStatus: ['skills_detail', 'social_detail', 'inventory_detail', 'task_intent', 'condition_flags'],
        perceptionModePolicy: 'mode_aware'
    },
    [PHASES.GOD]: {
        validCamera: 'pan_n_scan',
        compass: 'none',
        minimap: 'strategic_map',
        labels: 'system_labels',
        mapOverlay: ['trade_flows', 'scarcity_surplus', 'settlement_regions', 'contracts_activity'],
        steering: 'policy_macro',
        interactionControls: ['policy_macro'],
        feedbackChannels: ['system_dashboard_macro', 'achievement_log', 'narrative_recap'],
        pawnStatus: ['social_summary'],
        perceptionModePolicy: 'god_noop'
    }
}

function totalSkill(skills) {
    if (!skills) return 0
    return Object.values(skills).reduce((sum, value) => sum + (value || 0), 0)
}

function hasMembership(pawn) {
    const membership = pawn?.reputation?.membership
    return !!membership && Object.keys(membership).length > 0
}

function areModuleValuesEqual(previous, current) {
    if (Array.isArray(previous) || Array.isArray(current)) {
        if (!Array.isArray(previous) || !Array.isArray(current)) return false
        if (previous.length !== current.length) return false
        return previous.every((value, index) => value === current[index])
    }
    return previous === current
}

function cloneModuleValue(value) {
    return Array.isArray(value) ? [...value] : value
}

function cloneModulesSnapshot(modules) {
    const entries = Object.entries(modules || {})
    return entries.reduce((snapshot, [key, value]) => {
        snapshot[key] = cloneModuleValue(value)
        return snapshot
    }, {})
}

class ProgressionController {
    constructor() {
        this.overridePhase = null
        this.lastPhase = null
        this.lastUnlocked = { pawn: true, overseer: false, god: false }
        this.telemetry = []
        this.listeners = new Set()
        this.lastModules = null
    }

    setOverridePhase(phase) {
        this.overridePhase = phase || null
    }

    clearOverridePhase() {
        this.overridePhase = null
    }

    getOverridePhase() {
        return this.overridePhase
    }

    onEvent(listener) {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    evaluate(pawn, world) {
        const tick = world?.clock?.currentTick ?? 0
        const skillTotal = totalSkill(pawn?.skills)
        const unlocked = {
            pawn: true,
            overseer: skillTotal >= 15,
            god: skillTotal >= 50 && hasMembership(pawn)
        }

        const orienteering = pawn?.skills?.orienteering ?? 0
        const planning = pawn?.skills?.planning ?? 0
        const cartography = pawn?.skills?.cartography ?? 0
        const createdLandmarkReturnLoops = pawn?.progressionMetrics?.createdLandmarkReturnLoops ?? 0
        const routeRecallConsistency = pawn?.progressionMetrics?.routeRecallConsistency ?? 0

        let phase = PHASES.PHASE0
        let unlockReason = 'spawn_default'

        if ((pawn?.inventorySlots ?? 0) > 2 || skillTotal >= 5) {
            phase = PHASES.PHASE1
            unlockReason = 'situated_skill_or_loadout'
        }

        if (orienteering >= 15 && createdLandmarkReturnLoops >= 2) {
            phase = PHASES.PHASE2
            unlockReason = 'orienting_orienteering_and_loops'
        }

        if (routeRecallConsistency >= 0.7 && (planning >= 12 || cartography >= 8)) {
            phase = PHASES.PHASE3
            unlockReason = 'mapping_route_and_planning'
        }

        if (unlocked.overseer) {
            phase = PHASES.OVERSEER
            unlockReason = 'overseer_skill_gate'
        }

        if (unlocked.god) {
            phase = PHASES.GOD
            unlockReason = 'god_skill_and_membership_gate'
        }

        const effectivePhase = this.overridePhase ?? phase
        const baseModules = PHASE_DEFAULTS[effectivePhase] ?? PHASE_DEFAULTS[PHASES.PHASE0]
        const modules = {
            ...baseModules,
            mapOverlay: Array.isArray(baseModules.mapOverlay) ? [...baseModules.mapOverlay] : [],
            pawnStatus: Array.isArray(baseModules.pawnStatus) ? [...baseModules.pawnStatus] : [],
            interactionControls: Array.isArray(baseModules.interactionControls) ? [...baseModules.interactionControls] : [],
            feedbackChannels: Array.isArray(baseModules.feedbackChannels) ? [...baseModules.feedbackChannels] : []
        }

        const payload = {
            phase: effectivePhase,
            modeUnlocked: unlocked,
            modules,
            overrideActive: !!this.overridePhase,
            gateState: {
                orienteering,
                planning,
                cartography,
                createdLandmarkReturnLoops,
                routeRecallConsistency,
                totalSkill: skillTotal
            },
            telemetryContext: {
                unlockReason,
                unlockCandidates: [phase],
                lastTransitionTick: tick,
                isOverrideSession: !!this.overridePhase
            }
        }

        this._emitTransitions(payload, tick)
        return payload
    }

    _emitTransitions(payload, tick) {
        if (payload.phase !== this.lastPhase) {
            this._emit({ type: 'phase_entered', phase: payload.phase, tick, reason: payload.telemetryContext.unlockReason })
            this.lastPhase = payload.phase
        }

        const prev = this.lastUnlocked
        const next = payload.modeUnlocked
        if (!prev.overseer && next.overseer) {
            this._emit({ type: 'mode_unlocked', mode: 'overseer', tick })
        }
        if (!prev.god && next.god) {
            this._emit({ type: 'mode_unlocked', mode: 'god', tick })
        }

        if (payload.modules) {
            if (!this.lastModules) {
                this.lastModules = cloneModulesSnapshot(payload.modules)
            } else {
                const changed = []
                for (const key of Object.keys(payload.modules)) {
                    if (!areModuleValuesEqual(this.lastModules[key], payload.modules[key])) {
                        changed.push({ module: key, from: this.lastModules[key], to: payload.modules[key] })
                    }
                }
                if (changed.length > 0) {
                    this._emit({ type: 'capability_unlocked', tick, changes: changed, phase: payload.phase })
                    this.lastModules = cloneModulesSnapshot(payload.modules)
                }
            }
        }

        this.lastUnlocked = { ...next }
    }

    _emit(event) {
        this.telemetry.push(event)
        if (this.telemetry.length > 200) this.telemetry.shift()
        this.listeners.forEach(listener => listener(event))
    }
}

export { PHASES }
export default ProgressionController
