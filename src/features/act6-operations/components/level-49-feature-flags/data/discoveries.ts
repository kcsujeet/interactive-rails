import type { DiscoveryDef } from '@/hooks/useDiscoveryGating';

export const DISCOVERY_DEFS: DiscoveryDef[] = [
	{
		id: 'deploy-equals-release',
		label: 'Deploy and release are coupled (every release ships code)',
	},
	{
		id: 'no-launch-pinning',
		label:
			'Cannot pin a release to a specific time without coordinating a deploy',
	},
	{
		id: 'no-kill-switch',
		label: 'No kill switch when a vendor integration goes flaky',
	},
];
