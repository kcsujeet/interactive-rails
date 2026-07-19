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

// Observe phase shows just the 2 actors of a manual deploy: Laptop -> Server.
// Registry/Proxy/Container don't exist yet in the naive deploy world and only
// appear in the build phase (materializing step by step) and reward phase.
export const observeConnections: PipelineConnection[] = [
	{ from: 'laptop', to: 'server' },
];

// 5-stage chain for build + reward phases.
export const fullPipelineConnections: PipelineConnection[] = [
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

export const buildConnections = fullPipelineConnections;

// ─── Observe idle ──────────────────────────────────────────

function makeObserveStages(
	laptop: StageSpec,
	server: StageSpec,
): PipelineStage[] {
	return [
		{
			id: 'laptop',
			label: 'Dev Laptop',
			sublabel: laptop.sublabel,
			variant: laptop.variant,
			badge: laptop.badge,
		},
		{
			id: 'server',
			label: 'Server',
			sublabel: server.sublabel,
			variant: server.variant,
			badge: server.badge,
		},
	];
}

export const observeIdleStages: PipelineStage[] = makeObserveStages(
	{ sublabel: 'scp + ssh (no deploy tool)', variant: 'active' },
	{ sublabel: 'awaiting a deploy attempt', variant: 'default' },
);

// ─── Frames ────────────────────────────────────────────────

export interface PipelineFrame {
	stages: PipelineStage[];
	durationMs: number;
}

/**
 * Each probe plays a 2-stage (Laptop, Server) sequence. Each probe has a
 * DIFFERENT visual signature: variant cycling, laptop going danger on some
 * probes, varied frame counts (3 or 4), distinctive badges.
 */
export const PROBE_FRAMES: Record<string, PipelineFrame[]> = {
	// Transient restart window. Server red during restart, stays red after
	// (stranded requests) but no laptop-side failure.
	'scp-restart': [
		{
			stages: makeObserveStages(
				{ sublabel: 'scp -r . prod:/app', variant: 'active' },
				{ sublabel: 'receiving files...', variant: 'default' },
			),
			durationMs: 900,
		},
		{
			stages: makeObserveStages(
				{ sublabel: 'ssh prod "systemctl restart"', variant: 'active' },
				{
					sublabel: '8s restart window (requests dropped)',
					variant: 'danger',
					badge: 'RESTART',
				},
			),
			durationMs: 1300,
		},
		{
			stages: makeObserveStages(
				{ sublabel: 'done (unaware of outage)', variant: 'active' },
				{
					sublabel: 'back up, but 14 users saw 502',
					variant: 'danger',
					badge: '502!',
				},
			),
			durationMs: 1500,
		},
	],
	// Bundle install fails on the server. BOTH laptop and server go red.
	// This is the only probe where the laptop itself hits a failure.
	'git-pull': [
		{
			stages: makeObserveStages(
				{ sublabel: 'ssh prod "git pull"', variant: 'active' },
				{ sublabel: 'pulling origin...', variant: 'default' },
			),
			durationMs: 900,
		},
		{
			stages: makeObserveStages(
				{ sublabel: 'ssh prod "bundle install"', variant: 'active' },
				{
					sublabel: 'bundling live (traffic still on)',
					variant: 'default',
					badge: 'BUNDLE',
				},
			),
			durationMs: 1100,
		},
		{
			stages: makeObserveStages(
				{
					sublabel: 'ERROR: libxml2 missing on prod',
					variant: 'danger',
					badge: 'BUNDLE FAIL',
				},
				{
					sublabel: 'Puma crashed mid-install',
					variant: 'danger',
					badge: 'CRASHED',
				},
			),
			durationMs: 1100,
		},
		{
			stages: makeObserveStages(
				{ sublabel: 'app is down. SSH back in to fix.', variant: 'danger' },
				{
					sublabel: 'no puma, no traffic',
					variant: 'danger',
					badge: 'DOWN',
				},
			),
			durationMs: 1400,
		},
	],
	// The deceptive "it's up!" story. Server goes default with "UP" badge in the
	// middle frame (visually looks fine!) then flips to danger at the end.
	// This is the only probe with a green "UP" moment mid-sequence.
	'bad-release': [
		{
			stages: makeObserveStages(
				{ sublabel: 'pushed release (missing env)', variant: 'active' },
				{ sublabel: 'puma booting...', variant: 'default' },
			),
			durationMs: 900,
		},
		{
			stages: makeObserveStages(
				{ sublabel: 'done. systemctl says OK.', variant: 'active' },
				{
					sublabel: 'puma UP (process is alive)',
					variant: 'default',
					badge: 'UP',
				},
			),
			durationMs: 1200,
		},
		{
			stages: makeObserveStages(
				{ sublabel: 'unaware for 11 minutes', variant: 'active' },
				{
					sublabel: 'every request 500s (DB url missing)',
					variant: 'danger',
					badge: '500!',
				},
			),
			durationMs: 1600,
		},
	],
	// Rollback = another full deploy. Laptop stays red through most of the
	// sequence (multiple risky ops) and server eventually RECOVERS at the
	// end. Only probe with a "RECOVERED" frame, but the total outage was ~4min.
	rollback: [
		{
			stages: makeObserveStages(
				{ sublabel: 'prod is on fire. rolling back.', variant: 'danger' },
				{
					sublabel: 'serving broken v2 (500s)',
					variant: 'danger',
					badge: '500!',
				},
			),
			durationMs: 900,
		},
		{
			stages: makeObserveStages(
				{
					sublabel: 'git reset --hard <old-sha>',
					variant: 'danger',
					badge: 'ROLLING BACK',
				},
				{
					sublabel: 'still serving broken v2',
					variant: 'danger',
					badge: '500!',
				},
			),
			durationMs: 1100,
		},
		{
			stages: makeObserveStages(
				{
					sublabel: 'bundle install + restart puma',
					variant: 'danger',
				},
				{
					sublabel: '12s restart window on top',
					variant: 'danger',
					badge: '502!',
				},
			),
			durationMs: 1300,
		},
		{
			stages: makeObserveStages(
				{ sublabel: 'done. ~4min total outage.', variant: 'active' },
				{
					sublabel: 'back on v1 (but users left)',
					variant: 'default',
					badge: 'RECOVERED',
				},
			),
			durationMs: 1600,
		},
	],
	// Fleet-level split-brain. Only probe that explicitly references TWO
	// servers in sublabels and uses SPLIT/DRIFT badges.
	'two-servers': [
		{
			stages: makeObserveStages(
				{ sublabel: 'scp -> prod1 + prod2 (parallel)', variant: 'active' },
				{
					sublabel: 'prod1 + prod2 receiving',
					variant: 'default',
					badge: 'FLEET',
				},
			),
			durationMs: 900,
		},
		{
			stages: makeObserveStages(
				{ sublabel: 'prod2 scp hit network blip', variant: 'active' },
				{
					sublabel: 'prod1 OK  |  prod2 file truncated',
					variant: 'danger',
					badge: 'DRIFT',
				},
			),
			durationMs: 1300,
		},
		{
			stages: makeObserveStages(
				{ sublabel: 'done (unaware of drift)', variant: 'active' },
				{
					sublabel: '50% users see v1 | 50% see v2 assets',
					variant: 'danger',
					badge: 'SPLIT',
				},
			),
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
		registrySpec = { sublabel: 'scaffolded, unconfigured', variant: 'default' };
	}

	let proxySpec: StageSpec = {
		sublabel: '(not set up)',
		variant: 'inactive',
	};
	if (completedStep >= 4) {
		proxySpec = { sublabel: '/up 200, routing', variant: 'active' };
	} else if (completedStep >= 2) {
		proxySpec = { sublabel: '/up health check', variant: 'default' };
	} else if (completedStep >= 1) {
		proxySpec = { sublabel: 'scaffolded, unconfigured', variant: 'default' };
	}

	let containerSpec: StageSpec = {
		sublabel: '(not set up)',
		variant: 'inactive',
	};
	if (completedStep >= 4) {
		containerSpec = { sublabel: 'v1 healthy', variant: 'active' };
	} else if (completedStep >= 1) {
		containerSpec = {
			sublabel: 'scaffolded, unconfigured',
			variant: 'default',
		};
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
	proxy: { sublabel: '/up 200, routing', variant: 'active' },
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
				proxy: { sublabel: '/up 200, shifted to v2', variant: 'active' },
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
					sublabel: '/up returns 503 on v2',
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
				proxy: { sublabel: 'gate held, v1 only', variant: 'active' },
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
				proxy: { sublabel: '/up 200, routing v1', variant: 'active' },
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
				proxy: { sublabel: '/up 200, routing v2', variant: 'active' },
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
				proxy: { sublabel: '/up 200, routing v2', variant: 'active' },
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
				proxy: { sublabel: '/up 200, routing v2', variant: 'active' },
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
				proxy: { sublabel: '/up 200, routing v2', variant: 'active' },
				container: { sublabel: 'v2 healthy', variant: 'active' },
				server: { sublabel: 'fleet serving v2', variant: 'active' },
			}),
			durationMs: 1500,
		},
	],
};
