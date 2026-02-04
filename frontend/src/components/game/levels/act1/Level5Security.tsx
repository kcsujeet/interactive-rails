/**
 * Level 5: Environment Security
 *
 * Database shows "Access Denied" until ENV node connected.
 * Decision modal for "Public" vs "Encrypted" credentials.
 */

import { useRef, useState } from 'react';
import { Button } from '../../../ui/Button';
import type { LevelComponentProps } from '../index';
import {
	CanvasNode,
	CenterPanel,
	CodePreviewPanel,
	ConnectionLayer,
	DraggableNode,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	NodePalette,
	NodePaletteGroup,
	RightPanel,
	useLevelCompletion,
} from '../shared';

interface PlacedNode {
	id: string;
	type: string;
	x: number;
	y: number;
	label?: string;
}

interface Connection {
	id: string;
	sourceId: string;
	targetId: string;
}

// Node definitions
const NODE_DEFS: Record<
	string,
	{ name: string; icon: string; color: string; description: string }
> = {
	request: {
		name: 'Request',
		icon: 'R',
		color: '#22c55e',
		description: 'HTTP request',
	},
	router: {
		name: 'Router',
		icon: '/',
		color: '#f59e0b',
		description: 'routes.rb',
	},
	controller: {
		name: 'Controller',
		icon: 'C',
		color: '#3b82f6',
		description: 'Controller',
	},
	model: { name: 'Model', icon: 'M', color: '#8b5cf6', description: 'Model' },
	database: {
		name: 'Database',
		icon: 'D',
		color: '#06b6d4',
		description: 'PostgreSQL',
	},
	view: { name: 'View', icon: 'V', color: '#ec4899', description: 'View' },
	response: {
		name: 'Response',
		icon: 'R',
		color: '#10b981',
		description: 'Response',
	},
	env: {
		name: 'ENV',
		icon: 'E',
		color: '#eab308',
		description: 'Environment variables',
	},
};

export function Level5Security({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const canvasRef = useRef<HTMLDivElement>(null);

	// Pre-built pipeline with locked database
	const [placedNodes, setPlacedNodes] = useState<PlacedNode[]>([
		{ id: 'request-1', type: 'request', x: 80, y: 250 },
		{ id: 'router-1', type: 'router', x: 200, y: 250 },
		{ id: 'controller-1', type: 'controller', x: 340, y: 250 },
		{ id: 'post-model', type: 'model', x: 500, y: 180, label: 'Post' },
		{ id: 'comment-model', type: 'model', x: 500, y: 320, label: 'Comment' },
		{ id: 'database-1', type: 'database', x: 680, y: 250 },
		{ id: 'view-1', type: 'view', x: 840, y: 250 },
		{ id: 'response-1', type: 'response', x: 980, y: 250 },
	]);

	const [connections, setConnections] = useState<Connection[]>([
		{ id: 'c1', sourceId: 'request-1', targetId: 'router-1' },
		{ id: 'c2', sourceId: 'router-1', targetId: 'controller-1' },
		{ id: 'c3', sourceId: 'controller-1', targetId: 'post-model' },
		{ id: 'c4', sourceId: 'post-model', targetId: 'comment-model' },
		{ id: 'c5', sourceId: 'post-model', targetId: 'database-1' },
		{ id: 'c6', sourceId: 'comment-model', targetId: 'database-1' },
		{ id: 'c7', sourceId: 'database-1', targetId: 'view-1' },
		{ id: 'c8', sourceId: 'view-1', targetId: 'response-1' },
	]);

	const [envAdded, setEnvAdded] = useState(false);
	const [credentialType, setCredentialType] = useState<
		'public' | 'encrypted' | null
	>(null);
	const [showDecisionModal, setShowDecisionModal] = useState(false);
	const [showLeakWarning, setShowLeakWarning] = useState(false);
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [pendingConnection, setPendingConnection] = useState<{
		sourceId: string;
		x: number;
		y: number;
	} | null>(null);

	// Level is complete when ENV is connected with encrypted credentials
	const isComplete = credentialType === 'encrypted';
	const databaseUnlocked = credentialType !== null;

	// Handle dropping ENV node
	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		const nodeType = e.dataTransfer.getData('nodeType');
		if (nodeType !== 'env' || envAdded || !canvasRef.current) return;

		const rect = canvasRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const envNode: PlacedNode = {
			id: 'env-1',
			type: 'env',
			x,
			y,
		};

		setPlacedNodes((prev) => [...prev, envNode]);
		setEnvAdded(true);
	};

	// Handle connection
	const handleStartConnection = (nodeId: string) => {
		const node = placedNodes.find((n) => n.id === nodeId);
		if (node) {
			setPendingConnection({ sourceId: nodeId, x: node.x + 60, y: node.y });
		}
	};

	const handleCompleteConnection = (targetId: string) => {
		if (!pendingConnection || pendingConnection.sourceId === targetId) {
			setPendingConnection(null);
			return;
		}

		const sourceNode = placedNodes.find(
			(n) => n.id === pendingConnection.sourceId,
		);
		const targetNode = placedNodes.find((n) => n.id === targetId);

		// Check if connecting ENV to database
		if (
			(sourceNode?.type === 'env' && targetNode?.type === 'database') ||
			(sourceNode?.type === 'database' && targetNode?.type === 'env')
		) {
			// Show decision modal for credential type
			setShowDecisionModal(true);
		}

		setPendingConnection(null);
	};

	// Handle credential choice
	const handleCredentialChoice = (choice: 'public' | 'encrypted') => {
		setCredentialType(choice);
		setShowDecisionModal(false);

		// Add connection
		setConnections((prev) => [
			...prev,
			{
				id: `conn-env-db`,
				sourceId: 'env-1',
				targetId: 'database-1',
			},
		]);

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

	// Canvas handlers
	const handleCanvasMouseMove = (e: React.MouseEvent) => {
		if (pendingConnection && canvasRef.current) {
			const rect = canvasRef.current.getBoundingClientRect();
			setPendingConnection({
				...pendingConnection,
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
			});
		}
	};

	const handleCanvasClick = () => {
		setSelectedNodeId(null);
		setPendingConnection(null);
	};

	const handleNodeDrag = (id: string, x: number, y: number) => {
		if (id === 'env-1') {
			setPlacedNodes((prev) =>
				prev.map((n) => (n.id === id ? { ...n, x, y } : n)),
			);
		}
	};

	// Get connection coordinates
	const getConnectionCoords = () => {
		return connections
			.map((conn) => {
				const source = placedNodes.find((n) => n.id === conn.sourceId);
				const target = placedNodes.find((n) => n.id === conn.targetId);
				if (!source || !target) return null;

				const isEnvConnection = source.type === 'env' || target.type === 'env';
				const color = isEnvConnection
					? credentialType === 'encrypted'
						? '#22c55e'
						: credentialType === 'public'
							? '#ef4444'
							: '#eab308'
					: '#6b7280';

				return {
					id: conn.id,
					startX: source.x + 60,
					startY: source.y,
					endX: target.x - 60,
					endY: target.y,
					color,
					animated: true,
				};
			})
			.filter(Boolean) as Array<{
			id: string;
			startX: number;
			startY: number;
			endX: number;
			endY: number;
			color: string;
			animated: boolean;
		}>;
	};

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
									onDragStart={(e, type) =>
										e.dataTransfer.setData('nodeType', type)
									}
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
					onReset={() => {
						setPlacedNodes([
							{ id: 'request-1', type: 'request', x: 80, y: 250 },
							{ id: 'router-1', type: 'router', x: 200, y: 250 },
							{ id: 'controller-1', type: 'controller', x: 340, y: 250 },
							{
								id: 'post-model',
								type: 'model',
								x: 500,
								y: 180,
								label: 'Post',
							},
							{
								id: 'comment-model',
								type: 'model',
								x: 500,
								y: 320,
								label: 'Comment',
							},
							{ id: 'database-1', type: 'database', x: 680, y: 250 },
							{ id: 'view-1', type: 'view', x: 840, y: 250 },
							{ id: 'response-1', type: 'response', x: 980, y: 250 },
						]);
						setConnections([
							{ id: 'c1', sourceId: 'request-1', targetId: 'router-1' },
							{ id: 'c2', sourceId: 'router-1', targetId: 'controller-1' },
							{ id: 'c3', sourceId: 'controller-1', targetId: 'post-model' },
							{ id: 'c4', sourceId: 'post-model', targetId: 'comment-model' },
							{ id: 'c5', sourceId: 'post-model', targetId: 'database-1' },
							{ id: 'c6', sourceId: 'comment-model', targetId: 'database-1' },
							{ id: 'c7', sourceId: 'database-1', targetId: 'view-1' },
							{ id: 'c8', sourceId: 'view-1', targetId: 'response-1' },
						]);
						setEnvAdded(false);
						setCredentialType(null);
						setShowLeakWarning(false);
					}}
				/>

				{/* Canvas */}
				<div
					className="flex-1 relative bg-background overflow-hidden"
					onClick={handleCanvasClick}
					onDragOver={(e) => e.preventDefault()}
					onDrop={handleDrop}
					onMouseMove={handleCanvasMouseMove}
					ref={canvasRef}
				>
					{/* Grid background */}
					<div
						className="absolute inset-0 opacity-10"
						style={{
							backgroundImage:
								'radial-gradient(circle, #374151 1px, transparent 1px)',
							backgroundSize: '30px 30px',
						}}
					/>

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

					{/* Connections */}
					<ConnectionLayer
						connections={getConnectionCoords()}
						pendingConnection={
							pendingConnection
								? {
										startX:
											placedNodes.find(
												(n) => n.id === pendingConnection.sourceId,
											)!.x + 60,
										startY: placedNodes.find(
											(n) => n.id === pendingConnection.sourceId,
										)!.y,
										endX: pendingConnection.x,
										endY: pendingConnection.y,
									}
								: null
						}
						selectedConnectionId={null}
					/>

					{/* Nodes */}
					{placedNodes.map((node) => {
						const def = NODE_DEFS[node.type];
						const isDatabase = node.type === 'database';
						const isLocked =
							node.id !== 'env-1' &&
							!(isDatabase && envAdded && !credentialType);

						// Database shows lock icon when not connected to ENV
						const showLockBadge = isDatabase && !databaseUnlocked;

						return (
							<CanvasNode
								badge={showLockBadge ? 'X' : undefined}
								badgeColor={showLockBadge ? '#ef4444' : undefined}
								color={def.color}
								glowColor={
									isDatabase
										? !databaseUnlocked
											? 'rgba(239, 68, 68, 0.3)'
											: credentialType === 'encrypted'
												? 'rgba(34, 197, 94, 0.3)'
												: 'rgba(239, 68, 68, 0.3)'
										: undefined
								}
								icon={def.icon}
								id={node.id}
								key={node.id}
								locked={isLocked}
								name={node.label || def.name}
								onCompleteConnection={() => handleCompleteConnection(node.id)}
								onDrag={handleNodeDrag}
								onSelect={setSelectedNodeId}
								onStartConnection={() => handleStartConnection(node.id)}
								selected={selectedNodeId === node.id}
								type={node.type}
								x={node.x}
								y={node.y}
							/>
						);
					})}

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
						<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
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
						<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-destructive/80 border border-destructive text-destructive-foreground px-6 py-3 rounded-lg">
							Security vulnerability! Use encrypted credentials instead.
						</div>
					)}
				</div>
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
