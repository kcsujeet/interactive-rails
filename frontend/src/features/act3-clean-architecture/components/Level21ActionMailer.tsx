/**
 * Level 20: Action Mailer
 *
 * Build a secure password reset email flow with Action Mailer.
 * Teaches: Action Mailer, generates_token_for, deliver_later, stateless tokens
 */

import {
	Check,
	Clock,
	Key,
	Mail,
	Send,
	Server,
	ShieldCheck,
	Timer,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';

interface EmailComponent {
	id: string;
	label: string;
	description: string;
	icon: typeof Mail;
	color: string;
}

const EMAIL_COMPONENTS: EmailComponent[] = [
	{
		id: 'from',
		label: 'From Address',
		description: 'noreply@app.com',
		icon: Mail,
		color: '#3b82f6',
	},
	{
		id: 'subject',
		label: 'Subject Line',
		description: 'Reset your password',
		icon: Mail,
		color: '#8b5cf6',
	},
	{
		id: 'tokenGeneration',
		label: 'Token Generation',
		description: 'generates_token_for :password_reset',
		icon: Key,
		color: '#f59e0b',
	},
	{
		id: 'resetLink',
		label: 'Reset Link',
		description: 'Include reset URL with token',
		icon: Send,
		color: '#22c55e',
	},
	{
		id: 'expiryNotice',
		label: 'Expiry Notice',
		description: '15-minute expiry warning',
		icon: Clock,
		color: '#ef4444',
	},
	{
		id: 'deliverLater',
		label: 'Background Delivery',
		description: 'deliver_later (not deliver_now)',
		icon: Timer,
		color: '#06b6d4',
	},
];

const DELIVERY_STEPS = [
	{ label: 'Mailer', icon: Mail, color: '#3b82f6' },
	{ label: 'Job Queue', icon: Timer, color: '#f59e0b' },
	{ label: 'SMTP', icon: Server, color: '#8b5cf6' },
	{ label: 'Delivered', icon: Check, color: '#22c55e' },
];

type SelectedMailer = 'password_reset' | 'welcome';

export function Level21ActionMailer({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [emailComponents, setEmailComponents] = useState<
		Record<string, boolean>
	>({
		from: false,
		subject: false,
		tokenGeneration: false,
		resetLink: false,
		expiryNotice: false,
		deliverLater: false,
	});
	const [emailSent, setEmailSent] = useState(false);
	const [deliveryStep, setDeliveryStep] = useState(0);
	const [selectedMailer, setSelectedMailer] =
		useState<SelectedMailer>('password_reset');
	const deliveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const enabledCount = Object.values(emailComponents).filter(Boolean).length;
	const canSend = enabledCount >= 4;

	// Clean up delivery timer on unmount
	useEffect(() => {
		return () => {
			if (deliveryTimerRef.current) {
				clearTimeout(deliveryTimerRef.current);
			}
		};
	}, []);

	const toggleComponent = (id: string) => {
		setEmailComponents((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	const handleSendEmail = () => {
		if (!canSend || deliveryStep > 0) return;
		setDeliveryStep(1);

		const advanceStep = (step: number) => {
			if (step > 4) {
				setEmailSent(true);
				return;
			}
			deliveryTimerRef.current = setTimeout(() => {
				setDeliveryStep(step);
				advanceStep(step + 1);
			}, 500);
		};

		advanceStep(2);
	};

	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		if (enabledCount < 5) {
			errors.push(`Configure at least 5 email components (${enabledCount}/5)`);
		}

		if (!emailSent) {
			errors.push('Send the test email to verify the flow');
		}

		if (!emailComponents.deliverLater) {
			errors.push('Use deliver_later for background sending');
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Email flow incomplete!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'Secure password reset flow with Action Mailer!',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act3-level21-action-mailer', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const handleReset = () => {
		setEmailComponents({
			from: false,
			subject: false,
			tokenGeneration: false,
			resetLink: false,
			expiryNotice: false,
			deliverLater: false,
		});
		setEmailSent(false);
		setDeliveryStep(0);
		setSelectedMailer('password_reset');
		if (deliveryTimerRef.current) {
			clearTimeout(deliveryTimerRef.current);
		}
	};

	const generateMailerCode = () => {
		const lines: string[] = ['class UserMailer < ApplicationMailer'];

		if (emailComponents.from) {
			lines.push('  default from: "noreply@app.com"');
			lines.push('');
		}

		lines.push('  def password_reset(user)');
		lines.push('    @user = user');

		if (emailComponents.tokenGeneration) {
			lines.push('    @token = user.generate_token_for(:password_reset)');
		}

		if (emailComponents.resetLink) {
			lines.push('    @reset_url = edit_password_url(token: @token)');
		}

		lines.push('');

		const mailArgs: string[] = [];
		mailArgs.push('to: user.email');
		if (emailComponents.subject) {
			mailArgs.push('subject: "Reset your password"');
		}

		lines.push(`    mail(${mailArgs.join(', ')})`);
		lines.push('  end');
		lines.push('end');

		return lines.join('\n');
	};

	const generateModelCode = () => {
		const lines: string[] = ['class User < ApplicationRecord'];
		lines.push('  has_secure_password');
		lines.push('');

		if (emailComponents.tokenGeneration) {
			lines.push('  generates_token_for :password_reset,');
			lines.push('                      expires_in: 15.minutes do');
			lines.push('    password_salt&.last(10)');
			lines.push('  end');
		} else {
			lines.push('  # Add token generation here');
		}

		lines.push('end');
		return lines.join('\n');
	};

	// Security checklist items
	const securityChecks = [
		{
			label: 'Same response for existing/non-existing emails',
			met: emailComponents.from && emailComponents.subject,
		},
		{
			label: 'Token expires in 15 minutes',
			met: emailComponents.expiryNotice && emailComponents.tokenGeneration,
		},
		{
			label: 'Token invalidated when password changes',
			met: emailComponents.tokenGeneration,
		},
	];

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Build a secure password reset flow with Action Mailer and generates_token_for."
					instructions={[
						'Configure the email sender and subject',
						'Add token generation with generates_token_for',
						'Include reset link and expiry notice',
						'Use deliver_later for background sending',
					]}
					scenario="Users who forget their passwords are completely locked out. Support tickets are piling up. You need a self-service password reset flow."
				>
					<div className="p-4">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Email Components
						</div>
						<div className="space-y-2">
							{EMAIL_COMPONENTS.map((comp) => (
								<OptionCard
									color={resolveColor(comp.color)}
									description={comp.description}
									icon={comp.icon}
									key={comp.id}
									name={comp.label}
									onClick={() => toggleComponent(comp.id)}
									selected={emailComponents[comp.id]}
									size="lg"
								/>
							))}
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">
								Components configured
							</span>
							<span
								className={
									enabledCount >= 5 ? 'text-success' : 'text-foreground'
								}
							>
								{enabledCount} / 6
							</span>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all"
								style={{
									width: `${(enabledCount / 6) * 100}%`,
								}}
							/>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="Action Mailer"
					levelNumber={21}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-2xl mx-auto space-y-6">
						{/* Mailer tabs */}
						<div className="flex gap-2">
							<Button
								className={`text-sm ${
									selectedMailer === 'password_reset'
										? 'bg-primary text-primary-foreground'
										: ''
								}`}
								onClick={() => setSelectedMailer('password_reset')}
								size="sm"
								variant={
									selectedMailer === 'password_reset' ? 'default' : 'outline'
								}
							>
								<Key className="w-3.5 h-3.5 mr-1.5" />
								Password Reset
							</Button>
							<Button
								className={`text-sm ${
									selectedMailer === 'welcome'
										? 'bg-primary text-primary-foreground'
										: ''
								}`}
								onClick={() => setSelectedMailer('welcome')}
								size="sm"
								variant={selectedMailer === 'welcome' ? 'default' : 'outline'}
							>
								<Mail className="w-3.5 h-3.5 mr-1.5" />
								Welcome Email
							</Button>
						</div>

						{/* Email Preview */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center gap-2">
								<Mail className="w-4 h-4 text-primary" />
								<div>
									<div className="text-foreground font-semibold text-sm">
										{selectedMailer === 'password_reset'
											? 'Password Reset Email'
											: 'Welcome Email'}
									</div>
									<div className="text-xs text-muted-foreground">Preview</div>
								</div>
							</div>

							<div className="p-5 space-y-4">
								{/* From field */}
								<div className="flex items-center gap-3">
									<span className="text-xs text-muted-foreground w-16 shrink-0">
										From:
									</span>
									{emailComponents.from ? (
										<span className="text-sm text-foreground font-medium">
											noreply@app.com
										</span>
									) : (
										<div className="flex-1 h-5 border-2 border-dashed border-border rounded" />
									)}
								</div>

								{/* To field */}
								<div className="flex items-center gap-3">
									<span className="text-xs text-muted-foreground w-16 shrink-0">
										To:
									</span>
									<span className="text-sm text-muted-foreground">
										user@example.com
									</span>
								</div>

								{/* Subject field */}
								<div className="flex items-center gap-3">
									<span className="text-xs text-muted-foreground w-16 shrink-0">
										Subject:
									</span>
									{emailComponents.subject ? (
										<span className="text-sm text-foreground font-semibold">
											Reset your password
										</span>
									) : (
										<div className="flex-1 h-5 border-2 border-dashed border-border rounded" />
									)}
								</div>

								<div className="border-t border-border" />

								{/* Email body */}
								<div className="space-y-3">
									<p className="text-sm text-muted-foreground">Hi there,</p>
									<p className="text-sm text-muted-foreground">
										{selectedMailer === 'password_reset'
											? 'Someone requested a password reset for your account.'
											: 'Welcome to our app! We are glad to have you.'}
									</p>

									{/* Token generation section */}
									{selectedMailer === 'password_reset' && (
										<>
											{emailComponents.tokenGeneration ? (
												<div className="bg-warning/10 border border-warning/30 rounded-lg px-4 py-3 flex items-start gap-3">
													<Key className="w-4 h-4 text-warning shrink-0 mt-0.5" />
													<div>
														<div className="text-xs font-semibold text-warning">
															Secure Token
														</div>
														<code className="text-xs text-muted-foreground font-mono">
															generates_token_for :password_reset
														</code>
													</div>
												</div>
											) : (
												<div className="h-14 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
													<span className="text-xs text-muted-foreground">
														Token generation
													</span>
												</div>
											)}

											{/* Reset link */}
											{emailComponents.resetLink ? (
												<div className="bg-primary/10 border border-primary/30 rounded-lg px-4 py-3">
													<div className="flex items-center gap-2 mb-1">
														<Send className="w-3.5 h-3.5 text-primary" />
														<span className="text-xs font-semibold text-primary">
															Reset Link
														</span>
													</div>
													<code className="text-xs text-primary/80 font-mono break-all">
														https://app.com/passwords/edit?token=eyJfcm...
													</code>
												</div>
											) : (
												<div className="h-14 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
													<span className="text-xs text-muted-foreground">
														Reset link
													</span>
												</div>
											)}

											{/* Expiry notice */}
											{emailComponents.expiryNotice ? (
												<div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 flex items-center gap-3">
													<Clock className="w-4 h-4 text-destructive shrink-0" />
													<span className="text-xs text-destructive">
														This link expires in 15 minutes. If you did not
														request this, ignore this email.
													</span>
												</div>
											) : (
												<div className="h-10 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
													<span className="text-xs text-muted-foreground">
														Expiry notice
													</span>
												</div>
											)}
										</>
									)}
								</div>
							</div>
						</div>

						{/* Send Test Email */}
						<Button
							className={`w-full py-3 ${
								emailSent
									? 'bg-success hover:bg-success/90 text-foreground'
									: ''
							}`}
							disabled={!canSend || (deliveryStep > 0 && !emailSent)}
							onClick={handleSendEmail}
							variant={emailSent ? 'default' : 'default'}
						>
							{emailSent ? (
								<>
									<Check className="w-4 h-4 mr-2" />
									Email Sent Successfully
								</>
							) : deliveryStep > 0 ? (
								<>
									<Mail className="w-4 h-4 mr-2 animate-pulse" />
									Sending...
								</>
							) : (
								<>
									<Send className="w-4 h-4 mr-2" />
									Send Test Email
									{!canSend && (
										<span className="ml-2 text-xs opacity-70">
											(configure {4 - enabledCount} more)
										</span>
									)}
								</>
							)}
						</Button>

						{/* Delivery Animation */}
						{deliveryStep > 0 && (
							<div className="bg-card rounded-xl border border-border p-5">
								<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
									{emailComponents.deliverLater
										? 'Background Delivery Pipeline'
										: 'Synchronous Delivery (blocking request)'}
								</div>
								<div className="flex items-center justify-between">
									{DELIVERY_STEPS.map((step, index) => {
										const Icon = step.icon;
										const stepNum = index + 1;
										const isActive = deliveryStep >= stepNum;
										const isCurrent = deliveryStep === stepNum;
										return (
											<div
												className="flex items-center flex-1"
												key={step.label}
											>
												<div className="flex flex-col items-center">
													<div
														className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
															isActive
																? 'border-transparent'
																: 'border-border bg-secondary'
														} ${isCurrent ? 'animate-pulse' : ''}`}
														style={
															isActive
																? {
																		backgroundColor: `${step.color}20`,
																		borderColor: step.color,
																	}
																: undefined
														}
													>
														<Icon
															className={`w-5 h-5 transition-colors ${
																isActive ? '' : 'text-muted-foreground'
															}`}
															style={
																isActive
																	? {
																			color: step.color,
																		}
																	: undefined
															}
														/>
													</div>
													<span
														className={`text-xs mt-1.5 font-medium ${
															isActive
																? 'text-foreground'
																: 'text-muted-foreground'
														}`}
													>
														{step.label}
													</span>
												</div>
												{index < DELIVERY_STEPS.length - 1 && (
													<div className="flex-1 mx-2">
														<div
															className={`h-0.5 transition-all ${
																deliveryStep > stepNum
																	? 'bg-success'
																	: 'bg-border'
															}`}
														/>
													</div>
												)}
											</div>
										);
									})}
								</div>
							</div>
						)}

						{/* Security Checklist */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center gap-2">
								<ShieldCheck className="w-4 h-4 text-primary" />
								<div className="text-foreground font-semibold text-sm">
									Security Checklist
								</div>
							</div>
							<div className="p-4 space-y-3">
								{securityChecks.map((check) => (
									<div className="flex items-center gap-3" key={check.label}>
										<div
											className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
												check.met ? 'bg-success/20' : 'bg-secondary'
											}`}
										>
											{check.met ? (
												<Check className="w-3 h-3 text-success" />
											) : (
												<div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
											)}
										</div>
										<span
											className={`text-sm ${
												check.met ? 'text-foreground' : 'text-muted-foreground'
											}`}
										>
											{check.label}
										</span>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/mailers/user_mailer.rb',
							language: 'ruby',
							code: generateMailerCode(),
							highlight: emailComponents.deliverLater ? [] : [],
						},
						{
							filename: 'app/models/user.rb',
							language: 'ruby',
							code: generateModelCode(),
							highlight: emailComponents.tokenGeneration ? [4, 5, 6, 7] : [],
						},
					]}
					learningGoal="Action Mailer + generates_token_for gives you secure, stateless password resets. No token column needed: the token auto-expires when the password changes."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-1.5">
							<li className="flex items-start gap-2">
								<Key className="w-3 h-3 text-warning shrink-0 mt-0.5" />
								<span>generates_token_for: stateless, expiring tokens</span>
							</li>
							<li className="flex items-start gap-2">
								<Timer className="w-3 h-3 text-primary shrink-0 mt-0.5" />
								<span>deliver_later: always use background jobs</span>
							</li>
							<li className="flex items-start gap-2">
								<Mail className="w-3 h-3 text-success shrink-0 mt-0.5" />
								<span>Mailers are like controllers for email</span>
							</li>
							<li className="flex items-start gap-2">
								<Server className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
								<span>Preview at /rails/mailers in development</span>
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Controller Usage
						</div>
						<pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
							{`# POST /passwords
def create
  user = User.find_by(email: params[:email])

  # Always respond the same way!
  # (prevents email enumeration)
  if user
    UserMailer
      .password_reset(user)
      .${emailComponents.deliverLater ? 'deliver_later' : 'deliver_now'}
  end

  redirect_to root_path,
    notice: "Check your email."
end`}
						</pre>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level21ActionMailer;
