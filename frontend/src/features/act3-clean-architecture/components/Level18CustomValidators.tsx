/**
 * Level 18: Custom Validators
 *
 * Build reusable custom validator classes that replace duplicated inline validations.
 * Teaches: EachValidator, validate_each, naming conventions, custom error messages
 */

import {
	AlertTriangle,
	Calendar,
	Check,
	Globe,
	ShieldCheck,
	Wrench,
	X,
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

type ValidatorType = 'url' | 'past_date' | 'future_date';

interface ValidatorDef {
	id: string;
	name: string;
	type: ValidatorType;
	created: boolean;
}

interface ValidatorStep {
	id: string;
	label: string;
	description: string;
}

interface TestRecord {
	id: string;
	field: string;
	value: string;
	model: string;
	validatorType: ValidatorType;
	shouldPass: boolean;
}

// --- Constants ---

const INITIAL_VALIDATORS: ValidatorDef[] = [
	{ id: 'url', name: 'UrlValidator', type: 'url', created: false },
	{
		id: 'past_date',
		name: 'PastDateValidator',
		type: 'past_date',
		created: false,
	},
	{
		id: 'future_date',
		name: 'FutureDateValidator',
		type: 'future_date',
		created: false,
	},
];

const VALIDATOR_STEPS: ValidatorStep[] = [
	{
		id: 'base_class',
		label: 'Choose base class',
		description: 'Inherit from ActiveModel::EachValidator',
	},
	{
		id: 'validate_each',
		label: 'Define validate_each',
		description: 'Implement validate_each(record, attribute, value)',
	},
	{
		id: 'error_handling',
		label: 'Add error handling',
		description: 'Add errors with record.errors.add',
	},
];

const TEST_DATA: TestRecord[] = [
	{
		id: 't1',
		field: 'website',
		value: 'not-a-url',
		model: 'User',
		validatorType: 'url',
		shouldPass: false,
	},
	{
		id: 't2',
		field: 'website',
		value: 'https://example.com',
		model: 'User',
		validatorType: 'url',
		shouldPass: true,
	},
	{
		id: 't3',
		field: 'birthday',
		value: '2030-01-01',
		model: 'User',
		validatorType: 'past_date',
		shouldPass: false,
	},
	{
		id: 't4',
		field: 'birthday',
		value: '1990-05-15',
		model: 'User',
		validatorType: 'past_date',
		shouldPass: true,
	},
	{
		id: 't5',
		field: 'website',
		value: 'ftp://bad.com',
		model: 'Company',
		validatorType: 'url',
		shouldPass: false,
	},
	{
		id: 't6',
		field: 'start_date',
		value: '2020-01-01',
		model: 'Event',
		validatorType: 'future_date',
		shouldPass: false,
	},
	{
		id: 't7',
		field: 'start_date',
		value: '2030-06-01',
		model: 'Event',
		validatorType: 'future_date',
		shouldPass: true,
	},
];

const VALIDATOR_ICONS: Record<ValidatorType, typeof Globe> = {
	url: Globe,
	past_date: Calendar,
	future_date: Calendar,
};

const VALIDATOR_COLORS: Record<ValidatorType, string> = {
	url: '#3b82f6',
	past_date: '#f59e0b',
	future_date: '#22c55e',
};

// --- Code generation ---

function generateValidatorCode(type: ValidatorType): string {
	switch (type) {
		case 'url':
			return `class UrlValidator < ActiveModel::EachValidator
  def validate_each(record, attribute, value)
    return if value.blank?

    uri = URI.parse(value)
    unless uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS)
      record.errors.add(
        attribute,
        options[:message] || "is not a valid URL"
      )
    end
  rescue URI::InvalidURIError
    record.errors.add(
      attribute,
      options[:message] || "is not a valid URL"
    )
  end
end

# Usage in any model:
# validates :website, url: true`;

		case 'past_date':
			return `class PastDateValidator < ActiveModel::EachValidator
  def validate_each(record, attribute, value)
    return if value.blank?

    unless value.to_date < Date.current
      record.errors.add(
        attribute,
        options[:message] || "must be in the past"
      )
    end
  rescue ArgumentError
    record.errors.add(
      attribute,
      options[:message] || "is not a valid date"
    )
  end
end

# Usage in any model:
# validates :birthday, past_date: true`;

		case 'future_date':
			return `class FutureDateValidator < ActiveModel::EachValidator
  def validate_each(record, attribute, value)
    return if value.blank?

    unless value.to_date > Date.current
      record.errors.add(
        attribute,
        options[:message] || "must be in the future"
      )
    end
  rescue ArgumentError
    record.errors.add(
      attribute,
      options[:message] || "is not a valid date"
    )
  end
end

# Usage in any model:
# validates :start_date, future_date: true`;
	}
}

function getValidatorFilename(type: ValidatorType): string {
	switch (type) {
		case 'url':
			return 'app/validators/url_validator.rb';
		case 'past_date':
			return 'app/validators/past_date_validator.rb';
		case 'future_date':
			return 'app/validators/future_date_validator.rb';
	}
}

// --- Component ---

export function Level18CustomValidators({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [validators, setValidators] =
		useState<ValidatorDef[]>(INITIAL_VALIDATORS);
	const [selectedValidator, setSelectedValidator] = useState<string | null>(
		'url',
	);
	const [validatorSteps, setValidatorSteps] = useState<
		Record<string, string[]>
	>({
		url: [],
		past_date: [],
		future_date: [],
	});

	const createdCount = validators.filter((v) => v.created).length;

	// Determine which validators are built for test data evaluation
	const createdTypes = useMemo(
		() => new Set(validators.filter((v) => v.created).map((v) => v.type)),
		[validators],
	);

	// Count correct test results
	const testResults = useMemo(() => {
		return TEST_DATA.map((record) => {
			const hasValidator = createdTypes.has(record.validatorType);
			if (!hasValidator) return { ...record, status: 'no_validator' as const };
			return { ...record, status: 'validated' as const };
		});
	}, [createdTypes]);

	const correctResults = testResults.filter(
		(r) => r.status === 'validated',
	).length;

	const handleStepClick = (validatorId: string, stepId: string) => {
		setValidatorSteps((prev) => {
			const currentSteps = prev[validatorId] || [];
			if (currentSteps.includes(stepId)) return prev;

			// Enforce step order
			const stepIndex = VALIDATOR_STEPS.findIndex((s) => s.id === stepId);
			for (let i = 0; i < stepIndex; i++) {
				if (!currentSteps.includes(VALIDATOR_STEPS[i].id)) return prev;
			}

			const updatedSteps = [...currentSteps, stepId];

			// If all steps completed, mark validator as created
			if (updatedSteps.length === VALIDATOR_STEPS.length) {
				setValidators((vPrev) =>
					vPrev.map((v) =>
						v.id === validatorId ? { ...v, created: true } : v,
					),
				);
			}

			return { ...prev, [validatorId]: updatedSteps };
		});
	};

	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		if (createdCount < 3) {
			errors.push(`Build ${3 - createdCount} more validator(s)`);
		}

		if (correctResults < 5) {
			errors.push(
				`Only ${correctResults}/7 test records validated. Need at least 5.`,
			);
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Validators incomplete!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'Reusable validators replace inline duplication!',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act3-level18-custom-validators', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const handleReset = () => {
		setValidators(INITIAL_VALIDATORS);
		setSelectedValidator('url');
		setValidatorSteps({ url: [], past_date: [], future_date: [] });
	};

	const activeValidator = validators.find((v) => v.id === selectedValidator);
	const activeType: ValidatorType = activeValidator?.type ?? 'url';

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Build reusable custom validator classes that replace duplicated inline validations."
					instructions={[
						'Build a UrlValidator (EachValidator)',
						'Build a PastDateValidator',
						'Build a FutureDateValidator',
						'Apply validators to test data',
					]}
					scenario="Users submit 'not a url' for websites and future dates for birthdays. The same bad validation logic is copy-pasted across 3 models."
				>
					{/* Validator Build Progress */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Validators Built
						</div>
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Progress</span>
							<span
								className={
									createdCount === 3 ? 'text-success' : 'text-foreground'
								}
							>
								{createdCount} / 3
							</span>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all"
								style={{ width: `${(createdCount / 3) * 100}%` }}
							/>
						</div>
					</div>

					{/* Validator Cards */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Validators
						</div>
						<div className="space-y-2">
							{validators.map((v) => {
								const Icon = VALIDATOR_ICONS[v.type];
								const color = VALIDATOR_COLORS[v.type];
								const isSelected = selectedValidator === v.id;

								return (
									<Button
										className={`w-full p-3 h-auto rounded-lg text-left border transition-all hover:opacity-80 ${
											isSelected ? 'ring-2 ring-primary' : ''
										}`}
										key={v.id}
										onClick={() => setSelectedValidator(v.id)}
										style={{
											borderColor: color,
											backgroundColor: `${color}10`,
										}}
										variant="outline"
									>
										<div className="flex items-center justify-between w-full">
											<div className="flex items-center gap-2">
												<Icon className="w-3 h-3" style={{ color }} />
												<span className="font-mono text-sm" style={{ color }}>
													{v.name}
												</span>
											</div>
											{v.created ? (
												<Check className="w-4 h-4 text-success" />
											) : (
												<Wrench className="w-3 h-3 text-muted-foreground" />
											)}
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
					levelName="Custom Validators"
					levelNumber={18}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-3xl mx-auto space-y-6">
						{/* Validator Workshop */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center gap-2">
								<Wrench className="w-4 h-4 text-primary" />
								<div>
									<div className="text-foreground font-semibold">
										Validator Workshop
									</div>
									<div className="text-xs text-muted-foreground">
										Select a validator and complete each build step
									</div>
								</div>
							</div>

							{activeValidator ? (
								<div className="p-6">
									<div className="flex items-center gap-3 mb-5">
										{(() => {
											const Icon = VALIDATOR_ICONS[activeValidator.type];
											return (
												<Icon
													className="w-5 h-5"
													style={{
														color: VALIDATOR_COLORS[activeValidator.type],
													}}
												/>
											);
										})()}
										<div>
											<div
												className="font-mono font-semibold text-lg"
												style={{
													color: VALIDATOR_COLORS[activeValidator.type],
												}}
											>
												{activeValidator.name}
											</div>
											<div className="text-xs text-muted-foreground">
												{activeValidator.created
													? 'Validator built successfully'
													: 'Complete the steps below to build this validator'}
											</div>
										</div>
									</div>

									<div className="space-y-3">
										{VALIDATOR_STEPS.map((step, index) => {
											const completedSteps =
												validatorSteps[activeValidator.id] || [];
											const isCompleted = completedSteps.includes(step.id);
											const previousCompleted =
												index === 0 ||
												completedSteps.includes(VALIDATOR_STEPS[index - 1].id);
											const isAvailable = !isCompleted && previousCompleted;

											return (
												<div
													className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
														isCompleted
															? 'border-success bg-success/10'
															: isAvailable
																? 'border-primary bg-primary/5 cursor-pointer hover:bg-primary/10'
																: 'border-border bg-card opacity-50'
													}`}
													key={step.id}
													onClick={() => {
														if (isAvailable) {
															handleStepClick(activeValidator.id, step.id);
														}
													}}
												>
													<div
														className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
															isCompleted
																? 'bg-success text-success-foreground'
																: isAvailable
																	? 'bg-primary text-primary-foreground'
																	: 'bg-secondary text-muted-foreground'
														}`}
													>
														{isCompleted ? (
															<Check className="w-4 h-4" />
														) : (
															index + 1
														)}
													</div>
													<div className="flex-1">
														<div
															className={`text-sm font-medium ${
																isCompleted
																	? 'text-success'
																	: isAvailable
																		? 'text-foreground'
																		: 'text-muted-foreground'
															}`}
														>
															{step.label}
														</div>
														<div className="text-xs text-muted-foreground">
															{step.description}
														</div>
													</div>
													{isAvailable && (
														<ShieldCheck className="w-4 h-4 text-primary" />
													)}
												</div>
											);
										})}
									</div>
								</div>
							) : (
								<div className="p-8 text-center text-muted-foreground">
									Select a validator from the left panel to start building
								</div>
							)}
						</div>

						{/* Test Data */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center justify-between">
								<div className="flex items-center gap-2">
									<AlertTriangle className="w-4 h-4 text-warning" />
									<div>
										<div className="text-foreground font-semibold">
											Test Data
										</div>
										<div className="text-xs text-muted-foreground">
											Records validated against your custom validators
										</div>
									</div>
								</div>
								<div className="text-xs text-muted-foreground">
									{correctResults} / {TEST_DATA.length} validated
								</div>
							</div>

							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-border bg-card">
											<th className="text-left px-4 py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
												Model
											</th>
											<th className="text-left px-4 py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
												Field
											</th>
											<th className="text-left px-4 py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
												Value
											</th>
											<th className="text-left px-4 py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
												Validator
											</th>
											<th className="text-center px-4 py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
												Result
											</th>
										</tr>
									</thead>
									<tbody>
										{testResults.map((record) => {
											const hasValidator = record.status === 'validated';
											const color = VALIDATOR_COLORS[record.validatorType];

											return (
												<tr
													className="border-b border-border last:border-b-0 hover:bg-secondary/50 transition-colors"
													key={record.id}
												>
													<td className="px-4 py-3">
														<span className="font-mono text-foreground">
															{record.model}
														</span>
													</td>
													<td className="px-4 py-3">
														<span className="font-mono" style={{ color }}>
															{record.field}
														</span>
													</td>
													<td className="px-4 py-3">
														<span className="font-mono text-muted-foreground">
															{record.value}
														</span>
													</td>
													<td className="px-4 py-3">
														{hasValidator ? (
															<span
																className="text-xs px-2 py-0.5 rounded-full"
																style={{
																	backgroundColor: `${color}20`,
																	color,
																}}
															>
																{record.validatorType === 'url'
																	? 'url: true'
																	: record.validatorType === 'past_date'
																		? 'past_date: true'
																		: 'future_date: true'}
															</span>
														) : (
															<span className="text-xs text-muted-foreground">
																No validator
															</span>
														)}
													</td>
													<td className="px-4 py-3 text-center">
														{hasValidator ? (
															record.shouldPass ? (
																<div className="inline-flex items-center gap-1 text-success">
																	<Check className="w-4 h-4" />
																	<span className="text-xs">Pass</span>
																</div>
															) : (
																<div className="inline-flex items-center gap-1 text-destructive">
																	<X className="w-4 h-4" />
																	<span className="text-xs">Fail</span>
																</div>
															)
														) : (
															<span className="text-muted-foreground text-xs">
																--
															</span>
														)}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: getValidatorFilename(activeType),
							language: 'ruby',
							code: generateValidatorCode(activeType),
							highlight: [2, 3],
						},
					]}
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-1.5">
							<li className="flex items-start gap-2">
								<ShieldCheck className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>EachValidator for single attribute validation</span>
							</li>
							<li className="flex items-start gap-2">
								<ShieldCheck className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>Validator (no Each) for whole-record validation</span>
							</li>
							<li className="flex items-start gap-2">
								<ShieldCheck className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>Naming: UrlValidator = url: true</span>
							</li>
							<li className="flex items-start gap-2">
								<ShieldCheck className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>options[:message] for custom error messages</span>
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Before vs After
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
							{`# Before: duplicated in every model
class User < ApplicationRecord
  validate :check_url_format
  private
  def check_url_format
    # 10 lines of regex...
  end
end

# After: one validator, any model
class User < ApplicationRecord
  validates :website, url: true
end

class Company < ApplicationRecord
  validates :homepage, url: true
end`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level18CustomValidators;
