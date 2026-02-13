/**
 * Level 17: Validation Contracts
 *
 * Extract scattered validations from a fat registration controller into
 * composable Dry::Schema definitions + a Dry::Validation::Contract.
 * Teaches: Dry::Schema, Dry::Validation::Contract, schema composition, cross-field rules
 *
 * Social platform context: Registration creates User + Profile + NotificationPrefs.
 * Cross-field rule: creator accounts must enable weekly digest.
 *
 * Three-phase pedagogy:
 *   WHY   -- fat controller with inline validations and cross-field checks
 *   HOW   -- stepped extraction: schemas -> contract with composed params + rule
 *   ADVANTAGE -- before/after comparison, line count reduction, separation of concerns
 */

import {
	ArrowRight,
	Check,
	Lock,
	Scale,
	Shield,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';

// --- Types ---

type Category = 'schema' | 'rule';

interface Extraction {
	id: string;
	name: string;
	description: string;
	category: Category;
	added: boolean;
	step: 1 | 2;
}

interface ControllerLine {
	code: string;
	indent: number;
	extractionId: string | null;
}

// --- Constants ---

const CATEGORY_COLORS: Record<Category, string> = {
	schema: '#3b82f6',
	rule: '#f59e0b',
};

const CATEGORY_ICONS: Record<Category, typeof Shield> = {
	schema: Shield,
	rule: Scale,
};

const CATEGORY_LABELS: Record<Category, string> = {
	schema: 'Schema',
	rule: 'Rule',
};

const INITIAL_EXTRACTIONS: Extraction[] = [
	{
		id: 'user_schema',
		name: 'UserSchema',
		description: 'Email format + password length + username validations',
		category: 'schema',
		added: false,
		step: 1,
	},
	{
		id: 'profile_schema',
		name: 'ProfileSchema',
		description: 'Display name + bio length + location validations',
		category: 'schema',
		added: false,
		step: 1,
	},
	{
		id: 'notif_prefs_schema',
		name: 'NotifPrefsSchema',
		description: 'Email digest + push + mentions preferences',
		category: 'schema',
		added: false,
		step: 1,
	},
	{
		id: 'creator_digest_rule',
		name: 'Creator digest rule',
		description: 'Cross-field: creator role requires weekly digest',
		category: 'rule',
		added: false,
		step: 2,
	},
];

const CONTROLLER_LINES: ControllerLine[] = [
	{ code: 'class RegistrationController', indent: 0, extractionId: null },
	{ code: 'def create', indent: 1, extractionId: null },
	{ code: '# User validations', indent: 2, extractionId: 'user_schema' },
	{ code: 'if params[:email].blank?', indent: 2, extractionId: 'user_schema' },
	{ code: 'render json: {error: "..."}, status: 422', indent: 3, extractionId: 'user_schema' },
	{ code: 'end', indent: 2, extractionId: 'user_schema' },
	{ code: 'if params[:password].length < 8', indent: 2, extractionId: 'user_schema' },
	{ code: 'render json: {error: "..."}, status: 422', indent: 3, extractionId: 'user_schema' },
	{ code: 'end', indent: 2, extractionId: 'user_schema' },
	{ code: '', indent: 0, extractionId: 'user_schema' },
	{ code: '# Profile validations', indent: 2, extractionId: 'profile_schema' },
	{ code: 'if params[:display_name].blank?', indent: 2, extractionId: 'profile_schema' },
	{ code: 'render json: {error: "..."}, status: 422', indent: 3, extractionId: 'profile_schema' },
	{ code: 'end', indent: 2, extractionId: 'profile_schema' },
	{ code: 'if params[:bio].length > 500', indent: 2, extractionId: 'profile_schema' },
	{ code: 'render json: {error: "..."}, status: 422', indent: 3, extractionId: 'profile_schema' },
	{ code: 'end', indent: 2, extractionId: 'profile_schema' },
	{ code: '', indent: 0, extractionId: 'profile_schema' },
	{ code: '# Notification prefs validations', indent: 2, extractionId: 'notif_prefs_schema' },
	{ code: 'digests = %w[daily weekly monthly never]', indent: 2, extractionId: 'notif_prefs_schema' },
	{ code: 'unless digests.include?(params[:digest])', indent: 2, extractionId: 'notif_prefs_schema' },
	{ code: 'render json: {error: "..."}, status: 422', indent: 3, extractionId: 'notif_prefs_schema' },
	{ code: 'end', indent: 2, extractionId: 'notif_prefs_schema' },
	{ code: '', indent: 0, extractionId: 'notif_prefs_schema' },
	{ code: '# Cross-field business rule', indent: 2, extractionId: 'creator_digest_rule' },
	{ code: 'if params[:role] == "creator"', indent: 2, extractionId: 'creator_digest_rule' },
	{ code: '&& params[:digest] != "weekly"', indent: 3, extractionId: 'creator_digest_rule' },
	{ code: 'render json: {error: "..."}, status: 422', indent: 3, extractionId: 'creator_digest_rule' },
	{ code: 'end', indent: 2, extractionId: 'creator_digest_rule' },
	{ code: '', indent: 0, extractionId: 'creator_digest_rule' },
	{ code: 'user = User.create!(...)', indent: 2, extractionId: null },
	{ code: 'Profile.create!(user: user, ...)', indent: 2, extractionId: null },
	{ code: 'NotificationPref.create!(user: user, ...)', indent: 2, extractionId: null },
	{ code: '', indent: 0, extractionId: null },
	{ code: 'render json: user, status: :created', indent: 2, extractionId: null },
	{ code: 'end', indent: 1, extractionId: null },
	{ code: 'end', indent: 0, extractionId: null },
];

// --- Code generation ---

interface CodeFile {
	filename: string;
	language: string;
	code: string;
}

function generateCodeFiles(extractions: Extraction[]): CodeFile[] {
	const files: CodeFile[] = [];

	const hasUser = extractions.find((e) => e.id === 'user_schema')?.added;
	const hasProfile = extractions.find((e) => e.id === 'profile_schema')?.added;
	const hasNotifPrefs = extractions.find((e) => e.id === 'notif_prefs_schema')?.added;
	const allSchemas = hasUser && hasProfile && hasNotifPrefs;
	const hasRule = extractions.find((e) => e.id === 'creator_digest_rule')?.added;

	if (hasUser) {
		files.push({
			filename: 'app/schemas/user_schema.rb',
			language: 'ruby',
			code: `UserSchema = Dry::Schema.Params do
  required(:email).filled(:string,
    format?: URI::MailTo::EMAIL_REGEXP)
  required(:password).filled(:string, min_size?: 8)
  required(:username).filled(:string, min_size?: 3)
  optional(:role).filled(:string)
end`,
		});
	}

	if (hasProfile) {
		files.push({
			filename: 'app/schemas/profile_schema.rb',
			language: 'ruby',
			code: `ProfileSchema = Dry::Schema.Params do
  required(:display_name).filled(:string)
  optional(:bio).filled(:string, max_size?: 500)
  optional(:location).filled(:string)
end`,
		});
	}

	if (hasNotifPrefs) {
		files.push({
			filename: 'app/schemas/notif_prefs_schema.rb',
			language: 'ruby',
			code: `NotifPrefsSchema = Dry::Schema.Params do
  required(:email_digest).filled(:string,
    included_in?: %w[daily weekly monthly never])
  optional(:push_enabled).filled(:bool)
  optional(:mentions_only).filled(:bool)
end`,
		});
	}

	// Show contract shell once all schemas done, even before rule
	if (allSchemas && !hasRule) {
		files.push({
			filename: 'app/contracts/registration_contract.rb',
			language: 'ruby',
			code: `class RegistrationContract < Dry::Validation::Contract
  params(UserSchema & ProfileSchema & NotifPrefsSchema)

  # Add cross-field rules here...
end`,
		});
	}

	if (hasRule) {
		files.push({
			filename: 'app/contracts/registration_contract.rb',
			language: 'ruby',
			code: `class RegistrationContract < Dry::Validation::Contract
  params(UserSchema & ProfileSchema & NotifPrefsSchema)

  rule(:role, :email_digest) do
    if values[:role] == "creator" &&
       values[:email_digest] != "weekly"
      key(:role).failure("creators need weekly digest")
    end
  end
end`,
		});
	}

	if (files.length === 0) {
		files.push({
			filename: 'Getting started',
			language: 'ruby',
			code: `# Extract validations to see generated code
#
# Step 1: Extract model-specific validations
#         into Dry::Schema definitions
#
# Step 2: Compose schemas into a Contract
#         and add cross-field business rules`,
		});
	}

	return files;
}

// --- After panel controller states ---

function getAfterController(extractions: Extraction[]): {
	lines: { code: string; indent: number; color?: string }[];
	label: string;
} {
	const anySchemaExtracted = extractions
		.filter((e) => e.step === 1)
		.some((e) => e.added);

	if (!anySchemaExtracted) {
		return { label: '...', lines: [] };
	}

	return {
		label: '13 lines',
		lines: [
			{ code: 'class RegistrationController', indent: 0 },
			{ code: 'def create', indent: 1 },
			{ code: 'result = RegistrationContract.new.call(params)', indent: 2, color: CATEGORY_COLORS.rule },
			{ code: 'if result.failure?', indent: 2 },
			{ code: 'render json: {errors: result.errors}, status: 422', indent: 3 },
			{ code: 'end', indent: 2 },
			{ code: '', indent: 0 },
			{ code: 'attrs = result.to_h', indent: 2 },
			{ code: 'user = User.create!(...)', indent: 2 },
			{ code: 'Profile.create!(user: user, ...)', indent: 2 },
			{ code: 'NotificationPref.create!(user: user, ...)', indent: 2 },
			{ code: '', indent: 0 },
			{ code: 'render json: user, status: :created', indent: 2 },
			{ code: 'end', indent: 1 },
			{ code: 'end', indent: 0 },
		],
	};
}

// --- Component ---

export function Level17ValidationContracts({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [extractions, setExtractions] = useState<Extraction[]>(
		INITIAL_EXTRACTIONS,
	);

	const addedCount = extractions.filter((e) => e.added).length;
	const totalCount = extractions.length;
	const schemasComplete = extractions
		.filter((e) => e.step === 1)
		.every((e) => e.added);
	const ruleComplete = extractions.find(
		(e) => e.id === 'creator_digest_rule',
	)?.added;
	const step2Unlocked = schemasComplete;

	const stepsCompleted = useMemo(() => {
		if (step2Unlocked && ruleComplete) return 2;
		if (schemasComplete) return 1;
		return 0;
	}, [schemasComplete, step2Unlocked, ruleComplete]);

	const handleAdd = (id: string) => {
		setExtractions((prev) =>
			prev.map((e) => (e.id === id ? { ...e, added: true } : e)),
		);
	};

	const handleReset = () => {
		setExtractions(INITIAL_EXTRACTIONS);
	};

	const validateSolution = (): ValidationResult => {
		if (addedCount < totalCount) {
			return {
				valid: false,
				message: 'Extraction incomplete!',
				details: [
					`Complete ${totalCount - addedCount} more extraction(s)`,
				],
			};
		}

		return {
			valid: true,
			message: 'Validations extracted into composable schemas + contract!',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act3-level18-validation-contracts', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const afterState = getAfterController(extractions);

	// Count non-empty before lines and extracted lines
	const beforeTotalLines = CONTROLLER_LINES.filter((l) => l.code).length;
	const extractedLineCount = CONTROLLER_LINES.filter(
		(l) =>
			l.extractionId &&
			extractions.find((e) => e.id === l.extractionId)?.added,
	).length;
	const beforeVisibleLines = beforeTotalLines - extractedLineCount;

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Goal & Scenario */}
					<div className="p-4">
						<div className="flex items-center gap-2 mb-3">
							<Shield className="w-4 h-4 text-primary" />
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Goal
							</div>
						</div>
						<p className="text-sm text-foreground mb-4">
							Extract scattered validations into composable Dry::Schema definitions, then compose them in a contract with cross-field rules.
						</p>

						<div className="flex items-center gap-2 mb-2">
							<Scale className="w-4 h-4 text-warning" />
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Scenario
							</div>
						</div>
						<p className="text-xs text-muted-foreground">
							The registration controller creates User + Profile + NotificationPrefs in one action. Validations are scattered inline with no cross-field rule check. Every model validates independently with duplicated render calls.
						</p>
					</div>

					{/* Progress */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Progress
						</div>
						<div className="space-y-2">
							{[
								{
									label: 'Extract schemas',
									done: schemasComplete,
									icon: Shield,
								},
								{
									label: 'Compose contract + rule',
									done: !!ruleComplete,
									icon: Scale,
								},
							].map((step) => (
								<div className="flex items-center gap-2" key={step.label}>
									<div
										className={`w-5 h-5 rounded-full flex items-center justify-center ${
											step.done
												? 'bg-success text-success-foreground'
												: 'bg-secondary text-muted-foreground'
										}`}
									>
										{step.done ? (
											<Check className="w-3 h-3" />
										) : (
											<step.icon className="w-3 h-3" />
										)}
									</div>
									<span
										className={`text-xs ${
											step.done
												? 'text-success line-through'
												: 'text-muted-foreground'
										}`}
									>
										{step.label}
									</span>
								</div>
							))}
						</div>
						<div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all duration-500"
								style={{ width: `${(stepsCompleted / 2) * 100}%` }}
							/>
						</div>
						<div className="text-xs text-muted-foreground mt-1 text-right">
							{addedCount} / {totalCount} extractions
						</div>
					</div>

					{/* Step 1: Schemas */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
							Step 1: Extract Schemas
						</div>
						<div className="text-[10px] text-muted-foreground mb-3">
							Builds on L16 -- spot scattered code, extract it
						</div>
						<div className="space-y-2">
							{extractions
								.filter((e) => e.step === 1)
								.map((e) => {
									const color = CATEGORY_COLORS[e.category];
									const Icon = CATEGORY_ICONS[e.category];
									return (
										<Button
											className={`w-full p-2.5 h-auto rounded-lg text-left border transition-all hover:opacity-80 ${
												e.added ? 'opacity-60' : ''
											}`}
											disabled={e.added}
											key={e.id}
											onClick={() => handleAdd(e.id)}
											style={{
												borderColor: e.added
													? 'var(--color-border)'
													: color,
												backgroundColor: e.added
													? 'var(--color-secondary)'
													: `${color}10`,
											}}
											variant="outline"
										>
											<div className="w-full space-y-1 overflow-hidden">
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-1.5 min-w-0">
														<Icon
															className="w-3 h-3 shrink-0"
															style={{
																color: e.added
																	? 'var(--color-muted-foreground)'
																	: color,
															}}
														/>
														<span
															className="font-mono text-sm truncate"
															style={{
																color: e.added
																	? 'var(--color-muted-foreground)'
																	: color,
															}}
														>
															{e.name}
														</span>
													</div>
													{e.added && (
														<Check className="w-4 h-4 text-success shrink-0" />
													)}
												</div>
												<div className="pl-[18px] space-y-0.5">
													{!e.added && (
														<span
															className="text-[10px] px-1.5 py-0.5 rounded-full inline-block"
															style={{
																backgroundColor: `${color}20`,
																color,
															}}
														>
															{CATEGORY_LABELS[e.category]}
														</span>
													)}
													<div className="text-[10px] text-muted-foreground leading-tight">
														{e.description}
													</div>
												</div>
											</div>
										</Button>
									);
								})}
						</div>
					</div>

					{/* Step 2: Contract + Rule */}
					<div className="p-4 border-t border-border">
						<div className="flex items-center gap-1.5 mb-1">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Step 2: Compose Contract
							</div>
							{!step2Unlocked && (
								<Lock className="w-3 h-3 text-muted-foreground" />
							)}
						</div>
						<div className="text-[10px] text-muted-foreground mb-3">
							{step2Unlocked
								? 'Compose schemas + add cross-field rule'
								: 'Complete all schemas to unlock'}
						</div>
						<div className="space-y-2">
							{extractions
								.filter((e) => e.step === 2)
								.map((e) => {
									const color = CATEGORY_COLORS[e.category];
									const Icon = CATEGORY_ICONS[e.category];
									const locked = !step2Unlocked;
									return (
										<Button
											className={`w-full p-2.5 h-auto rounded-lg text-left border transition-all hover:opacity-80 ${
												e.added || locked ? 'opacity-60' : ''
											}`}
											disabled={e.added || locked}
											key={e.id}
											onClick={() => handleAdd(e.id)}
											style={{
												borderColor:
													e.added || locked
														? 'var(--color-border)'
														: color,
												backgroundColor:
													e.added || locked
														? 'var(--color-secondary)'
														: `${color}10`,
											}}
											variant="outline"
										>
											<div className="w-full space-y-1 overflow-hidden">
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-1.5 min-w-0">
														{locked ? (
															<Lock
																className="w-3 h-3 shrink-0 text-muted-foreground"
															/>
														) : (
															<Icon
																className="w-3 h-3 shrink-0"
																style={{
																	color: e.added
																		? 'var(--color-muted-foreground)'
																		: color,
																}}
															/>
														)}
														<span
															className="font-mono text-sm truncate"
															style={{
																color:
																	e.added || locked
																		? 'var(--color-muted-foreground)'
																		: color,
															}}
														>
															{e.name}
														</span>
													</div>
													{e.added && (
														<Check className="w-4 h-4 text-success shrink-0" />
													)}
												</div>
												<div className="pl-[18px] space-y-0.5">
													{!e.added && !locked && (
														<span
															className="text-[10px] px-1.5 py-0.5 rounded-full inline-block"
															style={{
																backgroundColor: `${color}20`,
																color,
															}}
														>
															{CATEGORY_LABELS[e.category]}
														</span>
													)}
													<div className="text-[10px] text-muted-foreground leading-tight">
														{e.description}
													</div>
												</div>
											</div>
										</Button>
									);
								})}
						</div>
					</div>

				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="Validation Contracts"
					levelNumber={18}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-4 overflow-auto">
					<div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
						{/* Left: Fat controller (Before) */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-3 py-2.5 border-b border-border flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Shield className="w-3.5 h-3.5 text-destructive" />
									<span className="text-sm text-foreground font-semibold">
										Before
									</span>
								</div>
								<span className="text-xs text-muted-foreground">
									{beforeVisibleLines} lines
								</span>
							</div>

							<div className="p-3 font-mono text-[11px] leading-relaxed overflow-x-auto">
								{CONTROLLER_LINES.map((line, i) => {
									const extracted =
										line.extractionId != null &&
										extractions.find(
											(e) => e.id === line.extractionId,
										)?.added;
									const extraction = line.extractionId
										? extractions.find(
												(e) => e.id === line.extractionId,
											)
										: null;
									const color = extraction
										? CATEGORY_COLORS[extraction.category]
										: undefined;

									if (extracted) {
										return (
											<div
												className="transition-all duration-300 line-through opacity-25 h-[18px] whitespace-nowrap"
												key={i}
												style={{
													paddingLeft: `${line.indent * 12}px`,
													textDecorationColor: color,
												}}
											>
												{line.code}
											</div>
										);
									}

									return (
										<div
											className={`transition-all duration-300 h-[18px] whitespace-nowrap ${
												line.extractionId
													? 'text-warning'
													: 'text-foreground'
											}`}
											key={i}
											style={{
												paddingLeft: `${line.indent * 12}px`,
											}}
										>
											{line.code}
										</div>
									);
								})}
							</div>
						</div>

						{/* Arrow divider */}
						<div className="flex items-center justify-center self-center text-muted-foreground">
							<ArrowRight className="w-5 h-5" />
						</div>

						{/* Right: Clean controller (After) */}
						<div
							className={`bg-card rounded-xl border overflow-hidden ${
								addedCount > 0
									? 'border-success/30'
									: 'border-border'
							}`}
						>
							<div
								className={`px-3 py-2.5 border-b flex items-center justify-between ${
									addedCount > 0
										? 'bg-success/5 border-success/20'
										: 'bg-secondary border-border'
								}`}
							>
								<div className="flex items-center gap-2">
									<Check
										className={`w-3.5 h-3.5 ${
											addedCount > 0
												? 'text-success'
												: 'text-muted-foreground'
										}`}
									/>
									<span className="text-sm text-foreground font-semibold">
										After
									</span>
								</div>
								<span
									className={`text-xs font-medium ${
										addedCount > 0
											? 'text-success'
											: 'text-muted-foreground'
									}`}
								>
									{afterState.label}
								</span>
							</div>

							<div className="p-3 font-mono text-[11px] leading-relaxed overflow-x-auto">
								{addedCount === 0 ? (
									<div className="text-muted-foreground text-center py-8 text-xs">
										Extract validations to see the clean version
									</div>
								) : (
									<>
										{afterState.lines.map((line, i) => (
											<div
												className={`h-[18px] whitespace-nowrap ${
													line.color
														? 'animate-in fade-in slide-in-from-left-2 duration-200'
														: 'text-foreground'
												}`}
												key={i}
												style={{
													paddingLeft: `${line.indent * 12}px`,
													color: line.color,
												}}
											>
												{line.code}
											</div>
										))}
										{addedCount === totalCount && (
											<div className="mt-4 text-center text-success text-xs font-medium flex items-center justify-center gap-1.5">
												<Check className="w-3.5 h-3.5" />
												All extracted! Validate to complete.
											</div>
										)}
									</>
								)}
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={generateCodeFiles(extractions)}
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-1.5">
							<li className="flex items-start gap-2">
								<Shield className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									<strong className="text-foreground">Dry::Schema:</strong> Type + format checks, reusable across contracts
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Scale className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									<strong className="text-foreground">Contract rules:</strong> Cross-field logic runs after schema passes
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Shield className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									<strong className="text-foreground">Composition:</strong> Schemas combine with <code className="text-primary">&amp;</code> operator for multi-model forms
								</span>
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Why Dry::Validation?
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
							{`# Schemas compose with &
params(UserSchema & ProfileSchema & NotifPrefsSchema)

# Rules add cross-field logic
rule(:role, :email_digest) do
  key.failure("...") if values[:role] == "creator"
end

# Not coupled to Rails -- works anywhere`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level17ValidationContracts;
