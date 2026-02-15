/**
 * Level 39: Soft Deletes & Audit Trails
 *
 * Learn to protect data with soft deletes (Discard gem) and track changes
 * with audit trails (PaperTrail gem). Delete records safely and restore them.
 */

import {
	Eye,
	EyeOff,
	History,
	RotateCcw,
	ShieldCheck,
	Trash2,
	UserCheck,
	UserX,
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

// ─── Types ────────────────────────────────────────────────────────

interface UserRecord {
	id: number;
	name: string;
	email: string;
	role: 'admin' | 'editor' | 'viewer';
	discardedAt: string | null;
}

interface AuditEntry {
	id: number;
	event: 'create' | 'update' | 'discard' | 'undiscard' | 'destroy';
	itemType: string;
	itemId: number;
	whodunnit: string;
	changeset: Record<string, [string | null, string | null]>;
	createdAt: string;
}

type DeleteMode = 'hard' | 'soft';

// ─── Initial Data ─────────────────────────────────────────────────

const INITIAL_USERS: UserRecord[] = [
	{
		id: 1,
		name: 'Alice Johnson',
		email: 'alice@example.com',
		role: 'admin',
		discardedAt: null,
	},
	{
		id: 2,
		name: 'Bob Smith',
		email: 'bob@example.com',
		role: 'editor',
		discardedAt: null,
	},
	{
		id: 3,
		name: 'Carol Williams',
		email: 'carol@example.com',
		role: 'viewer',
		discardedAt: null,
	},
	{
		id: 4,
		name: 'Dave Brown',
		email: 'dave@example.com',
		role: 'editor',
		discardedAt: null,
	},
	{
		id: 5,
		name: 'Eve Davis',
		email: 'eve@example.com',
		role: 'viewer',
		discardedAt: null,
	},
];

let auditIdCounter = 0;

function makeTimestamp(): string {
	const now = new Date();
	return now.toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	});
}

// ─── Configuration Options ────────────────────────────────────────

interface SoftDeleteConfig {
	discardEnabled: boolean;
	paperTrailEnabled: boolean;
	auditLoggingEnabled: boolean;
}

// ─── Component ────────────────────────────────────────────────────

export function Level40SoftDeletes({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();

	// State
	const [users, setUsers] = useState<UserRecord[]>(INITIAL_USERS);
	const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
	const [deleteMode, setDeleteMode] = useState<DeleteMode>('hard');
	const [config, setConfig] = useState<SoftDeleteConfig>({
		discardEnabled: false,
		paperTrailEnabled: false,
		auditLoggingEnabled: false,
	});
	const [hardDeletedIds, setHardDeletedIds] = useState<Set<number>>(new Set());
	const [hasRestoredRecord, setHasRestoredRecord] = useState(false);
	const [showDiscarded, setShowDiscarded] = useState(true);

	// ─── Helpers ────────────────────────────────────────

	const addAuditEntry = (
		event: AuditEntry['event'],
		itemId: number,
		changeset: AuditEntry['changeset'] = {},
	) => {
		if (!config.paperTrailEnabled) return;
		auditIdCounter += 1;
		const entry: AuditEntry = {
			id: auditIdCounter,
			event,
			itemType: 'User',
			itemId,
			whodunnit: 'admin_42',
			changeset,
			createdAt: makeTimestamp(),
		};
		setAuditTrail((prev) => [entry, ...prev]);
	};

	// ─── Actions ────────────────────────────────────────

	const handleDelete = (userId: number) => {
		const user = users.find((u) => u.id === userId);
		if (!user) return;

		if (deleteMode === 'hard') {
			// Hard delete: remove permanently
			setUsers((prev) => prev.filter((u) => u.id !== userId));
			setHardDeletedIds((prev) => new Set(prev).add(userId));
			addAuditEntry('destroy', userId, {
				name: [user.name, null],
				email: [user.email, null],
			});
		} else {
			// Soft delete: set discardedAt
			if (!config.discardEnabled) return;
			const timestamp = new Date().toISOString();
			setUsers((prev) =>
				prev.map((u) =>
					u.id === userId ? { ...u, discardedAt: timestamp } : u,
				),
			);
			addAuditEntry('discard', userId, {
				discarded_at: [null, timestamp],
			});
		}
	};

	const handleRestore = (userId: number) => {
		if (!config.discardEnabled) return;
		setUsers((prev) =>
			prev.map((u) => (u.id === userId ? { ...u, discardedAt: null } : u)),
		);
		setHasRestoredRecord(true);
		addAuditEntry('undiscard', userId, {
			discarded_at: [new Date().toISOString(), null],
		});
	};

	const toggleConfig = (key: keyof SoftDeleteConfig) => {
		setConfig((prev) => ({ ...prev, [key]: !prev[key] }));

		// Auto-switch to soft delete mode when discard is enabled
		if (key === 'discardEnabled' && !config.discardEnabled) {
			setDeleteMode('soft');
		}
	};

	// ─── Derived data ──────────────────────────────────

	const activeUsers = users.filter((u) => u.discardedAt === null);
	const discardedUsers = users.filter((u) => u.discardedAt !== null);
	const displayUsers = showDiscarded ? users : activeUsers;

	// ─── Validation ─────────────────────────────────────

	const validateSolution = (): ValidationResult => {
		if (!config.discardEnabled) {
			return {
				valid: false,
				message: 'Soft deletes not enabled!',
				details: [
					'Enable the Discard gem to use soft deletes instead of permanent deletion',
				],
			};
		}
		if (!config.paperTrailEnabled) {
			return {
				valid: false,
				message: 'Audit trail not enabled!',
				details: ['Enable PaperTrail to track who changed what and when'],
			};
		}
		if (!config.auditLoggingEnabled) {
			return {
				valid: false,
				message: 'Audit logging not enabled!',
				details: [
					'Enable audit logging to record all changes to the audit trail',
				],
			};
		}
		if (discardedUsers.length === 0 && hardDeletedIds.size === 0) {
			return {
				valid: false,
				message: 'Try deleting a record!',
				details: [
					'Soft-delete at least one user to see the difference from hard deletes',
				],
			};
		}
		if (!hasRestoredRecord) {
			return {
				valid: false,
				message: 'Restore a deleted record!',
				details: [
					'Use the restore button on a soft-deleted user to demonstrate recovery',
				],
			};
		}
		return {
			valid: true,
			message:
				'Soft deletes and audit trails configured! Data is safe and trackable.',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act6-level40-soft-deletes', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const handleReset = () => {
		setUsers(INITIAL_USERS);
		setAuditTrail([]);
		setDeleteMode('hard');
		setConfig({
			discardEnabled: false,
			paperTrailEnabled: false,
			auditLoggingEnabled: false,
		});
		setHardDeletedIds(new Set());
		setHasRestoredRecord(false);
		setShowDiscarded(true);
		auditIdCounter = 0;
	};

	// ─── Code preview ───────────────────────────────────

	const codeFiles = [
		{
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
${config.discardEnabled ? '  include Discard::Model' : '  # include Discard::Model  (not enabled)'}
${config.paperTrailEnabled ? '  has_paper_trail' : '  # has_paper_trail  (not enabled)'}

${
	config.discardEnabled
		? `  # Soft delete:
  # user.discard          # Sets discarded_at
  # user.discarded?       # => true
  # user.undiscard        # Restores record
  # User.kept             # Only active records
  # User.discarded        # Only discarded
  # User.with_discarded   # All records`
		: `  # Without soft deletes:
  # user.destroy  # Gone forever!
  # No way to undo...`
}
end`,
			highlight: config.discardEnabled
				? [2, 3]
				: config.paperTrailEnabled
					? [3]
					: [],
		},
		{
			filename: 'db/migrate/add_discarded_at.rb',
			language: 'ruby',
			code: `class AddDiscardedAtToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :discarded_at, :datetime
    add_index :users, :discarded_at
  end
end`,
			highlight: config.discardEnabled ? [3, 4] : [],
		},
		...(config.paperTrailEnabled
			? [
					{
						filename: 'config/initializers/paper_trail.rb',
						language: 'ruby',
						code: `PaperTrail.config.enabled = true

# Track who made changes
PaperTrail.request.whodunnit = -> {
  Current.user&.id
}

# Audit trail queries:
# user.versions.last.whodunnit    # "admin_42"
# user.versions.last.changeset    # { "email" => ["old", "new"] }
# user.versions.last.event        # "update"
# user.paper_trail.previous_version`,
						highlight: [1, 3, 4, 5],
					},
				]
			: []),
	];

	// ─── Render ─────────────────────────────────────────

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Enable soft deletes and audit trails to protect data and track changes."
					instructions={[
						'Enable the Discard gem for soft deletes',
						'Enable PaperTrail for audit trails',
						'Enable audit logging',
						'Soft-delete a user and then restore them',
					]}
					scenario="An admin accidentally deletes a user. With hard deletes, the data is gone forever. No undo possible. No record of who changed what."
				>
					{/* Configuration Toggles */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Configuration
						</div>
						<div className="space-y-2">
							<button
								className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
									config.discardEnabled
										? 'border-success bg-success/10'
										: 'border-border bg-secondary hover:border-muted-foreground'
								}`}
								onClick={() => toggleConfig('discardEnabled')}
								type="button"
							>
								<ShieldCheck
									className={`w-5 h-5 shrink-0 ${config.discardEnabled ? 'text-success' : 'text-muted-foreground'}`}
								/>
								<div>
									<div
										className={`text-sm font-medium ${config.discardEnabled ? 'text-success' : 'text-foreground'}`}
									>
										Discard Gem
									</div>
									<div className="text-xs text-muted-foreground">
										Soft deletes via discarded_at
									</div>
								</div>
							</button>

							<button
								className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
									config.paperTrailEnabled
										? 'border-success bg-success/10'
										: 'border-border bg-secondary hover:border-muted-foreground'
								}`}
								onClick={() => toggleConfig('paperTrailEnabled')}
								type="button"
							>
								<History
									className={`w-5 h-5 shrink-0 ${config.paperTrailEnabled ? 'text-success' : 'text-muted-foreground'}`}
								/>
								<div>
									<div
										className={`text-sm font-medium ${config.paperTrailEnabled ? 'text-success' : 'text-foreground'}`}
									>
										PaperTrail
									</div>
									<div className="text-xs text-muted-foreground">
										Version tracking & audit trail
									</div>
								</div>
							</button>

							<button
								className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
									config.auditLoggingEnabled
										? 'border-success bg-success/10'
										: 'border-border bg-secondary hover:border-muted-foreground'
								}`}
								onClick={() => toggleConfig('auditLoggingEnabled')}
								type="button"
							>
								<Eye
									className={`w-5 h-5 shrink-0 ${config.auditLoggingEnabled ? 'text-success' : 'text-muted-foreground'}`}
								/>
								<div>
									<div
										className={`text-sm font-medium ${config.auditLoggingEnabled ? 'text-success' : 'text-foreground'}`}
									>
										Audit Logging
									</div>
									<div className="text-xs text-muted-foreground">
										Log all record changes
									</div>
								</div>
							</button>
						</div>
					</div>

					{/* Delete Mode Toggle */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Delete Mode
						</div>
						<div className="grid grid-cols-2 gap-2">
							<Button
								className={`h-auto py-3 flex-col gap-1 ${
									deleteMode === 'hard'
										? 'border-destructive bg-destructive/15 text-destructive'
										: 'border-border'
								}`}
								onClick={() => setDeleteMode('hard')}
								variant="outline"
							>
								<Trash2 className="w-4 h-4" />
								<span className="text-xs font-medium">Hard Delete</span>
							</Button>
							<Button
								className={`h-auto py-3 flex-col gap-1 ${
									deleteMode === 'soft' && config.discardEnabled
										? 'border-success bg-success/15 text-success'
										: deleteMode === 'soft'
											? 'border-warning bg-warning/15 text-warning'
											: 'border-border'
								}`}
								disabled={!config.discardEnabled}
								onClick={() => setDeleteMode('soft')}
								variant="outline"
							>
								<ShieldCheck className="w-4 h-4" />
								<span className="text-xs font-medium">Soft Delete</span>
							</Button>
						</div>
						{!config.discardEnabled && deleteMode === 'hard' && (
							<div className="text-xs text-warning mt-2 text-center">
								Enable Discard gem to unlock soft deletes
							</div>
						)}
					</div>

					{/* Stats Summary */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Record Stats
						</div>
						<div className="grid grid-cols-3 gap-2 text-center">
							<div className="bg-secondary rounded-lg p-2">
								<div className="text-lg font-bold text-success">
									{activeUsers.length}
								</div>
								<div className="text-xs text-muted-foreground">Active</div>
							</div>
							<div className="bg-secondary rounded-lg p-2">
								<div className="text-lg font-bold text-warning">
									{discardedUsers.length}
								</div>
								<div className="text-xs text-muted-foreground">Discarded</div>
							</div>
							<div className="bg-secondary rounded-lg p-2">
								<div className="text-lg font-bold text-destructive">
									{hardDeletedIds.size}
								</div>
								<div className="text-xs text-muted-foreground">Destroyed</div>
							</div>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={6}
					levelName="Soft Deletes & Audit Trails"
					levelNumber={40}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto space-y-6">
						{/* User Records Table */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center justify-between">
								<div>
									<div className="text-foreground font-semibold">
										User Records
									</div>
									<div className="text-xs text-muted-foreground">
										{deleteMode === 'hard'
											? 'Hard delete mode: records are permanently removed'
											: 'Soft delete mode: records are marked as discarded'}
									</div>
								</div>
								{config.discardEnabled && (
									<Button
										className="text-xs gap-1.5"
										onClick={() => setShowDiscarded(!showDiscarded)}
										size="sm"
										variant="ghost"
									>
										{showDiscarded ? (
											<>
												<Eye className="w-3.5 h-3.5" />
												with_discarded
											</>
										) : (
											<>
												<EyeOff className="w-3.5 h-3.5" />
												.kept
											</>
										)}
									</Button>
								)}
							</div>

							<div className="divide-y divide-border">
								{displayUsers.length === 0 ? (
									<div className="p-8 text-center text-muted-foreground">
										<UserX className="w-10 h-10 mx-auto mb-2 opacity-40" />
										<div className="text-sm">No records to display</div>
										{!showDiscarded && discardedUsers.length > 0 && (
											<div className="text-xs mt-1">
												{discardedUsers.length} discarded record(s) hidden
											</div>
										)}
									</div>
								) : (
									<table className="w-full">
										<thead>
											<tr className="text-xs text-muted-foreground uppercase tracking-wider">
												<th className="text-left px-4 py-2 font-medium">ID</th>
												<th className="text-left px-4 py-2 font-medium">
													Name
												</th>
												<th className="text-left px-4 py-2 font-medium">
													Email
												</th>
												<th className="text-left px-4 py-2 font-medium">
													Role
												</th>
												<th className="text-left px-4 py-2 font-medium">
													Status
												</th>
												<th className="text-right px-4 py-2 font-medium">
													Actions
												</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-border">
											{displayUsers.map((user) => {
												const isDiscarded = user.discardedAt !== null;
												return (
													<tr
														className={`transition-colors ${
															isDiscarded
																? 'bg-muted/30'
																: 'hover:bg-secondary/50'
														}`}
														key={user.id}
													>
														<td
															className={`px-4 py-3 text-sm font-mono ${isDiscarded ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}
														>
															{user.id}
														</td>
														<td
															className={`px-4 py-3 text-sm font-medium ${isDiscarded ? 'text-muted-foreground/50 line-through' : 'text-foreground'}`}
														>
															{user.name}
														</td>
														<td
															className={`px-4 py-3 text-sm ${isDiscarded ? 'text-muted-foreground/50 line-through' : 'text-muted-foreground'}`}
														>
															{user.email}
														</td>
														<td className="px-4 py-3">
															<span
																className={`text-xs px-2 py-0.5 rounded-full font-medium ${
																	isDiscarded
																		? 'bg-muted text-muted-foreground/50'
																		: user.role === 'admin'
																			? 'bg-primary/15 text-primary'
																			: user.role === 'editor'
																				? 'bg-warning/15 text-warning'
																				: 'bg-secondary text-muted-foreground'
																}`}
															>
																{user.role}
															</span>
														</td>
														<td className="px-4 py-3">
															{isDiscarded ? (
																<span className="text-xs text-warning flex items-center gap-1">
																	<UserX className="w-3.5 h-3.5" />
																	Discarded
																</span>
															) : (
																<span className="text-xs text-success flex items-center gap-1">
																	<UserCheck className="w-3.5 h-3.5" />
																	Active
																</span>
															)}
														</td>
														<td className="px-4 py-3 text-right">
															{isDiscarded ? (
																<Button
																	className="text-xs gap-1.5 text-success hover:text-success"
																	onClick={() => handleRestore(user.id)}
																	size="sm"
																	variant="ghost"
																>
																	<RotateCcw className="w-3.5 h-3.5" />
																	Restore
																</Button>
															) : (
																<Button
																	className={`text-xs gap-1.5 ${
																		deleteMode === 'hard'
																			? 'text-destructive hover:text-destructive hover:bg-destructive/10'
																			: 'text-warning hover:text-warning hover:bg-warning/10'
																	}`}
																	onClick={() => handleDelete(user.id)}
																	size="sm"
																	variant="ghost"
																>
																	<Trash2 className="w-3.5 h-3.5" />
																	{deleteMode === 'hard'
																		? 'Destroy'
																		: 'Discard'}
																</Button>
															)}
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								)}
							</div>
						</div>

						{/* Hard Deleted Warning */}
						{hardDeletedIds.size > 0 && (
							<div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
								<div className="flex items-start gap-3">
									<Trash2 className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
									<div>
										<div className="text-sm font-medium text-destructive">
											{hardDeletedIds.size} record(s) permanently destroyed
										</div>
										<div className="text-xs text-destructive/70 mt-1">
											These records used hard delete (destroy) and cannot be
											recovered. This is why soft deletes matter!
										</div>
									</div>
								</div>
							</div>
						)}

						{/* Audit Trail */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center gap-2">
								<History className="w-4 h-4 text-primary" />
								<div>
									<div className="text-foreground font-semibold">
										Audit Trail (PaperTrail)
									</div>
									<div className="text-xs text-muted-foreground">
										{config.paperTrailEnabled
											? 'Tracking all record changes'
											: 'Enable PaperTrail to see audit history'}
									</div>
								</div>
							</div>

							{!config.paperTrailEnabled ? (
								<div className="p-8 text-center text-muted-foreground">
									<History className="w-10 h-10 mx-auto mb-2 opacity-20" />
									<div className="text-sm">Audit trail disabled</div>
									<div className="text-xs mt-1">
										Enable PaperTrail in the configuration panel
									</div>
								</div>
							) : auditTrail.length === 0 ? (
								<div className="p-8 text-center text-muted-foreground">
									<History className="w-10 h-10 mx-auto mb-2 opacity-20" />
									<div className="text-sm">No changes recorded yet</div>
									<div className="text-xs mt-1">
										Delete or restore a record to see the audit trail
									</div>
								</div>
							) : (
								<div className="divide-y divide-border max-h-64 overflow-y-auto">
									{auditTrail.map((entry) => (
										<div
											className="px-4 py-3 flex items-start gap-3"
											key={entry.id}
										>
											<div className="mt-0.5">
												{entry.event === 'discard' ? (
													<UserX className="w-4 h-4 text-warning" />
												) : entry.event === 'undiscard' ? (
													<RotateCcw className="w-4 h-4 text-success" />
												) : entry.event === 'destroy' ? (
													<Trash2 className="w-4 h-4 text-destructive" />
												) : (
													<History className="w-4 h-4 text-muted-foreground" />
												)}
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2">
													<span
														className={`text-xs font-medium px-1.5 py-0.5 rounded ${
															entry.event === 'discard'
																? 'bg-warning/15 text-warning'
																: entry.event === 'undiscard'
																	? 'bg-success/15 text-success'
																	: entry.event === 'destroy'
																		? 'bg-destructive/15 text-destructive'
																		: 'bg-secondary text-muted-foreground'
														}`}
													>
														{entry.event}
													</span>
													<span className="text-xs text-muted-foreground">
														{entry.itemType} #{entry.itemId}
													</span>
												</div>
												<div className="text-xs text-muted-foreground mt-1">
													<span className="text-primary">whodunnit:</span>{' '}
													{entry.whodunnit}
												</div>
												{Object.keys(entry.changeset).length > 0 && (
													<div className="text-xs text-muted-foreground mt-1 font-mono bg-secondary/50 rounded px-2 py-1">
														{Object.entries(entry.changeset).map(
															([key, [from, to]]) => (
																<div key={key}>
																	{key}:{' '}
																	<span className="text-destructive/70">
																		{from ?? 'nil'}
																	</span>{' '}
																	{'->'}{' '}
																	<span className="text-success/70">
																		{to ?? 'nil'}
																	</span>
																</div>
															),
														)}
													</div>
												)}
											</div>
											<div className="text-xs text-muted-foreground shrink-0">
												{entry.createdAt}
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={codeFiles}
					learningGoal="Soft deletes preserve data for recovery. Audit trails track who changed what. Together they make your app reliable and accountable."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Discard Gem Methods
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>
								<span className="text-primary font-mono">.discard</span> - Soft
								delete (set discarded_at)
							</li>
							<li>
								<span className="text-primary font-mono">.undiscard</span> -
								Restore a record
							</li>
							<li>
								<span className="text-primary font-mono">.discarded?</span> -
								Check if soft-deleted
							</li>
							<li>
								<span className="text-primary font-mono">.kept</span> - Scope
								for active records
							</li>
							<li>
								<span className="text-primary font-mono">.with_discarded</span>{' '}
								- Include deleted
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							PaperTrail Queries
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>
								<span className="text-primary font-mono">.versions</span> - All
								change history
							</li>
							<li>
								<span className="text-primary font-mono">.whodunnit</span> - Who
								made the change
							</li>
							<li>
								<span className="text-primary font-mono">.changeset</span> -
								What changed
							</li>
							<li>
								<span className="text-primary font-mono">.event</span> -
								create/update/destroy
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Why Soft Deletes?
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>
								<span className="text-success">+</span> Recoverable mistakes
							</li>
							<li>
								<span className="text-success">+</span> Regulatory compliance
							</li>
							<li>
								<span className="text-success">+</span> Referential integrity
							</li>
							<li>
								<span className="text-success">+</span> Audit trail support
							</li>
							<li>
								<span className="text-warning">-</span> Must filter queries
							</li>
							<li>
								<span className="text-warning">-</span> Storage grows over time
							</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level40SoftDeletes;
