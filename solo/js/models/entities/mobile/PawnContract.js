/**
 * Pawn contract systems: unified contract primitives across all triad phases.
 * 
 * Contract types: escort, defense, supply, research, apprenticeship
 * Contract lifecycle: offered → accepted → active → fulfilled → completed
 *                   → disputed (from any active state)
 * 
 * Contracts bridge tribal, civic, and mercantile groups.
 * Reputation affects contract rates and priority.
 */

import * as PawnReputation from './PawnReputation.js'

/**
 * Contract type definitions with default durations and priorities.
 */
const CONTRACT_TYPES = {
    escort: {
        description: 'Escort a pawn or group to a location',
        defaultDuration: 120, // ticks
        defaultPriority: 2,
        requiresSkills: ['combat', 'navigation']
    },
    defense: {
        description: 'Defend a location or group from threats',
        defaultDuration: 200,
        defaultPriority: 3,
        requiresSkills: ['combat', 'strategy']
    },
    supply: {
        description: 'Deliver resources or items to a group',
        defaultDuration: 80,
        defaultPriority: 1,
        requiresSkills: ['gathering', 'navigation']
    },
    research: {
        description: 'Investigate or discover solutions for a group',
        defaultDuration: 150,
        defaultPriority: 1,
        requiresSkills: ['planning', 'study']
    },
    apprenticeship: {
        description: 'Teach skills to another group\'s members',
        defaultDuration: 100,
        defaultPriority: 1,
        requiresSkills: ['teaching']
    }
}

/**
 * Contract lifecycle states.
 */
const CONTRACT_STATES = {
    OFFERED: 'offered',
    ACCEPTED: 'accepted',
    ACTIVE: 'active',
    FULFILLED: 'fulfilled',
    COMPLETED: 'completed',
    DISPUTED: 'disputed',
    TERMINATED: 'terminated'
}

/**
 * Create a new contract offer.
 * @param {Pawn} pawn - Pawn offering the contract
 * @param {Pawn} targetPawn - Pawn/group to offer contract to
 * @param {string} type - Contract type: 'escort', 'defense', 'supply', 'research', 'apprenticeship'
 * @param {Object} terms - Contract terms (overrides defaults)
 * @returns {Object|null} Contract object or null if reputation too low
 */
export function offerContract(pawn, targetPawn, type, terms = {}) {
    if (!targetPawn?.groupMemberships) {
        return null
    }

    const targetGroupId = PawnReputation.getTargetGroupId(targetPawn)
    if (!targetGroupId) {
        return null
    }

    // Check reputation threshold for offering contracts
    const canOffer = PawnReputation.canOfferContract(pawn, targetPawn)
    if (!canOffer.canOffer) {
        return null
    }

    const contractType = CONTRACT_TYPES[type]
    if (!contractType) {
        return null
    }

    const contractId = `contract_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const rateModifier = canOffer.rateModifier

    const contract = {
        id: contractId,
        type,
        state: CONTRACT_STATES.OFFERED,
        offeredBy: pawn.id,
        offeredTo: targetGroupId,
        terms: {
            ...contractType,
            ...terms,
            duration: terms.duration ?? contractType.defaultDuration,
            priority: terms.priority ?? contractType.defaultPriority,
            rateModifier
        },
        createdAt: pawn.world?.clock?.currentTick ?? 0,
        acceptedAt: null,
        completedAt: null,
        disputedAt: null,
        disputeReason: null
    }

    // Store contract on offering pawn
    if (!pawn.contracts) {
        pawn.contracts = {}
    }
    pawn.contracts[contractId] = contract

    // Store contract offer on target pawn's group
    if (!targetPawn.pendingContracts) {
        targetPawn.pendingContracts = {}
    }
    targetPawn.pendingContracts[contractId] = contract

    return contract
}

/**
 * Accept a contract offer.
 * @param {Pawn} pawn - Pawn accepting the contract
 * @param {string} contractId - Contract ID to accept
 * @returns {Object|null} Accepted contract or null
 */
export function acceptContract(pawn, contractId) {
    const contract = getContract(pawn, contractId)
    if (!contract || contract.state !== CONTRACT_STATES.OFFERED) {
        return null
    }

    contract.state = CONTRACT_STATES.ACCEPTED
    contract.acceptedAt = pawn.world?.clock?.currentTick ?? 0

    // Move to active contracts
    if (!pawn.activeContracts) {
        pawn.activeContracts = {}
    }
    pawn.activeContracts[contractId] = contract

    // Remove from pending
    if (pawn.pendingContracts) {
        delete pawn.pendingContracts[contractId]
    }

    // Record reputation event for acceptance
    PawnReputation.recordReputationEvent(pawn, contract.offeredBy, 'contract_accepted', 0.05, contract.acceptedAt)

    return contract
}

/**
 * Begin active work on a contract.
 * @param {Pawn} pawn - Pawn working on the contract
 * @param {string} contractId - Contract ID to activate
 * @returns {Object|null} Activated contract or null
 */
export function activateContract(pawn, contractId) {
    const contract = getContract(pawn, contractId)
    if (!contract || contract.state !== CONTRACT_STATES.ACCEPTED) {
        return null
    }

    contract.state = CONTRACT_STATES.ACTIVE

    return contract
}

/**
 * Mark a contract as fulfilled (work completed).
 * @param {Pawn} pawn - Pawn fulfilling the contract
 * @param {string} contractId - Contract ID to fulfill
 * @param {Object} results - Results of the work
 * @returns {Object|null} Fulfilled contract or null
 */
export function fulfillContract(pawn, contractId, results = {}) {
    const contract = getContract(pawn, contractId)
    if (!contract || contract.state !== CONTRACT_STATES.ACTIVE) {
        return null
    }

    contract.state = CONTRACT_STATES.FULFILLED
    contract.fulfilledAt = pawn.world?.clock?.currentTick ?? 0
    contract.results = results

    // Record reputation event for fulfillment
    const offeredByGroup = getGroupIdFromPawnId(pawn, contract.offeredBy)
    if (offeredByGroup) {
        PawnReputation.modifyGroupReputation(pawn, offeredByGroup, 'contract_fulfilled', 0.1)
        PawnReputation.recordReputationEvent(pawn, offeredByGroup, 'contract_fulfilled', 0.1, contract.fulfilledAt)
    }

    return contract
}

/**
 * Complete a fulfilled contract (final settlement).
 * @param {Pawn} pawn - Pawn completing the contract
 * @param {string} contractId - Contract ID to complete
 * @returns {Object|null} Completed contract or null
 */
export function completeContract(pawn, contractId) {
    const contract = getContract(pawn, contractId)
    if (!contract || contract.state !== CONTRACT_STATES.FULFILLED) {
        return null
    }

    contract.state = CONTRACT_STATES.COMPLETED
    contract.completedAt = pawn.world?.clock?.currentTick ?? 0

    return contract
}

/**
 * Dispute a contract (disagreement about terms or fulfillment).
 * @param {Pawn} pawn - Pawn disputing the contract
 * @param {string} contractId - Contract ID to dispute
 * @param {string} reason - Reason for dispute
 * @returns {Object|null} Disputed contract or null
 */
export function disputeContract(pawn, contractId, reason = '') {
    const contract = getContract(pawn, contractId)
    if (!contract || !['OFFERED', 'ACCEPTED', 'ACTIVE', 'FULFILLED'].includes(contract.state)) {
        return null
    }

    contract.state = CONTRACT_STATES.DISPUTED
    contract.disputedAt = pawn.world?.clock?.currentTick ?? 0
    contract.disputeReason = reason

    // Record reputation event for dispute
    const offeredByGroup = getGroupIdFromPawnId(pawn, contract.offeredBy)
    if (offeredByGroup) {
        PawnReputation.modifyGroupReputation(pawn, offeredByGroup, 'contract_broken', 0.15)
        PawnReputation.recordReputationEvent(pawn, offeredByGroup, 'contract_broken', 0.15, contract.disputedAt)
    }

    return contract
}

/**
 * Terminate a contract (early cancellation).
 * @param {Pawn} pawn - Pawn terminating the contract
 * @param {string} contractId - Contract ID to terminate
 * @returns {Object|null} Terminated contract or null
 */
export function terminateContract(pawn, contractId) {
    const contract = getContract(pawn, contractId)
    if (!contract || !['OFFERED', 'ACCEPTED', 'ACTIVE'].includes(contract.state)) {
        return null
    }

    contract.state = CONTRACT_STATES.TERMINATED
    contract.terminatedAt = pawn.world?.clock?.currentTick ?? 0

    return contract
}

/**
 * Get a contract by ID from any pawn's contract storage.
 * @param {Pawn} pawn - Pawn to search
 * @param {string} contractId - Contract ID to find
 * @returns {Object|null} Contract or null
 */
export function getContract(pawn, contractId) {
    // Check pending contracts
    if (pawn.pendingContracts?.[contractId]) {
        return pawn.pendingContracts[contractId]
    }

    // Check active contracts
    if (pawn.activeContracts?.[contractId]) {
        return pawn.activeContracts[contractId]
    }

    // Check all contracts
    if (pawn.contracts?.[contractId]) {
        return pawn.contracts[contractId]
    }

    return null
}

/**
 * Get all active contracts for a pawn.
 * @param {Pawn} pawn
 * @returns {Array} Active contracts sorted by priority
 */
export function getActiveContracts(pawn) {
    if (!pawn.activeContracts) {
        return []
    }

    const contracts = Object.values(pawn.activeContracts)
    contracts.sort((a, b) => b.terms.priority - a.terms.priority)
    return contracts
}

/**
 * Get all pending contract offers for a pawn.
 * @param {Pawn} pawn
 * @returns {Array} Pending contract offers
 */
export function getPendingContracts(pawn) {
    if (!pawn.pendingContracts) {
        return []
    }

    return Object.values(pawn.pendingContracts)
}

/**
 * Get all contracts offered by a pawn.
 * @param {Pawn} pawn
 * @returns {Array} Contracts offered by this pawn
 */
export function getOfferedContracts(pawn) {
    if (!pawn.contracts) {
        return []
    }

    return Object.values(pawn.contracts).filter(c => c.offeredBy === pawn.id)
}

/**
 * Get contract rate modifier based on reputation.
 * @param {Pawn} pawn - Pawn offering contract
 * @param {Pawn} targetPawn - Target pawn/group
 * @returns {number} Rate modifier (0.7-1.3)
 */
export function getContractRate(pawn, targetPawn) {
    return PawnReputation.getContractRateModifier(pawn, PawnReputation.getTargetGroupId(targetPawn))
}

/**
 * Get contract priority score for fulfillment ordering.
 * Higher score = higher priority.
 * @param {Object} contract - Contract to score
 * @returns {number} Priority score
 */
export function getContractPriorityScore(contract) {
    const basePriority = contract.terms.priority ?? 1
    const rateModifier = contract.terms.rateModifier ?? 1.0

    // Higher priority and better rates = higher score
    return basePriority * rateModifier
}

/**
 * Check if a contract is expired (past duration limit).
 * @param {Object} contract - Contract to check
 * @param {Pawn} pawn - Pawn to get current tick from
 * @returns {boolean} True if contract is expired
 */
export function isContractExpired(contract, pawn) {
    if (contract.state === CONTRACT_STATES.COMPLETED ||
        contract.state === CONTRACT_STATES.DISPUTED ||
        contract.state === CONTRACT_STATES.TERMINATED) {
        return false
    }

    const currentTick = pawn.world?.clock?.currentTick ?? 0
    const duration = contract.terms.duration ?? CONTRACT_TYPES[contract.type]?.defaultDuration ?? 100

    return (currentTick - contract.createdAt) > duration
}

/**
 * Expire all expired contracts for a pawn.
 * @param {Pawn} pawn
 */
export function expireExpiredContracts(pawn) {
    if (!pawn.activeContracts) return

    for (const [contractId, contract] of Object.entries(pawn.activeContracts)) {
        if (isContractExpired(contract, pawn)) {
            contract.state = CONTRACT_STATES.TERMINATED
            contract.terminatedAt = pawn.world?.clock?.currentTick ?? 0
        }
    }
}

/**
 * Get contract type definition.
 * @param {string} type - Contract type
 * @returns {Object|null} Contract type definition
 */
export function getContractType(type) {
    return CONTRACT_TYPES[type] ?? null
}

/**
 * Get all contract types.
 * @returns {Object} All contract type definitions
 */
export function getAllContractTypes() {
    return CONTRACT_TYPES
}

/**
 * Get contract state name.
 * @param {string} state - Contract state
 * @returns {string} State name
 */
export function getContractState(state) {
    return CONTRACT_STATES[state] ?? state
}

/**
 * Get all contract states.
 * @returns {Object} All contract states
 */
export function getAllContractStates() {
    return CONTRACT_STATES
}

/**
 * Helper: Get group ID from a pawn ID.
 * @param {Pawn} pawn - Pawn to search world
 * @param {string} pawnId - Pawn ID to look up
 * @returns {string|null} Group ID or null
 */
function getGroupIdFromPawnId(pawn, pawnId) {
    const targetPawn = pawn.world?.entitiesMap?.get(pawnId)
    if (!targetPawn) return null
    return PawnReputation.getTargetGroupId(targetPawn)
}
