import type {
	PipelineConnection,
	PipelineStage,
} from '@/components/levels/PipelineFlow';

// ─── Shared node identities ────────────────────────────────

type Variant = 'default' | 'active' | 'danger' | 'inactive';

interface StageSpec {
	sublabel: string;
	variant: Variant;
	badge?: string;
}

interface StageOverrides {
	laptop?: StageSpec;
	registry?: StageSpec;
	proxy?: StageSpec;
	container?: StageSpec;
	server?: StageSpec;
}

function makeStages(overrides: StageOverrides): PipelineStage[] {
	return [
		{
			id: 'laptop',
			label: 'Dev Laptop',
			sublabel: overrides.laptop?.sublabel ?? 'scp + ssh',
			variant: overrides.laptop?.variant ?? 'active',
			badge: overrides.laptop?.badge,
		},
		{
			id: 'registry',
			label: 'Registry',
			sublabel: overrides.registry?.sublabel ?? '(not set up)',
			variant: overrides.registry?.variant ?? 'inactive',
			badge: overrides.registry?.badge,
		},
		{
			id: 'proxy',
			label: 'Proxy',
			sublabel: overrides.proxy?.sublabel ?? '(not set up)',
			variant: overrides.proxy?.variant ?? 'inactive',
			badge: overrides.proxy?.badge,
		},
		{
			id: 'container',
			label: 'Container',
			sublabel: overrides.container?.sublabel ?? '(not set up)',
			variant: overrides.container?.variant ?? 'inactive',
			badge: overrides.container?.badge,
		},
		{
			id: 'server',
			label: 'Server',
			sublabel: overrides.server?.sublabel ?? 'awaiting a deploy attempt',
			variant: overrides.server?.variant ?? 'default',
			badge: overrides.server?.badge,
		},
	];
}

// ─── Connections ───────────────────────────────────────────

export const observeConnections: PipelineConnection[] = [
	{ from: 'laptop', to: 'registry' },
	{ from: 'registry', to: 'proxy' },
	{ from: 'proxy', to: 'container' },
	{ from: 'container', to: 'server' },
];

export const rewardConnections: PipelineConnection[] = [
	{ from: 'laptop', to: 'registry', dots: 'clean' },
	{ from: 'registry', to: 'proxy', dots: 'clean' },
	{ from: 'proxy', to: 'container', dots: 'clean' },
	{ from: 'container', to: 'server', dots: 'clean' },
];

export const buildConnections = observeConnections;

// ─── Observe idle ──────────────────────────────────────────

export const observeIdleStages: PipelineStage[] = makeStages({});

// ─── Frames ────────────────────────────────────────────────

export interface PipelineFrame {
	stages: PipelineStage[];
	durationMs: number;
}

/**
 * Multi-frame animations per probe. Each probe plays 3 frames: setup, hit,
 * fallout. After the last frame the stages persist until the next probe or
 * reset clears them.
 */
export const PROBE_FRAMES: Record<string, PipelineFrame[]> = {
	'scp-restart': [
		{
			stages: makeStages({
				laptop: { sublabel: 'scp -r . prod:/app', variant: 'active' },
				server: { sublabel: 'receiving files...', variant: 'default' },
			}),
			durationMs: 900,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'ssh prod "restart puma"', variant: 'active' },
				server: {
					sublabel: 'systemctl restart (in progress)',
					variant: 'danger',
					badge: 'RESTART',
				},
			}),
			durationMs: 1100,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'done', variant: 'active' },
				server: {
					sublabel: '~8s of 502s to real users',
					variant: 'danger',
					badge: '502!',
				},
			}),
			durationMs: 1600,
		},
	],
	'git-pull': [
		{
			stages: makeStages({
				laptop: { sublabel: 'ssh prod "git pull"', variant: 'active' },
				server: { sublabel: 'pulling origin...', variant: 'default' },
			}),
			durationMs: 900,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'ssh prod "bundle install"', variant: 'active' },
				server: {
					sublabel: 'bundling on prod (live traffic!)',
					variant: 'danger',
					badge: 'BUNDLE',
				},
			}),
			durationMs: 1100,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'aborted', variant: 'active' },
				server: {
					sublabel: 'Puma dead: libxml2 missing',
					variant: 'danger',
					badge: 'BOOT FAIL',
				},
			}),
			durationMs: 1600,
		},
	],
	'bad-release': [
		{
			stages: makeStages({
				laptop: { sublabel: 'pushed broken release', variant: 'active' },
				server: { sublabel: 'puma boot...', variant: 'default' },
			}),
			durationMs: 900,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'done', variant: 'active' },
				server: {
					sublabel: 'puma UP — but DATABASE_URL missing',
					variant: 'default',
					badge: 'UP',
				},
			}),
			durationMs: 1100,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'unaware', variant: 'active' },
				server: {
					sublabel: '100% of requests raise 500',
					variant: 'danger',
					badge: '500!',
				},
			}),
			durationMs: 1600,
		},
	],
	rollback: [
		{
			stages: makeStages({
				laptop: { sublabel: 'git reset --hard abc123', variant: 'active' },
				server: {
					sublabel: 'still serving broken v2',
					variant: 'danger',
					badge: '500!',
				},
			}),
			durationMs: 900,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'ssh prod "bundle install"', variant: 'active' },
				server: {
					sublabel: 'bundling old Gemfile.lock...',
					variant: 'danger',
					badge: 'BUNDLE',
				},
			}),
			durationMs: 1100,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'ssh prod "restart puma"', variant: 'active' },
				server: {
					sublabel: 'another 12s of 502s',
					variant: 'danger',
					badge: '502!',
				},
			}),
			durationMs: 1600,
		},
	],
	'two-servers': [
		{
			stages: makeStages({
				laptop: { sublabel: 'scp to prod1 + prod2', variant: 'active' },
				server: { sublabel: 'receiving files...', variant: 'default' },
			}),
			durationMs: 900,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'scp prod2 hit blip', variant: 'active' },
				server: {
					sublabel: 'prod1 OK  |  prod2 truncated',
					variant: 'danger',
					badge: 'DRIFT',
				},
			}),
			durationMs: 1100,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'done', variant: 'active' },
				server: {
					sublabel: 'split-brain: mismatched assets',
					variant: 'danger',
					badge: 'MIXED',
				},
			}),
			durationMs: 1600,
		},
	],
};

/**
 * Build-phase progression: each completed step materializes more of the pipeline.
 */
export function buildStagesFor(completedStep: number): PipelineStage[] {
	const laptopSublabel = completedStep >= 0 ? 'kamal 2.3.0 ready' : 'scp + ssh';

	let registrySpec: StageSpec = {
		sublabel: '(not set up)',
		variant: 'inactive',
	};
	if (completedStep >= 3) {
		registrySpec = { sublabel: 'authenticated', variant: 'active' };
	} else if (completedStep >= 2) {
		registrySpec = { sublabel: 'awaiting image', variant: 'default' };
	} else if (completedStep >= 1) {
		registrySpec = { sublabel: 'stub (kamal init)', variant: 'default' };
	}

	let proxySpec: StageSpec = {
		sublabel: '(not set up)',
		variant: 'inactive',
	};
	if (completedStep >= 4) {
		proxySpec = { sublabel: '/up 200 — routing', variant: 'active' };
	} else if (completedStep >= 2) {
		proxySpec = { sublabel: '/up health check', variant: 'default' };
	} else if (completedStep >= 1) {
		proxySpec = { sublabel: 'stub (kamal init)', variant: 'default' };
	}

	let containerSpec: StageSpec = {
		sublabel: '(not set up)',
		variant: 'inactive',
	};
	if (completedStep >= 4) {
		containerSpec = { sublabel: 'v1 healthy', variant: 'active' };
	} else if (completedStep >= 1) {
		containerSpec = { sublabel: 'stub (kamal init)', variant: 'default' };
	}

	const serverSpec: StageSpec =
		completedStep >= 4
			? { sublabel: 'fleet healthy', variant: 'active' }
			: { sublabel: 'awaiting first deploy', variant: 'default' };

	return makeStages({
		laptop: { sublabel: laptopSublabel, variant: 'active' },
		registry: registrySpec,
		proxy: proxySpec,
		container: containerSpec,
		server: serverSpec,
	});
}

// ─── Reward idle + frames (model v1/v2 rotation) ──────────

export const rewardIdleStages: PipelineStage[] = makeStages({
	laptop: { sublabel: 'kamal deploy', variant: 'active' },
	registry: { sublabel: 'image ready (v1)', variant: 'active' },
	proxy: { sublabel: '/up 200 — routing', variant: 'active' },
	container: { sublabel: 'v1 healthy', variant: 'active' },
	server: { sublabel: 'fleet healthy', variant: 'active' },
});

export const SCENARIO_FRAMES: Record<string, PipelineFrame[]> = {
	'deploy-ok': [
		{
			stages: makeStages({
				laptop: { sublabel: 'kamal deploy v2', variant: 'active' },
				registry: { sublabel: 'building image...', variant: 'active' },
				proxy: { sublabel: '/up 200 (routing v1)', variant: 'active' },
				container: { sublabel: 'v1 healthy', variant: 'active' },
				server: { sublabel: 'fleet serving v1', variant: 'active' },
			}),
			durationMs: 900,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'pushed v2 to registry', variant: 'active' },
				registry: { sublabel: 'v1 + v2 tags', variant: 'active' },
				proxy: { sublabel: 'polling v2 /up', variant: 'active' },
				container: {
					sublabel: 'v1 live  |  v2 booting',
					variant: 'default',
					badge: 'ROTATE',
				},
				server: { sublabel: 'fleet serving v1', variant: 'active' },
			}),
			durationMs: 1200,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'deploy complete', variant: 'active' },
				registry: { sublabel: 'image: v2', variant: 'active' },
				proxy: { sublabel: '/up 200 — shifted to v2', variant: 'active' },
				container: {
					sublabel: 'v2 healthy  |  v1 stopped',
					variant: 'active',
					badge: 'SHIFTED',
				},
				server: { sublabel: 'fleet serving v2', variant: 'active' },
			}),
			durationMs: 1500,
		},
	],
	'deploy-broken-health': [
		{
			stages: makeStages({
				laptop: { sublabel: 'kamal deploy v2', variant: 'active' },
				registry: { sublabel: 'building image...', variant: 'active' },
				proxy: { sublabel: '/up 200 (routing v1)', variant: 'active' },
				container: { sublabel: 'v1 healthy', variant: 'active' },
				server: { sublabel: 'fleet serving v1', variant: 'active' },
			}),
			durationMs: 900,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'pushed v2', variant: 'active' },
				registry: { sublabel: 'v1 + v2 tags', variant: 'active' },
				proxy: {
					sublabel: '/up returns 500 on v2',
					variant: 'default',
					badge: 'RETRY',
				},
				container: {
					sublabel: 'v1 live  |  v2 unhealthy',
					variant: 'danger',
					badge: 'BOOT FAIL',
				},
				server: { sublabel: 'fleet serving v1', variant: 'active' },
			}),
			durationMs: 1400,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'deploy aborted', variant: 'active' },
				registry: { sublabel: 'v1 + v2 tags', variant: 'active' },
				proxy: { sublabel: 'gate held — v1 only', variant: 'active' },
				container: {
					sublabel: 'v1 live  |  v2 stopped',
					variant: 'active',
					badge: 'NO SHIFT',
				},
				server: { sublabel: 'fleet still on v1', variant: 'active' },
			}),
			durationMs: 1500,
		},
	],
	rollback: [
		{
			stages: makeStages({
				laptop: { sublabel: 'kamal rollback v1-sha', variant: 'active' },
				registry: { sublabel: 'image: v2 (bad)', variant: 'default' },
				proxy: { sublabel: 'routing v2', variant: 'default' },
				container: {
					sublabel: 'v2 live (bad)',
					variant: 'danger',
					badge: '500!',
				},
				server: { sublabel: 'fleet serving v2', variant: 'danger' },
			}),
			durationMs: 900,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'tag swap in flight', variant: 'active' },
				registry: { sublabel: 'v1 tag ready', variant: 'active' },
				proxy: {
					sublabel: 'switching target...',
					variant: 'active',
					badge: 'SWAP',
				},
				container: {
					sublabel: 'v1 container reused',
					variant: 'active',
					badge: 'SHIFT',
				},
				server: { sublabel: 'fleet transitioning', variant: 'default' },
			}),
			durationMs: 1000,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'rolled back (2.1s)', variant: 'active' },
				registry: { sublabel: 'image: v1', variant: 'active' },
				proxy: { sublabel: '/up 200 — routing v1', variant: 'active' },
				container: { sublabel: 'v1 healthy', variant: 'active' },
				server: { sublabel: 'fleet serving v1', variant: 'active' },
			}),
			durationMs: 1500,
		},
	],
	'fleet-deploy': [
		{
			stages: makeStages({
				laptop: { sublabel: 'kamal deploy v2', variant: 'active' },
				registry: { sublabel: 'pushed v2', variant: 'active' },
				proxy: { sublabel: 'rotating prod1', variant: 'active' },
				container: {
					sublabel: 'prod1: v1→v2  |  prod2: v1',
					variant: 'default',
					badge: 'ROTATE',
				},
				server: {
					sublabel: 'prod1 shifting  |  prod2 serving v1',
					variant: 'active',
				},
			}),
			durationMs: 1200,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'prod1 done', variant: 'active' },
				registry: { sublabel: 'image: v2', variant: 'active' },
				proxy: { sublabel: 'rotating prod2', variant: 'active' },
				container: {
					sublabel: 'prod1: v2  |  prod2: v1→v2',
					variant: 'default',
					badge: 'ROTATE',
				},
				server: {
					sublabel: 'prod1 serving v2  |  prod2 shifting',
					variant: 'active',
				},
			}),
			durationMs: 1400,
		},
		{
			stages: makeStages({
				laptop: { sublabel: 'fleet deploy complete', variant: 'active' },
				registry: { sublabel: 'image: v2', variant: 'active' },
				proxy: { sublabel: '/up 200 — routing v2', variant: 'active' },
				container: {
					sublabel: 'prod1: v2  |  prod2: v2',
					variant: 'active',
					badge: 'SHIFTED',
				},
				server: { sublabel: 'fleet serving v2', variant: 'active' },
			}),
			durationMs: 1500,
		},
	],
	'broken-push': [
		{
			stages: makeStages({
				laptop: { sublabel: 'kamal deploy v3', variant: 'active' },
				registry: { sublabel: 'image: v2', variant: 'active' },
				proxy: { sublabel: '/up 200 — routing v2', variant: 'active' },
				container: { sublabel: 'v2 healthy', variant: 'active' },
				server: { sublabel: 'fleet serving v2', variant: 'active' },
			}),
			durationMs: 900,
		},
		{
			stages: makeStages({
				laptop: {
					sublabel: 'docker build FAILED (typo)',
					variant: 'danger',
					badge: 'BUILD FAIL',
				},
				registry: { sublabel: 'image: v2 (unchanged)', variant: 'active' },
				proxy: { sublabel: '/up 200 — routing v2', variant: 'active' },
				container: { sublabel: 'v2 healthy', variant: 'active' },
				server: { sublabel: 'fleet serving v2', variant: 'active' },
			}),
			durationMs: 1200,
		},
		{
			stages: makeStages({
				laptop: {
					sublabel: 'deploy aborted; prod untouched',
					variant: 'active',
				},
				registry: { sublabel: 'image: v2', variant: 'active' },
				proxy: { sublabel: '/up 200 — routing v2', variant: 'active' },
				container: { sublabel: 'v2 healthy', variant: 'active' },
				server: { sublabel: 'fleet serving v2', variant: 'active' },
			}),
			durationMs: 1500,
		},
	],
};
