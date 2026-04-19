import type {
	PipelineConnection,
	PipelineStage,
} from '@/components/levels/PipelineFlow';
import type { StressScenario } from '@/hooks/useStressTest';

export const observeStages: PipelineStage[] = [
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
	{
		id: 'server',
		label: 'Server',
		sublabel: 'systemctl restart',
		variant: 'danger',
		badge: '502!',
	},
];

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
