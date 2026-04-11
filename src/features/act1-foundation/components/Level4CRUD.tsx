/**
 * Level 4: CRUD Operations
 *
 * 5-step progression through Create, Read, Update, Destroy, Verify.
 * Uses TerminalChoiceStep with irb> prompt for Rails Console style.
 */

import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
	type TerminalStep,
	type ValidationResult,
} from '@/components/levels';
import type { LevelComponentProps } from '@/features/levels-registry';
import { useStepGating } from '@/hooks/useStepGating';

const STEPS: TerminalStep[] = [
	{
		id: 'create',
		title: 'Create',
		description: (
			<p className="text-sm text-muted-foreground">
				Which command creates a new Product and saves it to the database?
			</p>
		),
		commands: [
			{
				id: 'new',
				label: 'Product.new(title: "Hello", body: "My first post")',
				command: 'Product.new(title: "Hello", body: "My first post")',
				correct: false,
				feedback:
					'"new" builds the object in memory but doesn\'t save it to the database. You need the method that persists immediately.',
			},
			{
				id: 'insert',
				label: 'Product.insert(title: "Hello", body: "My first post")',
				command: 'Product.insert(title: "Hello", body: "My first post")',
				correct: false,
				feedback:
					'"insert" does a raw SQL INSERT, skipping validations and callbacks. For the full lifecycle, pick the method that validates and saves in one step.',
			},
			{
				id: 'create',
				label: 'Product.create(title: "Hello", body: "My first post")',
				command: 'Product.create(title: "Hello", body: "My first post")',
				correct: true,
			},
		],
		outputLines: [
			{
				text: '=> #<Product id: 1, title: "Hello", body: "My first post">',
				color: 'cyan',
			},
		],
	},
	{
		id: 'read',
		title: 'Read',
		description: (
			<p className="text-sm text-muted-foreground">
				Which command finds a product by its ID?
			</p>
		),
		commands: [
			{
				id: 'select',
				label: 'Product.select(1)',
				command: 'Product.select(1)',
				correct: false,
				feedback:
					'"select" filters columns (like SQL SELECT columns), not records. You need the method that fetches a single record by primary key.',
			},
			{
				id: 'find',
				label: 'Product.find(1)',
				command: 'Product.find(1)',
				correct: true,
			},
			{
				id: 'where',
				label: 'Product.where(1)',
				command: 'Product.where(1)',
				correct: false,
				feedback:
					'"where" takes conditions like where(title: "Hello"), not a bare ID. You need the method designed for primary key lookups.',
			},
		],
		outputLines: [
			{
				text: '=> #<Product id: 1, title: "Hello", body: "My first post">',
				color: 'cyan',
			},
		],
	},
	{
		id: 'update',
		title: 'Update',
		description: (
			<p className="text-sm text-muted-foreground">
				Which command changes the title and saves to the database?
			</p>
		),
		commands: [
			{
				id: 'assign',
				label: 'product.name = "Updated"',
				command: 'product.name = "Updated"',
				correct: false,
				feedback:
					'Assignment only changes the Ruby object in memory. You need the method that validates and persists to the DB in one call.',
			},
			{
				id: 'update_column',
				label: 'product.update_column(:title, "Updated")',
				command: 'product.update_column(:title, "Updated")',
				correct: false,
				feedback:
					'"update_column" skips validations and callbacks. You need the method that goes through the full Rails lifecycle.',
			},
			{
				id: 'update',
				label: 'product.update(title: "Updated")',
				command: 'product.update(title: "Updated")',
				correct: true,
			},
		],
		outputLines: [{ text: '=> true', color: 'cyan' }],
	},
	{
		id: 'destroy',
		title: 'Destroy',
		description: (
			<p className="text-sm text-muted-foreground">
				Which command removes the product and runs lifecycle callbacks?
			</p>
		),
		commands: [
			{
				id: 'delete',
				label: 'post.delete',
				command: 'post.delete',
				correct: false,
				feedback:
					'"delete" runs SQL directly, skipping callbacks. You need the method that runs lifecycle hooks like dependent associations.',
			},
			{
				id: 'destroy',
				label: 'product.destroy',
				command: 'product.destroy',
				correct: true,
			},
		],
		outputLines: [
			{
				text: '=> #<Product id: 1, title: "Updated"> (destroyed)',
				color: 'cyan',
			},
		],
	},
	{
		id: 'verify',
		title: 'Verify',
		description: (
			<p className="text-sm text-muted-foreground">
				Confirm the product was destroyed. Check the count.
			</p>
		),
		commands: [
			{
				id: 'all-length',
				label: 'Product.all.length',
				command: 'Product.all.length',
				correct: false,
				feedback:
					"all.length loads every record into memory just to count them. There's a more efficient way.",
			},
			{
				id: 'exists',
				label: 'Product.exists?',
				command: 'Product.exists?',
				correct: false,
				feedback:
					'exists? returns true/false, not a count. You need to see how many records remain.',
			},
			{
				id: 'count',
				label: 'Product.count',
				command: 'Product.count',
				correct: true,
			},
		],
		outputLines: [{ text: '=> 0', color: 'cyan' }],
	},
];

function getCodeFiles({ currentStep }: { currentStep: number }) {
	const highlightLines: number[] = [];
	if (currentStep >= 1) highlightLines.push(2, 3);
	if (currentStep >= 2) highlightLines.push(6, 7, 8);
	if (currentStep >= 3) highlightLines.push(11, 12);
	if (currentStep >= 4) highlightLines.push(15);

	return [
		{
			filename: 'CRUD_cheatsheet.rb',
			language: 'ruby',
			code: `# CREATE - Make new records
Product.create(title: "Hello", body: "World")
Product.new(title: "Draft").save

# READ - Fetch records
Product.all                    # All posts
Product.find(1)               # By ID
Product.find_by(title: "Hi")  # By attribute

# UPDATE - Modify records
post = Product.find(1)
product.update(title: "New Title")

# DELETE - Remove records
product.destroy       # Runs callbacks
post.delete        # Skips callbacks (avoid)`,
			highlight: highlightLines,
		},
	];
}

function getDbState(furthestStep: number) {
	if (furthestStep === 0) return 'No records yet';
	if (furthestStep >= 1 && furthestStep <= 2) return '#1 "Hello"';
	if (furthestStep === 3) return '#1 "Updated"';
	return 'Table is empty (Product.count => 0)';
}

export function Level4CRUD({ onComplete }: LevelComponentProps) {
	const stepDefs = STEPS.map((s) => ({ id: s.id, title: s.title }));
	const stepper = useStepGating(stepDefs, { autoAdvance: false });

	const currentConfig = STEPS[stepper.currentStep];

	const handleComplete = () => {
		onComplete({ stars: stepper.starRating });
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
		return { valid: true, message: "You've mastered CRUD operations!" };
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							In Level 3, you created the Product model and ran the migration.
							The table exists but it's empty. Open the Rails console and
							learn the four operations every model needs: Create, Read,
							Update, Delete.
						</p>
					</div>

					<div className="p-4">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Steps
						</div>
						<StepProgress
							currentStep={stepper.currentStep}
							onStepClick={stepper.goToStep}
							steps={stepper.steps}
						/>
					</div>

					<div className="p-4">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Database: posts
						</div>
						<div className="text-xs font-mono text-muted-foreground">
							{getDbState(stepper.furthestStep)}
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="CRUD Operations"
					levelNumber={4}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{currentConfig && (
							<TerminalChoiceStep
								commands={currentConfig.commands}
								completed={stepper.isCurrentStepCompleted}
								description={currentConfig.description}
								hasNext={stepper.currentStep < STEPS.length - 1}
								initialHistory={buildTerminalHistory(
									STEPS,
									stepper.currentStep,
								)}
								onCorrect={() => stepper.completeStep()}
								onNext={stepper.nextStep}
								onWrong={(fb) => stepper.recordWrongAttempt(fb)}
								outputLines={currentConfig.outputLines}
								prompt="irb>"
								stepKey={stepper.currentStep}
								terminalTitle="Rails Console"
								title={currentConfig.title}
							/>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles({ currentStep: stepper.currentStep })}
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							CRUD Operations
						</div>
						<div className="grid grid-cols-2 gap-2 text-xs">
							{['create', 'read', 'update', 'destroy'].map((op, i) => (
								<div
									className={`p-2 rounded ${
										stepper.furthestStep > i
											? 'bg-success/10 text-success'
											: 'bg-secondary text-muted-foreground'
									}`}
									key={op}
								>
									<span className="font-bold uppercase">{op[0]}</span>
									{op.slice(1)}
								</div>
							))}
						</div>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level4CRUD;
