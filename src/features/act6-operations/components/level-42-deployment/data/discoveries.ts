export const DISCOVERY_DEFS = [
	{ id: 'downtime', label: 'Restart drops traffic for several seconds' },
	{ id: 'no-rollback', label: 'No fast rollback when a release is bad' },
	{ id: 'no-health-gate', label: 'Broken releases still serve real traffic' },
	{ id: 'irreproducible', label: 'Servers drift: "works on my laptop"' },
	{ id: 'fleet-fragility', label: 'One unhealthy server takes the fleet down' },
];
