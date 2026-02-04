/**
 * Level 11: Authorization
 *
 * Policy node blocks unauthorized requests.
 * Shows Pundit-style authorization with visual filtering.
 */

import { useEffect, useState } from 'react';
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

interface Request {
	id: number;
	x: number;
	y: number;
	type: 'admin' | 'user' | 'hacker';
	action: 'view' | 'delete';
	blocked: boolean;
}

export function Level11Authorization({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [policyAdded, setPolicyAdded] = useState(false);
	const [requests, setRequests] = useState<Request[]>([]);
	const [blockedCount, setBlockedCount] = useState(0);
	const [allowedCount, setAllowedCount] = useState(0);
	const [breachOccurred, setBreachOccurred] = useState(false);

	// Validation function
	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		if (!policyAdded) {
			errors.push('Add the Policy node to protect your endpoints');
		}

		if (breachOccurred) {
			errors.push(
				'A security breach occurred! Reset and try again with the Policy enabled',
			);
		}

		if (blockedCount < 3) {
			errors.push(
				`Need to block at least 3 unauthorized requests (currently ${blockedCount})`,
			);
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Authorization not complete!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'Unauthorized requests are now blocked!',
		};
	};

	// Spawn requests
	useEffect(() => {
		const interval = setInterval(() => {
			const id = Date.now();
			const rand = Math.random();
			let type: Request['type'];
			let action: Request['action'];

			if (rand < 0.3) {
				type = 'admin';
				action = Math.random() > 0.5 ? 'view' : 'delete';
			} else if (rand < 0.6) {
				type = 'user';
				action = 'view';
			} else {
				type = 'hacker';
				action = 'delete'; // Hackers always try to delete
			}

			setRequests((prev) => [
				...prev.slice(-12),
				{
					id,
					x: 50,
					y: 150 + Math.random() * 200,
					type,
					action,
					blocked: false,
				},
			]);
		}, 600);

		return () => clearInterval(interval);
	}, []);

	// Animate requests
	useEffect(() => {
		const interval = setInterval(() => {
			setRequests((prev) =>
				prev
					.map((r) => {
						const newX = r.x + 4;

						// At policy checkpoint (x=300)
						if (policyAdded && newX >= 300 && newX < 310 && !r.blocked) {
							// Policy logic: only admins can delete, hackers always blocked
							const shouldBlock =
								r.type === 'hacker' ||
								(r.action === 'delete' && r.type !== 'admin');

							if (shouldBlock) {
								setBlockedCount((c) => c + 1);
								return { ...r, x: newX, blocked: true };
							} else {
								setAllowedCount((c) => c + 1);
							}
						}

						// Without policy, hackers get through
						if (
							!policyAdded &&
							newX >= 450 &&
							r.type === 'hacker' &&
							!r.blocked
						) {
							setBreachOccurred(true);
						}

						return { ...r, x: newX };
					})
					.filter((r) => r.x < 600 && !(r.blocked && r.x > 350)),
			);
		}, 50);

		return () => clearInterval(interval);
	}, [policyAdded]);

	const handleComplete = async () => {
		const success = await completeLevel('act2-level11-authorization', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const getRequestColor = (type: Request['type']) => {
		switch (type) {
			case 'admin':
				return '#22c55e';
			case 'user':
				return '#3b82f6';
			case 'hacker':
				return '#ef4444';
		}
	};

	const getRequestIcon = (type: Request['type'], action: Request['action']) => {
		if (type === 'hacker') return '!';
		if (action === 'delete') return '-';
		return '?';
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn Pundit-style authorization with Policy objects."
					instructions={[
						'Watch the unauthorized delete requests (red) getting through',
						'Add a Policy node to authorize requests',
						'See hackers get blocked while legitimate requests pass',
					]}
					scenario="Anyone can access any endpoint! Hackers are trying to delete posts they don't own. We need authorization at the boundary."
				>
					<div className="p-4 border-t border-border">
						<Button
							className="w-full"
							disabled={policyAdded}
							onClick={() => {
								setPolicyAdded(true);
								setBreachOccurred(false);
							}}
							variant={policyAdded ? 'secondary' : 'default'}
						>
							{policyAdded ? 'Policy Added' : 'Add Policy Node'}
						</Button>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Request Legend
						</div>
						<div className="space-y-2 text-sm">
							<div className="flex items-center gap-2">
								<div className="w-4 h-4 rounded-full bg-success" />
								<span className="text-foreground">Admin (can delete)</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-4 h-4 rounded-full bg-primary" />
								<span className="text-foreground">User (view only)</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-4 h-4 rounded-full bg-destructive" />
								<span className="text-foreground">Hacker (unauthorized)</span>
							</div>
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="grid grid-cols-2 gap-3">
							<div className="bg-success/20 rounded-lg p-3 text-center">
								<div className="text-2xl font-bold text-success">
									{allowedCount}
								</div>
								<div className="text-xs text-success/70">Allowed</div>
							</div>
							<div className="bg-destructive/20 rounded-lg p-3 text-center">
								<div className="text-2xl font-bold text-destructive">
									{blockedCount}
								</div>
								<div className="text-xs text-destructive/70">Blocked</div>
							</div>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="Authorization"
					levelNumber={11}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setPolicyAdded(false);
						setRequests([]);
						setBlockedCount(0);
						setAllowedCount(0);
						setBreachOccurred(false);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background overflow-hidden">
					{/* Breach warning */}
					{breachOccurred && !policyAdded && (
						<div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-destructive/90 border border-destructive rounded-lg px-6 py-3 z-10">
							<div className="text-destructive-foreground font-bold">
								SECURITY BREACH!
							</div>
							<div className="text-destructive-foreground/80 text-sm">
								Unauthorized delete succeeded!
							</div>
						</div>
					)}

					{/* Pipeline visualization */}
					<svg className="absolute inset-0 w-full h-full">
						{/* Controller */}
						<rect
							fill="#374151"
							height="200"
							rx="8"
							width="80"
							x="40"
							y="150"
						/>
						<text
							fill="#9ca3af"
							fontSize="12"
							textAnchor="middle"
							x="80"
							y="255"
						>
							Controller
						</text>

						{/* Policy (if added) */}
						{policyAdded && (
							<>
								<rect
									fill="#8b5cf6"
									height="140"
									rx="8"
									width="60"
									x="280"
									y="180"
								/>
								<text
									fill="white"
									fontSize="11"
									textAnchor="middle"
									x="310"
									y="255"
								>
									Policy
								</text>
								<text
									fill="white"
									fontSize="9"
									textAnchor="middle"
									x="310"
									y="270"
								>
									authorize!
								</text>
							</>
						)}

						{/* Service */}
						<rect
							fill="#374151"
							height="200"
							rx="8"
							width="100"
							x="450"
							y="150"
						/>
						<text
							fill="#9ca3af"
							fontSize="12"
							textAnchor="middle"
							x="500"
							y="255"
						>
							Service
						</text>

						{/* Connection lines */}
						<line
							stroke="#4b5563"
							strokeDasharray="5,5"
							strokeWidth="2"
							x1="120"
							x2={policyAdded ? '280' : '450'}
							y1="250"
							y2="250"
						/>
						{policyAdded && (
							<line
								stroke="#8b5cf6"
								strokeWidth="2"
								x1="340"
								x2="450"
								y1="250"
								y2="250"
							/>
						)}

						{/* Requests */}
						{requests.map((r) => {
							if (r.blocked && r.x > 320) return null;

							return (
								<g key={r.id}>
									<circle
										cx={r.x}
										cy={r.y}
										fill={getRequestColor(r.type)}
										opacity={r.blocked ? 0.5 : 1}
										r="12"
									/>
									<text
										className="text-foreground"
										fill="currentColor"
										fontSize="10"
										fontWeight="bold"
										textAnchor="middle"
										x={r.x}
										y={r.y + 4}
									>
										{getRequestIcon(r.type, r.action)}
									</text>
								</g>
							);
						})}

						{/* Block effects */}
						{requests
							.filter((r) => r.blocked && r.x >= 300 && r.x < 360)
							.map((r) => (
								<g key={`block-${r.id}`}>
									<text
										fill="#ef4444"
										fontSize="10"
										fontWeight="bold"
										textAnchor="middle"
										x={r.x}
										y={r.y - 20}
									>
										DENIED
									</text>
								</g>
							))}
					</svg>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/policies/post_policy.rb',
							language: 'ruby',
							code: `class PostPolicy < ApplicationPolicy
  def show?
    true  # Anyone can view
  end

  def destroy?
    user.admin? || record.author == user
  end
end

# In controller:
class PostsController < ApplicationController
  def destroy
    @post = Post.find(params[:id])
    authorize @post  # Raises Pundit::NotAuthorizedError

    @post.destroy
    redirect_to posts_path
  end
end`,
							highlight: [6, 7, 14],
						},
					]}
					learningGoal="Authorization policies centralize access control logic. Use Pundit to keep authorization rules testable and maintainable."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level11Authorization;
