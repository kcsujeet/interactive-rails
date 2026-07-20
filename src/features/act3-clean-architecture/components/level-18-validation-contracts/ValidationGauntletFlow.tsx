/**
 * Visualization for the validation-contracts level: a signup payload runs
 * through a validator.
 *
 * [Signup payload]  --POST /users-->  [Validator]  --Result-->
 *  (5 field chips)                     before: UserRegistration inline checks
 *                                      after:  RegistrationContract
 *                                              (Schema layer + Rules layer)
 *
 * The point of the picture is HOW the validator treats the payload. The
 * before-state checks fields one at a time and returns at the first bad one
 * (the rest stay "not checked"), so the customer resubmits over and over.
 * The after-state runs every field through the schema at once, then the
 * cross-field rules, and returns every error in one response.
 *
 * State-driven (flash / badge / chip state + edge active), animated by the
 * level via frame patches. No SMIL, so re-firing a scenario just replays the
 * frame timers.
 */

import { FileWarning, ListChecks, ShieldCheck, UserRound } from 'lucide-react';
import { FlowConnector } from '@/components/levels/FlowConnector';

export type ZoneFlash = 'idle' | 'red' | 'green' | 'amber';

export type FieldState = 'ok' | 'bad' | 'unchecked';

export type FieldKey =
	| 'email_address'
	| 'password'
	| 'display_name'
	| 'email_digest'
	| 'role';

export interface FieldChip {
	key: FieldKey;
	label: string;
	state: FieldState;
	/** Short note shown under a bad field (e.g. "must be a string"). */
	note?: string;
}

export interface ValidatorVizState {
	/** 'inline' = the scattered service (before); 'contract' = schema + rules. */
	mode: 'inline' | 'contract';
	sublabel: string;
	badge: string | null;
	flash: ZoneFlash;
	/** Which contract layer is currently active (after-state only). */
	activeLayer: 'none' | 'schema' | 'rules';
}

export interface EdgeVizState {
	active: boolean;
	reverse: boolean;
	label: string;
}

export interface GauntletVizState {
	fields: FieldChip[];
	validator: ValidatorVizState;
	request: EdgeVizState;
	result: EdgeVizState;
	/** Round trips the customer needs to surface every error. */
	roundTrips: number;
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

const FIELD_CARD: Record<FieldState, string> = {
	ok: 'border-success/50 bg-success/10 text-success',
	bad: 'border-destructive/50 bg-destructive/10 text-destructive',
	unchecked:
		'border-dashed border-border bg-muted/40 text-muted-foreground opacity-70',
};

function StatusBadge({ badge, flash }: { badge: string; flash: ZoneFlash }) {
	return (
		<span
			className={`inline-block px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
				flash === 'green'
					? 'bg-success/20 text-success'
					: flash === 'red'
						? 'bg-destructive/20 text-destructive'
						: flash === 'amber'
							? 'bg-warning/20 text-warning'
							: 'bg-muted text-muted-foreground'
			}`}
		>
			{badge}
		</span>
	);
}

function ContractLayers({ validator }: { validator: ValidatorVizState }) {
	const schemaActive = validator.activeLayer === 'schema';
	const rulesActive = validator.activeLayer === 'rules';
	return (
		<div className="mt-2 w-full space-y-1.5">
			<div
				className={`flex items-center gap-1.5 rounded-md border px-2 py-1 transition-all duration-300 ${
					schemaActive
						? 'border-warning/60 bg-warning/10'
						: 'border-border bg-muted/40'
				}`}
			>
				<ListChecks className="w-3.5 h-3.5 text-muted-foreground" />
				<span className="text-[11px] font-semibold text-foreground">
					Schema layer
				</span>
				<span className="ml-auto text-[10px] font-mono text-muted-foreground">
					shape + types
				</span>
			</div>
			<div
				className={`flex items-center gap-1.5 rounded-md border px-2 py-1 transition-all duration-300 ${
					rulesActive
						? 'border-warning/60 bg-warning/10'
						: 'border-border bg-muted/40'
				}`}
			>
				<ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
				<span className="text-[11px] font-semibold text-foreground">
					Rules layer
				</span>
				<span className="ml-auto text-[10px] font-mono text-muted-foreground">
					cross-field
				</span>
			</div>
		</div>
	);
}

interface ValidationGauntletFlowProps {
	state: GauntletVizState;
}

export function ValidationGauntletFlow({ state }: ValidationGauntletFlowProps) {
	const { fields, validator, request, result, roundTrips } = state;
	const isContract = validator.mode === 'contract';

	return (
		<div className="flex-1 flex items-center gap-0 px-4 py-4">
			{/* Signup payload with field chips */}
			<div className="flex-1 flex flex-col justify-center gap-2 self-stretch">
				<div className="flex items-center gap-1.5 mb-0.5">
					<UserRound className="w-4 h-4 text-muted-foreground" />
					<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Signup payload
					</span>
				</div>
				{fields.map((chip) => (
					<div
						className={`border rounded-md px-2.5 py-1.5 transition-all duration-300 ${FIELD_CARD[chip.state]}`}
						key={chip.key}
					>
						<div className="flex items-center justify-between gap-2">
							<span className="text-xs font-mono text-foreground/90">
								{chip.label}
							</span>
							<span className="text-[10px] font-mono font-semibold uppercase">
								{chip.state === 'unchecked' ? 'not checked' : chip.state}
							</span>
						</div>
						{chip.note && chip.state === 'bad' && (
							<div className="text-[10px] font-mono mt-0.5 text-destructive">
								{chip.note}
							</div>
						)}
					</div>
				))}
				<div className="text-[11px] font-mono text-muted-foreground mt-0.5">
					round trips to sign up:{' '}
					<span
						className={
							roundTrips > 1
								? 'text-destructive font-bold'
								: 'text-success font-bold'
						}
					>
						{roundTrips}
					</span>
				</div>
			</div>

			{/* Request out, Result back */}
			<div className="w-44 shrink-0 flex flex-col justify-center gap-4 px-2 self-stretch">
				<div className="space-y-1">
					<FlowConnector
						active={request.active}
						className="relative h-4 w-full"
						direction="horizontal"
						dotColor="bg-primary"
					/>
					{request.label && (
						<div className="text-[11px] font-mono text-foreground/80 text-center">
							{request.label}
						</div>
					)}
				</div>
				<div className="space-y-1">
					<div className="rotate-180">
						<FlowConnector
							active={result.active}
							className="relative h-4 w-full"
							direction="horizontal"
							dotColor={
								result.reverse && validator.flash === 'green'
									? 'bg-success'
									: 'bg-destructive'
							}
						/>
					</div>
					{result.label && (
						<div
							className={`text-[11px] font-mono text-center ${FLASH_TEXT[validator.flash]}`}
						>
							{result.label}
						</div>
					)}
				</div>
			</div>

			{/* Validator */}
			<div
				className={`flex-1 flex flex-col items-center justify-center border-2 rounded-lg p-4 transition-all duration-300 self-stretch ${FLASH_CARD[validator.flash]}`}
			>
				<div className="flex items-center gap-1.5">
					<FileWarning className="w-4 h-4 text-muted-foreground" />
					<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						{isContract ? 'RegistrationContract' : 'UserRegistration'}
					</span>
				</div>
				<div className="text-[11px] font-mono text-muted-foreground mt-1 text-center">
					{isContract
						? 'app/contracts/registration_contract.rb'
						: 'app/services/user_registration.rb'}
				</div>
				<div
					className={`text-xs font-mono mt-1.5 text-center ${FLASH_TEXT[validator.flash]}`}
				>
					{validator.sublabel}
				</div>
				{validator.badge && (
					<div className="mt-1.5">
						<StatusBadge badge={validator.badge} flash={validator.flash} />
					</div>
				)}
				{isContract && <ContractLayers validator={validator} />}
			</div>
		</div>
	);
}
