/**
 * Level 14: Scopes & Enums
 *
 * Learn to constrain values with Rails 8 enums and DRY up queries with scopes.
 * Player matches raw queries to scope names and adds an enum.
 * Teaches: Rails 8 enum syntax, named scopes, chaining, query interface
 */

import { Check, Filter, Hash, List } from 'lucide-react';
import { useState } from 'react';
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

interface QueryBlock {
	id: string;
	raw: string;
	scopeName: string | null;
	correctScope: string;
	description: string;
}

const QUERY_BLOCKS: QueryBlock[] = [
	{
		id: 'visible',
		raw: 'where(status: [:published])',
		scopeName: null,
		correctScope: 'visible',
		description: 'Only published posts (no drafts/archived)',
	},
	{
		id: 'recent',
		raw: 'order(created_at: :desc)',
		scopeName: null,
		correctScope: 'recent',
		description: 'Newest posts first',
	},
	{
		id: 'by_author',
		raw: 'where(user: user)',
		scopeName: null,
		correctScope: 'by_author',
		description: 'Filter posts by a specific author',
	},
	{
		id: 'not_deleted',
		raw: 'where.not(status: :deleted)',
		scopeName: null,
		correctScope: 'not_deleted',
		description: 'Exclude soft-deleted posts',
	},
];

const AVAILABLE_SCOPES = ['visible', 'recent', 'by_author', 'not_deleted'];

export function Level14ScopesEnums({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [queries, setQueries] = useState<QueryBlock[]>(QUERY_BLOCKS);
	const [enumAdded, setEnumAdded] = useState(false);
	const [selectedQuery, setSelectedQuery] = useState<string | null>(null);

	const scopedQueries = queries.filter((q) => q.scopeName === q.correctScope);

	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		if (!enumAdded) {
			errors.push('Add an enum for the status field');
		}

		const unscopedQueries = queries.filter((q) => !q.scopeName);
		if (unscopedQueries.length > 0) {
			errors.push(`${unscopedQueries.length} query(ies) still need scopes`);
		}

		const wrongScopes = queries.filter(
			(q) => q.scopeName && q.scopeName !== q.correctScope,
		);
		if (wrongScopes.length > 0) {
			errors.push(`${wrongScopes.length} scope(s) have incorrect names`);
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Scopes and enum need more work!',
				details: errors,
			};
		}

		return { valid: true, message: 'Clean enums and reusable scopes!' };
	};

	const assignScope = (queryId: string, scopeName: string) => {
		setQueries((prev) =>
			prev.map((q) => (q.id === queryId ? { ...q, scopeName } : q)),
		);
		setSelectedQuery(null);
	};

	const handleComplete = async () => {
		const success = await completeLevel('act2-level15-scopes-enums', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const generateModelCode = () => {
		const enumBlock = enumAdded
			? `  # Rails 8 enum (hash syntax, validates by default)
  enum :status, {
    draft: 0,
    published: 1,
    archived: 2,
    deleted: 3
  }, default: :draft, validate: true

`
			: '';

		const scopeLines = queries
			.filter((q) => q.scopeName)
			.map((q) => {
				if (q.id === 'by_author') {
					return `  scope :${q.scopeName}, ->(user) { ${q.raw} }`;
				}
				return `  scope :${q.scopeName}, -> { ${q.raw} }`;
			});

		return `class Post < ApplicationRecord
  belongs_to :user

${enumBlock}${scopeLines.length > 0 ? `  # Named scopes\n${scopeLines.join('\n')}\n` : '  # No scopes defined yet\n'}end`;
	};

	const generateControllerCode = () => {
		if (scopedQueries.length < 2) {
			return `# Current state -- no filtering:
def index
  posts = Post.all  # Returns EVERYTHING
  render json: PostSerializer.new(posts)
end`;
		}

		return `# Clean, filtered queries:
def index
  posts = policy_scope(Post)
            .not_deleted
            .then { |s| params[:status] ? s.where(status: params[:status]) : s.visible }
            .recent

  render json: PostSerializer.new(posts)
end

# Chaining example:
# Post.visible.recent.by_author(current_user)`;
	};

	const totalSteps = queries.length + 1; // scopes + enum
	const completedSteps = scopedQueries.length + (enumAdded ? 1 : 0);

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Enum Toggle */}
					<div className="p-4">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Step 1: Add Enum
						</div>
						<Button
							className="w-full"
							disabled={enumAdded}
							onClick={() => setEnumAdded(true)}
							variant={enumAdded ? 'secondary' : 'default'}
						>
							{enumAdded ? (
								<>
									<Check className="w-4 h-4 mr-2" />
									Enum Added
								</>
							) : (
								<>
									<Hash className="w-4 h-4 mr-2" />
									Add Status Enum
								</>
							)}
						</Button>
						{!enumAdded && (
							<p className="text-xs text-muted-foreground mt-2">
								Constrains status to draft, published, archived, deleted.
								Prevents typos like "pubished."
							</p>
						)}
						{enumAdded && (
							<p className="text-xs text-success mt-2">
								Auto-generates: Post.published, Post.draft, post.published?,
								post.published!
							</p>
						)}
					</div>

					{/* Available Scope Names */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Step 2: Assign Scope Names
						</div>
						<div className="flex flex-wrap gap-2">
							{AVAILABLE_SCOPES.map((scope) => {
								const isUsed = queries.some((q) => q.scopeName === scope);
								const isCorrect = queries.some(
									(q) => q.scopeName === scope && q.correctScope === scope,
								);
								return (
									<Button
										className={`px-3 py-1.5 font-mono text-sm transition-all ${
											isCorrect
												? 'bg-success/20 border-success text-success'
												: isUsed
													? 'bg-destructive/20 border-destructive text-destructive'
													: selectedQuery
														? 'bg-primary/20 border-primary text-primary hover:bg-primary/30 cursor-pointer'
														: 'bg-secondary border-border text-muted-foreground'
										}`}
										disabled={!selectedQuery}
										key={scope}
										onClick={() =>
											selectedQuery && assignScope(selectedQuery, scope)
										}
										size="sm"
										variant="outline"
									>
										:{scope}
									</Button>
								);
							})}
						</div>
						{selectedQuery && (
							<div className="mt-2 text-xs text-primary">
								Click a scope name to assign it
							</div>
						)}
					</div>

					{/* Progress */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Progress
						</div>
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Steps completed</span>
							<span
								className={
									completedSteps === totalSteps
										? 'text-success'
										: 'text-foreground'
								}
							>
								{completedSteps} / {totalSteps}
							</span>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all duration-300"
								style={{
									width: `${(completedSteps / totalSteps) * 100}%`,
								}}
							/>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="Scopes & Enums"
					levelNumber={15}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setQueries(QUERY_BLOCKS);
						setEnumAdded(false);
						setSelectedQuery(null);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-8 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-4">
						{/* Enum status display */}
						{enumAdded && (
							<div className="p-4 bg-primary/10 border border-primary rounded-xl mb-6">
								<div className="flex items-center gap-2 mb-2">
									<List className="w-4 h-4 text-primary" />
									<span className="text-primary font-semibold text-sm">
										Status Enum Active
									</span>
								</div>
								<div className="flex gap-2">
									{['draft', 'published', 'archived', 'deleted'].map(
										(status) => (
											<span
												className="text-xs font-mono px-2 py-1 bg-primary/20 text-primary rounded"
												key={status}
											>
												:{status}
											</span>
										),
									)}
								</div>
							</div>
						)}

						{/* Header */}
						<div className="text-center mb-4">
							<div className="text-muted-foreground text-sm mb-1">
								Transform raw queries into reusable scopes
							</div>
							<div className="text-xs text-muted-foreground">
								Click a query, then click a scope name to assign
							</div>
						</div>

						{/* Query Blocks */}
						{queries.map((query) => {
							const isScoped = query.scopeName === query.correctScope;
							const hasWrongScope =
								query.scopeName && query.scopeName !== query.correctScope;

							return (
								<button
									className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
										selectedQuery === query.id
											? 'border-primary bg-primary/10'
											: isScoped
												? 'border-success bg-success/10'
												: hasWrongScope
													? 'border-destructive bg-destructive/10'
													: 'border-border bg-card hover:border-muted-foreground'
									}`}
									key={query.id}
									onClick={() => !isScoped && setSelectedQuery(query.id)}
									type="button"
								>
									<div className="flex items-center justify-between mb-2">
										<span className="text-muted-foreground text-sm">
											{query.description}
										</span>
										{isScoped && (
											<span className="flex items-center gap-1 text-success text-xs bg-success/20 px-2 py-1 rounded">
												<Check className="w-3 h-3" />
												Scoped
											</span>
										)}
									</div>

									<div className="flex items-center gap-4">
										<div className="flex-1 p-3 bg-secondary rounded-lg">
											<div className="text-xs text-muted-foreground mb-1">
												Raw query:
											</div>
											<code className="text-warning text-sm">
												Post.{query.raw}
											</code>
										</div>

										<Filter className="w-5 h-5 text-muted-foreground shrink-0" />

										<div
											className={`flex-1 p-3 rounded-lg ${
												query.scopeName
													? isScoped
														? 'bg-success/20'
														: 'bg-destructive/20'
													: 'bg-secondary border-2 border-dashed border-border'
											}`}
										>
											<div className="text-xs text-muted-foreground mb-1">
												With scope:
											</div>
											{query.scopeName ? (
												<code
													className={
														isScoped
															? 'text-success text-sm'
															: 'text-destructive text-sm'
													}
												>
													Post.{query.scopeName}
													{query.id === 'by_author' ? '(current_user)' : ''}
												</code>
											) : (
												<span className="text-muted-foreground text-sm">
													Select scope name
												</span>
											)}
										</div>
									</div>
								</button>
							);
						})}

						{/* Chaining Example */}
						{scopedQueries.length >= 2 && (
							<div className="mt-6 p-4 bg-primary/10 border border-primary rounded-xl">
								<div className="text-primary font-semibold mb-2 text-sm">
									Scope Chaining
								</div>
								<code className="text-primary text-sm">
									Post.
									{scopedQueries
										.map((q) =>
											q.id === 'by_author'
												? `${q.scopeName}(user)`
												: q.scopeName,
										)
										.join('.')}
								</code>
								<div className="text-muted-foreground text-xs mt-2">
									Scopes can be chained for powerful, readable queries
								</div>
							</div>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/models/post.rb',
							language: 'ruby',
							code: generateModelCode(),
							highlight: enumAdded ? [4, 5, 6, 7, 8, 9] : [],
						},
						{
							filename: 'app/controllers/api/v1/posts_controller.rb',
							language: 'ruby',
							code: generateControllerCode(),
							highlight: scopedQueries.length >= 2 ? [4, 5, 6] : [],
						},
					]}
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Rails 8 Enum
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
							{`# Hash syntax (Rails 8 default):
enum :status, {
  draft: 0, published: 1,
  archived: 2, deleted: 3
}, validate: true

# Auto-generates:
Post.published  # scope
post.published? # predicate
post.published! # update`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level14ScopesEnums;
