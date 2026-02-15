/**
 * Level 3: CRUD Operations
 *
 * 5-step progression through Create, Read, Update, Destroy, Verify.
 * Each step presents choices with wrong-choice feedback.
 */

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
import { SimulatedTerminal, type TerminalOutputLine } from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { useStepGating, type StepDef } from '@/hooks/useStepGating';

interface Post {
	id: number;
	title: string;
	body: string;
}

const STEP_DEFS: StepDef[] = [
	{ id: 'create', title: 'Create' },
	{ id: 'read', title: 'Read' },
	{ id: 'update', title: 'Update' },
	{ id: 'destroy', title: 'Destroy' },
	{ id: 'verify', title: 'Verify' },
];

// Step 1: Create options
const CREATE_OPTIONS = [
	{
		id: 'create',
		label: 'Post.create(title: "Hello", body: "My first post")',
		correct: true,
	},
	{
		id: 'new',
		label: 'Post.new(title: "Hello", body: "My first post")',
		correct: false,
		feedback:
			'"new" builds the object in memory but doesn\'t save it to the database — use "create" to persist immediately.',
	},
	{
		id: 'insert',
		label: 'Post.insert(title: "Hello", body: "My first post")',
		correct: false,
		feedback:
			'"insert" is not an ActiveRecord method — use "create" to build and save in one step.',
	},
];

// Step 2: Read options
const READ_OPTIONS = [
	{
		id: 'find',
		label: 'Post.find(1)',
		correct: true,
	},
	{
		id: 'select',
		label: 'Post.select(1)',
		correct: false,
		feedback:
			'"select" filters columns (like SQL SELECT columns), not records — use "find" to fetch by ID.',
	},
	{
		id: 'where',
		label: 'Post.where(1)',
		correct: false,
		feedback:
			'"where" takes conditions like where(title: "Hello") — use "find(1)" to fetch by primary key.',
	},
];

// Step 3: Update options
const UPDATE_OPTIONS = [
	{
		id: 'update',
		label: 'post.update(title: "Updated")',
		correct: true,
	},
	{
		id: 'assign',
		label: 'post.title = "Updated"',
		correct: false,
		feedback:
			'Assignment only changes the Ruby object in memory — "update" validates and persists to the DB in one call.',
	},
	{
		id: 'update_column',
		label: 'post.update_column(:title, "Updated")',
		correct: false,
		feedback:
			'"update_column" skips validations and callbacks — use "update" to go through the full Rails lifecycle.',
	},
];

// Step 4: Destroy options
const DESTROY_OPTIONS = [
	{
		id: 'destroy',
		label: 'post.destroy',
		correct: true,
	},
	{
		id: 'delete',
		label: 'post.delete',
		correct: false,
		feedback:
			'"delete" runs SQL directly, skipping callbacks — "destroy" runs lifecycle hooks like dependent: :destroy.',
	},
];

export function Level4CRUD({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const stepper = useStepGating(STEP_DEFS);
	const [posts, setPosts] = useState<Post[]>([]);
	const [consoleHistory, setConsoleHistory] = useState<
		{ input: string; output: string; type: 'success' | 'error' | 'info' }[]
	>([{ input: 'rails console', output: 'Loading development environment (Rails 8.0.0)', type: 'info' }]);

	const addConsoleEntry = (
		input: string,
		output: string,
		type: 'success' | 'error' | 'info' = 'success',
	) => {
		setConsoleHistory((prev) => [...prev, { input, output, type }]);
	};

	// Step handlers
	const handleChoice = (
		options: typeof CREATE_OPTIONS,
		choiceId: string,
		onCorrect: () => void,
	) => {
		const opt = options.find((o) => o.id === choiceId)!;
		if (opt.correct) {
			onCorrect();
		} else {
			stepper.recordWrongAttempt(opt.feedback!);
		}
	};

	const handleCreate = () => {
		const newPost: Post = { id: 1, title: 'Hello', body: 'My first post' };
		setPosts([newPost]);
		addConsoleEntry(
			'Post.create(title: "Hello", body: "My first post")',
			`=> #<Post id: 1, title: "Hello", body: "My first post">`,
		);
		stepper.completeStep();
	};

	const handleRead = () => {
		addConsoleEntry(
			'Post.find(1)',
			`=> #<Post id: 1, title: "Hello", body: "My first post">`,
		);
		stepper.completeStep();
	};

	const handleUpdate = () => {
		setPosts((prev) =>
			prev.map((p) => (p.id === 1 ? { ...p, title: 'Updated' } : p)),
		);
		addConsoleEntry(
			'post.update(title: "Updated")',
			'=> true',
		);
		stepper.completeStep();
	};

	const handleDestroy = () => {
		addConsoleEntry(
			'post.destroy',
			`=> #<Post id: 1, title: "Updated"> (destroyed)`,
		);
		setPosts([]);
		stepper.completeStep();
	};

	// Step 5: Verify with terminal
	const verifyCommands = [
		{
			id: 'correct',
			label: 'Post.count',
			command: 'Post.count',
			correct: true,
		},
	];

	const verifyOutput: TerminalOutputLine[] = [
		{ text: '=> 0', color: 'cyan' },
		{ text: '', color: 'muted' },
		{ text: '# All CRUD operations complete!', color: 'green' },
	];

	const handleComplete = async () => {
		const success = await completeLevel('act1-level4-crud', {
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
				message: 'Complete all CRUD operations',
				details: stepper.steps
					.filter((s) => s.status !== 'completed')
					.map((s) => s.title),
			};
		}
		return { valid: true, message: "You've mastered CRUD operations!" };
	};

	const renderChoiceStep = (
		title: string,
		description: string,
		options: typeof CREATE_OPTIONS,
		onCorrect: () => void,
	) => (
		<div className="space-y-4">
			<h3 className="text-lg font-semibold text-foreground">{title}</h3>
			<p className="text-sm text-muted-foreground">{description}</p>
			<div className="space-y-3">
				{options.map((opt) => (
					<Button
						className="w-full h-auto py-3 text-left font-mono text-xs whitespace-normal"
						key={opt.id}
						onClick={() =>
							handleChoice(options, opt.id, onCorrect)
						}
						variant="outline"
					>
						{opt.label}
					</Button>
				))}
			</div>
			<ErrorFeedback
				message={stepper.lastFeedback}
				onDismiss={stepper.clearFeedback}
			/>
		</div>
	);

	const getCodeFiles = () => {
		const highlightLines: number[] = [];
		if (stepper.currentStep >= 1) highlightLines.push(2, 3);
		if (stepper.currentStep >= 2) highlightLines.push(6, 7, 8);
		if (stepper.currentStep >= 3) highlightLines.push(11, 12);
		if (stepper.currentStep >= 4) highlightLines.push(15);

		return [
			{
				filename: 'CRUD_cheatsheet.rb',
				language: 'ruby',
				code: `# CREATE - Make new records
Post.create(title: "Hello", body: "World")
Post.new(title: "Draft").save

# READ - Fetch records
Post.all                    # All posts
Post.find(1)               # By ID
Post.find_by(title: "Hi")  # By attribute

# UPDATE - Modify records
post = Post.find(1)
post.update(title: "New Title")

# DELETE - Remove records
post.destroy       # Runs callbacks
post.delete        # Skips callbacks (avoid)`,
				highlight: highlightLines,
			},
		];
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4 border-b border-border">
						<p className="text-sm text-muted-foreground leading-relaxed">
							Your Post model exists, but the database is empty. Learn the four
							fundamental operations: Create, Read, Update, Delete.
						</p>
					</div>

					<div className="p-4 border-b border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Steps
						</div>
						<StepProgress steps={stepper.steps} />
					</div>

					{/* Live database state */}
					<div className="p-4">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Database: posts
						</div>
						{posts.length === 0 ? (
							<p className="text-xs text-muted-foreground">
								{stepper.currentStep === 0
									? 'No records yet'
									: 'Table is empty (Post.count => 0)'}
							</p>
						) : (
							<div className="text-xs font-mono space-y-1">
								{posts.map((p) => (
									<div className="text-muted-foreground" key={p.id}>
										#{p.id} "{p.title}"
									</div>
								))}
							</div>
						)}
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="CRUD Operations"
					levelNumber={4}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => window.location.reload()}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Console history */}
						<div className="bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden">
							<div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border-b border-zinc-700">
								<div className="flex gap-1.5">
									<div className="w-3 h-3 rounded-full bg-red-500" />
									<div className="w-3 h-3 rounded-full bg-yellow-500" />
									<div className="w-3 h-3 rounded-full bg-green-500" />
								</div>
								<span className="text-xs text-zinc-400 font-mono ml-1">
									Rails Console
								</span>
							</div>
							<div className="p-3 font-mono text-sm max-h-48 overflow-y-auto">
								{consoleHistory.map((entry, i) => (
									<div className="mb-2" key={`console-${i}-${entry.input.slice(0, 15)}`}>
										<div className="flex gap-2">
											<span className="text-emerald-400 shrink-0">
												irb&gt;
											</span>
											<span className="text-zinc-200">{entry.input}</span>
										</div>
										<div
											className={`ml-6 ${
												entry.type === 'error'
													? 'text-red-400'
													: entry.type === 'info'
														? 'text-zinc-500'
														: 'text-cyan-400'
											}`}
										>
											{entry.output}
										</div>
									</div>
								))}
								<div className="flex items-center gap-2">
									<span className="text-emerald-400">irb&gt;</span>
									<span className="w-2 h-4 bg-zinc-300 animate-pulse" />
								</div>
							</div>
						</div>

						{/* Step content */}
						{stepper.currentStep === 0 &&
							renderChoiceStep(
								'Create',
								'Which command creates a new Post and saves it to the database?',
								CREATE_OPTIONS,
								handleCreate,
							)}

						{stepper.currentStep === 1 &&
							renderChoiceStep(
								'Read',
								'Which command finds a post by its ID?',
								READ_OPTIONS,
								handleRead,
							)}

						{stepper.currentStep === 2 &&
							renderChoiceStep(
								'Update',
								'Which command changes the title and saves to the database?',
								UPDATE_OPTIONS,
								handleUpdate,
							)}

						{stepper.currentStep === 3 &&
							renderChoiceStep(
								'Destroy',
								'Which command removes the post and runs lifecycle callbacks?',
								DESTROY_OPTIONS,
								handleDestroy,
							)}

						{stepper.currentStep === 4 && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Verify
								</h3>
								<p className="text-sm text-muted-foreground">
									Confirm the post was destroyed. Check the count.
								</p>
								<SimulatedTerminal
									commands={verifyCommands}
									onCorrect={() => stepper.completeStep()}
									onWrong={(fb) => stepper.recordWrongAttempt(fb)}
									outputLines={verifyOutput}
								/>
							</div>
						)}

						{stepper.isComplete && (
							<div className="text-center py-12 space-y-4">
								<div className="text-4xl">
									{'★'.repeat(stepper.starRating)}
									{'☆'.repeat(3 - stepper.starRating)}
								</div>
								<h3 className="text-xl font-bold text-foreground">
									CRUD Master!
								</h3>
								<p className="text-muted-foreground">
									You can Create, Read, Update, and Destroy records.
								</p>
								<Button onClick={handleComplete}>Complete Level</Button>
							</div>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={getCodeFiles()}>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							CRUD Operations
						</div>
						<div className="grid grid-cols-2 gap-2 text-xs">
							{['create', 'read', 'update', 'destroy'].map((op, i) => (
								<div
									className={`p-2 rounded ${
										stepper.currentStep > i
											? 'bg-success/10 text-success'
											: 'bg-secondary text-muted-foreground'
									}`}
									key={op}
								>
									<span className="font-bold uppercase">
										{op[0]}
									</span>
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
