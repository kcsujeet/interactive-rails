/**
 * Level 5: Views & Templates
 *
 * Learn ERB template syntax and how views render data.
 * Player fills in ERB tags to display data from the controller.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
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

interface ERBSlot {
	id: string;
	type: 'output' | 'execute';
	content: string | null;
	correctContent: string;
	hint: string;
}

interface ERBTag {
	id: string;
	content: string;
	type: 'output' | 'execute';
	description: string;
}

const INITIAL_SLOTS: ERBSlot[] = [
	{
		id: 'title',
		type: 'output',
		content: null,
		correctContent: '@post.title',
		hint: 'Display the title',
	},
	{
		id: 'body',
		type: 'output',
		content: null,
		correctContent: '@post.body',
		hint: 'Display the body',
	},
	{
		id: 'loop',
		type: 'execute',
		content: null,
		correctContent: '@posts.each do |post|',
		hint: 'Loop through posts',
	},
	{
		id: 'link',
		type: 'output',
		content: null,
		correctContent: 'link_to post.title, post',
		hint: 'Link to post',
	},
];

const AVAILABLE_TAGS: ERBTag[] = [
	{
		id: 'post-title',
		content: '@post.title',
		type: 'output',
		description: 'Current post title',
	},
	{
		id: 'post-body',
		content: '@post.body',
		type: 'output',
		description: 'Current post body',
	},
	{
		id: 'posts-each',
		content: '@posts.each do |post|',
		type: 'execute',
		description: 'Loop through posts',
	},
	{
		id: 'link-to',
		content: 'link_to post.title, post',
		type: 'output',
		description: 'Link to a post',
	},
];

// Sample data to show in preview
const SAMPLE_POST = {
	id: 1,
	title: 'Welcome to Rails!',
	body: 'This is your first post. Rails makes web development fun!',
};
const SAMPLE_POSTS = [
	{ id: 1, title: 'Getting Started with Rails' },
	{ id: 2, title: 'Understanding MVC' },
	{ id: 3, title: 'CRUD Operations' },
];

export function Level5Views({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [slots, setSlots] = useState<ERBSlot[]>(INITIAL_SLOTS);
	const [selectedTag, setSelectedTag] = useState<string | null>(null);
	const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<'show' | 'index'>('show');

	const correctCount = slots.filter(
		(s) => s.content === s.correctContent,
	).length;
	const showSlots = slots.filter((s) => s.id === 'title' || s.id === 'body');
	const indexSlots = slots.filter((s) => s.id === 'loop' || s.id === 'link');

	// Validation function
	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		const emptySlots = slots.filter((s) => !s.content);
		if (emptySlots.length > 0) {
			errors.push(`${emptySlots.length} ERB tag(s) still need to be placed`);
		}

		const incorrectSlots = slots.filter(
			(s) => s.content && s.content !== s.correctContent,
		);
		if (incorrectSlots.length > 0) {
			errors.push(`${incorrectSlots.length} ERB tag(s) have wrong content`);
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Template needs adjustment!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'Your ERB templates are rendering correctly!',
		};
	};

	const handleDragStart = (e: React.DragEvent, tagId: string) => {
		e.dataTransfer.setData('tagId', tagId);
		setSelectedTag(tagId);
	};

	const handleDragEnd = () => {
		setSelectedTag(null);
		setDragOverSlot(null);
	};

	const handleDrop = (slotId: string) => {
		if (selectedTag) {
			const tag = AVAILABLE_TAGS.find((t) => t.id === selectedTag);
			if (tag) {
				setSlots((prev) =>
					prev.map((s) =>
						s.id === slotId ? { ...s, content: tag.content } : s,
					),
				);
			}
		}
		setSelectedTag(null);
		setDragOverSlot(null);
	};

	const clearSlot = (slotId: string) => {
		setSlots((prev) =>
			prev.map((s) => (s.id === slotId ? { ...s, content: null } : s)),
		);
	};

	const handleComplete = async () => {
		const success = await completeLevel('act1-level5-views-templates', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const renderSlot = (slot: ERBSlot) => {
		const isCorrect = slot.content === slot.correctContent;
		const tagType = slot.type === 'output' ? '<%=' : '<%';
		const closeTag = slot.type === 'execute' ? ' %>' : ' %>';

		return (
			<div
				className={`inline-flex items-center rounded font-mono text-sm transition-all ${
					slot.content
						? isCorrect
							? 'bg-success/10 text-success'
							: 'bg-destructive/10 text-destructive'
						: dragOverSlot === slot.id
							? 'bg-warning/10 text-warning border-2 border-dashed border-warning'
							: 'bg-secondary text-muted-foreground border-2 border-dashed border-border'
				}`}
				key={slot.id}
				onDragLeave={() => setDragOverSlot(null)}
				onDragOver={(e) => {
					e.preventDefault();
					setDragOverSlot(slot.id);
				}}
				onDrop={() => handleDrop(slot.id)}
			>
				<span className="text-warning px-1">{tagType}</span>
				{slot.content ? (
					<span className="px-1">{slot.content}</span>
				) : (
					<span className="px-3 text-xs italic">{slot.hint}</span>
				)}
				<span className="text-warning px-1">{closeTag}</span>
				{slot.content && (
					<Button
						className="px-1 h-auto w-auto"
						onClick={() => clearSlot(slot.id)}
						size="icon"
						variant="ghost"
					>
						×
					</Button>
				)}
			</div>
		);
	};

	// Get the preview HTML based on filled slots
	const getPreviewHTML = () => {
		const titleSlot = slots.find((s) => s.id === 'title');
		const bodySlot = slots.find((s) => s.id === 'body');
		const loopSlot = slots.find((s) => s.id === 'loop');
		const linkSlot = slots.find((s) => s.id === 'link');

		if (activeTab === 'show') {
			const showTitle = titleSlot?.content === titleSlot?.correctContent;
			const showBody = bodySlot?.content === bodySlot?.correctContent;

			return (
				<div className="space-y-4">
					<h1
						className={`text-2xl font-bold ${showTitle ? 'text-foreground' : 'text-muted-foreground'}`}
					>
						{showTitle ? SAMPLE_POST.title : '[title will appear here]'}
					</h1>
					<p
						className={
							showBody ? 'text-muted-foreground' : 'text-muted-foreground/50'
						}
					>
						{showBody ? SAMPLE_POST.body : '[body will appear here]'}
					</p>
				</div>
			);
		} else {
			const hasLoop = loopSlot?.content === loopSlot?.correctContent;
			const hasLink = linkSlot?.content === linkSlot?.correctContent;

			return (
				<div className="space-y-2">
					<h1 className="text-xl font-bold text-foreground mb-4">All Posts</h1>
					{hasLoop ? (
						<ul className="space-y-2">
							{SAMPLE_POSTS.map((post) => (
								<li key={post.id}>
									{hasLink ? (
										<a className="text-primary hover:underline" href="#">
											{post.title}
										</a>
									) : (
										<span className="text-muted-foreground">
											[link will appear here]
										</span>
									)}
								</li>
							))}
						</ul>
					) : (
						<div className="text-muted-foreground">[posts will loop here]</div>
					)}
				</div>
			);
		}
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Views are the V in MVC. They take data from controllers and render it as HTML."
					instructions={[
						'<%= ... %> outputs a value',
						'<% ... %> executes code (no output)',
						'Views access instance variables from controllers (@post, @posts)',
						'ERB mixes Ruby code with HTML',
					]}
					scenario="Your controller has data, but users see nothing. Views are the templates that turn data into HTML that browsers can display."
				>
					{/* ERB Tags Palette */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							ERB Tags
						</div>
						<div className="space-y-2">
							{AVAILABLE_TAGS.map((tag) => {
								const isUsed = slots.some((s) => s.content === tag.content);
								return (
									<div
										className={`p-3 rounded-lg border font-mono text-sm transition-all ${
											isUsed
												? 'bg-secondary/50 border-border opacity-50 cursor-not-allowed'
												: 'bg-warning/10 border-warning cursor-grab hover:border-warning/70 active:cursor-grabbing'
										}`}
										draggable={!isUsed}
										key={tag.id}
										onDragEnd={handleDragEnd}
										onDragStart={(e) => handleDragStart(e, tag.id)}
									>
										<div className="flex items-center justify-between">
											<div>
												<span className="text-warning">
													{tag.type === 'output' ? '<%=' : '<%'}
												</span>
												<span className="text-primary mx-1">{tag.content}</span>
												<span className="text-warning">%&gt;</span>
											</div>
											{isUsed && (
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
										<div className="text-xs text-muted-foreground mt-1">
											{tag.description}
										</div>
									</div>
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
								Tags placed correctly
							</span>
							<span
								className={
									correctCount === slots.length
										? 'text-success'
										: 'text-foreground'
								}
							>
								{correctCount} / {slots.length}
							</span>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all duration-300"
								style={{ width: `${(correctCount / slots.length) * 100}%` }}
							/>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="Views & Templates"
					levelNumber={5}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => setSlots(INITIAL_SLOTS)}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-8 overflow-auto">
					<div className="max-w-3xl mx-auto">
						{/* View Tabs */}
						<div className="flex gap-2 mb-6">
							<Button
								onClick={() => setActiveTab('show')}
								size="sm"
								variant={activeTab === 'show' ? 'default' : 'secondary'}
							>
								show.html.erb
							</Button>
							<Button
								onClick={() => setActiveTab('index')}
								size="sm"
								variant={activeTab === 'index' ? 'default' : 'secondary'}
							>
								index.html.erb
							</Button>
						</div>

						<div className="grid grid-cols-2 gap-6">
							{/* ERB Template */}
							<div className="bg-card rounded-xl border-2 border-pink-500 overflow-hidden">
								<div className="bg-pink-900/40 px-4 py-3 border-b border-pink-500/50 flex items-center gap-3">
									<span className="w-10 h-10 rounded-lg bg-pink-600 flex items-center justify-center text-foreground font-bold text-lg">
										V
									</span>
									<div>
										<div className="text-foreground font-semibold">
											{activeTab}.html.erb
										</div>
										<div className="text-pink-300 text-xs">
											app/views/posts/{activeTab}.html.erb
										</div>
									</div>
								</div>
								<div className="p-4 font-mono text-sm">
									{activeTab === 'show' ? (
										<div className="space-y-4">
											<div>
												<span className="text-muted-foreground">
													&lt;h1&gt;
												</span>
												{renderSlot(showSlots[0])}
												<span className="text-muted-foreground">
													&lt;/h1&gt;
												</span>
											</div>
											<div>
												<span className="text-muted-foreground">&lt;p&gt;</span>
												{renderSlot(showSlots[1])}
												<span className="text-muted-foreground">
													&lt;/p&gt;
												</span>
											</div>
										</div>
									) : (
										<div className="space-y-2">
											<div className="text-muted-foreground">
												&lt;h1&gt;All Posts&lt;/h1&gt;
											</div>
											<div className="text-muted-foreground">&lt;ul&gt;</div>
											<div className="pl-4">{renderSlot(indexSlots[0])}</div>
											<div className="pl-8">
												<span className="text-muted-foreground">
													&lt;li&gt;
												</span>
												{renderSlot(indexSlots[1])}
												<span className="text-muted-foreground">
													&lt;/li&gt;
												</span>
											</div>
											<div className="pl-4 text-warning">&lt;% end %&gt;</div>
											<div className="text-muted-foreground">&lt;/ul&gt;</div>
										</div>
									)}
								</div>
							</div>

							{/* Browser Preview */}
							<div className="bg-card rounded-xl border border-border overflow-hidden">
								<div className="bg-secondary px-4 py-2 flex items-center gap-2 border-b border-border">
									<div className="flex gap-1.5">
										<div className="w-3 h-3 rounded-full bg-destructive" />
										<div className="w-3 h-3 rounded-full bg-warning" />
										<div className="w-3 h-3 rounded-full bg-success" />
									</div>
									<span className="text-muted-foreground text-sm ml-2">
										Browser Preview
									</span>
								</div>
								<div className="p-6 min-h-[200px]">{getPreviewHTML()}</div>
							</div>
						</div>

						{/* ERB Syntax Explanation */}
						<div className="mt-8 bg-card rounded-xl border border-border p-4">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								ERB Syntax
							</div>
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div className="flex items-center gap-3">
									<code className="bg-secondary px-2 py-1 rounded text-warning">
										&lt;%= ... %&gt;
									</code>
									<span className="text-muted-foreground">
										Output (prints value)
									</span>
								</div>
								<div className="flex items-center gap-3">
									<code className="bg-secondary px-2 py-1 rounded text-warning">
										&lt;% ... %&gt;
									</code>
									<span className="text-muted-foreground">
										Execute (no output)
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/views/posts/show.html.erb',
							language: 'erb',
							code: `<h1><%= @post.title %></h1>

<p><%= @post.body %></p>

<%= link_to "Edit", edit_post_path(@post) %>
<%= link_to "Back", posts_path %>`,
							highlight: showSlots
								.filter((s) => s.content === s.correctContent)
								.map((_, i) => i * 2 + 1),
						},
						{
							filename: 'app/views/posts/index.html.erb',
							language: 'erb',
							code: `<h1>All Posts</h1>

<ul>
  <% @posts.each do |post| %>
    <li><%= link_to post.title, post %></li>
  <% end %>
</ul>

<%= link_to "New Post", new_post_path %>`,
							highlight: indexSlots
								.filter((s) => s.content === s.correctContent)
								.map(() => 4),
						},
					]}
					learningGoal="ERB (Embedded Ruby) lets you mix Ruby code into HTML templates. Use <%= %> to output values, <% %> to execute code."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							View Helpers
						</div>
						<div className="text-xs text-muted-foreground space-y-1">
							<div>
								<code className="text-primary">link_to</code> - Create links
							</div>
							<div>
								<code className="text-primary">image_tag</code> - Display images
							</div>
							<div>
								<code className="text-primary">form_with</code> - Build forms
							</div>
							<div>
								<code className="text-primary">render</code> - Include partials
							</div>
						</div>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level5Views;
