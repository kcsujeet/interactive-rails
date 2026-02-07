/**
 * Level 5: Environment Security
 *
 * Database shows "Access Denied" until ENV node connected.
 * Decision modal for "Public" vs "Encrypted" credentials.
 */

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PipelineCanvas } from '@/components/PipelineCanvas';
import { usePipelineState } from '@/hooks/usePipelineState';
import { getNodeInfo } from '@/utils/gameData';
import type { LevelComponentProps } from '@/features/levels-registry';
import type { NodeOverride } from '@/hooks/usePipelineState';
import {
	CenterPanel,
	CodePreviewPanel,
	DraggableNode,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	NodePalette,
	NodePaletteGroup,
	RightPanel,
	useLevelCompletion,
} from '@/components/levels';

export function Level5Security({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();

	const [envAdded, setEnvAdded] = useState(false);
	const [credentialType, setCredentialType] = useState<
		'public' | 'encrypted' | null
	>(null);
	const [showDecisionModal, setShowDecisionModal] = useState(false);
	const [showLeakWarning, setShowLeakWarning] = useState(false);

	// Pre-built pipeline with locked nodes
	const pipeline = usePipelineState({
		initialNodes: [
			{ id: 'request-1', type: 'request', x: 130, y: 280 },
			{ id: 'router-1', type: 'router', x: 350, y: 280 },
			{ id: 'controller-1', type: 'controller', x: 570, y: 280 },
			{ id: 'post-model', type: 'model', x: 810, y: 110, label: 'Post' },
			{ id: 'comment-model', type: 'model', x: 810, y: 260, label: 'Comment' },
			{ id: 'database-1', type: 'database', x: 1060, y: 185 },
			{ id: 'view-1', type: 'view', x: 810, y: 420 },
			{ id: 'response-1', type: 'response', x: 1060, y: 420 },
		],
		initialConnections: [
			{ sourceNodeId: 'request-1', targetNodeId: 'router-1' },
			{ sourceNodeId: 'router-1', targetNodeId: 'controller-1' },
			{ sourceNodeId: 'controller-1', targetNodeId: 'post-model' },
			{ sourceNodeId: 'post-model', targetNodeId: 'comment-model' },
			{ sourceNodeId: 'post-model', targetNodeId: 'database-1' },
			{ sourceNodeId: 'comment-model', targetNodeId: 'database-1' },
			{ sourceNodeId: 'controller-1', targetNodeId: 'view-1' },
			{ sourceNodeId: 'view-1', targetNodeId: 'response-1' },
		],
		// Only allow dropping ENV node if not already added
		onBeforeDrop: (type) => type === 'env' && !envAdded,
		// Track when ENV node is dropped
		onNodeDropped: (node) => {
			if (node.type === 'env') {
				setEnvAdded(true);
			}
		},
		// Handle connection between ENV and Database - show modal
		onConnectionCreated: (connection) => {
			const sourceNode = pipeline.placedNodes.find(
				(n) => n.id === connection.sourceNodeId,
			);
			const targetNode = pipeline.placedNodes.find(
				(n) => n.id === connection.targetNodeId,
			);

			// Check if connecting ENV to database
			if (
				(sourceNode?.type === 'env' && targetNode?.type === 'database') ||
				(sourceNode?.type === 'database' && targetNode?.type === 'env')
			) {
				setShowDecisionModal(true);
			}
		},
	});

	// Level is complete when ENV is connected with encrypted credentials
	const isComplete = credentialType === 'encrypted';
	const databaseUnlocked = credentialType !== null;

	// Handle credential choice
	const handleCredentialChoice = (choice: 'public' | 'encrypted') => {
		setCredentialType(choice);
		setShowDecisionModal(false);

		// Show leak warning if public
		if (choice === 'public') {
			setShowLeakWarning(true);
			setTimeout(() => setShowLeakWarning(false), 5000);
		}
	};

	// Handle completing the level
	const handleComplete = async () => {
		const success = await completeLevel('act1-level5-security', {
			stars: 3,
			decisions: { credentials: credentialType! },
		});
		if (success) {
			onComplete({ stars: 3, decisions: { credentials: credentialType! } });
		}
	};

	// Handle reset
	const handleReset = useCallback(() => {
		pipeline.setPlacedNodes([
			{ id: 'request-1', type: 'request', x: 130, y: 280 },
			{ id: 'router-1', type: 'router', x: 350, y: 280 },
			{ id: 'controller-1', type: 'controller', x: 570, y: 280 },
			{ id: 'post-model', type: 'model', x: 810, y: 110, label: 'Post' },
			{ id: 'comment-model', type: 'model', x: 810, y: 260, label: 'Comment' },
			{ id: 'database-1', type: 'database', x: 1060, y: 185 },
			{ id: 'view-1', type: 'view', x: 810, y: 420 },
			{ id: 'response-1', type: 'response', x: 1060, y: 420 },
		]);
		pipeline.setConnections([
			{ sourceNodeId: 'request-1', targetNodeId: 'router-1' },
			{ sourceNodeId: 'router-1', targetNodeId: 'controller-1' },
			{ sourceNodeId: 'controller-1', targetNodeId: 'post-model' },
			{ sourceNodeId: 'post-model', targetNodeId: 'comment-model' },
			{ sourceNodeId: 'post-model', targetNodeId: 'database-1' },
			{ sourceNodeId: 'comment-model', targetNodeId: 'database-1' },
			{ sourceNodeId: 'controller-1', targetNodeId: 'view-1' },
			{ sourceNodeId: 'view-1', targetNodeId: 'response-1' },
		]);
		setEnvAdded(false);
		setCredentialType(null);
		setShowLeakWarning(false);
		setShowDecisionModal(false);
	}, [pipeline]);

	// Node overrides - database gets special visual treatment
	const nodeOverrides: Record<string, NodeOverride> = {
		'database-1': {
			glowColor: !databaseUnlocked
				? 'rgba(239, 68, 68, 0.3)' // red when disconnected
				: credentialType === 'encrypted'
					? 'rgba(34, 197, 94, 0.3)' // green when encrypted
					: 'rgba(239, 68, 68, 0.3)', // red when public
			badge: !databaseUnlocked ? 'X' : undefined,
			badgeColor: !databaseUnlocked ? '#ef4444' : undefined,
		},
	};

	// Locked nodes - all except env-1
	const lockedNodeIds = [
		'request-1',
		'router-1',
		'controller-1',
		'post-model',
		'comment-model',
		'database-1',
		'view-1',
		'response-1',
	];

	// Connection color overrides
	const connectionOverrides = pipeline.connections.reduce(
		(acc, conn) => {
			const sourceNode = pipeline.placedNodes.find(
				(n) => n.id === conn.sourceNodeId,
			);
			const targetNode = pipeline.placedNodes.find(
				(n) => n.id === conn.targetNodeId,
			);

			const isEnvConnection =
				sourceNode?.type === 'env' || targetNode?.type === 'env';

			if (isEnvConnection) {
				const color = credentialType === 'encrypted'
					? '#22c55e'
					: credentialType === 'public'
						? '#ef4444'
						: '#eab308';

				acc[`${conn.sourceNodeId}-${conn.targetNodeId}`] = {
					color,
				};
			}

			return acc;
		},
		{} as Record<string, { color: string }>,
	);

	// Generate code preview
	const getCodeFiles = () => {
		const files = [];

		// Database config
		files.push({
			filename: 'config/database.yml',
			language: 'ruby',
			code:
				credentialType === 'public'
					? `# DANGER: Hardcoded credentials!
production:
  adapter: postgresql
  database: myapp_production
  username: postgres
  password: "supersecret123"  # EXPOSED!`
					: credentialType === 'encrypted'
						? `# Secure: Using credentials.yml.enc
production:
  adapter: postgresql
  database: myapp_production
  username: <%= Rails.application.credentials.dig(:db, :user) %>
  password: <%= Rails.application.credentials.dig(:db, :pass) %>`
						: `# ERROR: Cannot connect
production:
  adapter: postgresql
  database: myapp_production
  # Missing credentials!`,
			highlight:
				credentialType === 'public'
					? [1, 6]
					: credentialType === 'encrypted'
						? [1, 5, 6]
						: [4],
		});

		// Credentials file
		if (credentialType === 'encrypted') {
			files.push({
				filename: 'config/credentials.yml.enc',
				language: 'ruby',
				code: `# Decrypted with RAILS_MASTER_KEY
# Safe to commit to git

db:
  user: postgres
  pass: supersecret123

secret_key_base: abc123...`,
				highlight: [1, 2],
			});
		}

		// CI/CD status
		files.push({
			filename: 'CI/CD Build Output',
			language: 'ruby',
			code: !databaseUnlocked
				? `# Build failed!
PG::ConnectionBad: could not connect to server
FATAL: password authentication failed

Hint: Configure environment variables or Rails credentials`
				: credentialType === 'public'
					? `# Build passed, but...
# WARNING: Credentials exposed in git history!
# Anyone with repo access can see your password

# Recommended: rotate credentials immediately`
					: `# Build passed!
# Credentials secure via RAILS_MASTER_KEY
# Set RAILS_MASTER_KEY in your CI/CD environment`,
			highlight: !databaseUnlocked
				? [2, 3]
				: credentialType === 'public'
					? [2, 3]
					: [2],
		});

		return files;
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Securely configure database credentials using Rails encrypted credentials."
					instructions={[
						'Drag the ENV node to the canvas',
						'Connect ENV to the Database',
						'Choose "Encrypted" credentials in the dialog',
					]}
					scenario="The build failed. CI/CD cannot connect to the database."
				>
					<NodePalette title="Available Components">
						{!envAdded ? (
							<NodePaletteGroup title="Configuration">
								<DraggableNode
									color="#eab308"
									description="Environment variables & secrets"
									icon="E"
									name="ENV"
									onDragEnd={pipeline.handleDragEnd}
									onDragStart={pipeline.handleDragStart}
									type="env"
								/>
							</NodePaletteGroup>
						) : (
							<div className="text-sm text-muted-foreground text-center py-4">
								ENV node added!
								{!credentialType && (
									<div className="mt-2">Connect it to the Database.</div>
								)}
							</div>
						)}
					</NodePalette>

					{/* Security status */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Security Status
						</div>

						<div
							className={`rounded-lg p-4 ${
								credentialType === 'encrypted'
									? 'bg-success/10 border border-success'
									: credentialType === 'public'
										? 'bg-destructive/10 border border-destructive'
										: 'bg-secondary border border-border'
							}`}
						>
							<div
								className={`text-sm font-medium ${
									credentialType === 'encrypted'
										? 'text-success'
										: credentialType === 'public'
											? 'text-destructive'
											: 'text-muted-foreground'
								}`}
							>
								{credentialType === 'encrypted'
									? 'SECURE'
									: credentialType === 'public'
										? 'DANGER: EXPOSED!'
										: 'DISCONNECTED'}
							</div>
							<div className="text-xs text-muted-foreground mt-1">
								{credentialType === 'encrypted'
									? 'Credentials encrypted with master key'
									: credentialType === 'public'
										? 'Credentials visible in git history!'
										: 'Database credentials not configured'}
							</div>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={1}
					levelName="Environment Security"
					levelNumber={5}
					onExit={onExit}
					onReset={handleReset}
				/>

				<PipelineCanvas
					canvasRef={pipeline.canvasRef}
					connectionOverrides={connectionOverrides}
					connections={pipeline.connections}
					draggedNodeType={pipeline.draggedNodeType}
					draggingNodeId={pipeline.draggingNodeId}
					lockedNodeIds={lockedNodeIds}
					nodeOverrides={nodeOverrides}
					onClick={pipeline.handleCanvasClick}
					onCompleteConnection={pipeline.completeConnection}
					onDeleteConnection={pipeline.deleteConnection}
					onDeleteNode={pipeline.deleteSelectedNode}
					onDragOver={pipeline.handleDragOver}
					onDrop={pipeline.handleDrop}
					onMouseMove={pipeline.handleCanvasMouseMove}
					onMouseUp={pipeline.handleCanvasMouseUp}
					onNodeMouseDown={pipeline.handleNodeMouseDown}
					onStartConnection={pipeline.startConnection}
					pendingConnection={pipeline.pendingConnection}
					placedNodes={pipeline.placedNodes}
					selectedNodeId={pipeline.selectedNodeId}
				>
					{/* Security leak warning overlay */}
					{showLeakWarning && (
						<div className="absolute inset-0 bg-destructive/30 flex items-center justify-center z-30 pointer-events-none">
							<div className="bg-destructive border-2 border-destructive rounded-xl p-6 text-center animate-pulse">
								<div className="text-4xl mb-2">!</div>
								<div className="text-xl font-bold text-destructive-foreground">
									SECURITY LEAK DETECTED
								</div>
								<div className="text-destructive-foreground text-sm mt-2">
									Credentials exposed in repository!
								</div>
							</div>
						</div>
					)}

					{/* Decision Modal */}
					{showDecisionModal && (
						<div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
							<div className="bg-card border border-border rounded-xl p-6 max-w-md shadow-2xl">
								<h3 className="text-xl font-bold text-foreground mb-2">
									How should secrets be stored?
								</h3>
								<p className="text-muted-foreground text-sm mb-6">
									Choose how to provide database credentials.
								</p>

								<div className="space-y-3">
									<Button
										className="w-full p-4 h-auto rounded-lg border border-border hover:border-destructive hover:bg-destructive/10 text-left transition-all"
										onClick={() => handleCredentialChoice('public')}
										variant="outline"
									>
										<div className="flex flex-col w-full">
											<div className="flex items-center justify-between mb-1">
												<span className="font-medium text-foreground">
													Publicly Visible
												</span>
												<span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded">
													Dangerous
												</span>
											</div>
											<div className="text-sm text-muted-foreground">
												Hardcode credentials in database.yml
											</div>
											<div className="text-xs text-destructive mt-1">
												! Secrets visible in git history!
											</div>
										</div>
									</Button>

									<Button
										className="w-full p-4 h-auto rounded-lg border border-border hover:border-success hover:bg-success/10 text-left transition-all"
										onClick={() => handleCredentialChoice('encrypted')}
										variant="outline"
									>
										<div className="flex flex-col w-full">
											<div className="flex items-center justify-between mb-1">
												<span className="font-medium text-foreground">
													Encrypted (credentials.yml.enc)
												</span>
												<span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded">
													Recommended
												</span>
											</div>
											<div className="text-sm text-muted-foreground">
												Encrypt secrets with RAILS_MASTER_KEY
											</div>
											<div className="text-xs text-success mt-1">
												+ Secure: only decrypted at runtime
											</div>
										</div>
									</Button>
								</div>

								<Button
									className="mt-4 w-full"
									onClick={() => setShowDecisionModal(false)}
									variant="ghost"
								>
									Cancel
								</Button>
							</div>
						</div>
					)}

					{/* Completion button */}
					{isComplete && (
						<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
							<Button
								className="bg-success hover:bg-success/90 text-foreground font-bold shadow-lg shadow-success/30"
								onClick={handleComplete}
								size="lg"
							>
								Complete Level
							</Button>
						</div>
					)}

					{/* Wrong choice feedback */}
					{credentialType === 'public' && !showLeakWarning && (
						<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-destructive/80 border border-destructive text-destructive-foreground px-6 py-3 rounded-lg z-10">
							Security vulnerability! Use encrypted credentials instead.
						</div>
					)}
				</PipelineCanvas>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles()}
					learningGoal="Understanding Rails credentials and secure secrets management."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level5Security;
