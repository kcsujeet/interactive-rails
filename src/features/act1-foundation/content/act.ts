import type { Act } from '@/types';
import { level1Environment } from './level-1-environment';
import { level2FirstBoot } from './level-2-first-boot';
import { level3Model } from './level-3-model';
import { level4Associations } from './level-4-associations';
import { level5CRUD } from './level-5-crud';
import { level6Routes } from './level-6-routes';
import { level7Controller } from './level-7-controller';
import { level8Serializers } from './level-8-serializers';

export const actOne: Act = {
	id: 1,
	name: 'The Foundation',
	tagline: 'Build a working API from nothing.',
	description:
		'Build a Rails 8 API from scratch: environment setup, project creation, models, associations, CRUD, routes, controllers, and serializers. By the end, you have a working product catalog API.',
	levels: [
		level1Environment,
		level2FirstBoot,
		level3Model,
		level4Associations,
		level5CRUD,
		level6Routes,
		level7Controller,
		level8Serializers,
	],
	unlockedNodes: ['terminal', 'postgres', 'sqlite'],
	metricsVisible: false,
};
