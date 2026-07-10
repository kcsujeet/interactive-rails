/**
 * Reward visualization for the service-objects level: three callers,
 * one workflow.
 *
 * [Storefront controller] --\
 * [Rake task]            ----> [UserRegistration service] -> Result back
 * [Unit test]            --/
 *
 * The point of the picture IS the fan-in: the same workflow the
 * controller uses is callable from a rake task and a test with no HTTP
 * anywhere. Each fired scenario animates one caller's round trip.
 */

import { FileCode2, Globe, Package, TestTube2 } from 'lucide-react';
import { FlowConnector } from '@/components/levels/FlowConnector';

export type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

export type CallerKey = 'controller' | 'rake' | 'test';

export interface CallerVizState {
	sublabel: string;
	badge: string | null;
	flash: ZoneFlash;
}

export interface ServiceVizState {
	sublabel: string;
	badge: string | null;
	flash: ZoneFlash;
}

export interface CallEdgeState {
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

const CALLER_META: Record<CallerKey, { title: string; icon: typeof Globe }> = {
	controller: { title: 'Storefront controller', icon: Globe },
	rake: { title: 'Rake task', icon: FileCode2 },
	test: { title: 'Unit test', icon: TestTube2 },
};

function CallerBadge({ badge, flash }: { badge: string; flash: ZoneFlash }) {
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

interface CallersFlowProps {
	callers: Record<CallerKey, CallerVizState>;
	service: ServiceVizState;
	edges: Record<CallerKey, CallEdgeState>;
}

export function CallersFlow({ callers, service, edges }: CallersFlowProps) {
	return (
		<div className="flex-1 flex items-center gap-0 px-4 py-4">
			<div className="flex-1 flex flex-col justify-center gap-3 self-stretch">
				{(Object.keys(CALLER_META) as CallerKey[]).map((key) => {
					const meta = CALLER_META[key];
					const state = callers[key];
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
										<CallerBadge badge={state.badge} flash={state.flash} />
									</span>
								)}
							</div>
							<div
								className={`text-xs font-mono mt-1.5 ${FLASH_TEXT[state.flash]}`}
							>
								{state.sublabel}
							</div>
						</div>
					);
				})}
			</div>

			{/* One connector row per caller: call out, Result back */}
			<div className="w-48 shrink-0 flex flex-col justify-center gap-3 px-2 self-stretch">
				{(Object.keys(CALLER_META) as CallerKey[]).map((key) => {
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
				className={`flex-1 flex flex-col items-center justify-center border-2 rounded-lg p-4 transition-all duration-300 self-stretch ${FLASH_CARD[service.flash]}`}
			>
				<div className="flex items-center gap-1.5">
					<Package className="w-4 h-4 text-muted-foreground" />
					<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						UserRegistration
					</span>
				</div>
				<div className="text-xs font-mono text-muted-foreground mt-1">
					app/services/user_registration.rb
				</div>
				<div
					className={`text-xs font-mono mt-1.5 text-center ${FLASH_TEXT[service.flash]}`}
				>
					{service.sublabel}
				</div>
				{service.badge && (
					<div className="mt-1.5">
						<CallerBadge badge={service.badge} flash={service.flash} />
					</div>
				)}
			</div>
		</div>
	);
}
