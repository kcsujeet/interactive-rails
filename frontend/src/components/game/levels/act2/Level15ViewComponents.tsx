/**
 * Level 15: View Components
 *
 * Extract reusable UI components from views.
 * Player identifies duplicated markup and creates components.
 */

import { useState } from 'react';
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

interface UIElement {
	id: string;
	name: string;
	instances: number;
	extracted: boolean;
	code: string;
}

const UI_ELEMENTS: UIElement[] = [
	{
		id: 'avatar',
		name: 'User Avatar',
		instances: 12,
		extracted: false,
		code: '<div class="avatar"><img src="<%= user.avatar_url %>"></div>',
	},
	{
		id: 'card',
		name: 'Content Card',
		instances: 8,
		extracted: false,
		code: '<div class="card"><%= content %></div>',
	},
	{
		id: 'badge',
		name: 'Status Badge',
		instances: 15,
		extracted: false,
		code: '<span class="badge badge-<%= status %>"><%= text %></span>',
	},
	{
		id: 'button',
		name: 'Action Button',
		instances: 23,
		extracted: false,
		code: '<button class="btn btn-<%= variant %>"><%= label %></button>',
	},
];

export function Level15ViewComponents({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [elements, setElements] = useState<UIElement[]>(UI_ELEMENTS);

	const extractedCount = elements.filter((e) => e.extracted).length;
	const totalDuplication = elements.reduce((sum, e) => sum + e.instances, 0);
	const remainingDuplication = elements
		.filter((e) => !e.extracted)
		.reduce((sum, e) => sum + e.instances, 0);

	const validateSolution = (): ValidationResult => {
		const unextracted = elements.filter((e) => !e.extracted);
		if (unextracted.length > 0) {
			return {
				valid: false,
				message: 'Extract all duplicated elements!',
				details: [
					`${unextracted.length} element(s) still duplicated across views`,
				],
			};
		}
		return {
			valid: true,
			message: 'Views are now DRY with reusable components!',
		};
	};

	const extractElement = (elementId: string) => {
		setElements((prev) =>
			prev.map((e) => (e.id === elementId ? { ...e, extracted: true } : e)),
		);
	};

	const handleComplete = async () => {
		const success = await completeLevel('act2-level15-view-components', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const generateComponentCode = (element: UIElement) => {
		return `# app/components/${element.id}_component.rb
class ${element.name.replace(' ', '')}Component < ViewComponent::Base
  def initialize(${element.id === 'avatar' ? 'user:' : element.id === 'badge' ? 'status:, text:' : element.id === 'button' ? 'label:, variant: :primary' : 'content:'})
    @${element.id === 'avatar' ? 'user' : element.id === 'badge' ? 'status, @text' : element.id === 'button' ? 'label, @variant' : 'content'} = ${element.id === 'avatar' ? 'user' : element.id === 'badge' ? 'status, text' : element.id === 'button' ? 'label, variant' : 'content'}
  end
end`;
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="DRY up your views with ViewComponent. Testable, reusable UI pieces."
					instructions={[
						'View Components encapsulate UI elements',
						'Write once, use everywhere',
						'Click elements to extract them into components',
						'Reduce duplication across your views',
					]}
					scenario="The same avatar markup is copy-pasted in 12 different views. When design changes, you have to update all 12. This is a maintenance nightmare."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Duplication Score
						</div>
						<div className="text-center py-4">
							<div
								className={`text-4xl font-bold ${remainingDuplication === 0 ? 'text-success' : 'text-destructive'}`}
							>
								{remainingDuplication}
							</div>
							<div className="text-xs text-muted-foreground">
								duplicated elements remaining
							</div>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all"
								style={{
									width: `${((totalDuplication - remainingDuplication) / totalDuplication) * 100}%`,
								}}
							/>
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Components created</span>
							<span
								className={
									extractedCount === elements.length
										? 'text-success'
										: 'text-foreground'
								}
							>
								{extractedCount} / {elements.length}
							</span>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="View Components"
					levelNumber={15}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => setElements(UI_ELEMENTS)}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-8 overflow-auto">
					<div className="max-w-3xl mx-auto">
						{/* View Files Grid */}
						<div className="grid grid-cols-3 gap-4 mb-8">
							{[
								'index.html.erb',
								'show.html.erb',
								'dashboard.html.erb',
								'profile.html.erb',
								'settings.html.erb',
								'admin.html.erb',
							].map((file, i) => (
								<div
									className="bg-card rounded-lg p-3 border border-border"
									key={file}
								>
									<div className="text-xs text-muted-foreground mb-2">
										{file}
									</div>
									<div className="flex flex-wrap gap-1">
										{elements.map((el) => {
											const showInFile =
												(i + el.instances) % 3 === 0 || el.instances > 10;
											if (!showInFile) return null;
											return (
												<div
													className={`text-xs px-2 py-1 rounded ${
														el.extracted
															? 'bg-success/20 text-success border border-success'
															: 'bg-destructive/20 text-destructive border border-destructive'
													}`}
													key={el.id}
												>
													{el.extracted
														? `<${el.name.replace(' ', '')} />`
														: el.name}
												</div>
											);
										})}
									</div>
								</div>
							))}
						</div>

						{/* Elements to Extract */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Duplicated Elements
								</div>
								<div className="text-xs text-muted-foreground">
									Click to extract into a component
								</div>
							</div>
							<div className="p-4 space-y-3">
								{elements.map((element) => (
									<div
										className={`p-4 rounded-lg border-2 transition-all ${
											element.extracted
												? 'border-success bg-success/10 cursor-default'
												: 'border-destructive bg-destructive/10 cursor-pointer hover:bg-destructive/20'
										}`}
										key={element.id}
										onClick={() =>
											!element.extracted && extractElement(element.id)
										}
									>
										<div className="flex items-center justify-between mb-2">
											<div className="flex items-center gap-3">
												<span
													className={`text-lg font-semibold ${element.extracted ? 'text-success' : 'text-destructive'}`}
												>
													{element.name}
												</span>
												{element.extracted && (
													<span className="text-xs bg-success/20 text-success px-2 py-1 rounded">
														✓ Extracted
													</span>
												)}
											</div>
											<div
												className={`text-sm ${element.extracted ? 'text-success' : 'text-destructive'}`}
											>
												{element.extracted
													? '1 component'
													: `${element.instances} duplicates`}
											</div>
										</div>
										<pre
											className={`text-xs p-2 rounded ${element.extracted ? 'bg-success/10' : 'bg-destructive/10'}`}
										>
											<code className="text-muted-foreground">
												{element.extracted
													? `<%= render ${element.name.replace(' ', '')}Component.new(...) %>`
													: element.code}
											</code>
										</pre>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={elements
						.filter((e) => e.extracted)
						.map((e) => ({
							filename: `app/components/${e.id}_component.rb`,
							language: 'ruby',
							code: generateComponentCode(e),
							highlight: [2],
						}))}
					learningGoal="ViewComponent extracts UI into testable Ruby classes. Each component has its own template and can be unit tested."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							ViewComponent Benefits
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>+ Unit testable UI</li>
							<li>+ Encapsulated logic & markup</li>
							<li>+ Better performance than partials</li>
							<li>+ Type-safe with Sorbet/RBS</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Usage
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
							{`<%# In any view %>
<%= render AvatarComponent.new(
  user: @user
) %>`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level15ViewComponents;
