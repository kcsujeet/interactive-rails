import type { DiscoveryDef } from '@/hooks/useDiscoveryGating';

export const DISCOVERY_DEFS: DiscoveryDef[] = [
	{
		id: 'buyer-cant-find',
		label: 'Buyers see "0 results" on the storefront for listings that exist',
	},
	{
		id: 'duplicate-accounts',
		label: 'New users sign up twice when no welcome email arrives',
	},
];
