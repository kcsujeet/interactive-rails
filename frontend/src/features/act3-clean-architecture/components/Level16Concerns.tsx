/**
 * Level 16: Concerns & Modules
 *
 * Extract shared behavior into a reusable ActiveSupport::Concern.
 * Player identifies duplicated tagging code across 3 models and extracts it.
 * Teaches: ActiveSupport::Concern, DRY, included block, class_methods
 */

import {
	Check,
	Copy,
	FileCode,
	Layers,
	PackagePlus,
	Scissors,
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

// --- Data definitions ---

interface CodeLine {
	id: string;
	code: string;
	shared: boolean;
}

interface ModelDef {
	name: string;
	filename: string;
	color: string;
	uniqueLines: string[];
	sharedLines: CodeLine[];
}

const SHARED_LINES: CodeLine[] = [
	{
		id: 'has_many_taggings',
		code: 'has_many :taggings, as: :taggable',
		shared: true,
	},
	{
		id: 'has_many_tags',
		code: 'has_many :tags, through: :taggings',
		shared: true,
	},
	{
		id: 'scope_tagged_with',
		code: 'scope :tagged_with, ->(name) { joins(:tags).where(tags: { name: name }) }',
		shared: true,
	},
	{
		id: 'def_tag_list',
		code: 'def tag_list; tags.map(&:name).join(", "); end',
		shared: true,
	},
	{
		id: 'def_tag_list_setter',
		code: 'def tag_list=(names); self.tags = names.split(",").map(&:strip).uniq.map { |n| Tag.find_or_create_by(name: n) }; end',
		shared: true,
	},
];

const MODELS: ModelDef[] = [
	{
		name: 'Post',
		filename: 'app/models/post.rb',
		color: '#3b82f6',
		uniqueLines: ['belongs_to :author', 'has_many :comments'],
		sharedLines: SHARED_LINES,
	},
	{
		name: 'Comment',
		filename: 'app/models/comment.rb',
		color: '#22c55e',
		uniqueLines: ['belongs_to :post', 'belongs_to :user'],
		sharedLines: SHARED_LINES,
	},
	{
		name: 'Photo',
		filename: 'app/models/photo.rb',
		color: '#f59e0b',
		uniqueLines: ['has_one_attached :image', 'belongs_to :user'],
		sharedLines: SHARED_LINES,
	},
];

const MODEL_NAMES = MODELS.map((m) => m.name);

// --- Initial state helpers ---

const INITIAL_EXTRACTED: Set<string> = new Set();
const INITIAL_INCLUDED: Set<string> = new Set();

// --- Component ---

export function Level16Concerns({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();

	const [extractedLines, setExtractedLines] = useState<Set<string>>(
		() => new Set(INITIAL_EXTRACTED),
	);
	const [concernCreated, setConcernCreated] = useState(false);
	const [includedModels, setIncludedModels] = useState<Set<string>>(
		() => new Set(INITIAL_INCLUDED),
	);

	// Derived state
	const selectedCount = extractedLines.size;
	const canExtract = selectedCount >= 4;
	const allIncluded = MODEL_NAMES.every((m) => includedModels.has(m));

	const stepsCompleted = useMemo(() => {
		if (allIncluded) return 3;
		if (concernCreated) return 2;
		if (selectedCount >= 4) return 1;
		return 0;
	}, [selectedCount, concernCreated, allIncluded]);

	// Handlers
	const toggleLine = (lineId: string) => {
		if (concernCreated) return;
		setExtractedLines((prev) => {
			const next = new Set(prev);
			if (next.has(lineId)) {
				next.delete(lineId);
			} else {
				next.add(lineId);
			}
			return next;
		});
	};

	const handleExtract = () => {
		if (!canExtract || concernCreated) return;
		setConcernCreated(true);
	};

	const toggleInclude = (modelName: string) => {
		if (!concernCreated) return;
		setIncludedModels((prev) => {
			const next = new Set(prev);
			if (next.has(modelName)) {
				next.delete(modelName);
			} else {
				next.add(modelName);
			}
			return next;
		});
	};

	const handleReset = () => {
		setExtractedLines(new Set());
		setConcernCreated(false);
		setIncludedModels(new Set());
	};

	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		if (selectedCount < 4) {
			errors.push(`Select at least 4 shared lines (${selectedCount} selected)`);
		}

		if (!concernCreated) {
			errors.push('Extract the shared code into a Taggable concern');
		}

		const missingModels = MODEL_NAMES.filter((m) => !includedModels.has(m));
		if (missingModels.length > 0) {
			errors.push(`Include concern in: ${missingModels.join(', ')}`);
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Concern extraction incomplete!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'Concern extracted and included in all models!',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act3-level16-concerns', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	// Code generation
	const generateConcernCode = () => {
		const extracted = SHARED_LINES.filter((l) => extractedLines.has(l.id));
		const associations = extracted.filter(
			(l) =>
				l.code.startsWith('has_many') ||
				l.code.startsWith('has_one') ||
				l.code.startsWith('belongs_to'),
		);
		const scopes = extracted.filter((l) => l.code.startsWith('scope'));
		const methods = extracted.filter((l) => l.code.startsWith('def '));

		if (extracted.length === 0) {
			return `# Select shared lines to preview the concern
module Taggable
  extend ActiveSupport::Concern

  included do
    # Associations will appear here
  end

  # Methods will appear here
end`;
		}

		const includedBlock =
			associations.length > 0 || scopes.length > 0
				? `  included do
${associations.map((l) => `    ${l.code}`).join('\n')}
${scopes.length > 0 ? `\n${scopes.map((l) => `    ${l.code}`).join('\n')}` : ''}
  end`
				: '';

		const methodBlock =
			methods.length > 0
				? methods
						.map((l) => {
							const parts = l.code
								.split(';')
								.map((p) => p.trim())
								.filter(Boolean);
							if (parts.length <= 1) return `  ${l.code}`;
							const defLine = parts[0];
							const body = parts.slice(1, -1).join('\n    ');
							const endLine =
								parts[parts.length - 1] === 'end'
									? ''
									: parts[parts.length - 1];
							return `  ${defLine}\n    ${body}${endLine ? `\n    ${endLine}` : ''}\n  end`;
						})
						.join('\n\n')
				: '';

		return `module Taggable
  extend ActiveSupport::Concern

${includedBlock}
${methodBlock ? `\n${methodBlock}` : ''}
end`;
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4">
						<div className="flex items-center gap-2 mb-3">
							<Layers className="w-4 h-4 text-primary" />
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Goal
							</div>
						</div>
						<p className="text-sm text-foreground mb-4">
							Extract shared behavior into a reusable Concern module.
						</p>

						<div className="flex items-center gap-2 mb-2">
							<Copy className="w-4 h-4 text-destructive" />
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Scenario
							</div>
						</div>
						<p className="text-xs text-muted-foreground mb-4">
							Three models have identical tagging code -- 120 lines of pure
							duplication across Post, Comment, and Photo. Time to DRY it up.
						</p>

						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Instructions
						</div>
						<ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside mb-4">
							<li>Identify duplicated code across models</li>
							<li>Select the shared lines to extract</li>
							<li>Create the Taggable concern</li>
							<li>Include it in all three models</li>
						</ol>
					</div>

					{/* Progress */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Progress
						</div>
						<div className="space-y-2">
							{[
								{
									label: 'Select shared code',
									done: selectedCount >= 4,
									icon: Scissors,
								},
								{
									label: 'Create concern',
									done: concernCreated,
									icon: PackagePlus,
								},
								{
									label: 'Include in all models',
									done: allIncluded,
									icon: Check,
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
								style={{ width: `${(stepsCompleted / 3) * 100}%` }}
							/>
						</div>
						<div className="text-xs text-muted-foreground mt-1 text-right">
							{stepsCompleted} / 3 steps
						</div>
					</div>

					{/* Legend */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Models
						</div>
						<div className="space-y-1.5">
							{MODELS.map((model) => (
								<div className="flex items-center gap-2" key={model.name}>
									<FileCode
										className="w-3 h-3"
										style={{ color: model.color }}
									/>
									<span className="text-xs text-muted-foreground">
										{model.name}
									</span>
								</div>
							))}
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="Concerns & Modules"
					levelNumber={16}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					{/* Before state: 3 model cards side by side */}
					{!concernCreated && (
						<div className="max-w-5xl mx-auto">
							<div className="flex items-center gap-2 mb-4">
								<Copy className="w-4 h-4 text-destructive" />
								<span className="text-sm font-medium text-foreground">
									Duplicated code across {MODELS.length} models
								</span>
								<span className="text-xs text-muted-foreground ml-auto">
									Click shared lines to select them
								</span>
							</div>

							<div className="grid grid-cols-3 gap-4">
								{MODELS.map((model) => (
									<div
										className="rounded-xl border-2 bg-card overflow-hidden transition-all"
										key={model.name}
										style={{ borderColor: `${model.color}40` }}
									>
										{/* Model header */}
										<div
											className="px-4 py-2.5 border-b flex items-center gap-2"
											style={{
												backgroundColor: `${model.color}15`,
												borderColor: `${model.color}30`,
											}}
										>
											<FileCode
												className="w-4 h-4"
												style={{ color: model.color }}
											/>
											<span
												className="font-semibold text-sm"
												style={{ color: model.color }}
											>
												{model.name}
											</span>
											<span className="text-xs text-muted-foreground ml-auto font-mono">
												{model.filename}
											</span>
										</div>

										<div className="p-3 space-y-1">
											{/* Unique lines */}
											{model.uniqueLines.map((line) => (
												<div
													className="px-2 py-1 rounded text-xs font-mono text-muted-foreground bg-secondary/50"
													key={line}
												>
													{line}
												</div>
											))}

											{/* Divider */}
											<div className="border-t border-border my-2" />

											{/* Shared lines (selectable) */}
											{model.sharedLines.map((line) => {
												const isSelected = extractedLines.has(line.id);
												return (
													<button
														className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono transition-all ${
															isSelected
																? 'bg-primary/20 text-primary ring-1 ring-primary/50'
																: 'bg-destructive/5 text-foreground hover:bg-destructive/10 animate-pulse-subtle'
														}`}
														key={line.id}
														onClick={() => toggleLine(line.id)}
														type="button"
													>
														<div className="flex items-center gap-1.5">
															{isSelected ? (
																<Check className="w-3 h-3 text-primary shrink-0" />
															) : (
																<Copy className="w-3 h-3 text-destructive/50 shrink-0" />
															)}
															<span className="truncate">{line.code}</span>
														</div>
													</button>
												);
											})}
										</div>
									</div>
								))}
							</div>

							{/* Extract button */}
							<div className="flex justify-center mt-6">
								<Button
									className={`px-6 py-3 font-semibold flex items-center gap-2 ${
										canExtract
											? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20'
											: 'bg-secondary text-muted-foreground cursor-not-allowed'
									}`}
									disabled={!canExtract}
									onClick={handleExtract}
								>
									<Scissors className="w-4 h-4" />
									Extract to Concern
									{selectedCount > 0 && (
										<span className="text-xs opacity-80">
											({selectedCount} lines)
										</span>
									)}
								</Button>
							</div>
						</div>
					)}

					{/* After state: concern card + slim models */}
					{concernCreated && (
						<div className="max-w-5xl mx-auto">
							<div className="flex items-center gap-2 mb-4">
								<PackagePlus className="w-4 h-4 text-success" />
								<span className="text-sm font-medium text-foreground">
									Concern extracted -- include it in each model
								</span>
							</div>

							{/* Concern card */}
							<div className="rounded-xl border-2 border-primary/50 bg-card overflow-hidden mb-6 max-w-lg mx-auto shadow-lg shadow-primary/10">
								<div className="px-4 py-2.5 border-b border-primary/30 bg-primary/10 flex items-center gap-2">
									<Layers className="w-4 h-4 text-primary" />
									<span className="font-semibold text-sm text-primary">
										Taggable Concern
									</span>
									<span className="text-xs text-muted-foreground ml-auto font-mono">
										app/models/concerns/taggable.rb
									</span>
								</div>
								<div className="p-3 space-y-1">
									{SHARED_LINES.filter((l) => extractedLines.has(l.id)).map(
										(line) => (
											<div
												className="px-2 py-1 rounded text-xs font-mono text-primary bg-primary/10"
												key={line.id}
											>
												{line.code}
											</div>
										),
									)}
								</div>
							</div>

							{/* Slim model cards */}
							<div className="grid grid-cols-3 gap-4">
								{MODELS.map((model) => {
									const isIncluded = includedModels.has(model.name);
									return (
										<div
											className={`rounded-xl border-2 bg-card overflow-hidden transition-all ${
												isIncluded ? 'ring-2 ring-success/50' : ''
											}`}
											key={model.name}
											style={{ borderColor: `${model.color}40` }}
										>
											<div
												className="px-4 py-2.5 border-b flex items-center gap-2"
												style={{
													backgroundColor: `${model.color}15`,
													borderColor: `${model.color}30`,
												}}
											>
												<FileCode
													className="w-4 h-4"
													style={{ color: model.color }}
												/>
												<span
													className="font-semibold text-sm"
													style={{ color: model.color }}
												>
													{model.name}
												</span>
												{isIncluded && (
													<Check className="w-4 h-4 text-success ml-auto" />
												)}
											</div>

											<div className="p-3 space-y-1">
												{/* Include button / status */}
												<button
													className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono transition-all ${
														isIncluded
															? 'bg-success/15 text-success ring-1 ring-success/30'
															: 'bg-secondary hover:bg-primary/10 text-muted-foreground hover:text-primary'
													}`}
													onClick={() => toggleInclude(model.name)}
													type="button"
												>
													<div className="flex items-center gap-1.5">
														{isIncluded ? (
															<Check className="w-3 h-3 shrink-0" />
														) : (
															<PackagePlus className="w-3 h-3 shrink-0" />
														)}
														include Taggable
													</div>
												</button>

												{/* Unique lines remain */}
												{model.uniqueLines.map((line) => (
													<div
														className="px-2 py-1 rounded text-xs font-mono text-muted-foreground bg-secondary/50"
														key={line}
													>
														{line}
													</div>
												))}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/models/concerns/taggable.rb',
							language: 'ruby',
							code: generateConcernCode(),
							highlight: [],
						},
					]}
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-2">
							<li className="flex items-start gap-2">
								<Scissors className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<span>
									<strong className="text-foreground">DRY:</strong> Don't Repeat
									Yourself -- extract when 2+ models share behavior
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Layers className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<span>
									<strong className="text-foreground">included block:</strong>{' '}
									Associations and scopes go inside{' '}
									<code className="text-primary">included do...end</code>
								</span>
							</li>
							<li className="flex items-start gap-2">
								<PackagePlus className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<span>
									<strong className="text-foreground">class_methods:</strong>{' '}
									For class-level methods shared across models
								</span>
							</li>
							<li className="flex items-start gap-2">
								<FileCode className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								<span>
									<strong className="text-foreground">When to extract:</strong>{' '}
									Only when 2+ models share the exact same behavior
								</span>
							</li>
						</ul>
					</div>

					{/* Usage example */}
					{concernCreated && (
						<div className="p-4 border-t border-border">
							<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
								After Extraction
							</div>
							<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
								{`# app/models/post.rb
class Post < ApplicationRecord
  include Taggable

  belongs_to :author
  has_many :comments
end

# Clean, focused, DRY`}
							</pre>
						</div>
					)}
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level16Concerns;
