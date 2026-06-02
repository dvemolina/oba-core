import { redirect } from '@sveltejs/kit';

export type Role = 'admin' | 'owner' | 'manager' | 'instructor';

export function userRole(locals: App.Locals): Role | null {
	return (locals.user?.role as Role) ?? null;
}

export function hasRole(locals: App.Locals, ...roles: Role[]): boolean {
	const role = userRole(locals);
	return role !== null && (roles as string[]).includes(role);
}

export function requireRole(locals: App.Locals, ...roles: Role[]): void {
	if (!hasRole(locals, ...roles)) redirect(302, '/');
}

export function canManageStaff(locals: App.Locals): boolean {
	return hasRole(locals, 'admin', 'owner');
}

export function canSeeFinancials(locals: App.Locals): boolean {
	return hasRole(locals, 'admin', 'owner');
}

export function canEditServices(locals: App.Locals): boolean {
	return hasRole(locals, 'admin', 'owner');
}

export function atLeastManager(locals: App.Locals): boolean {
	return hasRole(locals, 'admin', 'owner', 'manager');
}

export function isInstructorRole(locals: App.Locals): boolean {
	return hasRole(locals, 'instructor');
}
