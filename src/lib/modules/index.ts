import type { ModuleKey } from '$lib/features/services/modules'

export interface ModuleDefinition {
	key: ModuleKey
	label: string
	description: string
	icon: string
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
	{
		key: 'roster',
		label: 'Grupos',
		description: 'Varios clientes se apuntan independientemente al mismo slot',
		icon: '👥'
	},
	{
		key: 'editions',
		label: 'Ediciones',
		description: 'Instancias con fechas fijas del servicio (ej. camp de julio)',
		icon: '📅'
	},
	{
		key: 'sessions',
		label: 'Sesiones',
		description: 'Programa actividades con fecha, hora y asistencia',
		icon: '⏱'
	},
	{
		key: 'instructor',
		label: 'Instructor',
		description: 'Asigna un guía o monitor a la reserva',
		icon: '🏄'
	},
	{
		key: 'inventory',
		label: 'Inventario',
		description: 'Asigna material (tabla, neopreno) a cada participante',
		icon: '🎒'
	},
	{
		key: 'credits',
		label: 'Créditos',
		description: 'Vende bonos prepago — el cliente consume sesiones a su ritmo',
		icon: '🎟'
	}
]

export const MODULE_BY_KEY = Object.fromEntries(
	MODULE_DEFINITIONS.map(m => [m.key, m])
) as Record<ModuleKey, ModuleDefinition>
