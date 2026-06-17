export type SessionsModuleConfig = {
	durationMinutes?: number
	defaultCount?: number
}

export type RosterModuleConfig = {
	maxCapacity: number
}

export type EditionsModuleConfig = Record<string, never>

export type InventoryModuleConfig = {
	perParticipant: true
}

export type InstructorModuleConfig = {
	required: boolean
}

export type CreditsModuleConfig = {
	creditsIncluded: number
	validityMode: 'range' | 'days'
	validityDays?: number  // used when validityMode === 'days'
	validFrom?: string     // ISO date, used when validityMode === 'range'
	validTo?: string       // ISO date, used when validityMode === 'range'
	compatibleServiceIds: string[]
}

export type ServiceModules = {
	sessions?: SessionsModuleConfig
	roster?: RosterModuleConfig
	editions?: EditionsModuleConfig
	inventory?: InventoryModuleConfig
	instructor?: InstructorModuleConfig
	credits?: CreditsModuleConfig
}

export type ModuleKey = keyof ServiceModules

/** Returns ordered list of active module keys for a service. */
export function activeModuleKeys(modules: ServiceModules): ModuleKey[] {
	const ORDER: ModuleKey[] = ['roster', 'editions', 'sessions', 'instructor', 'inventory', 'credits']
	return ORDER.filter(k => k in modules)
}

import type { PricingMode } from './types'

/** Suggest a default pricing mode based on active modules. */
export function defaultPricingModeForModules(modules: ServiceModules): PricingMode {
	if (modules.credits) return 'flat'
	if (modules.inventory && modules.editions) return 'per_person'
	if (modules.inventory && !modules.sessions) return 'per_unit'
	if (modules.sessions && modules.roster) return 'per_person'
	if (modules.sessions && !modules.roster) return 'per_person_per_session'
	return 'flat'
}
