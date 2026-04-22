export type WhatsappSessionState =
	| 'IDLE'
	| 'COLLECTING_RESERVATION'
	| 'AWAITING_APPROVAL'
	| 'CONFIRMED'
	| 'REJECTED';

export interface WhatsappSession {
	whatsappId: string;
	state: WhatsappSessionState;
	serviceType: string | null;
	collectedData: Record<string, unknown> | null;
	reservationId: string | null;
	language: string | null;
	lastActivity: Date;
}

export interface UpsertWhatsappSessionInput {
	whatsappId: string;
	state?: WhatsappSessionState;
	serviceType?: string | null;
	collectedData?: Record<string, unknown> | null;
	reservationId?: string | null;
	language?: string;
}

export interface UpdateWhatsappSessionInput {
	state?: WhatsappSessionState;
	serviceType?: string | null;
	collectedData?: Record<string, unknown> | null;
	reservationId?: string | null;
	language?: string;
}
