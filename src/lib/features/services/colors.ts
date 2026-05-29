export const SERVICE_COLORS = {
	ocean:   { bg: 'bg-sky-100',     text: 'text-sky-800',     border: 'border-sky-400'    },
	coral:   { bg: 'bg-rose-100',    text: 'text-rose-800',    border: 'border-rose-400'   },
	amber:   { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-400'  },
	teal:    { bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-teal-400'   },
	emerald: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-400'},
	indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-800',  border: 'border-indigo-400' },
	purple:  { bg: 'bg-purple-100',  text: 'text-purple-800',  border: 'border-purple-400' },
	pink:    { bg: 'bg-pink-100',    text: 'text-pink-800',    border: 'border-pink-400'   },
	orange:  { bg: 'bg-orange-100',  text: 'text-orange-800',  border: 'border-orange-400' },
	lime:    { bg: 'bg-lime-100',    text: 'text-lime-800',    border: 'border-lime-400'   },
	slate:   { bg: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-400'  },
	cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-800',    border: 'border-cyan-400'   },
} as const;

export type ServiceColorKey = keyof typeof SERVICE_COLORS;

export const DEFAULT_COLOR: ServiceColorKey = 'ocean';

export const COLOR_LABELS: Record<ServiceColorKey, string> = {
	ocean:   'Ocean',
	coral:   'Coral',
	amber:   'Amber',
	teal:    'Teal',
	emerald: 'Emerald',
	indigo:  'Indigo',
	purple:  'Purple',
	pink:    'Pink',
	orange:  'Orange',
	lime:    'Lime',
	slate:   'Slate',
	cyan:    'Cyan',
};

// Dot colors for swatches (solid fill, used in picker and chips)
export const DOT_COLORS: Record<ServiceColorKey, string> = {
	ocean:   '#0ea5e9',
	coral:   '#f43f5e',
	amber:   '#f59e0b',
	teal:    '#14b8a6',
	emerald: '#10b981',
	indigo:  '#6366f1',
	purple:  '#a855f7',
	pink:    '#ec4899',
	orange:  '#f97316',
	lime:    '#84cc16',
	slate:   '#64748b',
	cyan:    '#06b6d4',
};

export function getServiceColor(key: string) {
	return SERVICE_COLORS[key as ServiceColorKey] ?? SERVICE_COLORS[DEFAULT_COLOR];
}

export function isValidColorKey(key: string): key is ServiceColorKey {
	return key in SERVICE_COLORS;
}
