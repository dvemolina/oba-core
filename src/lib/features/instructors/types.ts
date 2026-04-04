export interface Instructor {
	id: string;
	name: string;
	phone: string | null;
	email: string | null;
	bio: string | null;
	active: boolean;
	userId: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateInstructorInput {
	name: string;
	phone?: string;
	email?: string;
	bio?: string;
}

export interface UpdateInstructorInput extends Partial<CreateInstructorInput> {
	active?: boolean;
}
