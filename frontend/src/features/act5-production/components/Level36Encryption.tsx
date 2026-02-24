/**
 * Level 32: Encrypted Attributes
 *
 * Encrypt PII (emails, phone, address) at rest using Rails 8 `encrypts`.
 * Shows deterministic vs non-deterministic encryption and query behavior.
 */

import {
	Database,
	Eye,
	EyeOff,
	Key,
	Lock,
	Search,
	ShieldCheck,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
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

type EncryptionMode = 'plaintext' | 'deterministic' | 'non-deterministic';

interface ColumnConfig {
	name: string;
	isPII: boolean;
	mode: EncryptionMode;
}

interface UserRow {
	id: number;
	email: string;
	phone: string;
	address: string;
	name: string;
}

const SAMPLE_USERS: UserRow[] = [
	{
		id: 1,
		email: 'alice@example.com',
		phone: '+1-555-0123',
		address: '123 Main St, NYC',
		name: 'Alice Johnson',
	},
	{
		id: 2,
		email: 'bob@corp.io',
		phone: '+1-555-0456',
		address: '456 Oak Ave, LA',
		name: 'Bob Smith',
	},
	{
		id: 3,
		email: 'carol@startup.dev',
		phone: '+1-555-0789',
		address: '789 Pine Rd, SF',
		name: 'Carol Williams',
	},
];

const CIPHERTEXT_MAP: Record<string, string> = {
	'alice@example.com': '{"p":"dB3dhj...","h":{"iv":"f9w..."}}',
	'bob@corp.io': '{"p":"kM7xnP...","h":{"iv":"q2a..."}}',
	'carol@startup.dev': '{"p":"vR9bWe...","h":{"iv":"m5c..."}}',
	'+1-555-0123': '{"p":"aX4kLm...","h":{"iv":"j8r..."}}',
	'+1-555-0456': '{"p":"nY7pQw...","h":{"iv":"t3v..."}}',
	'+1-555-0789': '{"p":"cZ2sHf...","h":{"iv":"w6x..."}}',
	'123 Main St, NYC': '{"p":"gT5uBn...","h":{"iv":"e1d..."}}',
	'456 Oak Ave, LA': '{"p":"hW8yDr...","h":{"iv":"k4f..."}}',
	'789 Pine Rd, SF': '{"p":"iJ3zFt...","h":{"iv":"p7g..."}}',
};

interface QueryResult {
	type: 'success' | 'error';
	message: string;
	detail: string;
}

export function Level36Encryption({ onComplete }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();

	const [columns, setColumns] = useState<ColumnConfig[]>([
		{ name: 'email', isPII: true, mode: 'plaintext' },
		{ name: 'phone', isPII: true, mode: 'plaintext' },
		{ name: 'address', isPII: true, mode: 'plaintext' },
		{ name: 'name', isPII: false, mode: 'plaintext' },
	]);

	const [view, setView] = useState<'table' | 'dbdump'>('table');
	const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
	const [animatingColumn, setAnimatingColumn] = useState<string | null>(null);

	const getColumnConfig = useCallback(
		(name: string) => columns.find((c) => c.name === name)!,
		[columns],
	);

	const cycleEncryptionMode = useCallback(
		(columnName: string) => {
			const col = getColumnConfig(columnName);
			if (!col.isPII && col.mode === 'plaintext') {
				// Non-PII columns should not be encrypted (to teach the lesson)
				// But let the user try -- validation will catch it
			}

			setAnimatingColumn(columnName);
			setTimeout(() => setAnimatingColumn(null), 600);

			setColumns((prev) =>
				prev.map((c) => {
					if (c.name !== columnName) return c;
					const nextMode: EncryptionMode =
						c.mode === 'plaintext'
							? 'deterministic'
							: c.mode === 'deterministic'
								? 'non-deterministic'
								: 'plaintext';
					return { ...c, mode: nextMode };
				}),
			);
			setQueryResult(null);
		},
		[getColumnConfig],
	);

	const getCellValue = useCallback(
		(user: UserRow, columnName: string): string => {
			const col = getColumnConfig(columnName);
			const rawValue = user[columnName as keyof UserRow] as string;

			if (col.mode === 'plaintext') return rawValue;

			// Encrypted: show ciphertext
			return CIPHERTEXT_MAP[rawValue] ?? '{"p":"...","h":{"iv":"..."}}';
		},
		[getColumnConfig],
	);

	const handleQuery = useCallback(
		(type: 'email' | 'phone') => {
			const col = getColumnConfig(type);
			if (col.mode === 'plaintext') {
				setQueryResult({
					type: 'success',
					message:
						type === 'email'
							? 'User.find_by(email: "alice@example.com")'
							: 'User.find_by(phone: "+1-555-0123")',
					detail: 'Found! (but data is in plaintext -- not secure)',
				});
			} else if (col.mode === 'deterministic') {
				setQueryResult({
					type: 'success',
					message:
						type === 'email'
							? 'User.find_by(email: "alice@example.com")'
							: 'User.find_by(phone: "+1-555-0123")',
					detail:
						'Found! Deterministic encryption allows querying because the same input always produces the same ciphertext.',
				});
			} else {
				setQueryResult({
					type: 'error',
					message:
						type === 'email'
							? 'User.find_by(email: "alice@example.com")'
							: 'User.find_by(phone: "+1-555-0123")',
					detail:
						'ActiveRecord::EncryptionError: Cannot query on a non-deterministic encrypted column. Each encryption produces different ciphertext, so DB cannot match.',
				});
			}
		},
		[getColumnConfig],
	);

	const validateSolution = useCallback((): ValidationResult => {
		const emailCol = getColumnConfig('email');
		const phoneCol = getColumnConfig('phone');
		const addressCol = getColumnConfig('address');
		const nameCol = getColumnConfig('name');

		const errors: string[] = [];

		if (emailCol.mode !== 'deterministic') {
			errors.push(
				'Email needs to support lookups and uniqueness checks, which requires a queryable encryption mode.',
			);
		}
		if (phoneCol.mode !== 'non-deterministic') {
			errors.push(
				'Phone numbers are never used for lookups. The current mode exposes patterns unnecessarily.',
			);
		}
		if (addressCol.mode !== 'non-deterministic') {
			errors.push(
				'Addresses are never queried directly. The current mode exposes patterns unnecessarily.',
			);
		}
		if (nameCol.mode !== 'plaintext') {
			errors.push('Name is not PII in this context -- leave it as plaintext');
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Encryption configuration needs adjustment',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'All PII fields correctly encrypted!',
		};
	}, [getColumnConfig]);

	const handleComplete = async () => {
		const success = await completeLevel('act5-level36-encryption', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const handleReset = () => {
		setColumns([
			{ name: 'email', isPII: true, mode: 'plaintext' },
			{ name: 'phone', isPII: true, mode: 'plaintext' },
			{ name: 'address', isPII: true, mode: 'plaintext' },
			{ name: 'name', isPII: false, mode: 'plaintext' },
		]);
		setView('table');
		setQueryResult(null);
		setAnimatingColumn(null);
	};

	const encryptedCount = columns.filter((c) => c.mode !== 'plaintext').length;
	const piiEncrypted = columns.filter(
		(c) => c.isPII && c.mode !== 'plaintext',
	).length;

	const generatedCode = useMemo(() => {
		const emailLine =
			getColumnConfig('email').mode === 'deterministic'
				? '  encrypts :email, deterministic: true'
				: getColumnConfig('email').mode === 'non-deterministic'
					? '  encrypts :email'
					: '  # email: plaintext (not encrypted)';

		const phoneLine =
			getColumnConfig('phone').mode === 'deterministic'
				? '  encrypts :phone, deterministic: true'
				: getColumnConfig('phone').mode === 'non-deterministic'
					? '  encrypts :phone'
					: '  # phone: plaintext (not encrypted)';

		const addressLine =
			getColumnConfig('address').mode === 'deterministic'
				? '  encrypts :address, deterministic: true'
				: getColumnConfig('address').mode === 'non-deterministic'
					? '  encrypts :address'
					: '  # address: plaintext (not encrypted)';

		const nameLine =
			getColumnConfig('name').mode === 'deterministic'
				? '  encrypts :name, deterministic: true'
				: getColumnConfig('name').mode === 'non-deterministic'
					? '  encrypts :name'
					: '  # name: plaintext (not PII)';

		const emailQueryable = getColumnConfig('email').mode === 'deterministic';
		const phoneQueryable = getColumnConfig('phone').mode === 'deterministic';

		return `class User < ApplicationRecord
${emailLine}
${phoneLine}
${addressLine}
${nameLine}

${emailQueryable ? '  validates :email, uniqueness: true  # Works with deterministic!' : '  # validates :email, uniqueness: true'}
end

# Usage is transparent:
user = User.create!(
  email: "alice@example.com",
  phone: "+1-555-0123",
  address: "123 Main St"
)

user.email  # => "alice@example.com" (auto-decrypted)

${emailQueryable ? 'User.find_by(email: "alice@example.com")  # Works!' : '# User.find_by(email: ...) -- requires deterministic'}
${phoneQueryable ? 'User.find_by(phone: "+1-555-0123")        # Works!' : '# User.find_by(phone: ...) -- non-deterministic, raises error!'}

# In the database, an attacker sees:
# email => "${getColumnConfig('email').mode !== 'plaintext' ? '{"p":"dB3dhj...","h":{"iv":"f9w..."}}' : 'alice@example.com'}"
# phone => "${getColumnConfig('phone').mode !== 'plaintext' ? '{"p":"aX4kLm...","h":{"iv":"j8r..."}}' : '+1-555-0123'}"`;
	}, [getColumnConfig]);

	const highlightLines = useMemo(() => {
		const lines: number[] = [];
		if (getColumnConfig('email').mode !== 'plaintext') lines.push(2);
		if (getColumnConfig('phone').mode !== 'plaintext') lines.push(3);
		if (getColumnConfig('address').mode !== 'plaintext') lines.push(4);
		if (getColumnConfig('name').mode !== 'plaintext') lines.push(5);
		return lines;
	}, [getColumnConfig]);

	const getModeColor = (mode: EncryptionMode) => {
		switch (mode) {
			case 'plaintext':
				return 'text-destructive';
			case 'deterministic':
				return 'text-warning';
			case 'non-deterministic':
				return 'text-success';
		}
	};

	const getModeLabel = (mode: EncryptionMode) => {
		switch (mode) {
			case 'plaintext':
				return 'Plaintext';
			case 'deterministic':
				return 'Deterministic';
			case 'non-deterministic':
				return 'Non-deterministic';
		}
	};

	const getModeIcon = (mode: EncryptionMode) => {
		switch (mode) {
			case 'plaintext':
				return <Eye className="w-3.5 h-3.5" />;
			case 'deterministic':
				return <Key className="w-3.5 h-3.5" />;
			case 'non-deterministic':
				return <Lock className="w-3.5 h-3.5" />;
		}
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Encrypt PII at rest using Rails 8 encrypts with the right encryption mode for each field."
					instructions={[
						'Toggle each PII column between encryption modes',
						'Email needs deterministic (for find_by queries)',
						'Phone & address need non-deterministic (max security)',
						'Name is NOT PII -- leave as plaintext',
						'Try the query buttons to see deterministic vs non-deterministic behavior',
					]}
					scenario="A GDPR audit flagged that user PII (email, phone, address) is stored in plaintext. You need to encrypt sensitive fields at rest using Rails 8 encrypted attributes. Choose the right encryption mode for each field!"
				>
					{/* Encryption Status */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Encryption Status
						</div>
						<div className="space-y-2">
							{columns.map((col) => (
								<div
									className="flex items-center justify-between"
									key={col.name}
								>
									<div className="flex items-center gap-2">
										{col.mode !== 'plaintext' ? (
											<Lock className="w-3.5 h-3.5 text-success" />
										) : (
											<EyeOff className="w-3.5 h-3.5 text-destructive" />
										)}
										<span className="text-sm text-foreground font-mono">
											{col.name}
										</span>
										{col.isPII && (
											<span className="text-[10px] uppercase tracking-wider text-warning bg-warning/10 px-1.5 py-0.5 rounded">
												PII
											</span>
										)}
									</div>
									<span
										className={`text-xs font-medium ${getModeColor(col.mode)}`}
									>
										{getModeLabel(col.mode)}
									</span>
								</div>
							))}
						</div>
					</div>

					{/* Progress */}
					<div className="p-4 border-t border-border">
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">
								PII fields encrypted
							</span>
							<span
								className={
									piiEncrypted === 3 ? 'text-success' : 'text-foreground'
								}
							>
								{piiEncrypted} / 3
							</span>
						</div>
						<div className="bg-secondary rounded-full h-2 overflow-hidden">
							<div
								className="h-full bg-success transition-all duration-300"
								style={{
									width: `${(piiEncrypted / 3) * 100}%`,
								}}
							/>
						</div>
					</div>

					{/* Query Test */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Test Queries
						</div>
						<div className="space-y-2">
							<Button
								className="w-full justify-start gap-2"
								onClick={() => handleQuery('email')}
								size="sm"
								variant="outline"
							>
								<Search className="w-3.5 h-3.5" />
								<span className="font-mono text-xs">find_by(email: ...)</span>
							</Button>
							<Button
								className="w-full justify-start gap-2"
								onClick={() => handleQuery('phone')}
								size="sm"
								variant="outline"
							>
								<Search className="w-3.5 h-3.5" />
								<span className="font-mono text-xs">find_by(phone: ...)</span>
							</Button>
						</div>
						{queryResult && (
							<div
								className={`mt-3 p-3 rounded-lg border text-xs font-mono ${
									queryResult.type === 'success'
										? 'bg-success/10 border-success/30 text-success'
										: 'bg-destructive/10 border-destructive/30 text-destructive'
								}`}
							>
								<div className="font-semibold mb-1">
									{queryResult.type === 'success' ? '> ' : '! '}
									{queryResult.message}
								</div>
								<div className="text-[11px] opacity-80">
									{queryResult.detail}
								</div>
							</div>
						)}
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={5}
					levelName="Encrypted Attributes"
					levelNumber={36}
					onComplete={handleComplete}
					onReset={handleReset}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto">
						{/* View Toggle */}
						<div className="flex items-center gap-2 mb-6">
							<Button
								className={`gap-2 ${view === 'table' ? '' : 'text-muted-foreground'}`}
								onClick={() => setView('table')}
								size="sm"
								variant={view === 'table' ? 'default' : 'ghost'}
							>
								<Database className="w-4 h-4" />
								Users Table
							</Button>
							<Button
								className={`gap-2 ${view === 'dbdump' ? '' : 'text-muted-foreground'}`}
								onClick={() => setView('dbdump')}
								size="sm"
								variant={view === 'dbdump' ? 'default' : 'ghost'}
							>
								<ShieldCheck className="w-4 h-4" />
								DB Dump (Attacker View)
							</Button>
						</div>

						{view === 'table' ? (
							/* Interactive Table View */
							<div className="bg-card rounded-xl border border-border overflow-hidden">
								<div className="bg-secondary px-4 py-3 border-b border-border flex items-center gap-2">
									<Database className="w-4 h-4 text-muted-foreground" />
									<span className="text-foreground font-semibold text-sm">
										users
									</span>
									<span className="text-muted-foreground text-xs ml-2">
										Click column headers to toggle encryption mode
									</span>
								</div>

								<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead>
											<tr className="border-b border-border">
												<th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
													id
												</th>
												{columns.map((col) => (
													<th className="px-4 py-3 text-left" key={col.name}>
														<Button
															className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors hover:opacity-80 h-auto p-0 ${getModeColor(col.mode)}`}
															onClick={() => cycleEncryptionMode(col.name)}
															variant="ghost"
														>
															{getModeIcon(col.mode)}
															{col.name}
															{col.isPII && (
																<span className="text-[9px] bg-warning/10 text-warning px-1 py-0.5 rounded normal-case tracking-normal">
																	PII
																</span>
															)}
														</Button>
														<div
															className={`text-[10px] font-normal mt-1 ${getModeColor(col.mode)}`}
														>
															{getModeLabel(col.mode)}
														</div>
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{SAMPLE_USERS.map((user) => (
												<tr
													className="border-b border-border last:border-0 hover:bg-secondary/50"
													key={user.id}
												>
													<td className="px-4 py-3 text-muted-foreground font-mono">
														{user.id}
													</td>
													{columns.map((col) => {
														const rawValue = user[
															col.name as keyof UserRow
														] as string;
														const isEncrypted = col.mode !== 'plaintext';
														const displayValue = isEncrypted
															? (CIPHERTEXT_MAP[rawValue] ?? rawValue)
															: rawValue;
														const isAnimating = animatingColumn === col.name;

														return (
															<td
																className={`px-4 py-3 font-mono text-xs transition-all duration-300 ${
																	isAnimating ? 'bg-primary/10' : ''
																} ${
																	isEncrypted
																		? 'text-success/70'
																		: 'text-foreground'
																}`}
																key={col.name}
															>
																<div className="flex items-center gap-1.5">
																	{isEncrypted && (
																		<Lock className="w-3 h-3 text-success/50 shrink-0" />
																	)}
																	<span
																		className={`truncate max-w-[180px] ${
																			isEncrypted ? 'text-[11px]' : ''
																		}`}
																		title={displayValue}
																	>
																		{displayValue}
																	</span>
																</div>
															</td>
														);
													})}
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						) : (
							/* DB Dump / Attacker View */
							<div className="bg-card rounded-xl border border-border overflow-hidden">
								<div className="bg-destructive/10 px-4 py-3 border-b border-destructive/30 flex items-center gap-2">
									<ShieldCheck className="w-4 h-4 text-destructive" />
									<span className="text-destructive font-semibold text-sm">
										Attacker's View: Raw Database Dump
									</span>
								</div>
								<div className="p-4 font-mono text-xs space-y-4">
									<div className="text-muted-foreground mb-2">
										SELECT * FROM users;
									</div>
									{SAMPLE_USERS.map((user) => (
										<div
											className="bg-background rounded-lg border border-border p-3 space-y-1.5"
											key={user.id}
										>
											<div className="text-muted-foreground">
												<span className="text-foreground">id:</span> {user.id}
											</div>
											{columns.map((col) => {
												const rawValue = user[
													col.name as keyof UserRow
												] as string;
												const isEncrypted = col.mode !== 'plaintext';
												const displayValue = isEncrypted
													? (CIPHERTEXT_MAP[rawValue] ?? rawValue)
													: rawValue;

												return (
													<div
														className={
															isEncrypted
																? 'text-success/60'
																: 'text-destructive'
														}
														key={col.name}
													>
														<span className="text-foreground">{col.name}:</span>{' '}
														{isEncrypted ? (
															<span className="break-all">{displayValue}</span>
														) : (
															<span>
																{displayValue}
																<span className="text-destructive ml-2 text-[10px]">
																	EXPOSED
																</span>
															</span>
														)}
													</div>
												);
											})}
										</div>
									))}
									{encryptedCount > 0 && (
										<div className="text-center text-muted-foreground py-2 border-t border-border">
											{encryptedCount === 4
												? 'All fields encrypted. Attacker sees only gibberish.'
												: `${encryptedCount} of 4 fields encrypted. ${4 - encryptedCount} still exposed.`}
										</div>
									)}
									{encryptedCount === 0 && (
										<div className="text-center text-destructive py-2 border-t border-border">
											All data exposed in plaintext. Encrypt PII fields!
										</div>
									)}
								</div>
							</div>
						)}

						{/* Encryption Mode Legend */}
						<div className="mt-6 bg-card rounded-xl border border-border p-4">
							<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
								Encryption Modes
							</div>
							<div className="grid grid-cols-3 gap-4">
								<div className="flex items-start gap-2">
									<Eye className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
									<div>
										<div className="text-xs font-semibold text-destructive">
											Plaintext
										</div>
										<div className="text-[11px] text-muted-foreground">
											No encryption. Data visible to anyone with DB access.
										</div>
									</div>
								</div>
								<div className="flex items-start gap-2">
									<Key className="w-4 h-4 text-warning mt-0.5 shrink-0" />
									<div>
										<div className="text-xs font-semibold text-warning">
											Deterministic
										</div>
										<div className="text-[11px] text-muted-foreground">
											Same input = same ciphertext. Allows find_by, where,
											uniqueness.
										</div>
									</div>
								</div>
								<div className="flex items-start gap-2">
									<Lock className="w-4 h-4 text-success mt-0.5 shrink-0" />
									<div>
										<div className="text-xs font-semibold text-success">
											Non-deterministic
										</div>
										<div className="text-[11px] text-muted-foreground">
											Same input = different ciphertext. Max security, no
											querying.
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/models/user.rb',
							language: 'ruby',
							code: generatedCode,
							highlight: highlightLines,
						},
						{
							filename: 'config/credentials.yml.enc',
							language: 'yaml',
							code: `active_record_encryption:
  primary_key: "EGY8WhulUOXixybod7ZWwMIL68R9o5kC"
  deterministic_key: "aPA5XyALhf75NNnMzaspW7akTfZp0lPY"
  key_derivation_salt: "xEY0dt6TZcAMg52K7O84wYzkjvbA62Hz"

# Generated with:
# bin/rails db:encryption:init`,
							highlight: [2, 3, 4],
						},
					]}
					learningGoal="Rails 8 encrypts provides deterministic (queryable) and non-deterministic (more secure) encryption. Use deterministic only for fields you need to search."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li className="flex items-start gap-1.5">
								<Key className="w-3 h-3 text-warning mt-0.5 shrink-0" />
								Deterministic: same input = same ciphertext (queryable)
							</li>
							<li className="flex items-start gap-1.5">
								<Lock className="w-3 h-3 text-success mt-0.5 shrink-0" />
								Non-deterministic: same input = different ciphertext (secure)
							</li>
							<li className="flex items-start gap-1.5">
								<ShieldCheck className="w-3 h-3 text-primary mt-0.5 shrink-0" />
								Encryption is transparent to application code
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							When to Use Each
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>Deterministic: email (find_by, uniqueness validation)</li>
							<li>
								Non-deterministic: phone, address, SSN (no querying needed)
							</li>
							<li>Plaintext: non-sensitive data (name, preferences)</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level36Encryption;
