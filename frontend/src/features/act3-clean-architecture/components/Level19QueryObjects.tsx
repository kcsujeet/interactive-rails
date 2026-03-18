/**
 * Level 19: Query Objects
 *
 * Sequential phase flow: intro -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - intro): Static annotated code display (Type 2).
 *   Three consumer zones (Admin Controller, API Controller, CSV Job) each
 *   showing the same inline query chain with destructive left borders.
 *   Callout states the structural problem. "Build the Fix" always visible.
 * Phase 2 (HOW - build): 3 OptionCard steps
 *   Step 0: Choose extraction pattern (PORO query object)
 *   Step 1: Define filter method pattern (return self for chaining)
 *   Step 2: Wire controller to query object (proper instantiation + chaining)
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Queries" button
 * Phase 4 (ADVANTAGE - reward): Clean consumers with ProductQuery delegation
 *   (green borders), extracted ProductQuery zone with filter methods, and
 *   "Problems Solved" checklist closing the loop on intro's stated problems.
 *
 * Visualization approach: Type 2 static intro (refactoring concept).
 * The duplicated inline query chains are self-evident by reading the three files.
 *
 * Teaches: Query objects, composable scopes, returning self for chaining,
 * reuse across controllers/jobs.
 */

import { ArrowRight, Check, Play, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	OptionCard,
	RightPanel,
	StepProgress,
	type ValidationResult,
} from '@/components/levels';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'intro' | 'build' | 'activate' | 'reward';

// ──────────────────────────────────────────────
// Annotated code sections (intro)
// ──────────────────────────────────────────────

interface AnnotatedSection {
	id: string;
	label: string;
	variant: 'core' | 'duplicated';
	code: string;
}

const ADMIN_SECTIONS: AnnotatedSection[] = [
	{
		id: 'admin-core',
		label: 'Core',
		variant: 'core',
		code: '@posts = Product.all',
	},
	{
		id: 'admin-published',
		label: 'Duplicated: Published Filter',
		variant: 'duplicated',
		code: 'if params[:published].present?\n  @posts = @posts.where.not(published_at: nil)\nend',
	},
	{
		id: 'admin-author',
		label: 'Duplicated: Author Filter',
		variant: 'duplicated',
		code: 'if params[:author_id].present?\n  @posts = @posts.where(author_id: params[:author_id])\nend',
	},
	{
		id: 'admin-comments',
		label: 'Duplicated: Review Count',
		variant: 'duplicated',
		code: 'if params[:min_comments].present?\n  @posts = @posts.left_joins(:reviews)\n    .group(:id)\n    .having("COUNT(comments.id) >= ?", ...)\nend',
	},
	{
		id: 'admin-tag',
		label: 'Duplicated: Tag Filter',
		variant: 'duplicated',
		code: 'if params[:tag].present?\n  @posts = @posts.joins(:tags)\n    .where(tags: { name: params[:tag] })\nend',
	},
];

const API_SECTIONS: AnnotatedSection[] = [
	{
		id: 'api-core',
		label: 'Core',
		variant: 'core',
		code: 'posts = Product.all',
	},
	{
		id: 'api-published',
		label: 'Duplicated: Published Filter',
		variant: 'duplicated',
		code: 'posts = posts.where.not(published_at: nil) if params[:published]',
	},
	{
		id: 'api-author',
		label: 'Duplicated: Author Filter',
		variant: 'duplicated',
		code: 'posts = posts.where(author_id: params[:author_id]) if params[:author_id]',
	},
	{
		id: 'api-tag',
		label: 'Duplicated: Tag Filter',
		variant: 'duplicated',
		code: 'posts = posts.joins(:tags).where(tags: { name: params[:tag] }) if params[:tag]',
	},
];

const CSV_SECTIONS: AnnotatedSection[] = [
	{
		id: 'csv-core',
		label: 'Core',
		variant: 'core',
		code: 'posts = Product.all',
	},
	{
		id: 'csv-published',
		label: 'Duplicated: Published Filter',
		variant: 'duplicated',
		code: 'posts = posts.where.not(published_at: nil) if filters[:published]',
	},
	{
		id: 'csv-since',
		label: 'Duplicated: Date Filter (BUG)',
		variant: 'duplicated',
		code: '# BUG: uses > instead of >=\nposts = posts.where("published_at > ?", filters[:since])',
	},
];

// ──────────────────────────────────────────────
// Step definitions (3 OptionCard steps)
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'extraction-pattern', title: 'Choose Extraction Pattern' },
	{ id: 'filter-method', title: 'Define Filter Method Pattern' },
	{ id: 'wire-controller', title: 'Wire Controller to Query Object' },
];

// ──────────────────────────────────────────────
// OptionCard step data
// ──────────────────────────────────────────────

interface StepOption {
	id: string;
	label: string;
	correct: boolean;
	feedback?: string;
}

const PATTERN_OPTIONS: StepOption[] = [
	{
		id: 'model-scope',
		label: 'Add scopes to the Product model for each filter',
		correct: false,
		feedback:
			'Scopes work for single-purpose filters, but 6+ composable filters with JOINs and GROUP BY would bloat the model. A dedicated object composes better for multi-filter scenarios.',
	},
	{
		id: 'query-object',
		label: 'Extract into a ProductQuery PORO in app/queries/',
		correct: true,
	},
	{
		id: 'controller-concern',
		label: 'Move the filters into a controller concern',
		correct: false,
		feedback:
			'A concern just moves the code to a different file. It is still tied to the controller and cannot be reused in background jobs or rake tasks.',
	},
	{
		id: 'raw-sql',
		label: 'Replace the chains with a single raw SQL query',
		correct: false,
		feedback:
			'Raw SQL loses composability. You cannot conditionally add or remove filters without string concatenation, which is error-prone and hard to test.',
	},
];

const FILTER_METHOD_OPTIONS: StepOption[] = [
	{
		id: 'return-array',
		label: 'Each method calls .to_a and returns an Array of records',
		correct: false,
		feedback:
			'Returning an Array breaks chaining, pagination, and eager loading. The next filter cannot add more WHERE clauses to a plain Array.',
	},
	{
		id: 'return-new-query',
		label: 'Each method returns a new ProductQuery instance with a fresh scope',
		correct: false,
		feedback:
			'Creating a new instance on every call loses the accumulated scope from previous filters. The chain would only reflect the last filter applied.',
	},
	{
		id: 'return-self',
		label: 'Each method mutates @scope and returns self for chaining',
		correct: true,
	},
	{
		id: 'modify-in-place',
		label: 'Each method modifies @scope but returns nil',
		correct: false,
		feedback:
			'Returning nil breaks the chaining pattern. Callers could not write .by_author(3).by_tag("rails").results because the first call returns nil.',
	},
];

const WIRE_OPTIONS: StepOption[] = [
	{
		id: 'pass-params-hash',
		label: 'ProductQuery.new(params).results',
		correct: false,
		feedback:
			'Passing the entire params hash to the query object couples it to the controller. Background jobs and rake tasks do not have a params object.',
	},
	{
		id: 'call-class-method',
		label: 'ProductQuery.filter(params[:published], params[:author_id])',
		correct: false,
		feedback:
			'A single class method with positional arguments is not composable. Adding a new filter means changing the method signature everywhere it is called.',
	},
	{
		id: 'chain-methods',
		label: 'ProductQuery.new.published(params[:published]).by_author(params[:author_id]).sorted.results',
		correct: true,
	},
];

const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: StepOption[];
	}
> = {
	0: {
		title: 'Choose Extraction Pattern',
		description:
			'The admin controller has 60 lines of inline .where().joins().group() chains duplicated in three places. What is the best way to extract this query logic?',
		options: PATTERN_OPTIONS,
	},
	1: {
		title: 'Define Filter Method Pattern',
		description:
			'Each filter method (published, by_author, by_tag, with_min_comments) needs to be chainable so callers can combine any subset of filters. What should each method return?',
		options: FILTER_METHOD_OPTIONS,
	},
	2: {
		title: 'Wire Controller to Query Object',
		description:
			'The ProductQuery object is ready with chainable filter methods. How should the controller use it to replace the 60-line inline chain?',
		options: WIRE_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Annotated code block component
// ──────────────────────────────────────────────

function AnnotatedCodeBlock({
	fileName,
	sections,
	borderColor,
	lineCount,
}: {
	fileName: string;
	sections: AnnotatedSection[];
	borderColor: 'destructive' | 'success';
	lineCount?: string;
}) {
	const isDestructive = borderColor === 'destructive';
	return (
		<div className="flex-1 space-y-1.5">
			<div className="flex items-center justify-between mb-2">
				<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
					{fileName}
				</div>
				{lineCount && (
					<div className={`text-xs font-mono ${isDestructive ? 'text-destructive' : 'text-success'}`}>
						{lineCount}
					</div>
				)}
			</div>
			{sections.map((section) => {
				const isDuplicated = section.variant === 'duplicated';
				const borderClass = isDuplicated
					? isDestructive
						? 'border-l-destructive bg-destructive/5 dark:bg-destructive/10'
						: 'border-l-success bg-success/5 dark:bg-success/10'
					: 'border-l-zinc-400 dark:border-l-zinc-600 bg-muted/30';
				const badgeClass = isDuplicated
					? isDestructive
						? 'border-destructive/50 text-destructive bg-destructive/10'
						: 'border-success/50 text-success bg-success/10'
					: 'border-zinc-400/50 text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800';

				return (
					<div
						key={section.id}
						className={`border-l-2 rounded-r-md px-3 py-2 ${borderClass}`}
					>
						<Badge
							className={`text-[10px] mb-1 ${badgeClass}`}
							variant="outline"
						>
							{section.label}
						</Badge>
						<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">
							{section.code}
						</pre>
					</div>
				);
			})}
		</div>
	);
}

// ──────────────────────────────────────────────
// Code preview helper
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	if (phase === 'intro') {
		files.push({
			filename: 'app/controllers/admin/products_controller.rb',
			language: 'ruby',
			code: `class Admin::PostsController < ApplicationController
  def index
    @products = Product.all

    if params[:published].present?
      @products = @posts.where.not(published_at: nil)
    end

    if params[:author_id].present?
      @products = @posts.where(author_id: params[:author_id])
    end

    if params[:since].present?
      @products = @posts.where("published_at >= ?", params[:since])
    end

    if params[:min_comments].present?
      @products = @posts.left_joins(:reviews)
        .group(:id)
        .having("COUNT(comments.id) >= ?",
                params[:min_comments])
    end

    if params[:tag].present?
      @products = @posts.joins(:tags)
        .where(tags: { name: params[:tag] })
    end

    @products = @posts.order(published_at: :desc)

    render json: @posts
  end
end

# Same logic copy-pasted in:
# app/controllers/api/v1/products_controller.rb
# app/jobs/csv_export_job.rb`,
			highlight: [5, 6, 9, 10, 13, 14, 17, 18, 19, 20, 21, 24, 25, 26],
		});
		return files;
	}

	if (furthestStep === 0) {
		files.push({
			filename: 'app/controllers/admin/products_controller.rb',
			language: 'ruby',
			code: `class Admin::PostsController < ApplicationController
  def index
    @products = Product.all

    if params[:published].present?
      @products = @posts.where.not(published_at: nil)
    end

    if params[:author_id].present?
      @products = @posts.where(author_id: params[:author_id])
    end

    if params[:min_comments].present?
      @products = @posts.left_joins(:reviews)
        .group(:id)
        .having("COUNT(comments.id) >= ?",
                params[:min_comments])
    end

    # ... 60 lines of inline query chains
    render json: @posts
  end
end

# Duplicated in 2 more files`,
			highlight: [5, 6, 9, 10, 13, 14, 15, 16, 17],
		});
	}

	if (furthestStep >= 1) {
		files.push({
			filename: 'app/queries/product_query.rb',
			language: 'ruby',
			code:
				furthestStep >= 3
					? `class ProductQuery < ApplicationQuery
  def published(flag)
    return self if flag.blank?

    @scope = @scope.where.not(published_at: nil)
    self
  end

  def by_author(author_id)
    return self if author_id.blank?

    @scope = @scope.where(author_id: author_id)
    self
  end

  def since(date)
    return self if date.blank?

    @scope = @scope.where("published_at >= ?", date)
    self
  end

  def with_min_comments(count)
    return self if count.blank?

    @scope = @scope
      .left_joins(:reviews)
      .group(:id)
      .having("COUNT(comments.id) >= ?", count)
    self
  end

  def by_tag(tag_name)
    return self if tag_name.blank?

    @scope = @scope.joins(:tags)
      .where(tags: { name: tag_name })
    self
  end

  def sorted(column = :published_at, dir = :desc)
    @scope = @scope.order(column => dir)
    self
  end

  private

  def default_scope
    Product.all
  end
end`
					: furthestStep >= 2
						? `class ProductQuery < ApplicationQuery
  def published(flag)
    return self if flag.blank?

    @scope = @scope.where.not(published_at: nil)
    self  # returns self for chaining
  end

  def by_author(author_id)
    return self if author_id.blank?

    @scope = @scope.where(author_id: author_id)
    self
  end

  # Each method: guard blank, mutate @scope, return self
  # ...more filter methods

  private

  def default_scope
    Product.all
  end
end`
						: `class ProductQuery < ApplicationQuery
  # What pattern should each filter method follow?
  # How does chaining work?

  private

  def default_scope
    Product.all
  end
end`,
			highlight:
				furthestStep >= 3
					? [2, 6, 9, 14, 44, 49]
					: furthestStep >= 2
						? [5, 6, 7, 14, 15]
						: [2, 3],
		});
	}

	if (furthestStep >= 3) {
		files.push({
			filename: 'app/controllers/admin/products_controller.rb',
			language: 'ruby',
			code: `class Admin::PostsController < ApplicationController
  def index
    products = ProductQuery.new
      .published(params[:published])
      .by_author(params[:author_id])
      .since(params[:since])
      .with_min_comments(params[:min_comments])
      .by_tag(params[:tag])
      .sorted
      .results

    render json: posts
  end
end

# Reuse in API controller:
# ProductQuery.new(Product.where.not(published_at: nil))
#   .by_tag(params[:tag]).sorted.results

# Reuse in background job:
# ProductQuery.new.published(true).since(date).results`,
			highlight: [3, 4, 5, 6, 7, 8, 9, 10],
		});
	}

	return files;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level19QueryObjects({ onComplete }: LevelComponentProps) {
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const [phase, setPhase] = useState<Phase>('intro');

	// ── Transition: build -> activate when all steps complete ──
	useEffect(() => {
		if (phase === 'build' && stepper.isComplete) {
			setPhase('activate');
		}
	}, [phase, stepper.isComplete]);

	// ── OptionCard step handler ──
	const handleOptionClick = (option: StepOption) => {
		if (option.correct) {
			stepper.completeStep();
		} else if (option.feedback) {
			stepper.recordWrongAttempt(option.feedback);
		}
	};

	// ── Phase transition handlers ──
	const handleStartBuild = () => {
		setPhase('build');
	};

	const handleActivateQueries = () => {
		setPhase('reward');
	};

	// ── Completion ──
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
		return { valid: true, message: 'Query object extracts all inline chains!' };
	};

	const isViewingCompletedStep = stepper.isCurrentStepCompleted;
	const hasNextStep = stepper.currentStep < STEP_DEFS.length - 1;
	const currentOptionConfig = OPTION_STEP_CONFIG[stepper.currentStep];

	// ── Render ──
	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Scenario (always visible) */}
					<div className="p-4 border-b border-border space-y-3">
						<p className="text-sm text-muted-foreground leading-relaxed">
							The admin dashboard controller has a 60-line index action
							with inline{' '}
							<code className="text-foreground text-xs bg-muted px-1 py-0.5 rounded">
								.where().joins().group().order()
							</code>{' '}
							chains. The same filtering logic is copy-pasted in the API
							controller and CSV export job.
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Extract the query logic into a composable ProductQuery object
							so every consumer shares one source of truth.
						</p>
					</div>

					{/* Build / activate phases: step progress */}
					{(phase === 'build' || phase === 'activate') && (
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
					)}
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="Query Objects"
					levelNumber={19}
					onComplete={handleComplete}
					onReset={() => {
						window.location.reload();
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 flex flex-col bg-background overflow-hidden">
					{/* ── Phase 1: Intro (WHY) ── */}
					{phase === 'intro' && (
						<div className="flex-1 flex flex-col overflow-auto">
							<div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
								{/* Header */}
								<div className="text-center">
									<h3 className="text-lg font-semibold text-foreground">
										The Problem: Duplicated Query Chains
									</h3>
									<p className="text-xs text-muted-foreground mt-1">
										Same inline filters in 3 consumers, 60+ lines each
									</p>
								</div>

								{/* Three consumer zones with annotated code */}
								<div className="w-full max-w-4xl grid grid-cols-3 gap-3">
									<AnnotatedCodeBlock
										borderColor="destructive"
										fileName="Admin Controller"
										lineCount="60 lines"
										sections={ADMIN_SECTIONS}
									/>
									<AnnotatedCodeBlock
										borderColor="destructive"
										fileName="API Controller"
										lineCount="45 lines"
										sections={API_SECTIONS}
									/>
									<AnnotatedCodeBlock
										borderColor="destructive"
										fileName="CSV Export Job"
										lineCount="35 lines"
										sections={CSV_SECTIONS}
									/>
								</div>

								{/* Callout */}
								<div className="w-full max-w-4xl rounded-lg border border-destructive/30 bg-destructive/5 dark:bg-destructive/10 p-3">
									<p className="text-sm text-destructive font-medium">
										Same query chain in 3 places. Change the filter
										logic? Update it everywhere. Add a new filter?
										Copy-paste across all consumers. The CSV job
										already has a bug ({">"} vs {">="}) that diverged from the
										controllers.
									</p>
								</div>

								{/* Build the Fix button (always visible) */}
								<Button
									className="gap-2"
									onClick={handleStartBuild}
									size="lg"
								>
									Build the Fix
									<ArrowRight className="w-4 h-4" />
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 2: Build (HOW) ── */}
					{phase === 'build' && currentOptionConfig && (
						<div className="flex-1 overflow-auto p-6">
							<div className="max-w-2xl mx-auto space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									{currentOptionConfig.title}
								</h3>
								<p className="text-sm text-muted-foreground">
									{currentOptionConfig.description}
								</p>

								{isViewingCompletedStep ? (
									<div className="space-y-2">
										{currentOptionConfig.options.map((opt) => (
											<OptionCard
												color="violet"
												disabled={!opt.correct}
												key={opt.id}
												mono
												name={opt.label}
												selected={opt.correct}
												size="lg"
											/>
										))}
									</div>
								) : (
									<>
										<div className="space-y-2">
											{currentOptionConfig.options.map((opt) => (
												<OptionCard
													color="violet"
													key={opt.id}
													mono
													name={opt.label}
													onClick={() => handleOptionClick(opt)}
													size="lg"
												/>
											))}
										</div>

										<ErrorFeedback
											message={stepper.lastFeedback}
											onDismiss={stepper.clearFeedback}
										/>
									</>
								)}

								{isViewingCompletedStep && hasNextStep && (
									<div className="flex justify-end">
										<Button
											className="gap-2"
											onClick={stepper.nextStep}
											size="sm"
										>
											Next Step
											<ArrowRight className="w-4 h-4" />
										</Button>
									</div>
								)}
							</div>
						</div>
					)}

					{/* ── Phase 3: Activate (ADVANTAGE sub-phase a) ── */}
					{phase === 'activate' && (
						<div className="flex-1 flex items-center justify-center p-6">
							<div className="max-w-md text-center space-y-6">
								<div className="flex justify-center gap-1">
									{[1, 2, 3].map((s) => (
										<Star
											className={`w-8 h-8 ${
												s <= stepper.starRating
													? 'text-yellow-400 fill-yellow-400'
													: 'text-muted-foreground/30'
											}`}
											key={s}
										/>
									))}
								</div>
								<p className="text-sm text-muted-foreground">
									Your ProductQuery object is ready. Every consumer now
									delegates to one composable query object instead of
									maintaining its own inline chain.
								</p>
								<Button
									className="gap-2"
									onClick={handleActivateQueries}
									size="lg"
								>
									<Play className="w-4 h-4" />
									Visualize Queries
								</Button>
							</div>
						</div>
					)}

					{/* ── Phase 4: Reward (ADVANTAGE sub-phase b) ── */}
					{phase === 'reward' && (
						<div className="flex-1 flex flex-col overflow-auto">
							<div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
								{/* Header */}
								<div className="text-center">
									<h3 className="text-lg font-semibold text-foreground">
										The Fix: ProductQuery Object
									</h3>
									<p className="text-xs text-muted-foreground mt-1">
										One composable query object, three clean consumers
									</p>
								</div>

								{/* Clean consumers (thin) */}
								<div className="w-full max-w-4xl grid grid-cols-3 gap-3">
									{/* Admin Controller (clean) */}
									<div className="space-y-1.5">
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
											Admin Controller
										</div>
										<div className="border-l-2 border-l-success bg-success/5 dark:bg-success/10 rounded-r-md px-3 py-2">
											<Badge
												className="text-[10px] mb-1 border-success/50 text-success bg-success/10"
												variant="outline"
											>
												Delegates to ProductQuery
											</Badge>
											<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">ProductQuery.new{'\n'}  .published(params[:published]){'\n'}  .by_author(params[:author_id]){'\n'}  .sorted.results</pre>
										</div>
										<div className="mt-1 text-xs text-success font-medium px-3">
											Clean (5 lines)
										</div>
									</div>

									{/* API Controller (clean) */}
									<div className="space-y-1.5">
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
											API Controller
										</div>
										<div className="border-l-2 border-l-success bg-success/5 dark:bg-success/10 rounded-r-md px-3 py-2">
											<Badge
												className="text-[10px] mb-1 border-success/50 text-success bg-success/10"
												variant="outline"
											>
												Delegates to ProductQuery
											</Badge>
											<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">ProductQuery.new{'\n'}  .by_tag(params[:tag]){'\n'}  .sorted.results</pre>
										</div>
										<div className="mt-1 text-xs text-success font-medium px-3">
											Clean (3 lines)
										</div>
									</div>

									{/* CSV Job (clean) */}
									<div className="space-y-1.5">
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
											CSV Export Job
										</div>
										<div className="border-l-2 border-l-success bg-success/5 dark:bg-success/10 rounded-r-md px-3 py-2">
											<Badge
												className="text-[10px] mb-1 border-success/50 text-success bg-success/10"
												variant="outline"
											>
												Delegates to ProductQuery
											</Badge>
											<pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">ProductQuery.new{'\n'}  .published(true){'\n'}  .since(date).results</pre>
										</div>
										<div className="mt-1 text-xs text-success font-medium px-3">
											Clean (3 lines)
										</div>
									</div>
								</div>

								{/* ProductQuery zone */}
								<div className="w-full max-w-4xl border-2 border-success/30 bg-success/5 dark:bg-success/10 rounded-lg p-4">
									<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 text-center">
										app/queries/product_query.rb
									</div>
									<div className="grid grid-cols-3 gap-2">
										<div className="border-l-2 border-l-success bg-success/5 dark:bg-success/10 rounded-r-md px-2 py-1.5">
											<Badge
												className="text-[10px] mb-1 border-success/50 text-success bg-success/10"
												variant="outline"
											>
												Filters
											</Badge>
											<pre className="text-[10px] font-mono text-foreground/70 whitespace-pre-wrap">.published(flag){'\n'}.by_author(id){'\n'}.by_tag(name)</pre>
										</div>
										<div className="border-l-2 border-l-success bg-success/5 dark:bg-success/10 rounded-r-md px-2 py-1.5">
											<Badge
												className="text-[10px] mb-1 border-success/50 text-success bg-success/10"
												variant="outline"
											>
												Aggregates
											</Badge>
											<pre className="text-[10px] font-mono text-foreground/70 whitespace-pre-wrap">.with_min_comments(n){'\n'}.since(date)</pre>
										</div>
										<div className="border-l-2 border-l-success bg-success/5 dark:bg-success/10 rounded-r-md px-2 py-1.5">
											<Badge
												className="text-[10px] mb-1 border-success/50 text-success bg-success/10"
												variant="outline"
											>
												Ordering
											</Badge>
											<pre className="text-[10px] font-mono text-foreground/70 whitespace-pre-wrap">.sorted(col, dir){'\n'}.results</pre>
										</div>
									</div>
								</div>

								{/* Problems Solved checklist */}
								<div className="w-full max-w-4xl rounded-lg border border-success/30 bg-success/5 dark:bg-success/10 p-3">
									<div className="text-xs font-semibold text-success uppercase tracking-wider mb-2">
										Problems Solved
									</div>
									<div className="space-y-2">
										<div className="flex items-start gap-2">
											<Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
											<p className="text-sm text-foreground">
												<span className="font-medium">Change filter logic once, applies everywhere.</span>{' '}
												<span className="text-muted-foreground">
													Fix the date comparison in ProductQuery, all three consumers get the fix automatically.
												</span>
											</p>
										</div>
										<div className="flex items-start gap-2">
											<Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
											<p className="text-sm text-foreground">
												<span className="font-medium">Add a new filter: one method in ProductQuery.</span>{' '}
												<span className="text-muted-foreground">
													All consumers can chain it immediately. No copy-paste across controllers and jobs.
												</span>
											</p>
										</div>
										<div className="flex items-start gap-2">
											<Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
											<p className="text-sm text-foreground">
												<span className="font-medium">Unit-testable in isolation.</span>{' '}
												<span className="text-muted-foreground">
													Test{' '}
													<code className="text-xs bg-muted px-1 py-0.5 rounded">ProductQuery</code>{' '}
													directly without controllers or HTTP requests.
												</span>
											</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={getCodeFiles(phase, stepper.furthestStep)} />
			</RightPanel>
		</LevelLayout>
	);
}

export default Level19QueryObjects;
