# Occupation and Economy Framework

This document formalizes recurring concepts from early Trade notes into implementation priorities.

## Core Brand Triad

Trade development should center on three interacting pillars:

- Tribe: survival, shared labor, defense, kin-style coordination
- Town: structures, governance, specialization, persistent production
- Traders: mobility, arbitrage, logistics, contracts, market expansion

## Pawn Occupation Development

Pawn progression should emerge from repeated behavior, not class selection.

- Exposure-driven identity: gathering, crafting, hauling, building, teaching, trading
- Domain transfer: familiarity in one material class improves comprehension of adjacent items in that class
- Use discernment: materials should be judged differently by intended use (tool, weapon, construction, medicine, etc.)
- Apprenticeship effects: observing experts should accelerate novice specialization
- Reputation carryover: reliability and delivery quality should influence future contracts and roles

## Economic and Logistics Priorities

- Supply chains as first-class systems (source -> process -> transport -> destination)
- Shop and stall behavior with stock constraints and replenishment loops
- Dynamic value from scarcity, demand, and practical suitability
- Inventory and transport limits that make logistics a strategic choice
- Local surplus/deficit signals that drive trade routes and occupation drift

## Structure and Capability Priorities

- Structures as capability gates (workshops, storage, training, civic spaces)
- Settlement progression should unlock deeper specialization and market complexity
- Town-level organization should reduce coordination cost and improve throughput

## Near-Term Implementation Priorities

1. Occupation signal model from observed behavior history
2. Trade-oriented goal weighting that uses specialization and current market needs
3. Contract primitives (supply, escort, delivery, apprenticeship)
4. Stock-aware market entities (buy/sell offers + inventory pressure)
5. Role progression events (novice -> skilled -> specialist)

## Potential Considerations (Later)

- Credit/debt mechanics and merchant financing
- Multi-shop corporations and caravan guilds
- Regional product identity and quality tiers
- Policy/law effects on commerce and town stability

## Source Notes

This framework is distilled from `docs/TradeGameNotes.pdf` (early handwritten notes). The OCR extraction is noisy, so these are normalized design themes rather than verbatim requirements.
