import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Load modules directly for unit testing
const PawnCivicPath = path.resolve('solo/js/models/entities/mobile/PawnCivic.js')
const PawnSocialPath = path.resolve('solo/js/models/entities/mobile/PawnSocial.js')
const PawnTacticalPath = path.resolve('solo/js/models/entities/mobile/PawnTactical.js')
const PawnSecurityPath = path.resolve('solo/js/models/entities/mobile/PawnSecurity.js')
const PawnGroupPath = path.resolve('solo/js/models/entities/mobile/PawnGroup.js')
const PawnMemoryPath = path.resolve('solo/js/models/entities/mobile/PawnMemory.js')
const PawnInventionPath = path.resolve('solo/js/models/entities/mobile/PawnInvention.js')
const PawnInventoryPath = path.resolve('solo/js/models/entities/mobile/PawnInventory.js')

// Shared core modules
const DegradationPath = path.resolve('solo/js/core/Degradation.js')
const InventoryPath = path.resolve('solo/js/core/Inventory.js')
const MemoryPath = path.resolve('solo/js/core/Memory.js')

describe('Phase 2: File Structure Verification', () => {
    it('All pawn-specific modules exist', () => {
        assert.ok(fs.existsSync(PawnCivicPath))
        assert.ok(fs.existsSync(PawnSocialPath))
        assert.ok(fs.existsSync(PawnTacticalPath))
        assert.ok(fs.existsSync(PawnSecurityPath))
        assert.ok(fs.existsSync(PawnGroupPath))
        assert.ok(fs.existsSync(PawnMemoryPath))
        assert.ok(fs.existsSync(PawnInventionPath))
        assert.ok(fs.existsSync(PawnInventoryPath))
    })

    it('All shared core modules exist', () => {
        assert.ok(fs.existsSync(DegradationPath))
        assert.ok(fs.existsSync(InventoryPath))
        assert.ok(fs.existsSync(MemoryPath))
    })

    it('Pawn.js imports all pawn-specific modules', () => {
        const pawnContent = fs.readFileSync('solo/js/models/entities/mobile/Pawn.js', 'utf8')
        assert.ok(pawnContent.includes("import * as PawnCivic from './PawnCivic.js'"))
        assert.ok(pawnContent.includes("import * as PawnSocial from './PawnSocial.js'"))
        assert.ok(pawnContent.includes("import * as PawnTactical from './PawnTactical.js'"))
        assert.ok(pawnContent.includes("import * as PawnSecurity from './PawnSecurity.js'"))
    })

    it('Structure.js imports Degradation module', () => {
        const structureContent = fs.readFileSync('solo/js/models/entities/immobile/Structure.js', 'utf8')
        assert.ok(structureContent.includes("import * as Degradation from '../../core/Degradation.js'"))
    })

    it('ResourceCache.js imports Inventory module', () => {
        const cacheContent = fs.readFileSync('solo/js/models/entities/immobile/ResourceCache.js', 'utf8')
        assert.ok(cacheContent.includes("import * as Inventory from '../../core/Inventory.js'"))
    })

    it('PawnCivic.js exports all required functions', () => {
        const content = fs.readFileSync(PawnCivicPath, 'utf8')
        assert.ok(content.includes('export function checkProtoSettlementTrigger'))
        assert.ok(content.includes('export function getResourceRichness'))
        assert.ok(content.includes('export function canonizeEncampment'))
        assert.ok(content.includes('export function recordCivicContribution'))
        assert.ok(content.includes('export function updateCivicScore'))
        assert.ok(content.includes('export function getAverageGroupTrust'))
        assert.ok(content.includes('export function postJob'))
        assert.ok(content.includes('export function acceptJob'))
        assert.ok(content.includes('export function completeJob'))
        assert.ok(content.includes('export function addCurriculumLesson'))
        assert.ok(content.includes('export function completeCurriculumLesson'))
    })

    it('PawnSocial.js exports all required functions', () => {
        const content = fs.readFileSync(PawnSocialPath, 'utf8')
        assert.ok(content.includes('export function getGroupTrustIn'))
        assert.ok(content.includes('export function setGroupTrustIn'))
        assert.ok(content.includes('export function registerProximityTrustGain'))
        assert.ok(content.includes('export function registerHuntSuccess'))
        assert.ok(content.includes('export function notifyCacheSharing'))
        assert.ok(content.includes('export function checkCivicGroupFormationTrigger'))
        assert.ok(content.includes('export function applyTrustDecay'))
    })

    it('PawnTactical.js exports all required functions', () => {
        const content = fs.readFileSync(PawnTacticalPath, 'utf8')
        assert.ok(content.includes('export function recordTacticalMemory'))
        assert.ok(content.includes('export function updateTacticalMemory'))
        assert.ok(content.includes('export function getTerritoryMemories'))
        assert.ok(content.includes('export function updateTerritoryLandmarks'))
        assert.ok(content.includes('export function assignPatrolRoute'))
        assert.ok(content.includes('export function assignDefensePosition'))
    })

    it('PawnSecurity.js exports all required functions', () => {
        const content = fs.readFileSync(PawnSecurityPath, 'utf8')
        assert.ok(content.includes('export function createSecurityContract'))
        assert.ok(content.includes('export function getActiveSecurityContracts'))
        assert.ok(content.includes('export function terminateSecurityContract'))
        assert.ok(content.includes('export function createHuntParty'))
        assert.ok(content.includes('export function updateHuntParty'))
        assert.ok(content.includes('export function endHuntParty'))
    })

    it('PawnGroup.js exports all required functions', () => {
        const content = fs.readFileSync(PawnGroupPath, 'utf8')
        assert.ok(content.includes('export function sendGroupCommand'))
        assert.ok(content.includes('export function receiveGroupCommand'))
        assert.ok(content.includes('export function getGroupMembers'))
        assert.ok(content.includes('export function isLeader'))
        assert.ok(content.includes('export function getActivePatrolRoutes'))
        assert.ok(content.includes('export function getActiveDefenseAssignments'))
    })

    it('PawnMemory.js exports all required functions', () => {
        const content = fs.readFileSync(PawnMemoryPath, 'utf8')
        assert.ok(content.includes('export function rememberLandmark'))
        assert.ok(content.includes('export function findLandmarksByType'))
        assert.ok(content.includes('export function findLandmarksByLocation'))
        assert.ok(content.includes('export function findLandmarksBySignificance'))
        assert.ok(content.includes('export function getHomeLandmark'))
        assert.ok(content.includes('export function decayMemory'))
        assert.ok(content.includes('export function pruneMemory'))
        assert.ok(content.includes('export function getMemorySize'))
        assert.ok(content.includes('export function clearMemory'))
    })

    it('PawnInvention.js exports all required functions', () => {
        const content = fs.readFileSync(PawnInventionPath, 'utf8')
        assert.ok(content.includes('export function ponderInvention'))
        assert.ok(content.includes('export function progressInvention'))
        assert.ok(content.includes('export function getDiscoveredInventions'))
        assert.ok(content.includes('export function getActiveInventions'))
        assert.ok(content.includes('export function hasDiscovered'))
        assert.ok(content.includes('export function applyInventionBonuses'))
    })

    it('PawnInventory.js exports all required functions', () => {
        const content = fs.readFileSync(PawnInventoryPath, 'utf8')
        assert.ok(content.includes('export function addItem'))
        assert.ok(content.includes('export function takeItem'))
        assert.ok(content.includes('export function countItem'))
        assert.ok(content.includes('export function hasItem'))
        assert.ok(content.includes('export function getItemTypes'))
        assert.ok(content.includes('export function getTotalItems'))
        assert.ok(content.includes('export function clearInventory'))
        assert.ok(content.includes('export function transferItems'))
    })

    it('Degradation.js exports all required functions', () => {
        const content = fs.readFileSync(DegradationPath, 'utf8')
        assert.ok(content.includes('export function update'))
        assert.ok(content.includes('export function repair'))
        assert.ok(content.includes('export function getPercentage'))
        assert.ok(content.includes('export function isGood'))
        assert.ok(content.includes('export function isCritical'))
    })

    it('Inventory.js exports all required functions', () => {
        const content = fs.readFileSync(InventoryPath, 'utf8')
        assert.ok(content.includes('export function addItem'))
        assert.ok(content.includes('export function addItems'))
        assert.ok(content.includes('export function takeItems'))
        assert.ok(content.includes('export function countByType'))
        assert.ok(content.includes('export function totalItems'))
        assert.ok(content.includes('export function hasSpace'))
        assert.ok(content.includes('export function getItemTypes'))
        assert.ok(content.includes('export function clear'))
    })

    it('Memory.js exports all required functions', () => {
        const content = fs.readFileSync(MemoryPath, 'utf8')
        assert.ok(content.includes('export function addEntry'))
        assert.ok(content.includes('export function findByType'))
        assert.ok(content.includes('export function findByLocation'))
        assert.ok(content.includes('export function findBySignificance'))
        assert.ok(content.includes('export function decay'))
        assert.ok(content.includes('export function prune'))
        assert.ok(content.includes('export function size'))
        assert.ok(content.includes('export function clear'))
    })
})
