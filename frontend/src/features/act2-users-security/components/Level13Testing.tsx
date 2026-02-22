/**
 * Level 12: Testing
 *
 * Learn RSpec testing through a simulated test runner.
 * Player selects test types, picks assertions, and runs a simulated suite.
 * Teaches: Request specs, model specs, policy specs, FactoryBot, assertions.
 */

import {
	Check,
	ChevronRight,
	FileCode,
	FlaskConical,
	Play,
	ShieldCheck,
	Terminal,
	X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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

// --- Types ---

type TestType = 'request' | 'model' | 'policy';

interface TestResult {
	name: string;
	passed: boolean;
	output: string;
}

// --- Constants ---

const TEST_TYPE_META: Record<
	TestType,
	{ label: string; specFile: string; icon: typeof FlaskConical }
> = {
	request: {
		label: 'Request Spec',
		specFile: 'spec/requests/posts_spec.rb',
		icon: Terminal,
	},
	model: {
		label: 'Model Spec',
		specFile: 'spec/models/post_spec.rb',
		icon: FileCode,
	},
	policy: {
		label: 'Policy Spec',
		specFile: 'spec/policies/post_policy_spec.rb',
		icon: ShieldCheck,
	},
};

const ASSERTIONS: Record<TestType, string[]> = {
	request: [
		'Status code check',
		'JSON body structure',
		'Authentication required',
		'Error response format',
	],
	model: [
		'Presence validation',
		'Uniqueness validation',
		'Custom validation',
		'Association check',
	],
	policy: [
		'Owner can update',
		'Non-owner forbidden',
		'Admin can delete',
		'Guest read-only',
	],
};

// Maps assertion names to simulated test output
const ASSERTION_OUTPUT: Record<string, { name: string; output: string }> = {
	// Request spec
	'Status code check': {
		name: 'returns 200 for valid request',
		output:
			'expect(response).to have_http_status(:ok)                           PASSED',
	},
	'JSON body structure': {
		name: 'returns correct JSON structure',
		output:
			'expect(json[:data]).to include(:id, :title, :body, :created_at)     PASSED',
	},
	'Authentication required': {
		name: 'returns 401 without token',
		output:
			'expect(response).to have_http_status(:unauthorized)                 PASSED',
	},
	'Error response format': {
		name: 'returns errors in JSON:API format',
		output:
			'expect(json[:errors].first).to include(:status, :detail)            PASSED',
	},
	// Model spec
	'Presence validation': {
		name: 'is invalid without a title',
		output:
			'expect(post).not_to be_valid                                        PASSED',
	},
	'Uniqueness validation': {
		name: 'enforces unique slugs',
		output:
			'expect(duplicate).not_to be_valid                                   PASSED',
	},
	'Custom validation': {
		name: 'rejects body shorter than 10 chars',
		output:
			'expect(post.errors[:body]).to include("is too short")               PASSED',
	},
	'Association check': {
		name: 'belongs to a user',
		output:
			'expect(Post.reflect_on_association(:user).macro).to eq(:belongs_to) PASSED',
	},
	// Policy spec
	'Owner can update': {
		name: 'permits owner to update',
		output:
			'expect(policy).to permit(:update)                                   PASSED',
	},
	'Non-owner forbidden': {
		name: 'forbids non-owner from updating',
		output:
			'expect(policy).to forbid(:update)                                   PASSED',
	},
	'Admin can delete': {
		name: 'permits admin to destroy',
		output:
			'expect(policy).to permit(:destroy)                                  PASSED',
	},
	'Guest read-only': {
		name: 'permits guest to view only',
		output:
			'expect(policy).to permit(:show)                                     PASSED',
	},
};

// --- Code generators ---

function generateSpecCode(
	testType: TestType,
	selectedAssertions: Set<string>,
): string {
	const assertions = ASSERTIONS[testType];
	const selected = assertions.filter((a) => selectedAssertions.has(a));

	if (testType === 'request') {
		const lines = [
			'require "rails_helper"',
			'',
			'RSpec.describe "Posts API", type: :request do',
			'  let(:user) { create(:user) }',
			'  let(:headers) { auth_headers_for(user) }',
			'  let!(:post) { create(:post, user: user) }',
			'',
		];

		if (selected.includes('Status code check')) {
			lines.push(
				'  it "returns 200 for valid request" do',
				'    get "/api/v1/posts", headers: headers',
				'    expect(response).to have_http_status(:ok)',
				'  end',
				'',
			);
		}
		if (selected.includes('JSON body structure')) {
			lines.push(
				'  it "returns correct JSON structure" do',
				'    get "/api/v1/posts/#{post.id}", headers: headers',
				'    json = JSON.parse(response.body, symbolize_names: true)',
				'    expect(json[:data]).to include(:id, :title, :body, :created_at)',
				'  end',
				'',
			);
		}
		if (selected.includes('Authentication required')) {
			lines.push(
				'  it "returns 401 without token" do',
				'    get "/api/v1/posts"',
				'    expect(response).to have_http_status(:unauthorized)',
				'  end',
				'',
			);
		}
		if (selected.includes('Error response format')) {
			lines.push(
				'  it "returns errors in JSON:API format" do',
				'    post "/api/v1/posts", params: { post: { title: "" } },',
				'                          headers: headers',
				'    json = JSON.parse(response.body, symbolize_names: true)',
				'    expect(json[:errors].first).to include(:status, :detail)',
				'  end',
				'',
			);
		}

		if (selected.length === 0) {
			lines.push('  # Select assertions above to add tests', '');
		}

		lines.push('end');
		return lines.join('\n');
	}

	if (testType === 'model') {
		const lines = [
			'require "rails_helper"',
			'',
			'RSpec.describe Post, type: :model do',
			'  subject { build(:post) }',
			'',
		];

		if (selected.includes('Presence validation')) {
			lines.push(
				'  it "is invalid without a title" do',
				'    post = build(:post, title: nil)',
				'    expect(post).not_to be_valid',
				'    expect(post.errors[:title]).to include("can\'t be blank")',
				'  end',
				'',
			);
		}
		if (selected.includes('Uniqueness validation')) {
			lines.push(
				'  it "enforces unique slugs" do',
				'    create(:post, slug: "hello-world")',
				'    duplicate = build(:post, slug: "hello-world")',
				'    expect(duplicate).not_to be_valid',
				'  end',
				'',
			);
		}
		if (selected.includes('Custom validation')) {
			lines.push(
				'  it "rejects body shorter than 10 chars" do',
				'    post = build(:post, body: "short")',
				'    expect(post).not_to be_valid',
				'    expect(post.errors[:body]).to include("is too short")',
				'  end',
				'',
			);
		}
		if (selected.includes('Association check')) {
			lines.push(
				'  it "belongs to a user" do',
				'    assoc = Post.reflect_on_association(:user)',
				'    expect(assoc.macro).to eq(:belongs_to)',
				'  end',
				'',
			);
		}

		if (selected.length === 0) {
			lines.push('  # Select assertions above to add tests', '');
		}

		lines.push('end');
		return lines.join('\n');
	}

	// policy spec
	const lines = [
		'require "rails_helper"',
		'',
		'RSpec.describe PostPolicy, type: :policy do',
		'  let(:user) { create(:user) }',
		'  let(:admin) { create(:user, :admin) }',
		'  let(:post) { create(:post, user: user) }',
		'',
	];

	if (selected.includes('Owner can update')) {
		lines.push(
			'  it "permits owner to update" do',
			'    policy = described_class.new(user, post)',
			'    expect(policy).to permit(:update)',
			'  end',
			'',
		);
	}
	if (selected.includes('Non-owner forbidden')) {
		lines.push(
			'  it "forbids non-owner from updating" do',
			'    other = create(:user)',
			'    policy = described_class.new(other, post)',
			'    expect(policy).to forbid(:update)',
			'  end',
			'',
		);
	}
	if (selected.includes('Admin can delete')) {
		lines.push(
			'  it "permits admin to destroy" do',
			'    policy = described_class.new(admin, post)',
			'    expect(policy).to permit(:destroy)',
			'  end',
			'',
		);
	}
	if (selected.includes('Guest read-only')) {
		lines.push(
			'  it "permits guest to view only" do',
			'    guest = nil',
			'    policy = described_class.new(guest, post)',
			'    expect(policy).to permit(:show)',
			'  end',
			'',
		);
	}

	if (selected.length === 0) {
		lines.push('  # Select assertions above to add tests', '');
	}

	lines.push('end');
	return lines.join('\n');
}

// --- Component ---

export function Level13Testing({ onComplete }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [selectedTestType, setSelectedTestType] = useState<TestType>('request');
	const [selectedAssertions, setSelectedAssertions] = useState<Set<string>>(
		new Set(),
	);
	const [isRunning, setIsRunning] = useState(false);
	const [testResults, setTestResults] = useState<TestResult[]>([]);
	const [hasRun, setHasRun] = useState(false);
	const [visibleLines, setVisibleLines] = useState(0);
	const terminalRef = useRef<HTMLDivElement>(null);

	const currentAssertions = ASSERTIONS[selectedTestType];
	const meta = TEST_TYPE_META[selectedTestType];

	// Auto-scroll terminal to bottom when new lines appear
	useEffect(() => {
		if (terminalRef.current) {
			terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
		}
	}, [visibleLines]);

	// Toggle an assertion on/off
	const toggleAssertion = useCallback((assertion: string) => {
		setSelectedAssertions((prev) => {
			const next = new Set(prev);
			if (next.has(assertion)) {
				next.delete(assertion);
			} else {
				next.add(assertion);
			}
			return next;
		});
		// Reset run state when assertions change
		setHasRun(false);
		setTestResults([]);
		setVisibleLines(0);
	}, []);

	// Switch test type, clear assertions for that type
	const switchTestType = useCallback((type: TestType) => {
		setSelectedTestType(type);
		setSelectedAssertions(new Set());
		setHasRun(false);
		setTestResults([]);
		setVisibleLines(0);
	}, []);

	// Run the test suite with line-by-line animation
	const runTests = useCallback(() => {
		if (isRunning) return;

		const activeAssertions = currentAssertions.filter((a) =>
			selectedAssertions.has(a),
		);

		if (activeAssertions.length === 0) return;

		setIsRunning(true);
		setVisibleLines(0);
		setHasRun(false);

		// Build results: all tests pass if >= 2 assertions selected
		const allPass = activeAssertions.length >= 2;
		const results: TestResult[] = activeAssertions.map((assertion, idx) => {
			const info = ASSERTION_OUTPUT[assertion];
			const passed = allPass || idx < activeAssertions.length - 1;
			return {
				name: info.name,
				passed,
				output: passed ? info.output : info.output.replace('PASSED', 'FAILED'),
			};
		});

		setTestResults(results);

		// Animate lines appearing one by one
		// Header lines (3) + one line per result + summary line
		const totalLines = 3 + results.length + 2;
		let currentLine = 0;

		const interval = setInterval(() => {
			currentLine += 1;
			setVisibleLines(currentLine);
			if (currentLine >= totalLines) {
				clearInterval(interval);
				setIsRunning(false);
				setHasRun(true);
			}
		}, 280);
	}, [isRunning, currentAssertions, selectedAssertions]);

	// Reset everything
	const handleReset = useCallback(() => {
		setSelectedTestType('request');
		setSelectedAssertions(new Set());
		setIsRunning(false);
		setTestResults([]);
		setHasRun(false);
		setVisibleLines(0);
	}, []);

	// Validation
	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		const activeAssertions = currentAssertions.filter((a) =>
			selectedAssertions.has(a),
		);

		if (activeAssertions.length < 2) {
			errors.push(
				`Select at least 2 assertions (currently ${activeAssertions.length})`,
			);
		}

		if (!hasRun) {
			errors.push('Run your test suite before submitting');
		}

		if (hasRun && testResults.some((r) => !r.passed)) {
			errors.push(
				'Some tests are failing. Select at least 2 assertions for all to pass.',
			);
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Tests not passing yet!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'All tests green! Your test suite is ready.',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act2-level13-testing', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	// Build terminal output lines
	const buildTerminalLines = (): Array<{
		text: string;
		className: string;
	}> => {
		const lines: Array<{ text: string; className: string }> = [];

		// Header
		lines.push({
			text: `$ bundle exec rspec ${meta.specFile}`,
			className: 'text-muted-foreground',
		});
		lines.push({ text: '', className: '' });
		lines.push({
			text: `Running ${meta.label}...`,
			className: 'text-foreground',
		});

		// Results
		for (const result of testResults) {
			if (result.passed) {
				lines.push({
					text: `  ${result.output}`,
					className: 'text-success',
				});
			} else {
				lines.push({
					text: `  ${result.output}`,
					className: 'text-destructive',
				});
			}
		}

		// Summary
		if (testResults.length > 0) {
			lines.push({ text: '', className: '' });
			const passed = testResults.filter((r) => r.passed).length;
			const failed = testResults.filter((r) => !r.passed).length;
			if (failed === 0) {
				lines.push({
					text: `${passed} example${passed !== 1 ? 's' : ''}, 0 failures`,
					className: 'text-success font-bold',
				});
			} else {
				lines.push({
					text: `${testResults.length} example${testResults.length !== 1 ? 's' : ''}, ${failed} failure${failed !== 1 ? 's' : ''}`,
					className: 'text-destructive font-bold',
				});
			}
		}

		return lines;
	};

	const terminalLines = buildTerminalLines();
	const activeAssertionCount = currentAssertions.filter((a) =>
		selectedAssertions.has(a),
	).length;
	const allPassing =
		hasRun && testResults.length > 0 && testResults.every((r) => r.passed);

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Write tests that catch bugs before they reach production."
					instructions={[
						'Choose a test type (request, model, or policy spec)',
						'Select assertions to verify behavior',
						'Run your test suite',
						'Make sure all tests pass green',
					]}
					scenario="Your API has grown across Act 1: models, routes, controllers, associations, authorization. But there are zero tests. A deploy broke the login endpoint and nobody noticed for 3 hours."
				/>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="Testing"
					levelNumber={13}
					onComplete={handleComplete}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto">
						{/* Test Controls */}
						<div className="mb-6 space-y-4">
							{/* Test Type + Run */}
							<div className="flex items-center gap-3">
								{(Object.keys(TEST_TYPE_META) as TestType[]).map((type) => {
									const typeMeta = TEST_TYPE_META[type];
									const IconComponent = typeMeta.icon;
									const isActive = selectedTestType === type;
									return (
										<Button
											className={`gap-2 text-sm ${
												isActive
													? 'bg-primary/10 border-primary text-foreground'
													: 'text-muted-foreground'
											}`}
											key={type}
											onClick={() => switchTestType(type)}
											size="sm"
											variant={isActive ? 'outline' : 'ghost'}
										>
											<IconComponent className="w-4 h-4 shrink-0" />
											{typeMeta.label}
										</Button>
									);
								})}

								<div className="ml-auto">
									<Button
										className="gap-2"
										disabled={isRunning || activeAssertionCount === 0}
										onClick={runTests}
										size="sm"
										variant={allPassing ? 'secondary' : 'default'}
									>
										{isRunning ? (
											<>
												<FlaskConical className="w-4 h-4 animate-pulse" />
												Running...
											</>
										) : (
											<>
												<Play className="w-4 h-4" />
												Run Tests
											</>
										)}
									</Button>
								</div>
							</div>

							{/* Assertions */}
							<div className="flex flex-wrap gap-2">
								{currentAssertions.map((assertion) => {
									const isSelected = selectedAssertions.has(assertion);
									return (
										<Button
											className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
												isSelected
													? 'bg-primary/15 border-primary text-primary'
													: 'bg-secondary border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
											}`}
											key={assertion}
											onClick={() => toggleAssertion(assertion)}
										>
											{isSelected && (
												<Check className="w-3 h-3 inline-block mr-1 -mt-0.5" />
											)}
											{assertion}
										</Button>
									);
								})}
								<span className="text-xs text-muted-foreground self-center ml-1">
									({activeAssertionCount} selected)
								</span>
							</div>
						</div>

						{/* Terminal Header */}
						<div className="bg-card rounded-t-xl border border-border border-b-0">
							<div className="flex items-center gap-2 px-4 py-2.5">
								<div className="flex gap-1.5">
									<div className="w-3 h-3 rounded-full bg-destructive" />
									<div className="w-3 h-3 rounded-full bg-warning" />
									<div className="w-3 h-3 rounded-full bg-success" />
								</div>
								<div className="flex items-center gap-2 ml-3 text-xs text-muted-foreground font-mono">
									<Terminal className="w-3.5 h-3.5" />
									rspec -- {meta.specFile}
								</div>
							</div>
						</div>

						{/* Terminal Body */}
						<div
							className="bg-[#0d1117] rounded-b-xl border border-border border-t-0 p-4 font-mono text-sm min-h-[320px] max-h-[480px] overflow-y-auto"
							ref={terminalRef}
						>
							{testResults.length === 0 && !isRunning ? (
								<div className="text-muted-foreground/50 flex flex-col items-center justify-center min-h-[280px] gap-3">
									<FlaskConical className="w-10 h-10" />
									<div className="text-center">
										<div className="text-sm">No test results yet</div>
										<div className="text-xs mt-1">
											Select assertions and click Run Tests
										</div>
									</div>
								</div>
							) : (
								<div className="space-y-1">
									{terminalLines.map((line, idx) => {
										if (idx >= visibleLines) return null;
										return (
											<div
												className={`${line.className} leading-relaxed`}
												key={`line-${idx}-${line.text.slice(0, 20)}`}
											>
												{line.text || '\u00A0'}
											</div>
										);
									})}
									{isRunning && (
										<span className="inline-block w-2 h-4 bg-foreground animate-pulse" />
									)}
								</div>
							)}
						</div>

						{/* Test Result Cards */}
						{hasRun && testResults.length > 0 && (
							<div className="mt-6 space-y-2">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
									Test Results Detail
								</div>
								{testResults.map((result) => (
									<div
										className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
											result.passed
												? 'bg-success/5 border-success/30'
												: 'bg-destructive/5 border-destructive/30'
										}`}
										key={result.name}
									>
										{result.passed ? (
											<Check className="w-4 h-4 text-success shrink-0" />
										) : (
											<X className="w-4 h-4 text-destructive shrink-0" />
										)}
										<span
											className={`text-sm ${result.passed ? 'text-success' : 'text-destructive'}`}
										>
											{result.name}
										</span>
										<ChevronRight className="w-3 h-3 text-muted-foreground ml-auto" />
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: meta.specFile,
							language: 'ruby',
							code: generateSpecCode(selectedTestType, selectedAssertions),
							highlight: (() => {
								// Highlight assertion lines (the expect lines)
								const code = generateSpecCode(
									selectedTestType,
									selectedAssertions,
								);
								const lines = code.split('\n');
								const highlighted: number[] = [];
								for (let i = 0; i < lines.length; i++) {
									if (lines[i].includes('expect(')) {
										highlighted.push(i + 1);
									}
								}
								return highlighted;
							})(),
						},
						{
							filename: 'spec/factories/posts.rb',
							language: 'ruby',
							code: `FactoryBot.define do
  factory :post do
    title { Faker::Lorem.sentence }
    body { Faker::Lorem.paragraph(sentence_count: 5) }
    slug { Faker::Internet.slug }
    association :user

    trait :published do
      status { "published" }
      published_at { Time.current }
    end
  end
end`,
							highlight: [3, 4, 5, 6],
						},
					]}
					learningGoal="Testing is not optional. Request specs are your highest-value tests for APIs -- they test the full HTTP request/response cycle."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-2">
							<li className="flex items-start gap-2">
								<Terminal className="w-3 h-3 mt-0.5 text-primary shrink-0" />
								<span>Request specs test full HTTP cycle</span>
							</li>
							<li className="flex items-start gap-2">
								<FileCode className="w-3 h-3 mt-0.5 text-success shrink-0" />
								<span>FactoryBot creates test data</span>
							</li>
							<li className="flex items-start gap-2">
								<FlaskConical className="w-3 h-3 mt-0.5 text-purple-400 shrink-0" />
								<span>Test behavior, not implementation</span>
							</li>
							<li className="flex items-start gap-2">
								<ShieldCheck className="w-3 h-3 mt-0.5 text-warning shrink-0" />
								<span>One happy path + edge cases per endpoint</span>
							</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level13Testing;
