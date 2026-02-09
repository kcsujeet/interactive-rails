/**
 * Level 3: CRUD Operations
 *
 * Learn Create, Read, Update, Delete with ActiveRecord.
 * Player executes commands in a simulated Rails console.
 */

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

interface ConsoleEntry {
	id: number;
	input: string;
	output: string;
	type: 'success' | 'error' | 'info';
}

interface Post {
	id: number;
	title: string;
	body: string;
	created_at: string;
}

// Available commands for this level
const COMMANDS = [
	{
		cmd: 'Post.create(title: "Hello World", body: "My first post!")',
		operation: 'create',
		description: 'Create a new post',
	},
	{ cmd: 'Post.all', operation: 'read-all', description: 'Get all posts' },
	{
		cmd: 'Post.find(1)',
		operation: 'read-one',
		description: 'Find post by ID',
	},
	{
		cmd: 'Post.first.update(title: "Updated Title")',
		operation: 'update',
		description: 'Update a post',
	},
	{
		cmd: 'Post.last.destroy',
		operation: 'destroy',
		description: 'Delete a post',
	},
];

export function Level3CRUD({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [consoleHistory, setConsoleHistory] = useState<ConsoleEntry[]>([
		{
			id: 0,
			input: 'rails console',
			output: 'Loading development environment (Rails 7.1.0)',
			type: 'info',
		},
	]);
	const [posts, setPosts] = useState<Post[]>([]);
	const [completedOperations, setCompletedOperations] = useState<Set<string>>(
		new Set(),
	);
	const [nextId, setNextId] = useState(1);

	// Validation function
	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];
		const required = ['create', 'read-all', 'read-one', 'update', 'destroy'];
		const missing = required.filter((op) => !completedOperations.has(op));

		if (missing.length > 0) {
			const opNames: Record<string, string> = {
				create: 'Create (Post.create)',
				'read-all': 'Read All (Post.all)',
				'read-one': 'Read One (Post.find)',
				update: 'Update (Post.first.update)',
				destroy: 'Delete (Post.last.destroy)',
			};
			errors.push(
				`Try these operations: ${missing.map((m) => opNames[m]).join(', ')}`,
			);
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Complete all CRUD operations!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: "You've mastered CRUD operations!",
		};
	};

	const executeCommand = (cmd: string, operation: string) => {
		const entryId = consoleHistory.length;
		let output = '';
		let type: 'success' | 'error' | 'info' = 'success';

		switch (operation) {
			case 'create': {
				const newPost: Post = {
					id: nextId,
					title: 'Hello World',
					body: 'My first post!',
					created_at: new Date().toISOString(),
				};
				setPosts((prev) => [...prev, newPost]);
				setNextId((prev) => prev + 1);
				output = `=> #<Post id: ${newPost.id}, title: "${newPost.title}", body: "${newPost.body}">`;
				break;
			}
			case 'read-all': {
				if (posts.length === 0) {
					output = '=> []';
				} else {
					output = `=> [\n${posts.map((p) => `  #<Post id: ${p.id}, title: "${p.title}">`).join(',\n')}\n]`;
				}
				break;
			}
			case 'read-one': {
				const post = posts.find((p) => p.id === 1);
				if (post) {
					output = `=> #<Post id: ${post.id}, title: "${post.title}", body: "${post.body}">`;
				} else {
					output = "ActiveRecord::RecordNotFound: Couldn't find Post with id=1";
					type = 'error';
				}
				break;
			}
			case 'update': {
				if (posts.length === 0) {
					output = "NoMethodError: undefined method `update' for nil:NilClass";
					type = 'error';
				} else {
					setPosts((prev) => {
						const updated = [...prev];
						updated[0] = { ...updated[0], title: 'Updated Title' };
						return updated;
					});
					output = `=> true`;
				}
				break;
			}
			case 'destroy': {
				if (posts.length === 0) {
					output = "NoMethodError: undefined method `destroy' for nil:NilClass";
					type = 'error';
				} else {
					const lastPost = posts[posts.length - 1];
					setPosts((prev) => prev.slice(0, -1));
					output = `=> #<Post id: ${lastPost.id}, title: "${lastPost.title}"> (destroyed)`;
				}
				break;
			}
			default:
				output = '=> nil';
		}

		setConsoleHistory((prev) => [
			...prev,
			{ id: entryId, input: cmd, output, type },
		]);

		// Track completed operations (only if successful)
		if (type === 'success') {
			setCompletedOperations((prev) => new Set([...prev, operation]));
		}
	};

	const handleComplete = async () => {
		const success = await completeLevel('act1-level3-crud', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const progress = (completedOperations.size / 5) * 100;

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="CRUD operations are the foundation of all database work. Every web app uses them constantly."
					instructions={[
						'Click commands to execute them in the console',
						'Create: Make new records',
						'Read: Fetch existing records',
						'Update: Modify existing records',
						'Delete: Remove records',
					]}
					scenario="Your Post model exists, but the database is empty. Time to learn the four fundamental operations: Create, Read, Update, Delete."
				>
					{/* Command Palette */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Available Commands
						</div>
						<div className="space-y-2">
							{COMMANDS.map(({ cmd, operation, description }) => {
								const isCompleted = completedOperations.has(operation);
								return (
									<Button
										className={`w-full p-3 h-auto rounded-lg text-left transition-all border ${
											isCompleted
												? 'bg-success/10 border-success text-success'
												: 'bg-secondary border-border text-muted-foreground hover:border-primary hover:text-foreground'
										}`}
										key={operation}
										onClick={() => executeCommand(cmd, operation)}
										variant="outline"
									>
										<div className="flex flex-col w-full">
											<div className="flex items-center justify-between">
												<span className="text-xs font-medium uppercase tracking-wider">
													{operation.split('-')[0]}
												</span>
												{isCompleted && (
													<svg
														className="w-4 h-4 text-success"
														fill="currentColor"
														viewBox="0 0 20 20"
													>
														<path
															clipRule="evenodd"
															d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
															fillRule="evenodd"
														/>
													</svg>
												)}
											</div>
											<div className="font-mono text-xs mt-1 text-primary">
												{cmd}
											</div>
											<div className="text-xs text-muted-foreground mt-1">
												{description}
											</div>
										</div>
									</Button>
								);
							})}
						</div>
					</div>

					{/* Progress */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Progress
						</div>
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">
								Operations completed
							</span>
							<span
								className={
									completedOperations.size === 5
										? 'text-success'
										: 'text-foreground'
								}
							>
								{completedOperations.size} / 5
							</span>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all duration-300"
								style={{ width: `${progress}%` }}
							/>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="CRUD Operations"
					levelNumber={3}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setConsoleHistory([
							{
								id: 0,
								input: 'rails console',
								output: 'Loading development environment (Rails 7.1.0)',
								type: 'info',
							},
						]);
						setPosts([]);
						setCompletedOperations(new Set());
						setNextId(1);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-8 overflow-auto">
					{/* Rails Console */}
					<div className="max-w-2xl mx-auto">
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							{/* Console Header */}
							<div className="bg-secondary px-4 py-2 flex items-center gap-2 border-b border-border">
								<div className="flex gap-1.5">
									<div className="w-3 h-3 rounded-full bg-destructive" />
									<div className="w-3 h-3 rounded-full bg-warning" />
									<div className="w-3 h-3 rounded-full bg-success" />
								</div>
								<span className="text-muted-foreground text-sm ml-2">
									Rails Console
								</span>
							</div>

							{/* Console Output */}
							<div className="p-4 font-mono text-sm max-h-[400px] overflow-y-auto">
								{consoleHistory.map((entry) => (
									<div className="mb-3" key={entry.id}>
										<div className="flex">
											<span className="text-success mr-2">irb&gt;</span>
											<span className="text-foreground">{entry.input}</span>
										</div>
										<div
											className={`ml-6 whitespace-pre-wrap ${
												entry.type === 'error'
													? 'text-destructive'
													: entry.type === 'info'
														? 'text-muted-foreground'
														: 'text-primary'
											}`}
										>
											{entry.output}
										</div>
									</div>
								))}
								<div className="flex items-center">
									<span className="text-success mr-2">irb&gt;</span>
									<span className="w-2 h-4 bg-foreground animate-pulse" />
								</div>
							</div>
						</div>

						{/* Current Database State */}
						<div className="mt-6 bg-card rounded-xl border border-primary overflow-hidden">
							<div className="bg-primary/10 px-4 py-2 border-b border-primary/50">
								<span className="text-primary text-sm font-semibold">
									Database: posts table
								</span>
							</div>
							<div className="p-4">
								{posts.length === 0 ? (
									<div className="text-muted-foreground text-sm text-center py-4">
										No records yet. Try Post.create!
									</div>
								) : (
									<table className="w-full text-sm">
										<thead>
											<tr className="text-muted-foreground text-left">
												<th className="pb-2">id</th>
												<th className="pb-2">title</th>
												<th className="pb-2">body</th>
											</tr>
										</thead>
										<tbody>
											{posts.map((post) => (
												<tr
													className="text-muted-foreground border-t border-border"
													key={post.id}
												>
													<td className="py-2 text-purple-400">{post.id}</td>
													<td className="py-2">{post.title}</td>
													<td className="py-2 text-muted-foreground truncate max-w-[200px]">
														{post.body}
													</td>
												</tr>
											))}
										</tbody>
									</table>
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
							filename: 'CRUD_cheatsheet.rb',
							language: 'ruby',
							code: `# CREATE - Make new records
Post.create(title: "Hello", body: "World")
Post.new(title: "Draft").save

# READ - Fetch records
Post.all                    # All posts
Post.find(1)               # By ID
Post.find_by(title: "Hi")  # By attribute
Post.first / Post.last     # First/last record
Post.where(published: true) # Filter

# UPDATE - Modify records
post = Post.find(1)
post.update(title: "New Title")
post.title = "Another"
post.save

# DELETE - Remove records
post.destroy       # Delete one
Post.destroy_all   # Delete all`,
							highlight: completedOperations.has('create')
								? [2, 3]
								: completedOperations.has('read-all')
									? [6]
									: completedOperations.has('read-one')
										? [7]
										: completedOperations.has('update')
											? [14, 15, 16, 17]
											: completedOperations.has('destroy')
												? [20, 21]
												: [],
						},
					]}
					learningGoal="CRUD = Create, Read, Update, Delete. These four operations are how you interact with database records in Rails."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							CRUD Operations
						</div>
						<div className="grid grid-cols-2 gap-2 text-xs">
							<div
								className={`p-2 rounded ${completedOperations.has('create') ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'}`}
							>
								<span className="font-bold">C</span>reate
							</div>
							<div
								className={`p-2 rounded ${completedOperations.has('read-all') || completedOperations.has('read-one') ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'}`}
							>
								<span className="font-bold">R</span>ead
							</div>
							<div
								className={`p-2 rounded ${completedOperations.has('update') ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'}`}
							>
								<span className="font-bold">U</span>pdate
							</div>
							<div
								className={`p-2 rounded ${completedOperations.has('destroy') ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'}`}
							>
								<span className="font-bold">D</span>elete
							</div>
						</div>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level3CRUD;
