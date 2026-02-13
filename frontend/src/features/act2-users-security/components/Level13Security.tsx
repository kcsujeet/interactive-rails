/**
 * Level 13: Security
 *
 * Fix four security findings: CORS, credentials, rate limiting, strong params.
 * Player categorizes and fixes each security issue.
 * Teaches: rack-cors, Rails credentials, Rails 8 rate_limit, params.expect
 */

import {
	AlertTriangle,
	Check,
	Globe,
	KeyRound,
	Lock,
	Shield,
	Timer,
} from 'lucide-react';
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

interface SecurityFinding {
	id: string;
	name: string;
	description: string;
	severity: 'critical' | 'high';
	status: 'open' | 'fixed';
	fix: string;
	icon: 'globe' | 'key' | 'timer' | 'shield';
}

const INITIAL_FINDINGS: SecurityFinding[] = [
	{
		id: 'cors',
		name: 'No CORS Headers',
		description:
			'Browser requests from the React frontend fail with "blocked by CORS policy." The API has no Cross-Origin Resource Sharing configured.',
		severity: 'critical',
		status: 'open',
		fix: 'Configure rack-cors to allow the frontend origin',
		icon: 'globe',
	},
	{
		id: 'credentials',
		name: 'Hardcoded Secrets',
		description:
			'Stripe and SendGrid API keys are hardcoded in initializers and committed to git. Anyone with repo access can see them.',
		severity: 'critical',
		status: 'open',
		fix: 'Move to Rails encrypted credentials',
		icon: 'key',
	},
	{
		id: 'rate_limit',
		name: 'No Rate Limiting',
		description:
			'The login endpoint can be brute-forced with no limit. An attacker can try 10,000 passwords per second.',
		severity: 'high',
		status: 'open',
		fix: 'Add Rails 8 built-in rate_limit',
		icon: 'timer',
	},
	{
		id: 'strong_params',
		name: 'Unfiltered Params',
		description:
			'Some controllers use params[:post] directly without filtering. Users could send { post: { user_id: 999 } } to reassign ownership.',
		severity: 'high',
		status: 'open',
		fix: 'Use Rails 8 params.expect for strict filtering',
		icon: 'shield',
	},
];

const ICON_MAP = {
	globe: Globe,
	key: KeyRound,
	timer: Timer,
	shield: Shield,
};

export function Level13Security({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [findings, setFindings] = useState<SecurityFinding[]>(INITIAL_FINDINGS);
	const [selectedFinding, setSelectedFinding] = useState<string | null>(null);

	const fixedCount = findings.filter((f) => f.status === 'fixed').length;
	const openCount = findings.filter((f) => f.status === 'open').length;

	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		const openFindings = findings.filter((f) => f.status === 'open');
		if (openFindings.length > 0) {
			errors.push(`${openFindings.length} security finding(s) still unfixed`);
			for (const f of openFindings) {
				errors.push(`  - ${f.name}: ${f.fix}`);
			}
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Security vulnerabilities remain!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'All security findings resolved!',
		};
	};

	const fixFinding = (findingId: string) => {
		setFindings((prev) =>
			prev.map((f) =>
				f.id === findingId ? { ...f, status: 'fixed' as const } : f,
			),
		);
		setSelectedFinding(null);
	};

	const handleComplete = async () => {
		const success = await completeLevel('act2-level14-security', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const selected = findings.find((f) => f.id === selectedFinding);

	const generateCodePreview = () => {
		const corsFixed = findings.find((f) => f.id === 'cors')?.status === 'fixed';
		const credentialsFixed =
			findings.find((f) => f.id === 'credentials')?.status === 'fixed';
		const rateLimitFixed =
			findings.find((f) => f.id === 'rate_limit')?.status === 'fixed';
		const strongParamsFixed =
			findings.find((f) => f.id === 'strong_params')?.status === 'fixed';

		const files = [];

		files.push({
			filename: 'config/initializers/cors.rb',
			language: 'ruby',
			code: corsFixed
				? `# rack-cors configuration
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins "https://yourdomain.com", "http://localhost:3001"
    resource "/api/*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options],
      expose: ["Authorization"],
      max_age: 600
  end
end`
				: `# CORS NOT CONFIGURED
# Browser console:
# "Access to XMLHttpRequest has been blocked by CORS policy"
# The React frontend cannot call the API!`,
			highlight: corsFixed ? [4, 5] : [],
		});

		if (credentialsFixed) {
			files.push({
				filename: 'config/credentials.yml.enc',
				language: 'ruby',
				code: `# Encrypted with master key (never commit master.key!)
# Edit: EDITOR=vim bin/rails credentials:edit

stripe:
  api_key: sk_live_abc123...
  webhook_secret: whsec_xyz...
sendgrid:
  api_key: SG.abc123...

# Access in code:
# Rails.application.credentials.dig(:stripe, :api_key)`,
				highlight: [4, 5, 7, 8],
			});
		}

		if (rateLimitFixed) {
			files.push({
				filename: 'app/controllers/api/v1/sessions_controller.rb',
				language: 'ruby',
				code: `class Api::V1::SessionsController < ApplicationController
  # Rails 8 built-in rate limiting
  rate_limit to: 10, within: 3.minutes, only: :create,
    with: -> {
      render json: { error: "Too many attempts. Try again later." },
             status: :too_many_requests
    }

  def create
    user = User.authenticate_by(
      email: params[:email],
      password: params[:password]
    )
    if user
      session = user.sessions.create!
      render json: { token: session.token }, status: :created
    else
      render json: { error: "Invalid credentials" }, status: :unauthorized
    end
  end
end`,
				highlight: [2, 3],
			});
		}

		if (strongParamsFixed) {
			files.push({
				filename: 'app/controllers/api/v1/posts_controller.rb',
				language: 'ruby',
				code: `class Api::V1::PostsController < ApplicationController
  # Rails 8 rate limiting for mutations
  rate_limit to: 100, within: 1.minute, only: [:create, :update]

  private

  def post_params
    # Rails 8: params.expect -- safer than require/permit
    # Returns 400 (not 500) on tampered params
    params.expect(post: [:title, :body, :status])
  end
end`,
				highlight: [9, 10],
			});
		}

		return files;
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					{/* Audit Results */}
					<div className="p-4">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Security Audit Results
						</div>
						<div
							className={`p-3 rounded-lg mb-4 ${
								openCount > 0
									? 'bg-destructive/20 border border-destructive'
									: 'bg-success/20 border border-success'
							}`}
						>
							{openCount > 0 ? (
								<div className="flex items-center gap-2 text-destructive text-sm">
									<AlertTriangle className="w-4 h-4" />
									{openCount} critical finding(s) remain
								</div>
							) : (
								<div className="flex items-center gap-2 text-success text-sm">
									<Check className="w-4 h-4" />
									All findings resolved
								</div>
							)}
						</div>

						{/* Findings List */}
						<div className="space-y-2">
							{findings.map((finding) => {
								const Icon = ICON_MAP[finding.icon];
								return (
									<button
										className={`w-full p-3 rounded-lg text-left transition-all border ${
											finding.status === 'fixed'
												? 'bg-success/10 border-success/50'
												: selectedFinding === finding.id
													? 'bg-primary/10 border-primary'
													: 'bg-card border-border hover:border-muted-foreground'
										}`}
										key={finding.id}
										onClick={() =>
											finding.status === 'open' &&
											setSelectedFinding(finding.id)
										}
										type="button"
									>
										<div className="flex items-center gap-2">
											<Icon
												className={`w-4 h-4 ${
													finding.status === 'fixed'
														? 'text-success'
														: 'text-destructive'
												}`}
											/>
											<span
												className={`text-sm font-medium ${
													finding.status === 'fixed'
														? 'text-success line-through'
														: 'text-foreground'
												}`}
											>
												{finding.name}
											</span>
											<span
												className={`text-xs px-1.5 py-0.5 rounded ml-auto ${
													finding.status === 'fixed'
														? 'bg-success/20 text-success'
														: finding.severity === 'critical'
															? 'bg-destructive/20 text-destructive'
															: 'bg-warning/20 text-warning'
												}`}
											>
												{finding.status === 'fixed'
													? 'Fixed'
													: finding.severity}
											</span>
										</div>
									</button>
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
							<span className="text-muted-foreground">Findings fixed</span>
							<span
								className={
									fixedCount === findings.length
										? 'text-success'
										: 'text-foreground'
								}
							>
								{fixedCount} / {findings.length}
							</span>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all duration-300"
								style={{
									width: `${(fixedCount / findings.length) * 100}%`,
								}}
							/>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="Security"
					levelNumber={14}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setFindings(INITIAL_FINDINGS);
						setSelectedFinding(null);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-8 overflow-auto">
					{selected ? (
						<div className="max-w-2xl mx-auto">
							{/* Finding Detail Card */}
							<div className="bg-card rounded-xl border-2 border-destructive overflow-hidden">
								<div className="bg-destructive/10 px-6 py-4 border-b border-destructive/30">
									<div className="flex items-center gap-3">
										{(() => {
											const Icon = ICON_MAP[selected.icon];
											return <Icon className="w-6 h-6 text-destructive" />;
										})()}
										<div>
											<div className="text-foreground font-semibold text-lg">
												{selected.name}
											</div>
											<span className="text-xs px-2 py-0.5 rounded bg-destructive/20 text-destructive">
												{selected.severity}
											</span>
										</div>
									</div>
								</div>

								<div className="p-6 space-y-4">
									<div>
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
											Description
										</div>
										<p className="text-sm text-foreground">
											{selected.description}
										</p>
									</div>

									<div>
										<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
											Required Fix
										</div>
										<p className="text-sm text-primary font-medium">
											{selected.fix}
										</p>
									</div>

									<Button
										className="w-full"
										onClick={() => fixFinding(selected.id)}
									>
										<Lock className="w-4 h-4 mr-2" />
										Apply Fix
									</Button>
								</div>
							</div>
						</div>
					) : (
						<div className="max-w-3xl mx-auto">
							{/* Overview Grid */}
							<div className="text-center mb-8">
								<div className="text-muted-foreground text-sm">
									{openCount > 0
										? 'Select a finding from the left panel to review and fix it'
										: 'All security findings have been resolved!'}
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								{findings.map((finding) => {
									const Icon = ICON_MAP[finding.icon];
									return (
										<div
											className={`p-5 rounded-xl border-2 transition-all ${
												finding.status === 'fixed'
													? 'border-success/50 bg-success/5'
													: 'border-destructive/50 bg-destructive/5'
											}`}
											key={finding.id}
										>
											<div className="flex items-center gap-3 mb-3">
												<div
													className={`w-10 h-10 rounded-lg flex items-center justify-center ${
														finding.status === 'fixed'
															? 'bg-success/20'
															: 'bg-destructive/20'
													}`}
												>
													{finding.status === 'fixed' ? (
														<Check className="w-5 h-5 text-success" />
													) : (
														<Icon className="w-5 h-5 text-destructive" />
													)}
												</div>
												<div className="text-foreground font-medium">
													{finding.name}
												</div>
											</div>
											<p className="text-xs text-muted-foreground line-clamp-2">
												{finding.status === 'fixed'
													? finding.fix
													: finding.description}
											</p>
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel files={generateCodePreview()} />
			</RightPanel>
		</LevelLayout>
	);
}

export default Level13Security;
