import type { Act } from '@/types';
import { level11Callbacks } from '../components/level-11-callbacks/data/content';
import { level9Authentication } from './level-9-authentication';
import { level10Validations } from './level-10-validations';
import { level12Authorization } from './level-12-authorization';
import { level13Testing } from './level-13-testing';
import { level14StrongParams } from './level-14-strong-params';
import { level15CORS } from './level-15-cors';

export const actTwo: Act = {
	id: 2,
	name: 'Guards & Gates',
	tagline: 'Users are signing up. Time to lock it down.',
	description:
		'Your API is live and users are hitting it. But anyone can access anything, bad data is getting through, and there is no protection. Add authentication, validations, authorization, testing, and parameter filtering to make it production-safe, then connect a React frontend.',
	levels: [
		level9Authentication,
		level10Validations,
		level11Callbacks,
		level12Authorization,
		level13Testing,
		level14StrongParams,
		level15CORS,
	],
	unlockedNodes: [
		'authentication',
		'validation',
		'callback',
		'policy',
		'test',
		'cors',
		'rate_limiter',
		'credentials',
	],
	metricsVisible: false,
};
