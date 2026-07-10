/**
 * Reward visualization for the concerns level: two models, one shared
 * behavior.
 *
 * [Product]  --include-->
 *                          [Flaggable concern]
 * [Review]   --include-->
 *
 * The picture is the inverse of drift: behavior defined once flows to
 * every including model at the same moment. Each fired scenario
 * animates either a model exercising the shared behavior or a change
 * landing in the concern and reaching both models at once.
 */

import { Package, ShoppingBag, Star } from 'lucide-react';
import { FlowConnector } from '@/components/levels/FlowConnector';

export type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

export type ModelKey = 'product' | 'review';

export interface ModelVizState {
	sublabel: string;
	badge: string | null;
	flash: ZoneFlash;
}

export interface ConcernVizState {
	sublabel: string;
	badge: string | null;
	flash: ZoneFlash;
}

export interface ConcernEdgeState {
	active: boolean;
	reverse: boolean;
	label: string;
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

const MODEL_META: Record<ModelKey, { title: string; icon: typeof Star }> = {
	product: { title: 'Product', icon: ShoppingBag },
	review: { title: 'Review', icon: Star },
};

function StateBadge({ badge, flash }: { badge: string; flash: ZoneFlash }) {
	return (
		<span
			className={`inline-block px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
				flash === 'green'
					? 'bg-success/20 text-success'
					: flash === 'red'
						? 'bg-destructive/20 text-destructive'
						: 'bg-muted text-muted-foreground'
			}`}
		>
			{badge}
		</span>
	);
}

interface ConcernFlowProps {
	models: Record<ModelKey, ModelVizState>;
	concern: ConcernVizState;
	edges: Record<ModelKey, ConcernEdgeState>;
}

export function ConcernFlow({ models, concern, edges }: ConcernFlowProps) {
	return (
		<div className="flex-1 flex items-center gap-0 px-4 py-4">
			<div className="flex-1 flex flex-col justify-center gap-3 self-stretch">
				{(Object.keys(MODEL_META) as ModelKey[]).map((key) => {
					const meta = MODEL_META[key];
					const state = models[key];
					const Icon = meta.icon;
					return (
						<div
							className={`border rounded-lg p-3 transition-all duration-300 ${FLASH_CARD[state.flash]}`}
							key={key}
						>
							<div className="flex items-center gap-1.5">
								<Icon className="w-3.5 h-3.5 text-muted-foreground" />
								<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
									{meta.title}
								</span>
								{state.badge && (
									<span className="ml-auto">
										<StateBadge badge={state.badge} flash={state.flash} />
									</span>
								)}
							</div>
							<div className="text-xs font-mono text-muted-foreground mt-1">
								include Flaggable
							</div>
							<div
								className={`text-xs font-mono mt-1 ${FLASH_TEXT[state.flash]}`}
							>
								{state.sublabel}
							</div>
						</div>
					);
				})}
			</div>

			{/* One connector row per model */}
			<div className="w-48 shrink-0 flex flex-col justify-center gap-3 px-2 self-stretch">
				{(Object.keys(MODEL_META) as ModelKey[]).map((key) => {
					const edge = edges[key];
					return (
						<div className="space-y-1" key={key}>
							{edge.reverse ? (
								<div className="rotate-180">
									<FlowConnector
										active={edge.active}
										className="relative h-4 w-full"
										direction="horizontal"
										dotColor="bg-success"
									/>
								</div>
							) : (
								<FlowConnector
									active={edge.active}
									className="relative h-4 w-full"
									direction="horizontal"
									dotColor="bg-primary"
								/>
							)}
							{edge.label && (
								<div className="text-xs font-mono text-foreground/80 text-center animate-in fade-in duration-300">
									{edge.label}
								</div>
							)}
						</div>
					);
				})}
			</div>

			<div
				className={`flex-1 flex flex-col items-center justify-center border-2 rounded-lg p-4 transition-all duration-300 self-stretch ${FLASH_CARD[concern.flash]}`}
			>
				<div className="flex items-center gap-1.5">
					<Package className="w-4 h-4 text-muted-foreground" />
					<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Flaggable
					</span>
				</div>
				<div className="text-xs font-mono text-muted-foreground mt-1">
					app/models/concerns/flaggable.rb
				</div>
				<div
					className={`text-xs font-mono mt-1.5 text-center ${FLASH_TEXT[concern.flash]}`}
				>
					{concern.sublabel}
				</div>
				{concern.badge && (
					<div className="mt-1.5">
						<StateBadge badge={concern.badge} flash={concern.flash} />
					</div>
				)}
			</div>
		</div>
	);
}
