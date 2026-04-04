import { describe, it, expect } from 'vitest';
import {
	skillLevelEnum,
	serviceTypeEnum,
	bookingStatusEnum,
	paymentStatusEnum
} from './schema';

describe('schema enums', () => {
	it('skillLevel has the correct values', () => {
		expect(skillLevelEnum.enumValues).toEqual(['beginner', 'intermediate', 'advanced']);
	});

	it('serviceType has the correct values', () => {
		expect(serviceTypeEnum.enumValues).toEqual(['lesson', 'camp', 'product', 'rental']);
	});

	it('bookingStatus has the correct values', () => {
		expect(bookingStatusEnum.enumValues).toEqual(['pending', 'confirmed', 'cancelled']);
	});

	it('paymentStatus has the correct values', () => {
		expect(paymentStatusEnum.enumValues).toEqual(['pending', 'partial', 'paid']);
	});
});
