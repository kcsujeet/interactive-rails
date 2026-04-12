import type { Act } from '@/types';
import { level1Environment } from './level-1-environment';
import { level2FirstBoot } from './level-2-first-boot';
import { level3Model } from './level-3-model';
import { level4CRUD } from './level-4-crud';
import { level5Routes } from './level-5-routes';
import { level6Controller } from './level-6-controller';
import { level7Serializers } from './level-7-serializers';
import { level8Associations } from './level-8-associations';

export const actOne: Act = {
	id: 1,
	name: 'The Foundation',
	tagline: 'Build a working API from nothing.',
	description:
		'Build a Rails 8 API from scratch: environment setup, project creation, models, controllers, routes, serializers, and associations. By the end, you have a working product catalog API.',
	levels: [
		level1Environment,
		level2FirstBoot,
		level3Model,
		level4CRUD,
		level5Routes,
		level6Controller,
		level7Serializers,
		level8Associations,
	],
	unlockedNodes: ['terminal', 'postgres', 'sqlite'],
	metricsVisible: false,
};
