/**
 * Level 9: Data Contracts
 *
 * Validate input at the boundary using dry-validation contracts.
 * Dirty (jagged) particles become clean (smooth) after validation.
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
} from '../shared';

interface Particle {
	id: number;
	x: number;
	y: number;
	dirty: boolean;
	validated: boolean;
}

export function Level9Contracts({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [contractAdded, setContractAdded] = useState(false);
	const [particles, setParticles] = useState<Particle[]>([]);
	const [validatedCount, setValidatedCount] = useState(0);
	const [rejectedCount, setRejectedCount] = useState(0);

	const isComplete = contractAdded && validatedCount >= 5;

	// Spawn particles
	useEffect(() => {
		const interval = setInterval(() => {
			const id = Date.now();
			const isDirty = Math.random() > 0.3; // 70% are dirty
			setParticles((prev) => [
				...prev.slice(-10),
				{
					id,
					x: 50,
					y: 200 + Math.random() * 100,
					dirty: isDirty,
					validated: false,
				},
			]);
		}, 800);

		return () => clearInterval(interval);
	}, []);

	// Animate particles
	useEffect(() => {
		const interval = setInterval(() => {
			setParticles((prev) =>
				prev
					.map((p) => {
						const newX = p.x + 3;

						// At contract boundary (x=300), validate
						if (contractAdded && newX >= 300 && newX < 310 && !p.validated) {
							if (p.dirty) {
								// Dirty particles get rejected
								setRejectedCount((c) => c + 1);
								return { ...p, x: newX, validated: true };
							} else {
								// Clean particles pass through
								setValidatedCount((c) => c + 1);
								return { ...p, x: newX, validated: true };
							}
						}

						return { ...p, x: newX };
					})
					.filter((p) => p.x < 600),
			);
		}, 50);

		return () => clearInterval(interval);
	}, [contractAdded]);

	const handleComplete = async () => {
		const success = await completeLevel('act2-level9-data-contracts', {
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
					goal="Learn to validate input at system boundaries using data contracts."
					instructions={[
						'Observe the dirty (red/jagged) particles entering the system',
						'Add a Contract node to validate at the boundary',
						'Watch invalid data get rejected before it causes problems',
					]}
					scenario="Mobile clients are sending malformed data - missing fields, wrong types, invalid formats. The errors are bubbling up deep in the service layer."
				>
					<div className="p-4 border-t border-border">
						<Button
							className="w-full"
							disabled={contractAdded}
							onClick={() => setContractAdded(true)}
							variant={contractAdded ? 'secondary' : 'default'}
						>
							{contractAdded ? 'Contract Added' : 'Add Contract Node'}
						</Button>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Statistics
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="bg-success/20 rounded-lg p-3 text-center">
								<div className="text-2xl font-bold text-success">
									{validatedCount}
								</div>
								<div className="text-xs text-success/70">Validated</div>
							</div>
							<div className="bg-destructive/20 rounded-lg p-3 text-center">
								<div className="text-2xl font-bold text-destructive">
									{rejectedCount}
								</div>
								<div className="text-xs text-destructive/70">Rejected</div>
							</div>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="Data Contracts"
					levelNumber={9}
					onExit={onExit}
					onReset={() => {
						setContractAdded(false);
						setParticles([]);
						setValidatedCount(0);
						setRejectedCount(0);
					}}
				/>

				<div className="flex-1 relative bg-background overflow-hidden">
					{/* Pipeline visualization */}
					<svg className="absolute inset-0 w-full h-full">
						{/* API boundary */}
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
							y="260"
						>
							API
						</text>

						{/* Contract (if added) */}
						{contractAdded && (
							<>
								<rect
									fill="#0891b2"
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
									Contract
								</text>
								<text
									fill="white"
									fontSize="9"
									textAnchor="middle"
									x="310"
									y="270"
								>
									Validator
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
							y="260"
						>
							Service
						</text>

						{/* Connection lines */}
						<line
							stroke="#4b5563"
							strokeDasharray="5,5"
							strokeWidth="2"
							x1="120"
							x2={contractAdded ? '280' : '450'}
							y1="250"
							y2="250"
						/>
						{contractAdded && (
							<line
								stroke="#0891b2"
								strokeWidth="2"
								x1="340"
								x2="450"
								y1="250"
								y2="250"
							/>
						)}

						{/* Particles */}
						{particles.map((p) => {
							const isRejected = contractAdded && p.validated && p.dirty;
							if (isRejected && p.x > 320) return null; // Don't show rejected particles past contract

							return (
								<g key={p.id}>
									{p.dirty && !p.validated ? (
										// Jagged particle (dirty)
										<polygon
											fill="#ef4444"
											points={`${p.x},${p.y - 8} ${p.x + 6},${p.y - 4} ${p.x + 8},${p.y} ${p.x + 6},${p.y + 4} ${p.x},${p.y + 8} ${p.x - 6},${p.y + 4} ${p.x - 8},${p.y} ${p.x - 6},${p.y - 4}`}
										/>
									) : (
										// Smooth particle (clean)
										<circle cx={p.x} cy={p.y} fill="#22c55e" r="8" />
									)}
								</g>
							);
						})}

						{/* Rejection effect */}
						{particles
							.filter(
								(p) =>
									contractAdded &&
									p.validated &&
									p.dirty &&
									p.x >= 300 &&
									p.x < 350,
							)
							.map((p) => (
								<g key={`reject-${p.id}`}>
									<text
										fill="#ef4444"
										fontSize="10"
										textAnchor="middle"
										x={p.x}
										y={p.y - 15}
									>
										REJECTED
									</text>
								</g>
							))}
					</svg>

					{/* Legend */}
					<div className="absolute bottom-4 left-4 bg-card/80 rounded-lg p-3 text-xs space-y-2">
						<div className="flex items-center gap-2">
							<svg height="16" width="16">
								<polygon
									fill="#ef4444"
									points="8,0 14,4 16,8 14,12 8,16 2,12 0,8 2,4"
									transform="scale(0.5) translate(8,8)"
								/>
							</svg>
							<span className="text-muted-foreground">
								Dirty data (invalid)
							</span>
						</div>
						<div className="flex items-center gap-2">
							<svg height="16" width="16">
								<circle cx="8" cy="8" fill="#22c55e" r="6" />
							</svg>
							<span className="text-muted-foreground">Clean data (valid)</span>
						</div>
					</div>

					{/* Completion button */}
					{isComplete && (
						<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
							<Button
								className="px-8 py-3 bg-linear-to-r from-success to-success/80 text-foreground font-bold shadow-lg"
								onClick={handleComplete}
							>
								Complete Level
							</Button>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/contracts/create_order_contract.rb',
							language: 'ruby',
							code: `class CreateOrderContract < Dry::Validation::Contract
  params do
    required(:email).filled(:string)
    required(:amount).filled(:integer, gt?: 0)
    required(:items).array(:hash) do
      required(:product_id).filled(:integer)
      required(:quantity).filled(:integer, gt?: 0)
    end
  end

  rule(:email) do
    key.failure('invalid format') unless value.match?(URI::MailTo::EMAIL_REGEXP)
  end
end

# Usage in controller:
result = CreateOrderContract.new.call(params)
if result.success?
  OrderService.new(result.to_h).call
else
  render json: { errors: result.errors.to_h }, status: 422
end`,
							highlight: [2, 3, 4, 5, 6, 7, 8, 9],
						},
					]}
					learningGoal="Validate data at system boundaries. Contracts ensure invalid data never reaches your business logic."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level9Contracts;
