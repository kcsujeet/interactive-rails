import { AlertCircle, Search } from 'lucide-react';
import type { DashboardDamage } from './data/probes';

// ──────────────────────────────────────────────
// Customer Impact Dashboard
// ──────────────────────────────────────────────
//
// Two customer-facing surfaces (storefront search, signup confirmation),
// one per on-concept step. Each surface stays clean idle and renders the
// damage when a probe (observe) or scenario (reward) targets it.
//
// In observe, damage is painted from the latest probe's `damage` payload.
// In reward, damage is always null (the fix prevents the customer from ever
// seeing the broken state).

interface ColumnPanelProps {
	title: string;
	damaged?: boolean;
	children: React.ReactNode;
}

function ColumnPanel({ title, damaged, children }: ColumnPanelProps) {
	return (
		<div
			className={`rounded-md p-3 flex flex-col gap-2 min-w-0 h-full transition-colors duration-300 ${
				damaged
					? 'border-2 border-destructive bg-destructive/10'
					: 'border border-border bg-card'
			}`}
		>
			<div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
				{title}
			</div>
			{children}
		</div>
	);
}

interface ResultRow {
	name: string;
	price: string;
}

const STOREFRONT_RESULTS: ResultRow[] = [
	{ name: 'Ceramic Mug', price: '$19.99' },
	{ name: 'Ceramic Mug (large)', price: '$24.99' },
	{ name: 'Hand-thrown Mug', price: '$32.00' },
];

interface StorefrontSearchProps {
	damage?: DashboardDamage['storefront'];
}

function StorefrontSearch({ damage }: StorefrontSearchProps) {
	return (
		<ColumnPanel damaged={!!damage} title="Storefront Search">
			<div className="rounded border border-border bg-background px-2 py-1.5 flex items-center gap-2">
				<Search className="w-3 h-3 text-muted-foreground shrink-0" />
				<span className="text-xs text-foreground font-mono">Ceramic Mug</span>
			</div>
			<div className="flex-1 min-h-0 flex flex-col gap-1.5">
				{damage ? (
					<>
						<div className="rounded-md border-2 border-destructive bg-destructive/10 p-3 flex flex-col items-center justify-center gap-1 flex-1 min-h-0">
							<div className="text-sm font-bold text-destructive">
								0 results found
							</div>
							<div className="text-[10px] text-destructive text-center leading-tight">
								Matching listing exists, but the search missed it.
							</div>
						</div>
						<div className="text-[10px] text-muted-foreground leading-tight">
							Stored row:{' '}
							<span className="font-mono text-destructive">
								{damage.storedValue}
							</span>
						</div>
					</>
				) : (
					STOREFRONT_RESULTS.map((row) => (
						<div
							className="rounded-md border border-border bg-card p-2 flex flex-col"
							key={row.name}
						>
							<div className="text-xs font-medium text-foreground truncate">
								{row.name}
							</div>
							<div className="text-[10px] text-muted-foreground">
								{row.price}
							</div>
						</div>
					))
				)}
			</div>
		</ColumnPanel>
	);
}

interface SignupFlowProps {
	damage?: DashboardDamage['signup'];
}

function SignupFlow({ damage }: SignupFlowProps) {
	return (
		<ColumnPanel damaged={!!damage} title="Signup Confirmation">
			{damage ? (
				<div className="flex-1 min-h-0 flex flex-col gap-2">
					<div className="rounded-md border-2 border-destructive bg-destructive/10 p-3 flex flex-col gap-2 flex-1 min-h-0 justify-center">
						<div className="text-[10px] font-semibold text-destructive uppercase tracking-wider">
							Two accounts now exist
						</div>
						<div className="rounded border border-destructive/40 bg-background px-2 py-1 text-[11px] font-mono text-foreground">
							{damage.primaryEmail}
						</div>
						<div className="rounded border border-destructive/40 bg-background px-2 py-1 text-[11px] font-mono text-foreground">
							{damage.duplicateEmail}
						</div>
					</div>
					<div className="text-[10px] text-destructive font-semibold leading-tight">
						No welcome email arrived. The customer signed up twice. Cold inbox +
						duplicate-account confusion.
					</div>
				</div>
			) : (
				<div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-center">
					<div className="text-sm font-bold text-foreground">
						Welcome aboard!
					</div>
					<div className="rounded border border-border bg-background px-2 py-1 text-[11px] font-mono text-foreground">
						alice@example.com
					</div>
					<div className="text-[10px] text-muted-foreground leading-tight">
						Check your inbox for a welcome email.
					</div>
				</div>
			)}
		</ColumnPanel>
	);
}

interface IncidentLogProps {
	entries: string[];
}

function IncidentLog({ entries }: IncidentLogProps) {
	if (entries.length === 0) return null;
	return (
		<div className="border border-destructive/40 bg-destructive/5 rounded-md px-3 py-1.5 flex items-start gap-3 flex-wrap">
			<span className="text-[10px] font-semibold text-destructive uppercase tracking-wider shrink-0 flex items-center gap-1.5">
				<AlertCircle className="w-3 h-3" />
				Incident log
			</span>
			<ul className="flex flex-col gap-0.5 min-w-0">
				{entries.map((entry) => (
					<li
						className="text-xs text-destructive flex items-start gap-1.5 leading-tight"
						key={entry}
					>
						<span aria-hidden className="text-destructive">
							•
						</span>
						<span>{entry}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

interface CustomerDashboardProps {
	damage: DashboardDamage | null;
}

export function CustomerDashboard({ damage }: CustomerDashboardProps) {
	return (
		<div className="flex-1 min-h-0 overflow-hidden flex flex-col px-4 pt-4 pb-2">
			<div className="max-w-3xl w-full mx-auto flex-1 min-h-0 flex flex-col gap-2">
				<div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
					<StorefrontSearch damage={damage?.storefront} />
					<SignupFlow damage={damage?.signup} />
				</div>
				<IncidentLog entries={damage?.incidentLog ?? []} />
			</div>
		</div>
	);
}
