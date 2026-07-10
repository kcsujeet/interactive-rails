/**
 * CORS pipeline visualization: two systems and a round trip.
 *
 * [Client (browser or terminal)]  --request-->   [Rails API]
 *                                 <--response--
 *
 * Mechanism-honest by construction (per the MDN CORS guide): there is no
 * "gate" node between the client and the API, because nothing on the
 * network blocks cross-origin requests. Requests reach Rails; the
 * enforcement happens inside the browser when the response returns. In
 * the reward phase the middleware appears as a strip INSIDE the Rails
 * card (it is Rack middleware, not a separate system).
 */

import { Globe, Server, Shield, Terminal } from 'lucide-react';
import { FlowConnector } from '@/components/levels/FlowConnector';

export type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

export interface ClientVizState {
	mode: 'browser' | 'terminal';
	origin: string;
	sublabel: string;
	badge: string | null;
	flash: ZoneFlash;
	consoleLine: string | null;
}

export interface ApiVizState {
	sublabel: string;
	badge: string | null;
	flash: ZoneFlash;
	corsStrip: string | null;
}

export interface EdgeVizState {
	active: boolean;
	label: string;
	dotColor: string;
}

const FLASH_CARD: Record<ZoneFlash, string> = {
	idle: 'border-border bg-card',
	amber: 'border-warning/60 bg-warning/5 dark:bg-warning/10',
	red: 'border-destructive/60 bg-destructive/5 dark:bg-destructive/10',
	green: 'border-success/60 bg-success/5 dark:bg-success/10',
};

const FLASH_TEXT: Record<ZoneFlash, string> = {
	idle: 'text-muted-foreground',
	amber: 'text-warning',
	red: 'text-destructive',
	green: 'text-success',
};

function ZoneBadge({ badge, flash }: { badge: string; flash: ZoneFlash }) {
	return (
		<div
			className={`inline-block px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
				flash === 'green'
					? 'bg-success/20 text-success'
					: flash === 'red'
						? 'bg-destructive/20 text-destructive'
						: 'bg-muted text-muted-foreground'
			}`}
		>
			{badge}
		</div>
	);
}

function InspectHint({ show }: { show: boolean }) {
	if (!show) return null;
	return (
		<span className="text-primary text-sm animate-pulse font-bold">?</span>
	);
}

interface CorsPipelineProps {
	client: ClientVizState;
	api: ApiVizState;
	req: EdgeVizState;
	res: EdgeVizState;
	showCorsStrip: boolean;
	inspectable: boolean;
	inspectedStages: Set<string>;
	onStageClick?: (stageId: string) => void;
}

export function CorsPipeline({
	client,
	api,
	req,
	res,
	showCorsStrip,
	inspectable,
	inspectedStages,
	onStageClick,
}: CorsPipelineProps) {
	const isTerminal = client.mode === 'terminal';
	const clickable = inspectable && onStageClick;

	const clientCard = (
		<div
			className={`flex-1 flex flex-col border rounded-lg overflow-hidden transition-all duration-300 self-stretch ${FLASH_CARD[client.flash]} ${
				clickable ? 'cursor-pointer hover:ring-2 hover:ring-ring/30' : ''
			}`}
		>
			{isTerminal ? (
				<div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/50">
					<Terminal className="w-3 h-3 text-muted-foreground" />
					<div className="text-xs text-muted-foreground ml-auto font-mono">
						$ terminal
					</div>
				</div>
			) : (
				<div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/50">
					<div className="flex gap-1">
						<div className="w-2 h-2 rounded-full bg-red-400/70 dark:bg-red-400/50" />
						<div className="w-2 h-2 rounded-full bg-yellow-400/70 dark:bg-yellow-400/50" />
						<div className="w-2 h-2 rounded-full bg-green-400/70 dark:bg-green-400/50" />
					</div>
					<div className="text-xs text-muted-foreground ml-auto font-mono">
						{client.origin}
					</div>
				</div>
			)}
			<div className="flex-1 p-3 flex flex-col items-center justify-center gap-2 text-center">
				<div className="flex items-center gap-1.5">
					{isTerminal ? (
						<Terminal className="w-3.5 h-3.5 text-muted-foreground" />
					) : (
						<Globe className="w-3.5 h-3.5 text-muted-foreground" />
					)}
					<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						{isTerminal ? 'Terminal' : 'Browser'}
					</span>
					<InspectHint show={inspectable && !inspectedStages.has('client')} />
				</div>
				<div className={`text-xs font-mono ${FLASH_TEXT[client.flash]}`}>
					{client.sublabel}
				</div>
				{client.badge && (
					<ZoneBadge badge={client.badge} flash={client.flash} />
				)}
			</div>
			{client.consoleLine && (
				<div className="px-3 py-2 border-t border-border bg-muted/60 dark:bg-muted/30">
					<div
						className={`text-xs font-mono ${FLASH_TEXT[client.flash]} animate-in fade-in duration-300`}
					>
						{client.consoleLine}
					</div>
				</div>
			)}
		</div>
	);

	const apiCard = (
		<div
			className={`flex-1 flex flex-col border rounded-lg overflow-hidden transition-all duration-300 self-stretch ${FLASH_CARD[api.flash]} ${
				clickable ? 'cursor-pointer hover:ring-2 hover:ring-ring/30' : ''
			}`}
		>
			{showCorsStrip && (
				<div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-success/10 dark:bg-success/15">
					<Shield className="w-3 h-3 text-success" />
					<span className="text-xs font-semibold text-success uppercase tracking-wider">
						rack-cors
					</span>
					{api.corsStrip && (
						<span className="text-xs font-mono text-success/80 ml-auto animate-in fade-in duration-300">
							{api.corsStrip}
						</span>
					)}
				</div>
			)}
			<div className="flex-1 p-3 flex flex-col items-center justify-center gap-2 text-center">
				<div className="flex items-center gap-1.5">
					<Server className="w-3.5 h-3.5 text-muted-foreground" />
					<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Rails API
					</span>
					<InspectHint show={inspectable && !inspectedStages.has('api')} />
				</div>
				<div className="text-xs font-mono text-muted-foreground">
					localhost:3000
				</div>
				<div className={`text-xs font-mono ${FLASH_TEXT[api.flash]}`}>
					{api.sublabel}
				</div>
				{api.badge && <ZoneBadge badge={api.badge} flash={api.flash} />}
			</div>
		</div>
	);

	return (
		<div className="flex-1 flex items-stretch gap-0 px-4 py-4 relative">
			{clickable ? (
				<button
					className="flex-1 flex text-left"
					onClick={() => onStageClick('client')}
					type="button"
				>
					{clientCard}
				</button>
			) : (
				clientCard
			)}

			{/* Round trip: request out (top), response back (bottom) */}
			<div className="w-44 shrink-0 flex flex-col items-center justify-center gap-4 px-2">
				<div className="w-full space-y-1">
					<div className="text-xs text-muted-foreground text-center">
						request
					</div>
					<FlowConnector
						active={req.active}
						className="relative h-4 w-full"
						direction="horizontal"
						dotColor={req.dotColor}
					/>
					{req.label && (
						<div className="text-xs font-mono text-foreground/80 text-center animate-in fade-in duration-300">
							{req.label}
						</div>
					)}
				</div>
				<div className="w-full space-y-1">
					<div className="text-xs text-muted-foreground text-center">
						response
					</div>
					<div className="rotate-180">
						<FlowConnector
							active={res.active}
							className="relative h-4 w-full"
							direction="horizontal"
							dotColor={res.dotColor}
						/>
					</div>
					{res.label && (
						<div className="text-xs font-mono text-foreground/80 text-center animate-in fade-in duration-300">
							{res.label}
						</div>
					)}
				</div>
			</div>

			{clickable ? (
				<button
					className="flex-1 flex text-left"
					onClick={() => onStageClick('api')}
					type="button"
				>
					{apiCard}
				</button>
			) : (
				apiCard
			)}
		</div>
	);
}
