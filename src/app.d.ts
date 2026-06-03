declare global {
	namespace App {
		interface Locals {
			user?: {
				id: string;
				name: string;
				email: string;
				emailVerified: boolean;
				image: string | null;
				createdAt: Date;
				updatedAt: Date;
				role: string | null;
				roles: string[];
				banned: boolean | null;
				banReason: string | null;
				banExpires: Date | null;
				phone: string | null;
				bio: string | null;
				active: boolean;
			};
			session?: {
				id: string;
				expiresAt: Date;
				token: string;
				userId: string;
				ipAddress?: string | null;
				userAgent?: string | null;
			};
		}
	}
}

export {};
