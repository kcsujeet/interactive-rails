/**
 * Level 52: Modular Monolith
 *
 * Packwerk packages, CODEOWNERS, enforced boundaries, and privacy APIs.
 * Player organizes code into packages, configures dependency rules,
 * defines public APIs, and sets up code ownership.
 */

import {
	ArrowRight,
	Check,
	FolderTree,
	GitBranch,
	Lock,
	Package,
	Shield,
	Users,
} from 'lucide-react';
import { useState } from 'react';
import {
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	StepProgress,
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { useStepGating, type StepDef } from '@/hooks/useStepGating';

// --- Step definitions ---

const STEP_DEFS: StepDef[] = [
	{ id: 'packages', title: 'Define Packages' },
	{ id: 'dependencies', title: 'Enforce Dependencies' },
	{ id: 'public-api', title: 'Package Public API' },
	{ id: 'codeowners', title: 'Code Ownership' },
];

// --- Step option types ---

interface StepOption {
	id: string;
	label: string;
	description: string;
	codeSnippet: string;
	correct: boolean;
	feedback: string;
}

// --- Step 1: Package Structure ---

const PACKAGE_OPTIONS: StepOption[] = [
	{
		id: 'flat',
		label: 'app/models/invoice.rb',
		description: 'Keep Invoice in the flat models directory',
		codeSnippet: `app/
  models/
    invoice.rb    # <-- here
    user.rb
    order.rb
    notification.rb
    ... 196 more files`,
		correct: false,
		feedback:
			'A flat directory with 200 models has no boundaries -- any file can reference any other, which is exactly the problem that caused billing changes to break notifications.',
	},
	{
		id: 'wrong-domain',
		label: 'components/orders/app/models/invoice.rb',
		description: 'Place Invoice in the orders package',
		codeSnippet: `components/
  orders/
    app/
      models/
        invoice.rb  # <-- here
        order.rb`,
		correct: false,
		feedback:
			"An Invoice doesn't belong in the orders domain. Think about which business function owns invoicing logic.",
	},
	{
		id: 'correct-domain',
		label: 'components/billing/app/models/invoice.rb',
		description: 'Place Invoice in the billing package',
		codeSnippet: `components/
  billing/
    package.yml
    app/
      models/
        invoice.rb  # <-- here
        line_item.rb`,
		correct: true,
		feedback: '',
	},
];

// --- Step 2: Dependency Rules ---

const DEPENDENCY_OPTIONS: StepOption[] = [
	{
		id: 'no-config',
		label: 'No package.yml needed',
		description: 'Just import freely across packages',
		codeSnippet: `# No package.yml
# Any package can reach into any other
require "users/models/user"`,
		correct: false,
		feedback:
			'Without enforce_dependencies, there are no boundaries -- any package can reach into any other, which is exactly the problem you are solving.',
	},
	{
		id: 'enforce-with-deps',
		label: 'enforce_dependencies: true + dependencies: [users]',
		description: 'Explicitly declare billing depends on users',
		codeSnippet: `# components/billing/package.yml
enforce_dependencies: true
dependencies:
  - users`,
		correct: true,
		feedback: '',
	},
	{
		id: 'strict-no-deps',
		label: 'enforce_dependencies: strict (no dependencies)',
		description: 'Strict mode with no dependencies listed',
		codeSnippet: `# components/billing/package.yml
enforce_dependencies: strict
dependencies: []`,
		correct: false,
		feedback:
			'Strict mode with no dependencies means billing cannot access ANY other package -- but billing legitimately needs user data for invoicing.',
	},
];

// --- Step 3: Public API ---

const PUBLIC_API_OPTIONS: StepOption[] = [
	{
		id: 'direct-model',
		label: 'Audit.create!(action: ..., data: order.attributes)',
		description: 'Directly access the Audit model from outside its package',
		codeSnippet: `# In orders package:
Audit.create!(
  action: 'order.created',
  data: order.attributes
)`,
		correct: false,
		feedback:
			'Directly accessing the Audit model from outside its package violates privacy boundaries -- if the Audit model schema changes, every caller breaks.',
	},
	{
		id: 'wrong-interface',
		label: 'AuditLog.record(action: ..., subject: order)',
		description: 'Use AuditLog class to record audit entries',
		codeSnippet: `# In orders package:
AuditLog.record(
  action: 'order.created',
  subject: order
)`,
		correct: false,
		feedback:
			'Using a class name the audit package does not expose means you are guessing the public API -- the owning package defines what is accessible.',
	},
	{
		id: 'correct-interface',
		label: 'AuditInterface.create(action: ..., subject: order)',
		description: 'Use the audit package\'s explicit public API',
		codeSnippet: `# In orders package:
AuditInterface.create(
  action: 'order.created',
  subject: order
)`,
		correct: true,
		feedback: '',
	},
];

// --- Step 4: CODEOWNERS ---

const CODEOWNERS_OPTIONS: StepOption[] = [
	{
		id: 'everyone',
		label: '* @full-team',
		description: 'Make everyone an owner of everything',
		codeSnippet: `# .github/CODEOWNERS
* @full-team`,
		correct: false,
		feedback:
			'Making everyone an owner of everything creates bottlenecks -- every PR requires the full team review, and no one has specific domain responsibility.',
	},
	{
		id: 'generic-team',
		label: '/components/billing/ @backend-team',
		description: 'Assign the generic backend team to billing',
		codeSnippet: `# .github/CODEOWNERS
/components/billing/ @backend-team`,
		correct: false,
		feedback:
			'The generic backend-team does not have billing domain expertise -- CODEOWNERS should map to domain-specific teams who understand the code they own.',
	},
	{
		id: 'domain-team',
		label: '/components/billing/ @billing-team',
		description: 'Assign the billing team to their own domain',
		codeSnippet: `# .github/CODEOWNERS
/components/billing/ @billing-team`,
		correct: true,
		feedback: '',
	},
];

// --- Package dependency diagram data ---

interface PackageNode {
	id: string;
	label: string;
	x: number;
	y: number;
}

interface PackageDep {
	from: string;
	to: string;
}

const PACKAGE_NODES: PackageNode[] = [
	{ id: 'billing', label: 'billing', x: 20, y: 15 },
	{ id: 'orders', label: 'orders', x: 140, y: 15 },
	{ id: 'notifications', label: 'notifications', x: 20, y: 85 },
	{ id: 'users', label: 'users', x: 140, y: 85 },
];

const PACKAGE_DEPS: PackageDep[] = [
	{ from: 'billing', to: 'users' },
	{ from: 'orders', to: 'users' },
	{ from: 'orders', to: 'billing' },
	{ from: 'notifications', to: 'users' },
];

// --- Helper to get options for current step ---

function getOptionsForStep(stepIndex: number): StepOption[] {
	switch (stepIndex) {
		case 0:
			return PACKAGE_OPTIONS;
		case 1:
			return DEPENDENCY_OPTIONS;
		case 2:
			return PUBLIC_API_OPTIONS;
		case 3:
			return CODEOWNERS_OPTIONS;
		default:
			return [];
	}
}

function getStepScenario(stepIndex: number): {
	title: string;
	description: string;
	icon: typeof Package;
} {
	switch (stepIndex) {
		case 0:
			return {
				title: 'Define Packages',
				description:
					'The monolith has grown to 200 files. A change to billing broke notifications because there are no boundaries. Where should the Invoice model live?',
				icon: FolderTree,
			};
		case 1:
			return {
				title: 'Enforce Dependencies',
				description:
					'The billing package needs to read user data. How should you configure package.yml?',
				icon: Shield,
			};
		case 2:
			return {
				title: 'Package Public API',
				description:
					'The orders package needs to create an audit log entry. How should it access the audit functionality?',
				icon: Lock,
			};
		case 3:
			return {
				title: 'Code Ownership',
				description:
					'Setting up CODEOWNERS so PRs require approval from domain owners. The billing team should own their package.',
				icon: Users,
			};
		default:
			return {
				title: '',
				description: '',
				icon: Package,
			};
	}
}

// --- Component ---

export function Level52ModularMonolith({
	onComplete,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const [selectedOption, setSelectedOption] = useState<string | null>(null);

	const handleOptionClick = (option: StepOption) => {
		if (stepper.isComplete || isViewingCompletedStep) return;

		setSelectedOption(option.id);

		if (option.correct) {
			stepper.completeStep();
			setSelectedOption(null);
		} else {
			stepper.recordWrongAttempt(option.feedback);
		}
	};

	const handleComplete = async () => {
		const success = await completeLevel('act7-level51-modular-monolith', {
			stars: stepper.starRating,
		});
		if (success) {
			onComplete({ stars: stepper.starRating });
		}
	};

	const validateSolution = (): ValidationResult => {
		if (!stepper.isComplete) {
			return {
				valid: false,
				message: 'Complete all steps first',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		return {
			valid: true,
			message: 'Modular monolith configured with enforced boundaries!',
		};
	};

	const getCodeFiles = () => {
		const files = [];

		if (stepper.currentStep <= 1) {
			files.push({
				filename: 'components/billing/package.yml',
				language: 'yaml',
				code: `# components/billing/package.yml
enforce_dependencies: true
enforce_privacy: true
dependencies:
  - users
  - .   # root package

# components/billing/app/public/
# Only files here are accessible from outside`,
				highlight:
					stepper.currentStep === 0 ? [1] : [2, 3, 4, 5, 6],
			});
		}

		if (stepper.currentStep >= 2) {
			files.push({
				filename: 'components/billing/app/public/billing_interface.rb',
				language: 'ruby',
				code: `# components/billing/app/public/billing_interface.rb
module BillingInterface
  def self.create_invoice(user:, items:)
    Invoice.create!(user: user, line_items: items)
  end
end`,
				highlight: [2, 3, 4],
			});
		}

		if (stepper.currentStep >= 3) {
			files.push({
				filename: '.github/CODEOWNERS',
				language: 'yaml',
				code: `/components/billing/ @billing-team
/components/orders/  @orders-team
/components/users/   @platform-team`,
				highlight: [1, 2, 3],
			});
		}

		// Always show the full config
		files.push({
			filename: 'packwerk.yml',
			language: 'yaml',
			code: `# packwerk.yml (root)
include:
  - "components/**/*.rb"
  - "app/**/*.rb"
exclude:
  - "test/**/*"
  - "spec/**/*"

# Run: bin/packwerk check
# Validates all package boundaries at CI time`,
			highlight: [2, 3, 4],
		});

		return files;
	};

	const currentOptions = getOptionsForStep(stepper.currentStep);
	const currentScenario = getStepScenario(stepper.currentStep);
	const ScenarioIcon = currentScenario.icon;

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your monolith has 200+ models with no boundaries. A billing
							change broke notifications because nothing enforces separation.
							Use Packwerk to create domain packages with enforced boundaries.
						</p>
					</div>

					<div className="p-4 border-b border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Steps
						</div>
						<StepProgress
							currentStep={stepper.currentStep}
							onStepClick={stepper.goToStep}
							steps={stepper.steps}
						/>
					</div>

					{/* Package Dependency Diagram */}
					<div className="p-4 border-b border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Package Dependencies
						</div>
						<div className="bg-background rounded-lg p-3">
							<svg
								className="w-full"
								viewBox="0 0 260 145"
								xmlns="http://www.w3.org/2000/svg"
							>
								{/* Arrow definitions */}
								<defs>
									<marker
										fill="currentColor"
										id="arrowhead"
										markerHeight="7"
										markerWidth="10"
										orient="auto"
										refX="10"
										refY="3.5"
									>
										<polygon
											className="text-primary"
											points="0 0, 10 3.5, 0 7"
										/>
									</marker>
								</defs>

								{/* Dependency arrows */}
								{PACKAGE_DEPS.map((dep) => {
									const from = PACKAGE_NODES.find(
										(n) => n.id === dep.from,
									)!;
									const to = PACKAGE_NODES.find(
										(n) => n.id === dep.to,
									)!;
									const fromCx = from.x + 50;
									const fromCy = from.y + 25;
									const toCx = to.x + 50;
									const toCy = to.y + 25;

									// Calculate edge points (from center to center, clipped to box edge)
									const dx = toCx - fromCx;
									const dy = toCy - fromCy;
									const dist = Math.sqrt(dx * dx + dy * dy);
									const nx = dx / dist;
									const ny = dy / dist;

									const startX = fromCx + nx * 28;
									const startY = fromCy + ny * 16;
									const endX = toCx - nx * 28;
									const endY = toCy - ny * 16;

									return (
										<line
											className="text-primary"
											key={`${dep.from}-${dep.to}`}
											markerEnd="url(#arrowhead)"
											stroke="currentColor"
											strokeDasharray="4 2"
											strokeWidth="1.5"
											x1={startX}
											x2={endX}
											y1={startY}
											y2={endY}
										/>
									);
								})}

								{/* Package nodes */}
								{PACKAGE_NODES.map((node) => {
									const isHighlighted =
										(stepper.currentStep === 0 &&
											node.id === 'billing') ||
										(stepper.currentStep === 1 &&
											(node.id === 'billing' ||
												node.id === 'users')) ||
										(stepper.currentStep === 3 &&
											node.id === 'billing');

									return (
										<g key={node.id}>
											<rect
												className={
													isHighlighted
														? 'fill-primary/20 stroke-primary'
														: 'fill-card stroke-border'
												}
												height="50"
												rx="6"
												strokeWidth="1.5"
												width="100"
												x={node.x}
												y={node.y}
											/>
											<text
												className={`text-[11px] font-medium ${
													isHighlighted
														? 'fill-primary'
														: 'fill-foreground'
												}`}
												dominantBaseline="middle"
												textAnchor="middle"
												x={node.x + 50}
												y={node.y + 20}
											>
												{node.label}
											</text>
											<text
												className="text-[9px] fill-muted-foreground"
												dominantBaseline="middle"
												textAnchor="middle"
												x={node.x + 50}
												y={node.y + 36}
											>
												package.yml
											</text>
										</g>
									);
								})}
							</svg>
						</div>
						<p className="text-xs text-muted-foreground mt-2 text-center">
							Dashed arrows show allowed dependencies
						</p>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={7}
					levelName="Modular Monolith"
					levelNumber={51}
					onComplete={handleComplete}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Active step content */}
						{!stepper.isComplete && (
							<div className="space-y-4">
								{/* Scenario card */}
								<div className="bg-card rounded-xl border border-border overflow-hidden">
									<div className="bg-secondary px-5 py-3 border-b border-border flex items-center gap-3">
										<ScenarioIcon className="w-5 h-5 text-primary" />
										<h3 className="text-foreground font-semibold">
											{currentScenario.title}
										</h3>
										<span className="ml-auto text-xs text-muted-foreground">
											Step {stepper.currentStep + 1} of{' '}
											{STEP_DEFS.length}
										</span>
									</div>
									<div className="p-5">
										<p className="text-sm text-muted-foreground leading-relaxed">
											{currentScenario.description}
										</p>
									</div>
								</div>

								{/* Code context for selected option */}
								{selectedOption && (
									<div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm">
										<pre className="text-zinc-300 whitespace-pre-wrap">
											{
												currentOptions.find(
													(o) => o.id === selectedOption,
												)?.codeSnippet
											}
										</pre>
									</div>
								)}

								{/* Clickable options */}
								<div className="space-y-3">
									{currentOptions.map((option) => (
										<Button
											className="w-full text-left bg-card rounded-xl border border-border p-4 transition-all hover:border-primary hover:bg-primary/5"
											key={option.id}
											onClick={() => handleOptionClick(option)}
											onMouseEnter={() =>
												setSelectedOption(option.id)
											}
											onMouseLeave={() =>
												setSelectedOption(null)
											}
										>
											<div className="flex items-start gap-3">
												<div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
													<Package className="w-4 h-4 text-muted-foreground" />
												</div>
												<div className="flex-1 min-w-0">
													<div className="text-sm font-medium text-foreground font-mono">
														{option.label}
													</div>
													<div className="text-xs text-muted-foreground mt-1">
														{option.description}
													</div>
												</div>
												<ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-2" />
											</div>
										</Button>
									))}
								</div>

								{/* Error feedback */}
								<ErrorFeedback
									message={stepper.lastFeedback}
									onDismiss={stepper.clearFeedback}
								/>
								{isViewingCompletedStep && hasNextStep && (
									<div className="flex justify-end">
										<Button onClick={stepper.nextStep}>
											Next Step <ArrowRight className="w-4 h-4 ml-2" />
										</Button>
									</div>
								)}
							</div>
						)}

						{/* Completion state */}
						{stepper.isComplete && (
							<div className="text-center py-12 space-y-6">
								<div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 border-2 border-success">
									<Check className="w-8 h-8 text-success" />
								</div>
								<div>
									<div className="flex justify-center gap-1 mb-3">
										{[1, 2, 3].map((star) => (
											<span
												className={`text-2xl ${
													star <= stepper.starRating
														? 'text-warning'
														: 'text-muted-foreground'
												}`}
												key={star}
											>
												{star <= stepper.starRating
													? '\u2605'
													: '\u2606'}
											</span>
										))}
									</div>
									<h3 className="text-xl font-bold text-foreground">
										Modular Monolith Configured!
									</h3>
									<p className="text-muted-foreground mt-2 max-w-md mx-auto">
										Domain packages with enforced boundaries,
										privacy APIs, and code ownership are in place.
										Packwerk validates dependencies at CI time.
									</p>
								</div>

								{/* Summary grid */}
								<div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
									<div className="bg-card rounded-lg border border-border p-3 text-center">
										<FolderTree className="w-5 h-5 text-primary mx-auto mb-1" />
										<div className="text-xs text-muted-foreground">
											Package Structure
										</div>
										<div className="text-sm font-medium text-success">
											Domain-based
										</div>
									</div>
									<div className="bg-card rounded-lg border border-border p-3 text-center">
										<Shield className="w-5 h-5 text-primary mx-auto mb-1" />
										<div className="text-xs text-muted-foreground">
											Dependencies
										</div>
										<div className="text-sm font-medium text-success">
											Enforced
										</div>
									</div>
									<div className="bg-card rounded-lg border border-border p-3 text-center">
										<Lock className="w-5 h-5 text-primary mx-auto mb-1" />
										<div className="text-xs text-muted-foreground">
											Privacy API
										</div>
										<div className="text-sm font-medium text-success">
											Public interfaces
										</div>
									</div>
									<div className="bg-card rounded-lg border border-border p-3 text-center">
										<GitBranch className="w-5 h-5 text-primary mx-auto mb-1" />
										<div className="text-xs text-muted-foreground">
											CODEOWNERS
										</div>
										<div className="text-sm font-medium text-success">
											Domain teams
										</div>
									</div>
								</div>

								<Button onClick={handleComplete}>
									Complete Level
								</Button>
							</div>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles()}
					learningGoal="Packwerk enforces package boundaries in a modular monolith. Each domain gets its own package with explicit dependencies, privacy APIs, and code ownership. CI validates boundaries automatically."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-1.5">
							<li className="flex items-start gap-2">
								<Package className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									<span className="text-primary">
										Packwerk packages
									</span>{' '}
									define domain boundaries with package.yml
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Shield className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									<span className="text-primary">
										enforce_dependencies
									</span>{' '}
									flags undeclared cross-package references
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Lock className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									<span className="text-primary">
										enforce_privacy
									</span>{' '}
									only exposes files in app/public/
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Users className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									<span className="text-primary">CODEOWNERS</span>{' '}
									maps directories to domain teams for PR review
								</span>
							</li>
							<li className="flex items-start gap-2">
								<GitBranch className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									<span className="text-primary">
										bin/packwerk check
									</span>{' '}
									validates all boundaries in CI
								</span>
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Public API Pattern
						</div>
						<pre className="text-xs text-muted-foreground font-mono bg-background rounded p-2 whitespace-pre-wrap">
							{`# components/billing/app/public/
#   billing_interface.rb
#
# Only files in app/public/ are
# accessible from outside the package.
# Internal models stay private.`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level52ModularMonolith;
