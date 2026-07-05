import type { ProbeConfig } from '@/components/levels/ProbeTerminal';

// Damage payload paints the customer-facing dashboard when a probe fires.
// Two customer surfaces (storefront search, signup confirmation) -- one for
// each on-concept step. Each probe paints damage on exactly one surface
// plus an incident-log line summarizing the customer-visible cost.

export interface StorefrontDamage {
	emptyResults: true;
	storedValue: string; // the dirty stored row, e.g. '"  Ceramic Mug  "'
}

export interface SignupDamage {
	duplicateAccounts: true;
	primaryEmail: string;
	duplicateEmail: string;
}

export interface DashboardDamage {
	storefront?: StorefrontDamage;
	signup?: SignupDamage;
	incidentLog: string[];
}

export interface DamagedProbe extends ProbeConfig {
	damage: DashboardDamage;
}

// Probes show the damage that customers experience because of the missing
// normalization (positive callback case) and the missing welcome-email
// trigger (negative callback case, fix is in the controller). Each probe
// is a customer-facing failure (lost sale, duplicate accounts), not an
// artifact inspection.
export const PROBES: DamagedProbe[] = [
	{
		id: 'buyer-search-misses',
		label: 'Buyer searches the storefront for "Ceramic Mug"',
		command: 'GET /api/products?name=Ceramic+Mug',
		responseLines: [
			{ text: 'HTTP/1.1 200 OK', color: 'cyan' },
			{ text: '{"data":[]}  # 0 results', color: 'red' },
			{ text: '', color: 'muted' },
			{
				text: 'Stored row: name = "  Ceramic Mug  " (seller typed extra spaces).',
				color: 'yellow',
			},
			{
				text: 'find_by(name: "Ceramic Mug") misses. Buyer leaves. Seller loses the sale.',
				color: 'red',
			},
		],
		damage: {
			storefront: {
				emptyResults: true,
				storedValue: '"  Ceramic Mug  "',
			},
			incidentLog: [
				'47 buyers searched "Ceramic Mug" today and got 0 results.',
				'Marketplace lost ~$1.2K in GMV before anyone noticed.',
			],
		},
		story: [
			'A seller submits a new listing with name "  Ceramic Mug  " (extra whitespace).',
			'The model saves the value exactly as typed -- no cleanup before the INSERT.',
			'Hours later, a buyer searches the storefront for "Ceramic Mug".',
			'The query is a clean string match against a dirty stored value. It returns 0 results.',
			'The buyer assumes the listing does not exist and leaves. The seller loses the sale.',
		],
	},
	{
		id: 'duplicate-signup',
		label: 'New user signs up, never receives a welcome email',
		command: 'POST /api/users (signup)',
		responseLines: [
			{ text: 'HTTP/1.1 201 Created', color: 'cyan' },
			{ text: '', color: 'muted' },
			{
				text: '(no welcome email sent. UsersController#create only does User.new + save.)',
				color: 'yellow',
			},
			{
				text: 'Customer waits, assumes signup failed, signs up again with a different address.',
				color: 'red',
			},
			{
				text: 'Two accounts now exist for the same person. Cold inbox + duplicate-account confusion.',
				color: 'red',
			},
		],
		damage: {
			signup: {
				duplicateAccounts: true,
				primaryEmail: 'alice@example.com',
				duplicateEmail: 'alice2@example.com',
			},
			incidentLog: [
				'No welcome email arrived. The customer signed up twice.',
				'Support now juggles two accounts for one person. Order history is split.',
			],
		},
		story: [
			'A new customer completes signup and waits for a welcome email.',
			'The controller does User.new(user_params) + save and renders the JSON response.',
			'Nothing in the model or controller triggers a welcome email after the save.',
			'After 10 minutes with no email, the customer assumes the form was broken.',
			'They sign up again with a different address. Now two accounts exist for one person.',
		],
	},
];

// Map probe IDs to discovery IDs they trigger
export const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'buyer-search-misses': 'buyer-cant-find',
	'duplicate-signup': 'duplicate-accounts',
};
