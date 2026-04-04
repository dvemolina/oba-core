// src/lib/features/clients/types.ts
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Client {
	id: string;
	firstName: string;
	lastName: string;
	phone: string | null;
	email: string | null;
	nationality: string | null;
	skillLevel: SkillLevel | null;
	notes: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateClientInput {
	firstName: string;
	lastName: string;
	phone?: string;
	email?: string;
	nationality?: string;
	skillLevel?: SkillLevel;
	notes?: string;
}

export interface UpdateClientInput extends Partial<CreateClientInput> {}
