/**
 * Level 10: Encrypted Attributes
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Custom "Database Breach View" visualization.
 *   A database table showing 3 user rows with columns: id, email, phone, address.
 *   All PII columns are plaintext (red). The player fires probes that reveal what
 *   an attacker sees: SQL injection dumps, backup leaks, frequency analysis.
 *
 * Phase 2 (HOW - build): 5 steps (1 terminal + 4 OptionCard)
 *   Step 0: Generate encryption keys (terminal)
 *   Step 1: Add keys to Rails credentials (OptionCard)
 *   Step 2: Encrypt email with deterministic mode (OptionCard)
 *   Step 3: Encrypt phone and address with non-deterministic mode (OptionCard)
 *   Step 4: Update service to handle encrypted queries (OptionCard)
 *
 * Phase 3 (ADVANTAGE - reward): Same table, now showing ciphertext for PII.
 *   Allowed: Deterministic find_by works, app code reads plaintext.
 *   Blocked: Non-deterministic find_by fails, attacker sees gibberish.
 *
 * Teaches: Rails 8 encrypts, deterministic vs non-deterministic,
 *   db:encryption:init, credentials, transparent encryption
 */

import { ArrowRight, Database, Eye, Key, Lock, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	OptionCard,
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
	type TerminalStepData,
	type ValidationResult,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import {
	type ProbeConfig,
	ProbeTerminal,
} from '@/components/levels/ProbeTerminal';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Button } from '@/components/ui/Button';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { registerLevelCode } from '@/lib/codebase-registry';
import type { LevelComponentProps } from '@/lib/levels-registry';
import { shuffleOptions } from '@/lib/shuffleOptions';
import { cn } from '@/lib/utils';

registerLevelCode('act2-level10-encryption', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Sample data for visualization
// ──────────────────────────────────────────────

const SAMPLE_USERS = [
	{
		id: 1,
		email: 'alice@example.com',
		phone: '+1-555-0123',
		address: '123 Main St, NYC',
		name: 'Alice',
	},
	{
		id: 2,
		email: 'bob@corp.io',
		phone: '+1-555-0456',
		address: '456 Oak Ave, LA',
		name: 'Bob',
	},
	{
		id: 3,
		email: 'carol@startup.dev',
		phone: '+1-555-0789',
		address: '789 Pine Rd, SF',
		name: 'Carol',
	},
];

const CIPHERTEXT: Record<string, string> = {
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

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'plaintext-email', label: 'Emails exposed in plaintext' },
	{ id: 'plaintext-phone', label: 'Phone numbers exposed in plaintext' },
	{ id: 'plaintext-address', label: 'Addresses exposed in plaintext' },
	{ id: 'no-encryption-keys', label: 'No encryption keys configured' },
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'sql-injection': ['plaintext-email', 'plaintext-phone'],
	'backup-leak': ['plaintext-address'],
	'inspect-config': ['no-encryption-keys'],
};

// ──────────────────────────────────────────────
// Probe definitions
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'sql-injection',
		label: 'SQL injection attack',
		command: "SELECT email, phone FROM users WHERE id = '1 OR 1=1'",
		responseLines: [
			{ text: 'alice@example.com  | +1-555-0123', color: 'red' },
			{ text: 'bob@corp.io        | +1-555-0456', color: 'red' },
			{ text: 'carol@startup.dev  | +1-555-0789', color: 'red' },
			{ text: '# All emails and phones dumped in plaintext!', color: 'yellow' },
		],
		story: [
			'An attacker finds a SQL injection vulnerability in the search endpoint.',
			"They craft a query that bypasses the WHERE clause: id = '1 OR 1=1'.",
			'The database returns every row in the users table.',
			'All emails and phone numbers are stored in plaintext.',
			'The attacker now has the full customer PII dump.',
		],
	},
	{
		id: 'backup-leak',
		label: 'Database backup exposed',
		command: 'pg_dump myapp_production | grep address',
		responseLines: [
			{ text: '123 Main St, NYC', color: 'red' },
			{ text: '456 Oak Ave, LA', color: 'red' },
			{ text: '789 Pine Rd, SF', color: 'red' },
			{
				text: '# Backup file contains all addresses in plaintext!',
				color: 'yellow',
			},
			{
				text: '# GDPR violation: PII accessible outside the app.',
				color: 'red',
			},
		],
		story: [
			'The ops team runs a nightly pg_dump for disaster recovery.',
			'The backup file is stored on an external server.',
			'A contractor with backup access runs grep to search for addresses.',
			'Every customer address appears in plaintext in the dump.',
			'This is a GDPR violation: PII is accessible outside the application boundary.',
		],
	},
	{
		id: 'inspect-config',
		label: 'Check encryption config',
		command: 'rails runner "puts ActiveRecord::Encryption.config.primary_key"',
		responseLines: [
			{ text: '=> nil', color: 'red' },
			{ text: 'No encryption keys configured!', color: 'red' },
			{ text: 'ActiveRecord::Encryption is not initialized.', color: 'yellow' },
			{ text: 'Run: bin/rails db:encryption:init', color: 'muted' },
		],
		story: [
			'A developer checks whether encryption is set up in this Rails app.',
			'They inspect the ActiveRecord::Encryption configuration.',
			'The primary_key returns nil. No encryption keys are configured.',
			'Without keys, the encrypts declaration in models would have no effect.',
			'All PII columns are stored and queryable as raw plaintext.',
		],
	},
];

// ──────────────────────────────────────────────
// Build step definitions
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'generate-keys', title: 'Generate Encryption Keys' },
	{ id: 'add-credentials', title: 'Secure Key Storage' },
	{ id: 'encrypt-email', title: 'Encrypt Email Column' },
	{ id: 'encrypt-pii', title: 'Encrypt Phone & Address' },
	{ id: 'update-service', title: 'Update Lookup Service' },
];

// Terminal step 0: Generate encryption keys
const KEYGEN_COMMANDS = [
	{
		id: 'wrong-generate-key',
		label: 'rails generate encryption',
		command: 'rails generate encryption',
		correct: false,
		feedback:
			'There is no "encryption" generator. Rails provides a dedicated rake task for generating the three encryption keys.',
	},
	{
		id: 'correct-init',
		label: 'bin/rails db:encryption:init',
		command: 'bin/rails db:encryption:init',
		correct: true,
	},
	{
		id: 'wrong-secret',
		label: 'rails secret',
		command: 'rails secret',
		correct: false,
		feedback:
			'rails secret generates a single random string. Encryption requires three specific keys: primary_key, deterministic_key, and key_derivation_salt.',
	},
];

const KEYGEN_OUTPUT = [
	{
		text: 'Add this entry to the credentials of the target environment:',
		color: 'green' as const,
	},
	{ text: '', color: 'muted' as const },
	{ text: 'active_record_encryption:', color: 'cyan' as const },
	{
		text: '  primary_key: EGY8WhulUOXixybod7ZWwMIL68R9o5kC',
		color: 'cyan' as const,
	},
	{
		text: '  deterministic_key: aPA5XyALhf75NNnMzaspW7akTfZp0lPY',
		color: 'cyan' as const,
	},
	{
		text: '  key_derivation_salt: xEY0dt6TZcAMg52K7O84wYzkjvbA62Hz',
		color: 'cyan' as const,
	},
];

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: KEYGEN_COMMANDS, outputLines: KEYGEN_OUTPUT },
	null, // step 1: OptionCard
	null, // step 2: OptionCard
	null, // step 3: OptionCard
	null, // step 4: OptionCard
];

// OptionCard step 1: Add keys to credentials
const CREDENTIALS_OPTIONS = [
	{
		id: 'wrong-env-var',
		label: `# .env file
ENCRYPTION_PRIMARY_KEY=EGY8Whul...
ENCRYPTION_DETERMINISTIC_KEY=aPA5XyAL...
ENCRYPTION_SALT=xEY0dt6T...

# config/application.rb
config.active_record_encryption.primary_key =
  ENV['ENCRYPTION_PRIMARY_KEY']`,
		correct: false,
		feedback:
			'Environment variables in .env files are not encrypted and can be accidentally committed. Rails credentials are encrypted at rest and the standard location for encryption keys.',
	},
	{
		id: 'correct-credentials',
		label: `# EDITOR=vim rails credentials:edit
active_record_encryption:
  primary_key: EGY8WhulUOXixybod7ZWwMIL68R9o5kC
  deterministic_key: aPA5XyALhf75NNnMzaspW7akTfZp0lPY
  key_derivation_salt: xEY0dt6TZcAMg52K7O84wYzkjvbA62Hz

# Encrypted in config/credentials.yml.enc
# Decrypted at runtime via config/master.key`,
		correct: true,
	},
	{
		id: 'wrong-initializer',
		label: `# config/initializers/encryption.rb
ActiveRecord::Encryption.configure(
  primary_key: "EGY8WhulUOXixybod7ZWwMIL68R9o5kC",
  deterministic_key: "aPA5XyALhf75NNnMzaspW7akTfZp0lPY",
  key_derivation_salt: "xEY0dt6TZcAMg52K7O84wYzkjvbA62Hz"
)`,
		correct: false,
		feedback:
			'Hardcoding keys in an initializer file means they are stored in plaintext in your repository. Rails credentials encrypts them at rest.',
	},
];

// OptionCard step 2: Encrypt email (deterministic)
const EMAIL_ENCRYPTION_OPTIONS = [
	{
		id: 'wrong-non-deterministic',
		label: `class User < ApplicationRecord
  encrypts :email
  # Default mode: each encryption produces
  # a unique ciphertext, even for the same value
end`,
		correct: false,
		feedback:
			'Non-deterministic encryption means the same email produces different ciphertext each time. The database cannot match on it, breaking login lookups and uniqueness validation.',
	},
	{
		id: 'correct-deterministic',
		label: `class User < ApplicationRecord
  encrypts :email, deterministic: true
  # Deterministic mode: same plaintext always
  # produces the same ciphertext
end`,
		correct: true,
	},
	{
		id: 'wrong-downcase-only',
		label: `class User < ApplicationRecord
  encrypts :email, downcase: true
  # Normalize to lowercase before encrypting
end`,
		correct: false,
		feedback:
			'The downcase option normalizes the value but does not set the encryption mode. Without deterministic: true, this still uses non-deterministic encryption by default.',
	},
];

// OptionCard step 3: Encrypt phone and address (non-deterministic)
const PII_ENCRYPTION_OPTIONS = [
	{
		id: 'wrong-deterministic-pii',
		label: `class User < ApplicationRecord
  encrypts :email, deterministic: true
  encrypts :phone, deterministic: true
  encrypts :address, deterministic: true
end`,
		correct: false,
		feedback:
			'Deterministic mode is a tradeoff: it enables querying but identical values produce identical ciphertext. Email needed that tradeoff for login lookups. Phone and address are never queried, so there is no reason to accept weaker encryption for them.',
	},
	{
		id: 'correct-non-deterministic',
		label: `class User < ApplicationRecord
  encrypts :email, deterministic: true
  encrypts :phone
  encrypts :address
end`,
		correct: true,
	},
	{
		id: 'wrong-encrypt-name',
		label: `class User < ApplicationRecord
  encrypts :email, deterministic: true
  encrypts :phone
  encrypts :address
  encrypts :name
end`,
		correct: false,
		feedback:
			'Name is not PII in this context and does not need encryption. Over-encrypting adds performance overhead (encryption/decryption on every read/write) with no security benefit.',
	},
];

// OptionCard step 4: Update service for encrypted queries
const SERVICE_OPTIONS = [
	{
		id: 'wrong-raw-sql',
		label: `class FindUser < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def call
    v = FindUserContract.new.call(email: @email)
    return Result.new(success?: false,
      user: nil, errors: v.errors.to_h) if v.failure?

    user = User.find_by_sql(
      "SELECT * FROM users WHERE email = '#{@email}'")
    # Raw SQL bypasses encryption!
    Result.new(success?: true, user: user.first, errors: [])
  end
end`,
		correct: false,
		feedback:
			'Raw SQL queries bypass ActiveRecord encryption entirely. The database stores ciphertext, so a plaintext WHERE clause will never match. Use ActiveRecord query methods which handle encryption transparently.',
	},
	{
		id: 'wrong-manual-encrypt',
		label: `class FindUser < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(email:)
    @email = email
  end

  def call
    v = FindUserContract.new.call(email: @email)
    return Result.new(success?: false,
      user: nil, errors: v.errors.to_h) if v.failure?

    cipher = ActiveRecord::Encryption.encryptor
    encrypted = cipher.encrypt(@email)
    user = User.find_by(email: encrypted)
    Result.new(success?: true, user:, errors: [])
  end
end`,
		correct: false,
		feedback:
			'You do not need to manually encrypt query values. ActiveRecord handles encryption and decryption transparently when you use standard query methods like find_by.',
	},
	{
		id: 'correct-activerecord',
		label: `class FindUser < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(email:)
    @email = email
  end

  def call
    v = FindUserContract.new.call(email: @email)
    return Result.new(success?: false,
      user: nil, errors: v.errors.to_h) if v.failure?

    user = User.find_by(email: @email)
    return Result.new(success?: false,
      user: nil, errors: ["Not found"]) unless user

    Result.new(success?: true, user:, errors: [])
  end
end`,
		correct: true,
	},
];

const OPTION_STEP_CONFIG: Record<
	number,
	{
		title: string;
		description: string;
		options: {
			id: string;
			label: string;
			correct: boolean;
			feedback?: string;
		}[];
	}
> = {
	1: {
		title: 'Store Encryption Keys',
		description:
			'The three generated keys need to be stored securely. Choose the right storage mechanism.',
		options: CREDENTIALS_OPTIONS,
	},
	2: {
		title: 'Encrypt the Email Column',
		description:
			'Email is used for login (find_by) and uniqueness validation. Choose the right encryption mode.',
		options: EMAIL_ENCRYPTION_OPTIONS,
	},
	3: {
		title: 'Encrypt Phone & Address',
		description:
			'Phone and address are never used for lookups. Choose the encryption approach that maximizes security.',
		options: PII_ENCRYPTION_OPTIONS,
	},
	4: {
		title: 'Update the Lookup Service',
		description:
			'The FindUser service needs to work correctly with encrypted email. Choose the right query approach.',
		options: SERVICE_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'find-by-email',
		label: 'GET find user by email',
		description: 'Look up user by encrypted email (deterministic)',
		method: 'GET',
		path: '/api/v1/users?email=alice@example.com',
		actor: 'authenticated user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: 'User.find_by(email: "alice@example.com")', color: 'cyan' },
			{
				text: 'Deterministic: query value encrypted, matched in DB.',
				color: 'green',
			},
		],
	},
	{
		id: 'find-by-phone',
		label: 'GET find user by phone',
		description: 'Try to look up by non-deterministic phone',
		method: 'GET',
		path: '/api/v1/users?phone=+1-555-0123',
		actor: 'authenticated user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{ text: 'ActiveRecord::EncryptionError', color: 'yellow' },
			{
				text: 'Cannot query non-deterministic column. Each encryption differs.',
				color: 'red',
			},
		],
	},
	{
		id: 'attacker-dump',
		label: 'SQL injection attack',
		description: 'Attacker tries to dump user table',
		method: 'GET',
		path: "/api/v1/users?id=1' OR 1=1",
		actor: 'attacker',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK (but data is encrypted!)', color: 'green' },
			{ text: 'email: {"p":"dB3dhj...","h":{"iv":"f9w..."}}', color: 'cyan' },
			{ text: 'phone: {"p":"aX4kLm...","h":{"iv":"j8r..."}}', color: 'cyan' },
			{ text: 'Attacker sees ciphertext, not PII.', color: 'green' },
		],
	},
	{
		id: 'uniqueness-validation',
		label: 'POST create duplicate email',
		description: 'Try to create user with existing email',
		method: 'POST',
		path: '/api/v1/users',
		actor: 'authenticated user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{ text: '{ error: { code: "VALIDATION_FAILED" } }', color: 'yellow' },
			{
				text: 'validates :email, uniqueness: true works with deterministic!',
				color: 'cyan',
			},
		],
	},
	{
		id: 'transparent-read',
		label: 'GET user profile',
		description: 'Read user profile (encryption is transparent)',
		method: 'GET',
		path: '/api/v1/users/1',
		actor: 'authenticated user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: 'email: "alice@example.com" (auto-decrypted)', color: 'cyan' },
			{ text: 'phone: "+1-555-0123" (auto-decrypted)', color: 'cyan' },
			{
				text: 'App code sees plaintext. DB stores ciphertext.',
				color: 'green',
			},
		],
	},
	{
		id: 'backup-safe',
		label: 'Database backup audit',
		description: 'Verify PII is encrypted in database backups',
		method: 'GET',
		path: '/admin/audit/backup-check',
		actor: 'security auditor',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: 'All PII columns encrypted at rest.', color: 'green' },
			{ text: 'Backup leak would expose only ciphertext.', color: 'cyan' },
			{ text: 'GDPR compliance: PASS', color: 'green' },
		],
	},
	{
		id: 'encryption-config',
		label: 'Check encryption config',
		description: 'Verify encryption keys are configured',
		method: 'GET',
		path: '/admin/audit/encryption-status',
		actor: 'security auditor',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: 'primary_key: configured', color: 'cyan' },
			{ text: 'deterministic_key: configured', color: 'cyan' },
			{ text: 'key_derivation_salt: configured', color: 'cyan' },
			{ text: 'ActiveRecord::Encryption: ACTIVE', color: 'green' },
		],
	},
	{
		id: 'sql-injection',
		label: 'SQL injection attack',
		description: 'Attacker exploits SQL injection to dump user table',
		method: 'GET',
		path: "/api/v1/users?id=1' OR 1=1",
		actor: 'attacker',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK (but data is encrypted!)', color: 'green' },
			{ text: 'email: {"p":"dB3dhj...","h":{"iv":"f9w..."}}', color: 'cyan' },
			{ text: 'phone: {"p":"aX4kLm...","h":{"iv":"j8r..."}}', color: 'cyan' },
			{ text: 'Attacker sees ciphertext, not PII.', color: 'green' },
		],
	},
	{
		id: 'backup-leak',
		label: 'Database backup exposed',
		description: 'Database backup file is leaked externally',
		method: 'GET',
		path: '/admin/audit/backup-check',
		actor: 'attacker',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'Backup contains only ciphertext for PII columns.',
				color: 'green',
			},
			{ text: 'email: {"p":"dB3dhj...","h":{"iv":"f9w..."}}', color: 'cyan' },
			{ text: 'address: {"p":"nQ2zRt...","h":{"iv":"w7k..."}}', color: 'cyan' },
			{ text: 'No plaintext PII in backup. GDPR safe.', color: 'green' },
		],
	},
	{
		id: 'inspect-config',
		label: 'Check encryption config',
		description: 'Verify encryption keys are properly configured',
		method: 'GET',
		path: '/admin/audit/encryption-status',
		actor: 'security auditor',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: 'primary_key: configured', color: 'cyan' },
			{ text: 'deterministic_key: configured', color: 'cyan' },
			{ text: 'ActiveRecord::Encryption: ACTIVE', color: 'green' },
		],
	},
];

// ──────────────────────────────────────────────
// Reward: per-scenario visualization config
// ──────────────────────────────────────────────

interface RewardVizConfig {
	banner: string;
	bannerType: 'success' | 'danger' | 'info';
	/** Which perspective to highlight: 'app' shows plaintext, 'db' shows ciphertext, 'both' shows split */
	perspective: 'app' | 'db' | 'both';
	/** Which columns to highlight in the active perspective */
	highlightCols: string[];
	/** Which row to focus (null = all rows) */
	focusRow: number | null;
}

const REWARD_VIZ: Record<string, RewardVizConfig> = {
	'find-by-email': {
		banner: 'Deterministic: query encrypted, matched in DB. User found.',
		bannerType: 'success',
		perspective: 'both',
		highlightCols: ['email'],
		focusRow: 1,
	},
	'find-by-phone': {
		banner:
			'Non-deterministic: same phone encrypts differently each time. No match possible.',
		bannerType: 'danger',
		perspective: 'db',
		highlightCols: ['phone'],
		focusRow: null,
	},
	'attacker-dump': {
		banner:
			'Attacker dumped the table but sees only ciphertext. No PII exposed.',
		bannerType: 'success',
		perspective: 'db',
		highlightCols: ['email', 'phone', 'address'],
		focusRow: null,
	},
	'uniqueness-validation': {
		banner:
			'Deterministic email: duplicate detected via ciphertext match. 422 rejected.',
		bannerType: 'danger',
		perspective: 'both',
		highlightCols: ['email'],
		focusRow: 1,
	},
	'transparent-read': {
		banner:
			'App reads plaintext automatically. Encryption is invisible to application code.',
		bannerType: 'success',
		perspective: 'both',
		highlightCols: ['email', 'phone', 'address'],
		focusRow: 1,
	},
	'backup-safe': {
		banner: 'Database backup contains only ciphertext. GDPR compliance: PASS.',
		bannerType: 'success',
		perspective: 'db',
		highlightCols: ['email', 'phone', 'address'],
		focusRow: null,
	},
	'encryption-config': {
		banner:
			'All three encryption keys configured. ActiveRecord::Encryption is active.',
		bannerType: 'info',
		perspective: 'app',
		highlightCols: [],
		focusRow: null,
	},
	'sql-injection': {
		banner:
			'Attacker dumped the table but sees only ciphertext. No PII exposed.',
		bannerType: 'success',
		perspective: 'db',
		highlightCols: ['email', 'phone', 'address'],
		focusRow: null,
	},
	'backup-leak': {
		banner: 'Database backup contains only ciphertext. GDPR compliance: PASS.',
		bannerType: 'success',
		perspective: 'db',
		highlightCols: ['email', 'phone', 'address'],
		focusRow: null,
	},
	'inspect-config': {
		banner:
			'All encryption keys configured. ActiveRecord::Encryption is active.',
		bannerType: 'info',
		perspective: 'app',
		highlightCols: [],
		focusRow: null,
	},
};

// ──────────────────────────────────────────────
// Code preview files
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, completedStep: number) {
	if (phase === 'observe') {
		return [
			{
				filename: 'app/models/user.rb',
				language: 'ruby',
				code: `class User < ApplicationRecord
  has_secure_password

  # PII stored in PLAINTEXT!
  # email: "alice@example.com"
  # phone: "+1-555-0123"
  # address: "123 Main St, NYC"

  # No encrypts declarations
  # No encryption keys configured
  # Database breach = full PII exposure

  has_one_attached :avatar do |attachable|
    attachable.variant :thumb, resize_to_limit: [100, 100]
    attachable.variant :medium, resize_to_limit: [300, 300]
  end

  validates :email, uniqueness: true
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }
end`,
			},
			{
				filename: 'app/services/find_user.rb',
				language: 'ruby',
				code: `class FindUser < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(email:)
    @email = email
  end

  def call
    v = FindUserContract.new.call(email: @email)
    return Result.new(success?: false,
      user: nil, errors: v.errors.to_h) if v.failure?

    user = User.find_by(email: @email)
    # Works with plaintext... but data is exposed!
    Result.new(success?: true, user:, errors: [])
  end
end`,
			},
		];
	}

	if (phase === 'build') {
		// Step 0 (generate keys): db:encryption:init prints to stdout,
		// no files are modified. Show unchanged "before" model.
		if (completedStep < 0) {
			return [
				{
					filename: 'app/models/user.rb',
					language: 'ruby',
					code: `class User < ApplicationRecord
  has_secure_password

  # PII stored in PLAINTEXT!
  # email: "alice@example.com"
  # phone: "+1-555-0123"
  # address: "123 Main St, NYC"

  has_one_attached :avatar do |attachable|
    attachable.variant :thumb, resize_to_limit: [100, 100]
    attachable.variant :medium, resize_to_limit: [300, 300]
  end

  validates :email, uniqueness: true
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }
end`,
				},
			];
		}
		// Step 1 (store keys): still working on WHERE to store them.
		// Keep showing unchanged model; don't show credentials.yml.enc
		// (that would reveal the answer).
		if (completedStep < 1) {
			return [
				{
					filename: 'app/models/user.rb',
					language: 'ruby',
					code: `class User < ApplicationRecord
  has_secure_password

  # PII stored in PLAINTEXT!
  # email: "alice@example.com"
  # phone: "+1-555-0123"
  # address: "123 Main St, NYC"

  has_one_attached :avatar do |attachable|
    attachable.variant :thumb, resize_to_limit: [100, 100]
    attachable.variant :medium, resize_to_limit: [300, 300]
  end

  validates :email, uniqueness: true
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }
end`,
				},
			];
		}
		// After step 1 completed: keys stored in credentials.
		// Show the credentials file + unchanged model.
		if (completedStep < 2) {
			return [
				{
					filename: 'config/credentials.yml.enc',
					language: 'yaml',
					code: `active_record_encryption:
  primary_key: EGY8WhulUOXixybod7ZWwMIL68R9o5kC
  deterministic_key: aPA5XyALhf75NNnMzaspW7akTfZp0lPY
  key_derivation_salt: xEY0dt6TZcAMg52K7O84wYzkjvbA62Hz`,
				},
				{
					filename: 'app/models/user.rb',
					language: 'ruby',
					code: `class User < ApplicationRecord
  has_secure_password

  # Keys are stored. Now encrypt the PII columns.
  # email: "alice@example.com"  (still plaintext)
  # phone: "+1-555-0123"        (still plaintext)
  # address: "123 Main St, NYC" (still plaintext)

  has_one_attached :avatar do |attachable|
    attachable.variant :thumb, resize_to_limit: [100, 100]
    attachable.variant :medium, resize_to_limit: [300, 300]
  end

  validates :email, uniqueness: true
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }
end`,
				},
			];
		}
		if (completedStep < 3) {
			return [
				{
					filename: 'app/models/user.rb',
					language: 'ruby',
					code: `class User < ApplicationRecord
  has_secure_password

  encrypts :email, deterministic: true

  # phone and address are still plaintext.
  # They need encryption too.

  has_one_attached :avatar do |attachable|
    attachable.variant :thumb, resize_to_limit: [100, 100]
    attachable.variant :medium, resize_to_limit: [300, 300]
  end

  validates :email, uniqueness: true
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }
end`,
				},
			];
		}
		// After step 3 completed, working on step 4: show model with
		// all encrypts declarations + the UNCHANGED service (before fix).
		// Do NOT show the corrected service -- that's the step 4 answer.
		if (completedStep < 4) {
			return [
				{
					filename: 'app/models/user.rb',
					language: 'ruby',
					code: `class User < ApplicationRecord
  has_secure_password

  encrypts :email, deterministic: true
  encrypts :phone
  encrypts :address

  has_one_attached :avatar do |attachable|
    attachable.variant :thumb, resize_to_limit: [100, 100]
    attachable.variant :medium, resize_to_limit: [300, 300]
  end

  validates :email, uniqueness: true
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }
end`,
				},
				{
					filename: 'app/services/find_user.rb',
					language: 'ruby',
					code: `class FindUser < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(email:)
    @email = email
  end

  def call
    v = FindUserContract.new.call(email: @email)
    return Result.new(success?: false,
      user: nil, errors: v.errors.to_h) if v.failure?

    user = User.find_by(email: @email)
    # Works with plaintext... but data is now encrypted!
    # Does this query approach still work?
    Result.new(success?: true, user:, errors: [])
  end
end`,
				},
			];
		}
		// All steps complete: show the final corrected code.
		return [
			{
				filename: 'app/services/find_user.rb',
				language: 'ruby',
				code: `class FindUser < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(email:)
    @email = email
  end

  def call
    v = FindUserContract.new.call(email: @email)
    return Result.new(success?: false,
      user: nil, errors: v.errors.to_h) if v.failure?

    # ActiveRecord encrypts the query value automatically
    user = User.find_by(email: @email)
    return Result.new(success?: false,
      user: nil, errors: ["Not found"]) unless user

    Result.new(success?: true, user:, errors: [])
  end
end`,
			},
			{
				filename: 'app/models/user.rb',
				language: 'ruby',
				code: `class User < ApplicationRecord
  has_secure_password

  encrypts :email, deterministic: true
  encrypts :phone
  encrypts :address

  has_one_attached :avatar do |attachable|
    attachable.variant :thumb, resize_to_limit: [100, 100]
    attachable.variant :medium, resize_to_limit: [300, 300]
  end

  validates :email, uniqueness: true
end`,
			},
		];
	}

	// reward
	return [
		{
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password

  # Deterministic: queryable (find_by, uniqueness)
  encrypts :email, deterministic: true

  # Non-deterministic: max security, no querying
  encrypts :phone
  encrypts :address

  has_one_attached :avatar do |attachable|
    attachable.variant :thumb, resize_to_limit: [100, 100]
    attachable.variant :medium, resize_to_limit: [300, 300]
  end

  validates :email, uniqueness: true
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }
end`,
		},
		{
			filename: 'app/services/find_user.rb',
			language: 'ruby',
			code: `class FindUser < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(email:)
    @email = email
  end

  def call
    v = FindUserContract.new.call(email: @email)
    return Result.new(success?: false,
      user: nil, errors: v.errors.to_h) if v.failure?

    user = User.find_by(email: @email)
    return Result.new(success?: false,
      user: nil, errors: ["Not found"]) unless user

    Result.new(success?: true, user:, errors: [])
  end
end`,
		},
		{
			filename: 'config/credentials.yml.enc',
			language: 'yaml',
			code: `active_record_encryption:
  primary_key: EGY8WhulUOXixybod7ZWwMIL68R9o5kC
  deterministic_key: aPA5XyALhf75NNnMzaspW7akTfZp0lPY
  key_derivation_salt: xEY0dt6TZcAMg52K7O84wYzkjvbA62Hz`,
		},
	];
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level10Encryption({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<Phase>('observe');
	const [flowPhase, setFlowPhase] = useState(-1);
	const [wrongFeedback, setWrongFeedback] = useState<string | null>(null);
	const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
	const [highlightedCols, setHighlightedCols] = useState<string[]>([]);
	const [lastScenarioBlocked, setLastScenarioBlocked] = useState(false);
	const [rewardScenarioId, setRewardScenarioId] = useState<string | null>(null);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);

	// Clear timers on unmount
	useEffect(() => {
		return () => {
			for (const t of timersRef.current) clearTimeout(t);
		};
	}, []);

	// No auto-advance. Player clicks "Next Step" on the last step to go to reward.

	// ── Observe phase: probe handler ──
	const handleProbe = useCallback(
		(probeId: string) => {
			if (flowPhase !== -1) return;

			const discoveries = PROBE_DISCOVERY_MAP[probeId];
			if (discoveries) {
				for (const d of discoveries) discoveryGating.discover(d);
			}

			setFlowPhase(0);
			const timers: ReturnType<typeof setTimeout>[] = [];

			if (probeId === 'inspect-config') {
				// Config check: no table highlight, just a brief flash on the header
				setHighlightedCols([]);
				const tEnd = setTimeout(() => {
					setFlowPhase(-1);
				}, ANIMATION_DURATION_MS * 2);
				timers.push(tEnd);
			} else {
				// Determine which columns to highlight based on probe
				const cols =
					probeId === 'sql-injection' ? ['email', 'phone'] : ['address'];
				setHighlightedCols(cols);

				// Animate rows sequentially
				for (let i = 0; i < SAMPLE_USERS.length; i++) {
					const t = setTimeout(() => {
						setHighlightedRow(SAMPLE_USERS[i].id);
					}, i * ANIMATION_DURATION_MS);
					timers.push(t);
				}
				const tEnd = setTimeout(() => {
					setHighlightedRow(null);
					setHighlightedCols([]);
					setFlowPhase(-1);
				}, SAMPLE_USERS.length * ANIMATION_DURATION_MS);
				timers.push(tEnd);
			}

			timersRef.current.push(...timers);
		},
		[flowPhase, discoveryGating],
	);

	// ── Build phase: option handler ──
	const handleOptionSelect = useCallback(
		(optionId: string) => {
			const config = OPTION_STEP_CONFIG[stepper.currentStep];
			if (!config) return;
			const option = config.options.find((o) => o.id === optionId);
			if (!option) return;

			if (option.correct) {
				setWrongFeedback(null);
				stepper.completeStep();
			} else {
				setWrongFeedback(option.feedback ?? 'Not quite right.');
				stepper.recordWrongAttempt(option.feedback ?? 'Not quite right.');
			}
		},
		[stepper],
	);

	// ── Reward phase: fire handler ──
	const handleFireScenario = useCallback(
		(scenarioId: string) => {
			if (flowPhase !== -1) return;
			const result = stressTest.fireRequest(scenarioId);
			setRewardScenarioId(scenarioId);
			setLastScenarioBlocked(result.result === 'blocked');

			// Brief animation lock so the UI doesn't allow rapid double-fires
			setFlowPhase(0);
			const t = setTimeout(() => {
				setFlowPhase(-1);
			}, ANIMATION_DURATION_MS);
			timersRef.current.push(t);
		},
		[flowPhase, stressTest],
	);

	// ── Validation ──
	const handleValidate = useCallback((): ValidationResult => {
		if (phase !== 'reward') {
			return {
				valid: false,
				message: 'Complete all phases',
				details: ['Finish the observe, build, and reward phases'],
			};
		}
		return { valid: true, message: 'PII encrypted at rest. GDPR compliant!' };
	}, [phase]);

	const handleComplete = async () => {
		onComplete({ stars: stepper.starRating });
	};

	// ── Determine last scenario for reward viz ──
	const lastResult =
		stressTest.results.length > 0
			? stressTest.results[stressTest.results.length - 1]
			: null;

	// ── Render: Database table visualization ──
	const renderDatabaseTable = (encrypted: boolean) => {
		const lastScenarioId = lastResult?.scenarioId;
		const isAttackerView = encrypted && lastScenarioId === 'attacker-dump';

		// In observe phase, only highlight specific columns per probe
		// In reward phase, use green for allowed, red for blocked
		const isColHighlighted = (col: string) =>
			!encrypted && highlightedCols.length > 0
				? highlightedCols.includes(col)
				: true;

		const rowHighlightClass = (isHighlighted: boolean) => {
			if (!isHighlighted) return '';
			if (!encrypted) return 'bg-red-100 dark:bg-red-900/30';
			if (lastScenarioBlocked) return 'bg-red-100 dark:bg-red-900/30';
			return 'bg-emerald-100 dark:bg-emerald-900/30';
		};

		const cellClass = (col: string, isHighlighted: boolean) => {
			const base = 'px-3 py-2 font-mono transition-colors';
			if (encrypted) {
				if (isHighlighted && lastScenarioBlocked)
					return cn(base, 'text-red-700 dark:text-red-400');
				return cn(base, 'text-emerald-700 dark:text-emerald-400');
			}
			// Observe: flash only targeted columns
			if (isHighlighted && isColHighlighted(col))
				return cn(
					base,
					'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
				);
			return cn(base, 'text-red-700 dark:text-red-400');
		};

		return (
			<div className="mx-auto max-w-3xl py-4">
				{/* Table header */}
				<div
					className={cn(
						'rounded-t-lg border border-b-0 px-4 py-2 flex items-center gap-2',
						encrypted
							? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
							: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700',
					)}
				>
					<Database
						className={cn(
							'w-4 h-4',
							encrypted
								? 'text-emerald-600 dark:text-emerald-400'
								: 'text-red-600 dark:text-red-400',
						)}
					/>
					<span className="text-sm font-semibold text-foreground">users</span>
					{isAttackerView && (
						<span className="text-xs text-emerald-600 dark:text-emerald-400 ml-2">
							Attacker sees ciphertext only
						</span>
					)}
					{!encrypted && (
						<span className="text-xs text-red-600 dark:text-red-400 ml-2">
							PII exposed in plaintext!
						</span>
					)}
				</div>

				{/* Table body */}
				<div
					className={cn(
						'rounded-b-lg border overflow-hidden',
						encrypted
							? 'border-emerald-300 dark:border-emerald-700'
							: 'border-red-300 dark:border-red-700',
					)}
				>
					<table className="w-full text-xs">
						<thead>
							<tr className="bg-muted/50 border-b border-border">
								<th className="px-3 py-2 text-left font-medium text-muted-foreground">
									id
								</th>
								<th className="px-3 py-2 text-left font-medium">
									<span
										className={cn(
											encrypted
												? 'text-emerald-700 dark:text-emerald-400'
												: 'text-red-700 dark:text-red-400',
										)}
									>
										email {encrypted ? '(deterministic)' : '(plaintext!)'}
									</span>
								</th>
								<th className="px-3 py-2 text-left font-medium">
									<span
										className={cn(
											encrypted
												? 'text-emerald-700 dark:text-emerald-400'
												: 'text-red-700 dark:text-red-400',
										)}
									>
										phone {encrypted ? '(non-det)' : '(plaintext!)'}
									</span>
								</th>
								<th className="px-3 py-2 text-left font-medium">
									<span
										className={cn(
											encrypted
												? 'text-emerald-700 dark:text-emerald-400'
												: 'text-red-700 dark:text-red-400',
										)}
									>
										address {encrypted ? '(non-det)' : '(plaintext!)'}
									</span>
								</th>
								<th className="px-3 py-2 text-left font-medium text-muted-foreground">
									name
								</th>
							</tr>
						</thead>
						<tbody>
							{SAMPLE_USERS.map((user) => {
								const isHighlighted = highlightedRow === user.id;
								return (
									<tr
										className={cn(
											'border-b border-border last:border-0 transition-colors',
											rowHighlightClass(isHighlighted),
										)}
										key={user.id}
									>
										<td className="px-3 py-2 font-mono text-muted-foreground">
											{user.id}
										</td>
										<td className={cellClass('email', isHighlighted)}>
											{encrypted ? (
												<span className="flex items-center gap-1">
													<Lock className="w-3 h-3 shrink-0" />
													<span className="truncate max-w-32">
														{CIPHERTEXT[user.email]}
													</span>
												</span>
											) : (
												user.email
											)}
										</td>
										<td className={cellClass('phone', isHighlighted)}>
											{encrypted ? (
												<span className="flex items-center gap-1">
													<Lock className="w-3 h-3 shrink-0" />
													<span className="truncate max-w-32">
														{CIPHERTEXT[user.phone]}
													</span>
												</span>
											) : (
												user.phone
											)}
										</td>
										<td className={cellClass('address', isHighlighted)}>
											{encrypted ? (
												<span className="flex items-center gap-1">
													<Lock className="w-3 h-3 shrink-0" />
													<span className="truncate max-w-32">
														{CIPHERTEXT[user.address]}
													</span>
												</span>
											) : (
												user.address
											)}
										</td>
										<td className="px-3 py-2 font-mono text-foreground">
											{user.name}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
		);
	};

	// ── Left panel content ──
	const renderLeftPanel = () => {
		if (phase === 'observe') {
			return (
				<InstructionPanel
					goal="Discover why storing PII in plaintext is a GDPR violation."
					instructions={[
						'Fire probes to see what an attacker can extract.',
						'Notice all PII columns are readable in plaintext.',
						'Check the encryption configuration.',
					]}
					scenario="A GDPR audit flagged that user PII (email, phone, address) is stored in plaintext in the database. A breach would expose everything."
				>
					<div className="p-4 border-t border-border space-y-4">
						<div>
							<h3 className="text-sm font-semibold text-foreground mb-2">
								Scenario
							</h3>
							<p className="text-sm text-muted-foreground">
								A GDPR audit flagged that user PII (email, phone, address) is
								stored in plaintext in the database. A breach would expose
								everything.
							</p>
						</div>
						<DiscoveryChecklist
							discoveredCount={discoveryGating.discoveredCount}
							discoveries={discoveryGating.discoveries}
							minRequired={discoveryGating.minRequired}
						/>
					</div>
				</InstructionPanel>
			);
		}

		if (phase === 'build') {
			return (
				<InstructionPanel
					goal="Encrypt PII at rest using Rails 8 encrypted attributes."
					instructions={[
						'Generate the three encryption keys.',
						'Store keys securely in Rails credentials.',
						'Add deterministic encryption for email (queryable).',
						'Add non-deterministic encryption for phone and address.',
						'Update the lookup service for encrypted queries.',
					]}
					scenario="Rails 8 provides built-in encryption via the encrypts macro. Deterministic encryption allows querying, non-deterministic provides maximum security."
				>
					<div className="p-4 border-t border-border">
						<StepProgress
							currentStep={stepper.currentStep}
							steps={stepper.steps}
						/>
					</div>
				</InstructionPanel>
			);
		}

		// reward
		return (
			<InstructionPanel
				goal="Stress-test the encrypted database."
				instructions={[
					'Query by email (deterministic) and verify it works.',
					'Try querying by phone and see it fail.',
					'Simulate an attacker dump and see only ciphertext.',
				]}
				scenario="PII is encrypted at rest. The app sees plaintext. The database stores ciphertext. Attackers see gibberish."
			>
				<div className="p-4 border-t border-border">
					<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
						Legend
					</div>
					<div className="space-y-2 text-xs">
						<div className="flex items-center gap-2">
							<Key className="w-3 h-3 text-amber-600 dark:text-amber-400" />
							<span className="text-foreground">Deterministic (queryable)</span>
						</div>
						<div className="flex items-center gap-2">
							<Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
							<span className="text-foreground">
								Non-deterministic (max security)
							</span>
						</div>
						<div className="flex items-center gap-2">
							<Eye className="w-3 h-3 text-muted-foreground" />
							<span className="text-foreground">Plaintext (not PII)</span>
						</div>
					</div>
					<div className="mt-4 grid grid-cols-2 gap-3">
						<div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-lg p-3 text-center">
							<div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
								{stressTest.allowedCount}
							</div>
							<div className="text-xs text-emerald-600 dark:text-emerald-400">
								Secure
							</div>
						</div>
						<div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-3 text-center">
							<div className="text-xl font-bold text-red-700 dark:text-red-400">
								{stressTest.blockedCount}
							</div>
							<div className="text-xs text-red-600 dark:text-red-400">
								Blocked
							</div>
						</div>
					</div>
				</div>
			</InstructionPanel>
		);
	};

	// ── Center panel content ──
	const renderCenterPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col">
					{renderDatabaseTable(false)}

					<div className="mt-auto px-6 pb-2">
						<ProbeTerminal
							disabled={flowPhase !== -1}
							onProbe={handleProbe}
							probes={PROBES}
						/>
					</div>

					{discoveryGating.isUnlocked && (
						<div className="p-4 flex justify-center animate-in fade-in duration-500">
							<Button onClick={() => setPhase('build')}>
								<Zap className="w-4 h-4 mr-2" />
								Build the Fix
								<ArrowRight className="w-4 h-4 ml-2" />
							</Button>
						</div>
					)}
				</div>
			);
		}

		if (phase === 'build') {
			const currentStep = stepper.currentStep;
			const terminalData = TERMINAL_STEP_MAP[currentStep];

			if (terminalData) {
				return (
					<div className="flex-1 flex flex-col p-6">
						<TerminalChoiceStep
							commands={terminalData.commands}
							completed={stepper.isCurrentStepCompleted}
							description={
								<p className="text-sm text-muted-foreground">
									Generate the three encryption keys needed for Active Record
									encryption.
								</p>
							}
							hasNext={currentStep < STEP_DEFS.length - 1}
							initialHistory={buildTerminalHistory(
								TERMINAL_STEP_MAP,
								currentStep,
							)}
							onCorrect={() => stepper.completeStep()}
							onNext={stepper.nextStep}
							onWrong={(fb) => stepper.recordWrongAttempt(fb)}
							outputLines={terminalData.outputLines}
							stepKey={currentStep}
							title={STEP_DEFS[currentStep].title}
						/>
					</div>
				);
			}

			// OptionCard steps
			const config = OPTION_STEP_CONFIG[currentStep];
			if (!config) return null;

			return (
				<div className="flex-1 flex flex-col p-6 overflow-y-auto">
					<div className="mb-4">
						<h3 className="text-lg font-semibold text-foreground">
							{config.title}
						</h3>
						<p className="text-sm text-muted-foreground mt-1">
							{config.description}
						</p>
					</div>

					{wrongFeedback && (
						<div className="mb-4">
							<ErrorFeedback
								message={wrongFeedback}
								onDismiss={() => setWrongFeedback(null)}
							/>
						</div>
					)}

					<div className="space-y-3">
						{shuffleOptions(config.options, currentStep).map((opt) => (
							<OptionCard
								description=""
								disabled={stepper.isCurrentStepCompleted}
								key={opt.id}
								mono
								name={opt.label}
								onClick={() => handleOptionSelect(opt.id)}
								selected={stepper.isCurrentStepCompleted && opt.correct}
							/>
						))}
					</div>

					{stepper.isCurrentStepCompleted &&
						currentStep < STEP_DEFS.length - 1 && (
							<div className="mt-4 flex justify-end">
								<Button
									className="gap-2"
									onClick={() => {
										setWrongFeedback(null);
										stepper.nextStep();
									}}
									size="sm"
								>
									Next Step
									<ArrowRight className="w-4 h-4" />
								</Button>
							</div>
						)}
					{stepper.isCurrentStepCompleted &&
						currentStep === STEP_DEFS.length - 1 && (
							<div className="mt-4 flex justify-end">
								<Button
									className="gap-2"
									onClick={() => {
										setWrongFeedback(null);
										stressTest.reset();
										setPhase('reward');
									}}
									size="sm"
								>
									Next Step
									<ArrowRight className="w-4 h-4" />
								</Button>
							</div>
						)}
				</div>
			);
		}

		// reward: dual-perspective visualization
		const vizConfig = rewardScenarioId ? REWARD_VIZ[rewardScenarioId] : null;
		const showApp =
			!vizConfig ||
			vizConfig.perspective === 'app' ||
			vizConfig.perspective === 'both';
		const showDb =
			!vizConfig ||
			vizConfig.perspective === 'db' ||
			vizConfig.perspective === 'both';

		const renderMiniTable = (
			title: string,
			icon: React.ReactNode,
			borderColor: string,
			showCiphertext: boolean,
			cols: string[],
		) => (
			<div className={cn('rounded-lg border overflow-hidden', borderColor)}>
				<div
					className={cn(
						'px-3 py-1.5 flex items-center gap-2 text-xs font-semibold border-b',
						borderColor,
						showCiphertext
							? 'bg-amber-50 dark:bg-amber-900/20'
							: 'bg-emerald-50 dark:bg-emerald-900/20',
					)}
				>
					{icon}
					<span className="text-foreground">{title}</span>
				</div>
				<table className="w-full text-xs">
					<thead>
						<tr className="bg-muted/50 border-b border-border">
							<th className="px-2 py-1 text-left font-medium text-muted-foreground">
								id
							</th>
							{cols.map((col) => (
								<th
									className="px-2 py-1 text-left font-medium text-muted-foreground"
									key={col}
								>
									{col}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{SAMPLE_USERS.map((user) => {
							const isFocused =
								vizConfig &&
								(vizConfig.focusRow === null || vizConfig.focusRow === user.id);
							return (
								<tr
									className={cn(
										'border-b border-border last:border-0 transition-colors',
										isFocused && vizConfig
											? showCiphertext
												? 'bg-amber-50 dark:bg-amber-900/20'
												: 'bg-emerald-50 dark:bg-emerald-900/20'
											: '',
									)}
									key={user.id}
								>
									<td className="px-2 py-1 font-mono text-muted-foreground">
										{user.id}
									</td>
									{cols.map((col) => {
										const val = user[col as keyof typeof user];
										const isHighlighted =
											vizConfig?.highlightCols.includes(col) && isFocused;
										return (
											<td
												className={cn(
													'px-2 py-1 font-mono transition-colors',
													isHighlighted
														? showCiphertext
															? 'text-amber-700 dark:text-amber-300 font-semibold'
															: 'text-emerald-700 dark:text-emerald-300 font-semibold'
														: 'text-muted-foreground',
												)}
												key={col}
											>
												{showCiphertext ? (
													<span className="flex items-center gap-1">
														<Lock className="w-3 h-3 shrink-0 opacity-60" />
														<span className="truncate max-w-24">
															{CIPHERTEXT[String(val)] ?? '...'}
														</span>
													</span>
												) : (
													String(val)
												)}
											</td>
										);
									})}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		);

		return (
			<div className="flex-1 flex flex-col">
				<div className="px-6 py-3 space-y-3 overflow-y-auto">
					{/* Scenario result banner */}
					{vizConfig && (
						<div
							className={cn(
								'rounded-lg px-4 py-2.5 text-sm font-medium animate-in fade-in duration-300',
								vizConfig.bannerType === 'success' &&
									'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700',
								vizConfig.bannerType === 'danger' &&
									'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700',
								vizConfig.bannerType === 'info' &&
									'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700',
							)}
						>
							{vizConfig.banner}
						</div>
					)}

					{!vizConfig && (
						<div className="rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
							Fire a scenario below to see how encryption protects data at each
							layer.
						</div>
					)}

					{/* Dual perspective tables */}
					<div
						className={cn(
							'grid gap-3',
							showApp && showDb ? 'grid-cols-2' : 'grid-cols-1',
						)}
					>
						{showApp &&
							renderMiniTable(
								'What the App Sees',
								<Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
								'border-emerald-300 dark:border-emerald-700',
								false,
								['email', 'phone', 'address'],
							)}
						{showDb &&
							renderMiniTable(
								'What the Database Stores',
								<Database className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
								'border-amber-300 dark:border-amber-700',
								true,
								['email', 'phone', 'address'],
							)}
					</div>
				</div>

				<div className="mt-auto px-6 pb-2">
					<StressTestPanel
						allowedCount={stressTest.allowedCount}
						blockedCount={stressTest.blockedCount}
						canAutoFire={stressTest.canAutoFire}
						disabled={flowPhase !== -1}
						isAutoFiring={stressTest.isAutoFiring}
						onFire={handleFireScenario}
						onToggleAutoFire={() =>
							stressTest.toggleAutoFire(handleFireScenario)
						}
						results={stressTest.results}
						scenarios={STRESS_SCENARIOS}
					/>
				</div>
			</div>
		);
	};

	return (
		<LevelLayout>
			<LeftPanel>{renderLeftPanel()}</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={5}
					levelName="Encrypted Attributes"
					levelNumber={10}
					onComplete={handleComplete}
					onReset={() => {
						setPhase('observe');
						setFlowPhase(-1);
						setWrongFeedback(null);
						setHighlightedRow(null);
						setHighlightedCols([]);
						setLastScenarioBlocked(false);
						setRewardScenarioId(null);
						stressTest.reset();
					}}
					onValidate={handleValidate}
				/>
				{renderCenterPanel()}
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						stepper.isCurrentStepCompleted
							? stepper.currentStep
							: stepper.currentStep - 1,
					)}
					learningGoal={
						phase === 'observe'
							? 'All PII is stored in plaintext. A database breach exposes everything.'
							: phase === 'build'
								? 'Configure Rails 8 encrypted attributes with the right mode per field.'
								: 'PII encrypted at rest. App sees plaintext. Attackers see ciphertext.'
					}
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level10Encryption;
