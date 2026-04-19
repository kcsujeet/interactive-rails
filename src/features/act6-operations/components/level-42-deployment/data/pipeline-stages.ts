import type {
	PipelineConnection,
	PipelineStage,
} from '@/components/levels/PipelineFlow';
import type { StressScenario } from '@/hooks/useStressTest';

const baseObserveStages: PipelineStage[] = [
	{
		id: 'laptop',
		label: 'Dev Laptop',
		sublabel: 'scp + ssh',
		variant: 'active',
	},
	{
		id: 'registry',
		label: 'Registry',
		sublabel: '(not set up)',
		variant: 'inactive',
	},
	{
		id: 'proxy',
		label: 'Proxy',
		sublabel: '(not set up)',
		variant: 'inactive',
	},
	{
		id: 'container',
		label: 'Container',
		sublabel: '(not set up)',
		variant: 'inactive',
	},
];

interface ServerState {
	sublabel: string;
	variant: 'default' | 'active' | 'danger' | 'inactive';
	badge?: string;
	laptopSublabel?: string;
}

const SERVER_STATE_BY_PROBE: Record<string, ServerState> = {
	'scp-restart': {
		sublabel: '~8s of 502s during restart',
		variant: 'danger',
		badge: '502!',
		laptopSublabel: 'scp -r . prod:/app',
	},
	'git-pull': {
		sublabel: 'Puma dead: libxml2 missing',
		variant: 'danger',
		badge: 'BOOT FAIL',
		laptopSublabel: 'ssh prod "git pull"',
	},
	'bad-release': {
		sublabel: '500 per request (bad env)',
		variant: 'danger',
		badge: '500!',
		laptopSublabel: 'pushed broken release',
	},
	rollback: {
		sublabel: 'redeploying old sha',
		variant: 'danger',
		badge: '502!',
		laptopSublabel: 'git reset --hard',
	},
	'two-servers': {
		sublabel: 'split-brain: mismatched assets',
		variant: 'danger',
		badge: 'DRIFT',
		laptopSublabel: 'scp to prod1 + prod2',
	},
};

const IDLE_SERVER_STATE: ServerState = {
	sublabel: 'awaiting a deploy attempt',
	variant: 'default',
};

export function observeStagesFor(lastProbeId: string | null): PipelineStage[] {
	const state = lastProbeId
		? (SERVER_STATE_BY_PROBE[lastProbeId] ?? IDLE_SERVER_STATE)
		: IDLE_SERVER_STATE;

	const laptop = state.laptopSublabel
		? { ...baseObserveStages[0], sublabel: state.laptopSublabel }
		: baseObserveStages[0];

	return [
		laptop,
		baseObserveStages[1],
		baseObserveStages[2],
		baseObserveStages[3],
		{
			id: 'server',
			label: 'Server',
			sublabel: state.sublabel,
			variant: state.variant,
			badge: state.badge,
		},
	];
}

export const observeConnections: PipelineConnection[] = [
	{ from: 'laptop', to: 'registry' },
	{ from: 'registry', to: 'proxy' },
	{ from: 'proxy', to: 'container' },
	{ from: 'container', to: 'server' },
];

export function rewardStagesFor(
	lastScenario: StressScenario | undefined,
): PipelineStage[] {
	const ok = lastScenario?.expectedResult === 'allowed';
	const blocked = lastScenario?.expectedResult === 'blocked';
	const registryDanger = lastScenario?.id === 'broken-push';
	const proxyGates = lastScenario?.id === 'deploy-broken-health';

	return [
		{
			id: 'laptop',
			label: 'Dev Laptop',
			sublabel: 'kamal deploy',
			variant: 'active',
		},
		{
			id: 'registry',
			label: 'Registry',
			sublabel: registryDanger ? 'build rejected' : 'image pushed',
			variant: registryDanger ? 'danger' : 'active',
			badge: registryDanger ? 'FAIL' : undefined,
		},
		{
			id: 'proxy',
			label: 'Proxy',
			sublabel: proxyGates
				? '/up 500 — gate held'
				: ok
					? '/up 200 — routing'
					: 'idle',
			variant: 'active',
		},
		{
			id: 'container',
			label: 'Container',
			sublabel: blocked ? 'rotation aborted' : 'v2 healthy',
			variant: blocked ? 'danger' : 'active',
			badge: blocked ? 'NO SHIFT' : undefined,
		},
		{
			id: 'server',
			label: 'Server',
			sublabel: 'fleet healthy',
			variant: 'active',
		},
	];
}

export const rewardConnections: PipelineConnection[] = [
	{ from: 'laptop', to: 'registry', dots: 'clean' },
	{ from: 'registry', to: 'proxy', dots: 'clean' },
	{ from: 'proxy', to: 'container', dots: 'clean' },
	{ from: 'container', to: 'server', dots: 'clean' },
];
