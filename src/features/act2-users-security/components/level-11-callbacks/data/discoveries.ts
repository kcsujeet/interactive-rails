import type { DiscoveryDef } from '@/hooks/useDiscoveryGating';

export const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'raw-stored', label: 'Raw email stored without cleanup' },
	{ id: 'lookup-fails', label: 'Case-sensitive lookup returns nil' },
	{ id: 'no-welcome', label: 'No welcome email on signup' },
	{ id: 'no-hooks', label: 'Model has no lifecycle hooks' },
];
