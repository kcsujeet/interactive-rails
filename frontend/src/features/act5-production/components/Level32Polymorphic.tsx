/**
 * Level 29: Polymorphic Associations
 *
 * Replace three separate comment tables with one polymorphic Comment model.
 * Shows the ER diagram transition from fragmented tables to a unified polymorphic approach.
 */

import {
	ArrowRight,
	Check,
	Database,
	Link,
	Merge,
	Table2,
	X,
} from 'lucide-react';
import { useCallback, useState } from 'react';
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

type ViewMode = 'before' | 'after';

interface ModelConnection {
	post: boolean;
	photo: boolean;
	video: boolean;
}

const PARENT_MODELS = [
	{
		key: 'post' as const,
		label: 'Post',
		color: 'text-blue-400',
		bgColor: 'bg-blue-400/10',
		borderColor: 'border-blue-400/40',
	},
	{
		key: 'photo' as const,
		label: 'Photo',
		color: 'text-purple-400',
		bgColor: 'bg-purple-400/10',
		borderColor: 'border-purple-400/40',
	},
	{
		key: 'video' as const,
		label: 'Video',
		color: 'text-amber-400',
		bgColor: 'bg-amber-400/10',
		borderColor: 'border-amber-400/40',
	},
] as const;

export function Level32Polymorphic({
	onComplete,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [viewMode, setViewMode] = useState<ViewMode>('before');
	const [hasUnified, setHasUnified] = useState(false);
	const [connections, setConnections] = useState<ModelConnection>({
		post: false,
		photo: false,
		video: false,
	});

	const allConnected =
		connections.post && connections.photo && connections.video;
	const connectedCount = Object.values(connections).filter(Boolean).length;

	const toggleConnection = (model: keyof ModelConnection) => {
		if (!hasUnified) return;
		setConnections((prev) => ({ ...prev, [model]: !prev[model] }));
	};

	const handleUnify = () => {
		setHasUnified(true);
		setViewMode('after');
	};

	const validateSolution = useCallback((): ValidationResult => {
		if (!hasUnified) {
			return {
				valid: false,
				message: 'Create the polymorphic Comment model',
				details: [
					'Click "Unify into Polymorphic Comment" to replace the three separate tables',
				],
			};
		}
		if (!allConnected) {
			const missing: string[] = [];
			if (!connections.post) missing.push('Post');
			if (!connections.photo) missing.push('Photo');
			if (!connections.video) missing.push('Video');
			return {
				valid: false,
				message: `Connect Comment to all models (${connectedCount}/3)`,
				details: missing.map((m) => `Click on ${m} to connect it to Comment`),
			};
		}
		return {
			valid: true,
			message: 'Polymorphic association configured correctly!',
		};
	}, [hasUnified, allConnected, connections, connectedCount]);

	const handleComplete = async () => {
		const success = await completeLevel('act5-level32-polymorphic', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const handleReset = () => {
		setViewMode('before');
		setHasUnified(false);
		setConnections({ post: false, photo: false, video: false });
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Replace three separate comment tables with one polymorphic Comment model."
					instructions={[
						'Observe the "Before" state: 3 separate comment tables',
						'Click "Unify" to create one polymorphic Comment model',
						'Connect Comment to all 3 parent models (Post, Photo, Video)',
						'Submit to complete the level',
					]}
					scenario="In Level 8, you linked Comment to Post with has_many. But now photos and videos need comments too, creating three identical tables. Polymorphic associations unify them into one."
				>
					{/* Progress Tracker */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Progress
						</div>
						<div className="space-y-2">
							<div className="flex items-center gap-2 text-sm">
								{hasUnified ? (
									<Check className="w-4 h-4 text-success" />
								) : (
									<div className="w-4 h-4 rounded-full border border-muted-foreground" />
								)}
								<span
									className={
										hasUnified ? 'text-success' : 'text-muted-foreground'
									}
								>
									Create polymorphic Comment
								</span>
							</div>
							<div className="flex items-center gap-2 text-sm">
								{allConnected ? (
									<Check className="w-4 h-4 text-success" />
								) : (
									<div className="w-4 h-4 rounded-full border border-muted-foreground" />
								)}
								<span
									className={
										allConnected ? 'text-success' : 'text-muted-foreground'
									}
								>
									Connect all 3 models ({connectedCount}/3)
								</span>
							</div>
						</div>
					</div>

					{/* View Toggle */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							View
						</div>
						<div className="flex gap-2">
							<Button
								className={`flex-1 text-sm ${
									viewMode === 'before'
										? 'border-destructive text-destructive'
										: ''
								}`}
								onClick={() => setViewMode('before')}
								size="sm"
								variant={viewMode === 'before' ? 'outline' : 'ghost'}
							>
								Before
							</Button>
							<Button
								className={`flex-1 text-sm ${
									viewMode === 'after' && hasUnified
										? 'border-success text-success'
										: ''
								}`}
								disabled={!hasUnified}
								onClick={() => setViewMode('after')}
								size="sm"
								variant={viewMode === 'after' ? 'outline' : 'ghost'}
							>
								After
							</Button>
						</div>
					</div>

					{/* Unify Button */}
					<div className="p-4 border-t border-border">
						<Button
							className={`w-full py-3 ${
								hasUnified
									? 'bg-success/20 text-success border-success cursor-default'
									: ''
							}`}
							disabled={hasUnified}
							onClick={handleUnify}
							variant={hasUnified ? 'outline' : 'default'}
						>
							{hasUnified ? (
								<span className="flex items-center gap-2">
									<Check className="w-4 h-4" />
									Polymorphic Comment Created
								</span>
							) : (
								<span className="flex items-center gap-2">
									<Merge className="w-4 h-4" />
									Unify into Polymorphic Comment
								</span>
							)}
						</Button>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={5}
					levelName="Polymorphic Associations"
					levelNumber={32}
					onComplete={handleComplete}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto">
						{viewMode === 'before' ? (
							<BeforeView />
						) : (
							<AfterView
								connections={connections}
								onToggleConnection={toggleConnection}
							/>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'db/migrate/create_comments.rb',
							language: 'ruby',
							code: `class CreateComments < ActiveRecord::Migration[8.0]
  def change
    create_table :comments do |t|
      t.text :body, null: false
      t.references :commentable, polymorphic: true, null: false
      t.references :user, null: false, foreign_key: true
      t.timestamps
    end
    add_index :comments, [:commentable_type, :commentable_id]
  end
end`,
							highlight: [5, 9],
						},
						{
							filename: 'app/models/comment.rb',
							language: 'ruby',
							code: `class Comment < ApplicationRecord
  belongs_to :commentable, polymorphic: true
  belongs_to :user

  validates :body, presence: true
end`,
							highlight: [2],
						},
						{
							filename: 'app/models/post.rb',
							language: 'ruby',
							code: `class Post < ApplicationRecord
  has_many :comments, as: :commentable, dependent: :destroy
end

# app/models/photo.rb
class Photo < ApplicationRecord
  has_many :comments, as: :commentable, dependent: :destroy
end

# app/models/video.rb
class Video < ApplicationRecord
  has_many :comments, as: :commentable, dependent: :destroy
end`,
							highlight: [2, 7, 12],
						},
					]}
					learningGoal="Polymorphic associations let one model belong to multiple parent types using commentable_type + commentable_id columns."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							How It Works
						</div>
						<ul className="text-xs text-muted-foreground space-y-1.5">
							<li className="flex items-start gap-1.5">
								<Database className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
								<span>
									commentable_type stores the model name (e.g. "Post")
								</span>
							</li>
							<li className="flex items-start gap-1.5">
								<Link className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
								<span>commentable_id stores the record ID</span>
							</li>
							<li className="flex items-start gap-1.5">
								<Table2 className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
								<span>One table replaces three identical ones</span>
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Usage Example
						</div>
						<pre className="text-xs text-muted-foreground font-mono bg-background rounded p-2">
							{`post.comments.create(body: "Great!")
photo.comments.create(body: "Nice!")
# Both stored in comments table
# with different commentable_type`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

/** "Before" view: 3 separate comment tables (the problem) */
function BeforeView() {
	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="text-center">
				<div className="inline-flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2">
					<X className="w-4 h-4 text-destructive" />
					<span className="text-sm font-semibold text-destructive">
						Problem: 3 Separate Comment Tables
					</span>
				</div>
				<p className="text-xs text-muted-foreground mt-2">
					Each model has its own comment table with identical columns - a DRY
					violation
				</p>
			</div>

			{/* Three separate table pairs */}
			<div className="grid grid-cols-3 gap-4">
				{PARENT_MODELS.map((model) => (
					<div className="space-y-3" key={model.key}>
						{/* Parent model */}
						<div
							className={`rounded-xl border-2 ${model.borderColor} ${model.bgColor} p-4 text-center`}
						>
							<Database className={`w-6 h-6 mx-auto mb-2 ${model.color}`} />
							<div className={`font-bold text-sm ${model.color}`}>
								{model.label}
							</div>
							<div className="text-xs text-muted-foreground mt-1">
								id, title, ...
							</div>
						</div>

						{/* Arrow */}
						<div className="flex justify-center">
							<ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" />
						</div>

						{/* Separate comment table */}
						<div className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-4">
							<Table2 className="w-5 h-5 mx-auto mb-2 text-destructive" />
							<div className="font-semibold text-xs text-destructive text-center">
								{model.label}Comment
							</div>
							<div className="mt-2 space-y-1">
								{['id', 'body', `${model.key}_id`, 'user_id', 'timestamps'].map(
									(col) => (
										<div
											className="text-xs text-muted-foreground bg-background/50 rounded px-2 py-0.5 font-mono"
											key={col}
										>
											{col}
										</div>
									),
								)}
							</div>
						</div>
					</div>
				))}
			</div>

			{/* Problem callout */}
			<div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
				<div className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
					<X className="w-4 h-4" />
					Why This Is Bad
				</div>
				<ul className="text-xs text-muted-foreground space-y-1">
					<li className="flex items-start gap-2">
						<span className="text-destructive mt-0.5">-</span>3 tables with
						identical columns (body, user_id, timestamps)
					</li>
					<li className="flex items-start gap-2">
						<span className="text-destructive mt-0.5">-</span>3 separate models
						with duplicate logic
					</li>
					<li className="flex items-start gap-2">
						<span className="text-destructive mt-0.5">-</span>
						Cannot query "all comments by user" without UNION across 3 tables
					</li>
					<li className="flex items-start gap-2">
						<span className="text-destructive mt-0.5">-</span>
						Every new commentable type requires a new table and model
					</li>
				</ul>
			</div>
		</div>
	);
}

/** "After" view: single polymorphic Comment table */
function AfterView({
	connections,
	onToggleConnection,
}: {
	connections: ModelConnection;
	onToggleConnection: (model: keyof ModelConnection) => void;
}) {
	const allConnected =
		connections.post && connections.photo && connections.video;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="text-center">
				<div
					className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 ${
						allConnected
							? 'bg-success/10 border border-success/30'
							: 'bg-primary/10 border border-primary/30'
					}`}
				>
					{allConnected ? (
						<Check className="w-4 h-4 text-success" />
					) : (
						<Link className="w-4 h-4 text-primary" />
					)}
					<span
						className={`text-sm font-semibold ${allConnected ? 'text-success' : 'text-primary'}`}
					>
						{allConnected
							? 'Polymorphic Association Complete!'
							: 'Click each model to connect it to Comment'}
					</span>
				</div>
			</div>

			{/* Parent models row */}
			<div className="grid grid-cols-3 gap-4">
				{PARENT_MODELS.map((model) => {
					const isConnected = connections[model.key];
					return (
						<button
							className={`rounded-xl border-2 p-4 text-center transition-all cursor-pointer ${
								isConnected
									? `${model.borderColor} ${model.bgColor}`
									: 'border-border bg-card hover:border-muted-foreground'
							}`}
							key={model.key}
							onClick={() => onToggleConnection(model.key)}
							type="button"
						>
							<Database
								className={`w-6 h-6 mx-auto mb-2 ${isConnected ? model.color : 'text-muted-foreground'}`}
							/>
							<div
								className={`font-bold text-sm ${isConnected ? model.color : 'text-foreground'}`}
							>
								{model.label}
							</div>
							<div className="text-xs text-muted-foreground mt-1">
								has_many :comments, as: :commentable
							</div>
							{isConnected ? (
								<div className="mt-2 inline-flex items-center gap-1 text-xs text-success bg-success/10 rounded-full px-2 py-0.5">
									<Check className="w-3 h-3" />
									Connected
								</div>
							) : (
								<div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
									<Link className="w-3 h-3" />
									Click to connect
								</div>
							)}
						</button>
					);
				})}
			</div>

			{/* Connection lines */}
			<div className="flex justify-center gap-6">
				{PARENT_MODELS.map((model) => {
					const isConnected = connections[model.key];
					return (
						<div className="flex flex-col items-center" key={model.key}>
							<div
								className={`w-0.5 h-8 transition-colors ${
									isConnected ? 'bg-success' : 'bg-border'
								}`}
							/>
							{isConnected && (
								<ArrowRight className="w-4 h-4 text-success rotate-90" />
							)}
							{!isConnected && (
								<div className="w-4 h-4 rounded-full border border-dashed border-muted-foreground" />
							)}
						</div>
					);
				})}
			</div>

			{/* Unified Comment table */}
			<div
				className={`rounded-xl border-2 p-6 transition-all ${
					allConnected
						? 'border-success bg-success/5'
						: 'border-primary/40 bg-primary/5'
				}`}
			>
				<div className="flex items-center justify-center gap-3 mb-4">
					<Table2
						className={`w-6 h-6 ${allConnected ? 'text-success' : 'text-primary'}`}
					/>
					<div
						className={`font-bold text-lg ${allConnected ? 'text-success' : 'text-primary'}`}
					>
						Comment
					</div>
					<span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">
						polymorphic
					</span>
				</div>

				<div className="grid grid-cols-2 gap-x-8 gap-y-1 max-w-md mx-auto">
					{[
						{ col: 'id', desc: 'primary key' },
						{ col: 'body', desc: 'text, not null' },
						{
							col: 'commentable_type',
							desc: '"Post" | "Photo" | "Video"',
							highlight: true,
						},
						{
							col: 'commentable_id',
							desc: 'references parent record',
							highlight: true,
						},
						{ col: 'user_id', desc: 'foreign key' },
						{ col: 'created_at', desc: 'timestamp' },
					].map((item) => (
						<div
							className={`flex items-center gap-2 py-1 px-2 rounded font-mono text-xs ${
								item.highlight
									? allConnected
										? 'bg-success/10 text-success'
										: 'bg-primary/10 text-primary'
									: 'text-muted-foreground'
							}`}
							key={item.col}
						>
							<span className="font-semibold">{item.col}</span>
							<span className="text-muted-foreground text-[10px]">
								{item.desc}
							</span>
						</div>
					))}
				</div>

				{/* Example data rows */}
				{allConnected && (
					<div className="mt-4 pt-4 border-t border-success/20">
						<div className="text-xs font-semibold text-success uppercase tracking-wider mb-2 text-center">
							Example Rows
						</div>
						<div className="space-y-1 max-w-md mx-auto">
							{[
								{ type: 'Post', id: 1, body: 'Great article!' },
								{ type: 'Photo', id: 5, body: 'Beautiful shot!' },
								{ type: 'Video', id: 3, body: 'Helpful tutorial!' },
							].map((row) => (
								<div
									className="flex items-center gap-3 text-xs font-mono bg-background/50 rounded px-3 py-1.5"
									key={row.type}
								>
									<span className="text-muted-foreground w-20 truncate">
										"{row.body}"
									</span>
									<span className="text-primary font-semibold">{row.type}</span>
									<span className="text-muted-foreground">id: {row.id}</span>
								</div>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Benefits callout */}
			<div
				className={`rounded-xl p-4 transition-all ${
					allConnected
						? 'bg-success/5 border border-success/20'
						: 'bg-card border border-border'
				}`}
			>
				<div
					className={`text-sm font-semibold mb-2 flex items-center gap-2 ${
						allConnected ? 'text-success' : 'text-foreground'
					}`}
				>
					<Check className="w-4 h-4" />
					Why This Is Better
				</div>
				<ul className="text-xs text-muted-foreground space-y-1">
					<li className="flex items-start gap-2">
						<span className="text-success mt-0.5">+</span>
						One table, one model - DRY and maintainable
					</li>
					<li className="flex items-start gap-2">
						<span className="text-success mt-0.5">+</span>
						Query all comments easily: Comment.where(user: current_user)
					</li>
					<li className="flex items-start gap-2">
						<span className="text-success mt-0.5">+</span>
						Adding new commentable types requires zero new tables
					</li>
					<li className="flex items-start gap-2">
						<span className="text-success mt-0.5">+</span>
						Shared validations, callbacks, and scopes in one place
					</li>
				</ul>
			</div>
		</div>
	);
}

export default Level32Polymorphic;
