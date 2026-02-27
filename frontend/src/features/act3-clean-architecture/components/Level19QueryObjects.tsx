/**
 * Level 18: Query Objects
 *
 * Extract complex inline query chains from a fat controller into a composable
 * PostQuery PORO with chainable filter methods.
 * Teaches: Query objects, composable scopes, returning ActiveRecord::Relation, reuse across controllers/jobs
 */

import {
	ArrowRight,
	Check,
	Database,
	Filter,
	Layers,
	SortAsc,
	Tag,
} from 'lucide-react';
import { useState } from 'react';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	OptionCard,
	resolveColor,
	RightPanel,
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';
import type { LevelComponentProps } from '@/features/levels-registry';

// --- Types ---

type Complexity = 'simple' | 'join' | 'aggregate';

interface QueryMethod {
	id: string;
	name: string;
	description: string;
	complexity: Complexity;
	added: boolean;
	code: string;
	param: string;
}

// --- Constants ---

const COMPLEXITY_COLORS: Record<Complexity, string> = {
	simple: '#3b82f6',
	join: '#f59e0b',
	aggregate: '#a855f7',
};

const COMPLEXITY_LABELS: Record<Complexity, string> = {
	simple: 'Simple filter',
	join: 'JOIN required',
	aggregate: 'Sort / aggregate',
};

const COMPLEXITY_ICONS: Record<Complexity, typeof Filter> = {
	simple: Filter,
	join: Layers,
	aggregate: SortAsc,
};

// Lines of the fat controller, each block maps to a method extraction
interface ControllerLine {
	code: string;
	indent: number;
	methodId: string | null; // which method extracts this line (null = always visible)
}

const CONTROLLER_LINES: ControllerLine[] = [
	{ code: 'class Admin::PostsController < ApplicationController', indent: 0, methodId: null },
	{ code: 'def index', indent: 1, methodId: null },
	{ code: '@posts = Post.all', indent: 2, methodId: null },
	{ code: '', indent: 0, methodId: null },
	{ code: 'if params[:status].present?', indent: 2, methodId: 'by_status' },
	{ code: '@posts = @posts.where(status: params[:status])', indent: 3, methodId: 'by_status' },
	{ code: 'end', indent: 2, methodId: 'by_status' },
	{ code: '', indent: 0, methodId: 'by_status' },
	{ code: 'if params[:author_id].present?', indent: 2, methodId: 'by_author' },
	{ code: '@posts = @posts.where(author_id: params[:author_id])', indent: 3, methodId: 'by_author' },
	{ code: 'end', indent: 2, methodId: 'by_author' },
	{ code: '', indent: 0, methodId: 'by_author' },
	{ code: 'if params[:since].present?', indent: 2, methodId: 'since' },
	{ code: '@posts = @posts.where("published_at >= ?", params[:since])', indent: 3, methodId: 'since' },
	{ code: 'end', indent: 2, methodId: 'since' },
	{ code: '', indent: 0, methodId: 'since' },
	{ code: 'if params[:min_comments].present?', indent: 2, methodId: 'with_min_comments' },
	{ code: '@posts = @posts.left_joins(:comments)', indent: 3, methodId: 'with_min_comments' },
	{ code: '.group(:id)', indent: 4, methodId: 'with_min_comments' },
	{ code: '.having("COUNT(comments.id) >= ?", params[:min_comments])', indent: 4, methodId: 'with_min_comments' },
	{ code: 'end', indent: 2, methodId: 'with_min_comments' },
	{ code: '', indent: 0, methodId: 'with_min_comments' },
	{ code: 'if params[:tag].present?', indent: 2, methodId: 'by_tag' },
	{ code: '@posts = @posts.joins(:tags).where(tags: { name: params[:tag] })', indent: 3, methodId: 'by_tag' },
	{ code: 'end', indent: 2, methodId: 'by_tag' },
	{ code: '', indent: 0, methodId: 'by_tag' },
	{ code: '@posts = @posts.order(params[:sort] || :published_at => :desc)', indent: 2, methodId: 'sorted' },
	{ code: '', indent: 0, methodId: 'sorted' },
	{ code: 'render json: @posts', indent: 2, methodId: null },
	{ code: 'end', indent: 1, methodId: null },
	{ code: 'end', indent: 0, methodId: null },
];

const INITIAL_METHODS: QueryMethod[] = [
	{
		id: 'by_status',
		name: 'by_status',
		description: 'Filter by status (draft/published)',
		complexity: 'simple',
		added: false,
		param: 'params[:status]',
		code: `  def by_status(status)
    return self if status.blank?

    @scope = @scope.where(status: status)
    self
  end`,
	},
	{
		id: 'by_author',
		name: 'by_author',
		description: 'Filter by author_id',
		complexity: 'simple',
		added: false,
		param: 'params[:author_id]',
		code: `  def by_author(author_id)
    return self if author_id.blank?

    @scope = @scope.where(author_id: author_id)
    self
  end`,
	},
	{
		id: 'since',
		name: 'since',
		description: 'Filter by published_at date',
		complexity: 'simple',
		added: false,
		param: 'params[:since]',
		code: `  def since(date)
    return self if date.blank?

    @scope = @scope.where("published_at >= ?", date)
    self
  end`,
	},
	{
		id: 'with_min_comments',
		name: 'with_min_comments',
		description: 'Filter by minimum comment count',
		complexity: 'join',
		added: false,
		param: 'params[:min_comments]',
		code: `  def with_min_comments(count)
    return self if count.blank?

    @scope = @scope
      .left_joins(:comments)
      .group(:id)
      .having("COUNT(comments.id) >= ?", count)
    self
  end`,
	},
	{
		id: 'by_tag',
		name: 'by_tag',
		description: 'Filter by tag name (JOIN)',
		complexity: 'join',
		added: false,
		param: 'params[:tag]',
		code: `  def by_tag(tag_name)
    return self if tag_name.blank?

    @scope = @scope.joins(:tags).where(tags: { name: tag_name })
    self
  end`,
	},
	{
		id: 'sorted',
		name: 'sorted',
		description: 'Apply sort order',
		complexity: 'aggregate',
		added: false,
		param: 'params[:sort], params[:dir]',
		code: `  def sorted(column = :published_at, direction = :desc)
    @scope = @scope.order(column => direction)
    self
  end`,
	},
];

// --- Code generation ---

function generateQueryCode(methods: QueryMethod[]): string {
	const addedMethods = methods.filter((m) => m.added);

	let code = `# app/queries/application_query.rb
class ApplicationQuery
  attr_reader :scope

  def initialize(scope = default_scope)
    @scope = scope
  end

  def results
    scope
  end

  private

  def default_scope
    raise NotImplementedError
  end
end

# app/queries/post_query.rb
class PostQuery < ApplicationQuery`;

	if (addedMethods.length > 0) {
		code += '\n';
	}

	for (const m of addedMethods) {
		code += `\n${m.code}\n`;
	}

	code += `
  private

  def default_scope
    Post.all
  end
end`;

	return code;
}

// --- Component ---

export function Level19QueryObjects({
	onComplete,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [methods, setMethods] = useState<QueryMethod[]>(INITIAL_METHODS);

	const addedCount = methods.filter((m) => m.added).length;

	const handleAddMethod = (id: string) => {
		setMethods((prev) =>
			prev.map((m) => (m.id === id ? { ...m, added: true } : m)),
		);
	};

	const handleRemoveMethod = (id: string) => {
		setMethods((prev) =>
			prev.map((m) => (m.id === id ? { ...m, added: false } : m)),
		);
	};

	const validateSolution = (): ValidationResult => {
		if (addedCount < 6) {
			return {
				valid: false,
				message: 'Query object incomplete!',
				details: [`Extract ${6 - addedCount} more query method(s)`],
			};
		}

		return {
			valid: true,
			message: 'Composable query methods replace inline chains!',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act3-level19-query-objects', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const handleReset = () => {
		setMethods(INITIAL_METHODS);
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Extract complex inline query chains from a fat controller into a composable PostQuery object."
					instructions={[
						'Click each query method to add it to PostQuery',
						'Watch the controller shrink as methods move to the query object',
						'All 6 methods must be extracted to complete the level',
						'The query object returns self for chaining',
					]}
					scenario="Level 16 extracted business logic into Service Objects. Now do the same for queries. The admin dashboard has 60-line inline .where().joins().group().order() chains duplicated across three controllers."
				>
					{/* Progress */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Methods Extracted
						</div>
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Progress</span>
							<span
								className={
									addedCount === 6 ? 'text-success' : 'text-foreground'
								}
							>
								{addedCount} / 6
							</span>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all"
								style={{ width: `${(addedCount / 6) * 100}%` }}
							/>
						</div>
					</div>

					{/* Method Palette */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Available Query Methods
						</div>
						<div className="space-y-2">
							{methods.map((m) => {
								const Icon = COMPLEXITY_ICONS[m.complexity];

								return (
									<OptionCard
										badge={!m.added ? COMPLEXITY_LABELS[m.complexity] : undefined}
										color={resolveColor(COMPLEXITY_COLORS[m.complexity])}
										description={m.description}
										disabled={m.added}
										icon={Icon}
										key={m.id}
										name={`.${m.name}`}
										onClick={() => handleAddMethod(m.id)}
										selected={m.added}
								/>
								);
							})}
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="Query Objects"
					levelNumber={19}
					onComplete={handleComplete}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-4 overflow-auto">
					<div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
						{/* Left: Fat controller */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-3 py-2.5 border-b border-border flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Database className="w-3.5 h-3.5 text-destructive" />
									<span className="text-sm text-foreground font-semibold">
										Before
									</span>
								</div>
								<span className="text-xs text-muted-foreground">
									{CONTROLLER_LINES.filter((l) => l.code).length -
										CONTROLLER_LINES.filter(
											(l) =>
												l.methodId &&
												methods.find((m) => m.id === l.methodId)?.added,
										).length}{' '}
									lines
								</span>
							</div>

							<div className="p-3 font-mono text-xs leading-relaxed">
								{CONTROLLER_LINES.map((line, i) => {
									const extracted =
										line.methodId != null &&
										methods.find((m) => m.id === line.methodId)?.added;
									const method = line.methodId
										? methods.find((m) => m.id === line.methodId)
										: null;
									const color = method
										? COMPLEXITY_COLORS[method.complexity]
										: undefined;

									if (extracted) {
										return (
											<div
												className="transition-all duration-300 line-through opacity-25 h-[18px]"
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
											className={`transition-all duration-300 h-[18px] ${
												line.methodId
													? 'text-warning'
													: 'text-foreground'
											}`}
											key={i}
											style={{ paddingLeft: `${line.indent * 12}px` }}
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

						{/* Right: Clean controller */}
						<div className={`bg-card rounded-xl border overflow-hidden ${addedCount > 0 ? 'border-success/30' : 'border-border'}`}>
							<div className={`px-3 py-2.5 border-b flex items-center justify-between ${addedCount > 0 ? 'bg-success/5 border-success/20' : 'bg-secondary border-border'}`}>
								<div className="flex items-center gap-2">
									<Check className={`w-3.5 h-3.5 ${addedCount > 0 ? 'text-success' : 'text-muted-foreground'}`} />
									<span className="text-sm text-foreground font-semibold">
										After
									</span>
								</div>
								<span className={`text-xs font-medium ${addedCount > 0 ? 'text-success' : 'text-muted-foreground'}`}>
									{addedCount > 0 ? `${6 + addedCount} lines` : '...'}
								</span>
							</div>

							<div className="p-3 font-mono text-xs leading-relaxed">
								{addedCount === 0 ? (
									<div className="text-muted-foreground text-center py-8 text-xs">
										Click methods in the left panel to start extracting
									</div>
								) : (
									<>
										<div className="text-foreground h-[18px]">class Admin::PostsController</div>
										<div className="text-foreground h-[18px] pl-3">def index</div>
										<div className="text-foreground h-[18px] pl-6">
											posts = PostQuery.new
										</div>
										{methods
											.filter((m) => m.added)
											.map((m) => (
												<div
													className="h-[18px] pl-9 animate-in fade-in slide-in-from-left-2 duration-200"
													key={m.id}
													style={{
														color: COMPLEXITY_COLORS[m.complexity],
													}}
												>
													.{m.name}({m.param})
												</div>
											))}
										<div className="text-foreground h-[18px] pl-9">
											.results
										</div>
										<div className="h-[18px]" />
										<div className="text-foreground h-[18px] pl-6">
											render json: posts
										</div>
										<div className="text-foreground h-[18px] pl-3">end</div>
										<div className="text-foreground h-[18px]">end</div>
										{addedCount === 6 && (
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
					files={[
						{
							filename: 'app/queries/post_query.rb',
							language: 'ruby',
							code: generateQueryCode(methods),
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
								<Database className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									Base scope: <code>Post.all</code>, override per use case
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Filter className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									Guard: <code>return self if param.blank?</code>
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Layers className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									Return <code>ActiveRecord::Relation</code>, not Array
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Tag className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>
									Return <code>self</code> for chainability
								</span>
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Before vs After
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
							{`# Before: 60 lines in every controller
class Admin::PostsController
  def index
    @posts = Post.all
    @posts = @posts.where(status: s) if s
    @posts = @posts.where(author_id: a) if a
    @posts = @posts.left_joins(:comments)
      .group(:id).having("COUNT...")
    # ... 40 more lines
  end
end

# After: one line, reusable everywhere
class Admin::PostsController
  def index
    posts = PostQuery.new
      .by_status(params[:status])
      .by_author(params[:author_id])
      .results
    render json: posts
  end
end`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level19QueryObjects;
