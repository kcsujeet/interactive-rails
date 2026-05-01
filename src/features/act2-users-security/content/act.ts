import type { Act } from '@/types';
import { level9Authentication } from './level-9-authentication';
import { level10Encryption } from './level-10-encryption';
import { level11Authorization } from './level-11-authorization';
import { level12Validations } from './level-12-validations';
import { level13StrongParams } from './level-13-strong-params';
import { level14Testing } from './level-14-testing';

export const actTwo: Act = {
	id: 2,
	name: 'Users & Security',
	tagline: 'Users are signing up. Time to lock it down.',
	description:
		'Your API is live and users are hitting it. But anyone can access anything, sensitive fields sit in plaintext, bad data is getting through, and there is no protection. Add authentication, encryption, authorization, validations, parameter filtering, and testing to make it production-safe.',
	levels: [
		level9Authentication,
		level10Encryption,
		level11Authorization,
		level12Validations,
		level13StrongParams,
		level14Testing,
	],
	unlockedNodes: [
		'authentication',
		'encryption',
		'policy',
		'validation',
		'test',
		'credentials',
	],
	metricsVisible: false,
};
