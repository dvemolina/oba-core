export interface Instructor {
	id: string;      // user.id
	name: string;
	phone: string | null;
	email: string;   // from user.email (never null)
	bio: string | null;
	active: boolean;
	roles: string[];
}
