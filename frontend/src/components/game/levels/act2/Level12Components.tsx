/**
 * Level 12: ViewComponents
 *
 * Extract duplicated view code into reusable ViewComponent.
 * Shows DRY principle for view layer.
 */

import { useState } from 'react';
import { Button } from '../../../ui/Button';
import type { LevelComponentProps } from '../index';
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
} from '../shared';

interface ViewBlock {
	id: string;
	view: string;
	code: string;
	extracted: boolean;
}

export function Level12Components({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [componentCreated, setComponentCreated] = useState(false);
	const [blocks, setBlocks] = useState<ViewBlock[]>([
		{
			id: 'user-card-1',
			view: 'users/index',
			code: 'render_user_card(@user)',
			extracted: false,
		},
		{
			id: 'user-card-2',
			view: 'posts/show',
			code: 'render_user_card(@author)',
			extracted: false,
		},
		{
			id: 'user-card-3',
			view: 'comments/show',
			code: 'render_user_card(@commenter)',
			extracted: false,
		},
	]);

	const extractedCount = blocks.filter((b) => b.extracted).length;

	// Validation function
	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		if (!componentCreated) {
			errors.push('Create the ViewComponent first');
		}

		const unextractedBlocks = blocks.filter((b) => !b.extracted);
		if (unextractedBlocks.length > 0) {
			errors.push(
				`${unextractedBlocks.length} view(s) still have duplicated code`,
			);
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Duplication still exists!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'All duplicated code extracted to ViewComponent!',
		};
	};

	const handleExtract = (blockId: string) => {
		if (!componentCreated) return;
		setBlocks((prev) =>
			prev.map((b) => (b.id === blockId ? { ...b, extracted: true } : b)),
		);
	};

	const handleComplete = async () => {
		const success = await completeLevel('act2-level12-view-components', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn ViewComponent pattern for reusable, testable view code."
					instructions={[
						'Notice the duplicated code blocks (highlighted in yellow)',
						'Create a ViewComponent to extract the shared code',
						'Click each block to consolidate into the component',
					]}
					scenario="The same user card HTML is duplicated across 3 different views. Every change requires updating 3 files!"
				>
					<div className="p-4 border-t border-border">
						<Button
							className="w-full"
							disabled={componentCreated}
							onClick={() => setComponentCreated(true)}
							variant={componentCreated ? 'secondary' : 'default'}
						>
							{componentCreated ? 'Component Created' : 'Create ViewComponent'}
						</Button>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Extraction Progress
						</div>
						<div className="bg-secondary rounded-full h-3 overflow-hidden">
							<div
								className="bg-primary h-full transition-all duration-300"
								style={{ width: `${(extractedCount / 3) * 100}%` }}
							/>
						</div>
						<div className="text-muted-foreground text-sm mt-2">
							{extractedCount} / 3 views updated
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="ViewComponents"
					levelNumber={12}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setComponentCreated(false);
						setBlocks([
							{
								id: 'user-card-1',
								view: 'users/index',
								code: 'render_user_card(@user)',
								extracted: false,
							},
							{
								id: 'user-card-2',
								view: 'posts/show',
								code: 'render_user_card(@author)',
								extracted: false,
							},
							{
								id: 'user-card-3',
								view: 'comments/show',
								code: 'render_user_card(@commenter)',
								extracted: false,
							},
						]);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-8 overflow-auto">
					<div className="flex gap-8 justify-center">
						{/* View files with duplicated code */}
						<div className="space-y-6">
							{blocks.map((block) => (
								<div
									className={`bg-card border-2 rounded-xl p-4 w-64 transition-all ${
										block.extracted ? 'border-success' : 'border-border'
									}`}
									key={block.id}
								>
									<div className="text-muted-foreground text-sm font-mono mb-3">
										app/views/{block.view}.html.erb
									</div>

									{block.extracted ? (
										<div className="bg-success/20 border border-success rounded-lg p-3">
											<code className="text-success text-sm">
												{'<%= render UserCardComponent.new(user: @user) %>'}
											</code>
										</div>
									) : (
										<Button
											className={`w-full text-left h-auto p-0 ${componentCreated ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`}
											disabled={!componentCreated}
											onClick={() => handleExtract(block.id)}
											variant="ghost"
										>
											<div
												className={`rounded-lg p-3 w-full ${
													componentCreated
														? 'bg-warning/20 border-2 border-warning border-dashed'
														: 'bg-secondary border border-border'
												}`}
											>
												<pre className="text-xs text-foreground whitespace-pre-wrap">
													{`<div class="user-card">
  <img src="<%= @user.avatar %>">
  <h3><%= @user.name %></h3>
  <span><%= @user.role %></span>
</div>`}
												</pre>
												{componentCreated && (
													<div className="text-warning text-xs mt-2 text-center">
														Click to extract
													</div>
												)}
											</div>
										</Button>
									)}
								</div>
							))}
						</div>

						{/* Arrow */}
						<div className="flex items-center">
							<svg
								className="w-12 h-12 text-muted-foreground"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									d="M14 5l7 7m0 0l-7 7m7-7H3"
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
								/>
							</svg>
						</div>

						{/* ViewComponent */}
						<div
							className={`bg-card border-2 rounded-xl p-6 w-80 transition-all ${
								componentCreated ? 'border-primary' : 'border-border opacity-50'
							}`}
						>
							<div className="text-primary font-mono text-sm mb-4">
								app/components/user_card_component.rb
							</div>

							{componentCreated ? (
								<div className="space-y-4">
									<pre className="text-xs text-foreground bg-secondary rounded-lg p-3 overflow-x-auto">
										{`class UserCardComponent < ViewComponent::Base
  def initialize(user:)
    @user = user
  end
end`}
									</pre>

									<div className="text-muted-foreground text-xs font-mono">
										user_card_component.html.erb
									</div>
									<pre className="text-xs text-foreground bg-secondary rounded-lg p-3">
										{`<div class="user-card">
  <img src="<%= @user.avatar %>">
  <h3><%= @user.name %></h3>
  <span><%= @user.role %></span>
</div>`}
									</pre>

									<div className="bg-primary/20 rounded-lg p-3">
										<div className="text-primary text-sm font-medium">
											Benefits:
										</div>
										<ul className="text-primary/80 text-xs mt-1 space-y-1">
											<li>+ Single source of truth</li>
											<li>+ Unit testable in isolation</li>
											<li>+ Type-safe parameters</li>
										</ul>
									</div>
								</div>
							) : (
								<div className="text-muted-foreground text-center py-8">
									Create component to enable extraction
								</div>
							)}

							{extractedCount === 3 && (
								<div className="mt-4 p-3 bg-success/20 border border-success rounded-lg text-success text-sm text-center">
									All duplications removed!
								</div>
							)}
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/components/user_card_component.rb',
							language: 'ruby',
							code: `class UserCardComponent < ViewComponent::Base
  def initialize(user:)
    @user = user
  end

  # Preview in lookbook
  def self.preview
    new(user: User.first)
  end
end

# Usage in any view:
<%= render UserCardComponent.new(user: @author) %>

# Unit test:
RSpec.describe UserCardComponent do
  it "renders the user name" do
    user = build(:user, name: "Alice")
    render_inline(described_class.new(user: user))
    expect(page).to have_text("Alice")
  end
end`,
							highlight: [1, 2, 3, 4, 13],
						},
					]}
					learningGoal="ViewComponents extract reusable view code into testable Ruby classes. Use them for complex UI elements that appear in multiple places."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level12Components;
