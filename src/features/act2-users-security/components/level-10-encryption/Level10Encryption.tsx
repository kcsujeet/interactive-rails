/**
 * Level 10: Encrypted Attributes
 *
 * Final model state: User has email_address (deterministic; casing is handled
 * by the normalizes declaration from L9's auth generator), phone
 * (deterministic), address (default/non-deterministic).
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Custom "Database Breach View" visualization.
 *   A database table showing 3 user rows with columns: id, email_address, phone,
 *   address. All PII columns are plaintext (red). The player fires probes that
 *   show three distinct leak surfaces: SQL injection (primary DB), backup grep
 *   (offline copies), and tail of production query logs (every WHERE value
 *   logged with PII).
 *
 * Phase 2 (HOW - build): 4 steps (1 terminal + 3 OptionCard)
 *   Step 0: Generate encryption keys (terminal)
 *   Step 1: Add keys to Rails credentials (OptionCard)
 *   Step 2: Encrypt email_address with deterministic mode so login
 *           lookups keep working (OptionCard)
 *   Step 3: Encrypt phone (queryable for support) and address with the right
 *           mode for each (OptionCard)
 *
 * Note: Validations are L12 (per cumulative-patterns), service objects (L16+)
 * and Dry::Validation contracts (L18+) are later. The "make queries work with
 * encrypted columns" lesson is folded into Step 2 + Step 3: choosing the
 * right mode per column means User.authenticate_by(email_address:) and the
 * support-agent phone lookup Just Work because Rails encrypts the WHERE value
 * transparently when the column is deterministic.
 *
 * Phase 3 (ADVANTAGE - reward): Same table, now showing ciphertext for PII.
 *   Allowed: Authenticate by email_address, look up by phone (deterministic),
 *     read profile (transparent decrypt), all attacker actions return ciphertext.
 *   Blocked: find_by(address:) returns nil (non-deterministic).
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
		email_address: 'alice@example.com',
		phone: '+1-555-0123',
		address: '123 Main St, NYC',
	},
	{
		id: 2,
		email_address: 'bob@corp.io',
		phone: '+1-555-0456',
		address: '456 Oak Ave, LA',
	},
	{
		id: 3,
		email_address: 'carol@startup.dev',
		phone: '+1-555-0789',
		address: '789 Pine Rd, SF',
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
	{ id: 'plaintext-pii', label: 'Customer PII exposed in plaintext' },
	{ id: 'plaintext-address', label: 'Addresses also leaked through backups' },
	{ id: 'plaintext-logs', label: 'Production query logs leak PII too' },
];

// Pedagogy rule: each probe unlocks exactly one distinct discovery,
// each discovery is unlocked by exactly one probe. (Three probes,
// three discoveries.)
const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'sql-injection': ['plaintext-pii'],
	'backup-leak': ['plaintext-address'],
	'tail-query-logs': ['plaintext-logs'],
};

// ──────────────────────────────────────────────
// Probe definitions
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'sql-injection',
		label: 'Exploit SQL injection on the search endpoint',
		command: 'SELECT email_address, phone FROM users WHERE id = 1 OR 1=1',
		responseLines: [
			{ text: 'alice@example.com  | +1-555-0123', color: 'red' },
			{ text: 'bob@corp.io        | +1-555-0456', color: 'red' },
			{ text: 'carol@startup.dev  | +1-555-0789', color: 'red' },
			{ text: '# All emails and phones dumped in plaintext!', color: 'yellow' },
		],
		story: [
			'An attacker finds a SQL injection vulnerability in the search endpoint.',
			'The endpoint interpolates ?id= straight into SQL, so id=1 OR 1=1 makes the WHERE clause always true.',
			'The database returns every row in the users table.',
			'All emails and phone numbers are stored in plaintext.',
			'The attacker now has the full customer PII dump.',
		],
	},
	{
		id: 'backup-leak',
		label: 'Grep an exposed database backup',
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
		id: 'tail-query-logs',
		label: 'Tail the production query logs',
		command: 'tail -f log/production.log | grep "User Load"',
		responseLines: [
			{
				text: 'User Load (1.2ms) SELECT * FROM users WHERE',
				color: 'red',
			},
			{
				text: "  email_address = 'alice@example.com' LIMIT 1",
				color: 'red',
			},
			{
				text: 'User Load (0.9ms) SELECT * FROM users WHERE',
				color: 'red',
			},
			{ text: "  phone = '+1-555-0456' LIMIT 1", color: 'red' },
			{
				text: '# Every WHERE clause logs the PII it queried by.',
				color: 'yellow',
			},
			{
				text: '# Logs ship to S3, Datadog, and a contractor laptop.',
				color: 'red',
			},
		],
		story: [
			'A platform engineer tails production logs to debug a slow request.',
			'Each SQL query Rails executes is logged with the literal WHERE values.',
			'Login lookups print the user email; support lookups print the phone.',
			'These log files ship to S3, Datadog, and a contractor laptop nightly.',
			'Plaintext PII has now leaked outside the database without any breach.',
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
			'Environment variables in .env files are not encrypted and can be accidentally committed. Keys this sensitive need a store that is encrypted at rest.',
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
			'Hardcoding keys in an initializer file means they are stored in plaintext in your repository. Anyone with repo access can read every key.',
	},
];

// OptionCard step 2: Encrypt email_address (queryable + case-insensitive)
const EMAIL_ENCRYPTION_OPTIONS = [
	{
		id: 'wrong-non-deterministic',
		label: `class User < ApplicationRecord
  encrypts :email_address
  # Default mode: each encryption produces
  # a unique ciphertext, even for the same value
end`,
		correct: false,
		feedback:
			'Default mode produces a different ciphertext on every write. The database cannot equality-match against it, so authenticate_by(email_address:) returns nil for every login.',
	},
	{
		id: 'wrong-deterministic-only',
		label: `class User < ApplicationRecord
  encrypts :email_address, deterministic: true
  # Same plaintext always produces the same
  # ciphertext, so find_by works
end`,
		correct: false,
		feedback:
			'That works for case-sensitive lookups, but "ALICE@EXAMPLE.COM" and "alice@example.com" now hash to different ciphertexts. Logging in with the wrong case fails. Email lookups need to be case-insensitive.',
	},
	{
		id: 'correct-deterministic-downcase',
		label: `class User < ApplicationRecord
  encrypts :email_address, deterministic: true, downcase: true
  # Same plaintext always produces the same
  # ciphertext, and casing is normalized before
  # encryption so login is case-insensitive
end`,
		correct: true,
	},
];

// OptionCard step 3: Encrypt phone (queryable for support) and address (default)
const PII_ENCRYPTION_OPTIONS = [
	{
		id: 'wrong-default-phone',
		label: `class User < ApplicationRecord
  encrypts :email_address, deterministic: true, downcase: true
  encrypts :phone
  encrypts :address
end`,
		correct: false,
		feedback:
			'Support agents look users up by phone when customers call in. With the default mode, find_by(phone:) silently returns nil because each encryption produces a different ciphertext. Phone needs the same lookup capability email does.',
	},
	{
		id: 'correct-phone-deterministic',
		label: `class User < ApplicationRecord
  encrypts :email_address, deterministic: true, downcase: true
  encrypts :phone, deterministic: true
  encrypts :address
end`,
		correct: true,
	},
	{
		id: 'wrong-address-deterministic',
		label: `class User < ApplicationRecord
  encrypts :email_address, deterministic: true, downcase: true
  encrypts :phone, deterministic: true
  encrypts :address, deterministic: true
end`,
		correct: false,
		feedback:
			'Addresses are never used as a lookup key. Making them queryable accepts the frequency-analysis tradeoff (identical addresses share ciphertext) without buying anything in return.',
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
		title: 'Encrypt the email_address Column',
		description:
			'authenticate_by(email_address:) needs to find the user. Logins are case-insensitive: "Alice@Example.com" and "alice@example.com" must resolve to the same row.',
		options: EMAIL_ENCRYPTION_OPTIONS,
	},
	3: {
		title: 'Encrypt Phone & Address',
		description:
			'Support agents look users up by phone when customers call in. Addresses are never used as a lookup key. Pick the right mode for each.',
		options: PII_ENCRYPTION_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'sql-injection',
		label: 'Exploit SQL injection on the search endpoint',
		description: 'Attacker tries to dump the users table',
		method: 'GET',
		path: "/api/users?id=1' OR 1=1",
		actor: 'attacker',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK (but data is encrypted!)', color: 'green' },
			{
				text: 'email_address: {"p":"dB3dhj...","h":{"iv":"f9w..."}}',
				color: 'cyan',
			},
			{ text: 'phone: {"p":"aX4kLm...","h":{"iv":"j8r..."}}', color: 'cyan' },
			{ text: 'Attacker sees ciphertext, not PII.', color: 'green' },
		],
		story: [
			'Same attacker, same SQL injection payload that dumped every row before.',
			'The query still bypasses the WHERE clause and returns all users.',
			'But the email_address, phone, and address columns now contain ciphertext.',
			'The encryption key is in Rails credentials, not the database.',
			'The attacker walks away with random bytes instead of customer PII.',
		],
	},
	{
		id: 'backup-leak',
		label: 'Grep an exposed database backup',
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
			{
				text: 'email_address: {"p":"dB3dhj...","h":{"iv":"f9w..."}}',
				color: 'cyan',
			},
			{
				text: 'address: {"p":"gT5uBn...","h":{"iv":"e1d..."}}',
				color: 'cyan',
			},
			{ text: 'No plaintext PII in backup. GDPR safe.', color: 'green' },
		],
		story: [
			'Same nightly pg_dump, same contractor with backup access.',
			'They run the same grep that turned up every customer address before.',
			'The dump file still contains every row of the users table.',
			'But the address column is now encrypted bytes on disk.',
			'No matches for "Main St", "Oak Ave", or "Pine Rd" anywhere in the file.',
		],
	},
	{
		id: 'tail-query-logs',
		label: 'Tail the production query logs',
		description: 'Read SQL queries that Rails logs to disk',
		method: 'GET',
		path: '/admin/audit/log-check',
		actor: 'platform engineer',
		expectedResult: 'allowed',
		responseLines: [
			{
				text: 'User Load (1.2ms) SELECT * FROM users WHERE',
				color: 'cyan',
			},
			{
				text: '  email_address = \'{"p":"dB3dhj...","h":{"iv":"f9w..."}}\' LIMIT 1',
				color: 'cyan',
			},
			{
				text: '# WHERE values are encrypted before they hit SQL.',
				color: 'green',
			},
			{
				text: '# Logs ship the same ciphertext the database stores.',
				color: 'green',
			},
		],
		story: [
			'Same engineer tails the same production logs to debug a slow request.',
			'The User Load lines still print SELECT statements with their WHERE values.',
			'But Active Record encrypts the lookup value before sending the query.',
			'The log file now contains ciphertext, not plaintext PII.',
			'Logs ship to S3 and Datadog with no extra exposure surface.',
		],
	},
	{
		id: 'find-by-email',
		label: 'Authenticate by email_address',
		description: 'Login lookup via authenticate_by',
		method: 'POST',
		path: '/api/sessions',
		actor: 'customer',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: 'User.authenticate_by(email_address: "alice@example.com", ...)',
				color: 'cyan',
			},
			{
				text: 'Lookup value encrypted with the same key, equality match wins.',
				color: 'green',
			},
		],
		story: [
			'A customer signs in with their email and password.',
			'authenticate_by encrypts the email_address before querying.',
			'The ciphertext matches the row stored at signup, so the user is found.',
			'has_secure_password verifies the password digest.',
			'Encryption is invisible to the auth flow; login still works.',
		],
	},
	{
		id: 'find-by-phone-support',
		label: 'Look up a customer by phone (support)',
		description: 'Support agent finds a user during a call',
		method: 'GET',
		path: '/admin/users?phone=%2B1-555-0123',
		actor: 'support agent',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: 'User.find_by(phone: "+1-555-0123")', color: 'cyan' },
			{
				text: 'Phone encrypted deterministically too. Match found.',
				color: 'green',
			},
		],
		story: [
			'A customer calls support and gives their phone number for verification.',
			'The agent searches the admin tool by phone.',
			'phone is encrypted deterministically, so the lookup value hashes the same way.',
			'find_by(phone:) returns the row.',
			'Same workflow as before; no support process changed.',
		],
	},
	{
		id: 'find-by-address-fails',
		label: 'Try to look up a user by address',
		description: 'Demonstrates non-deterministic mode',
		method: 'GET',
		path: '/admin/users?address=123%20Main%20St',
		actor: 'support agent',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '404 Not Found', color: 'red' },
			{ text: 'User.find_by(address: "123 Main St, NYC")', color: 'cyan' },
			{ text: '=> nil', color: 'red' },
			{
				text: 'Each save encrypts to a different ciphertext, so no row matches.',
				color: 'yellow',
			},
		],
		story: [
			'A new feature tries to find a user by street address.',
			'address is encrypted in default (non-deterministic) mode.',
			'Every write produces a different ciphertext, even for the same plaintext.',
			'The query value also encrypts to a unique ciphertext that matches nothing.',
			'find_by silently returns nil. By design: address was never a lookup key.',
		],
	},
	{
		id: 'transparent-read',
		label: 'Read a user profile',
		description: 'App reads decrypted plaintext transparently',
		method: 'GET',
		path: '/api/users/1',
		actor: 'customer',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: 'email_address: "alice@example.com" (auto-decrypted)',
				color: 'cyan',
			},
			{ text: 'phone: "+1-555-0123" (auto-decrypted)', color: 'cyan' },
			{
				text: 'App code sees plaintext. DB stores ciphertext.',
				color: 'green',
			},
		],
		story: [
			'A customer loads their profile page.',
			'Active Record reads the encrypted columns from PostgreSQL.',
			'The encryptor decrypts each column with the primary key from credentials.',
			'The controller and view see plain Ruby strings.',
			'Encryption is transparent everywhere except at rest.',
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
	'sql-injection': {
		banner:
			'Attacker dumped the table but sees only ciphertext. No PII exposed.',
		bannerType: 'success',
		perspective: 'db',
		highlightCols: ['email_address', 'phone', 'address'],
		focusRow: null,
	},
	'backup-leak': {
		banner: 'Database backup contains only ciphertext. GDPR compliance: PASS.',
		bannerType: 'success',
		perspective: 'db',
		highlightCols: ['email_address', 'phone', 'address'],
		focusRow: null,
	},
	'tail-query-logs': {
		banner:
			'WHERE values are encrypted before they hit SQL. Logs ship ciphertext, not PII.',
		bannerType: 'success',
		perspective: 'db',
		highlightCols: ['email_address', 'phone'],
		focusRow: null,
	},
	'find-by-email': {
		banner:
			'authenticate_by encrypts the lookup value with the same key. Login works.',
		bannerType: 'success',
		perspective: 'both',
		highlightCols: ['email_address'],
		focusRow: 1,
	},
	'find-by-phone-support': {
		banner:
			'phone is deterministic too. Support lookups by phone still find the row.',
		bannerType: 'success',
		perspective: 'both',
		highlightCols: ['phone'],
		focusRow: 1,
	},
	'find-by-address-fails': {
		banner:
			'address is non-deterministic. Each ciphertext is unique, so find_by returns nil.',
		bannerType: 'danger',
		perspective: 'db',
		highlightCols: ['address'],
		focusRow: null,
	},
	'transparent-read': {
		banner:
			'App reads plaintext automatically. Encryption is invisible to application code.',
		bannerType: 'success',
		perspective: 'both',
		highlightCols: ['email_address', 'phone', 'address'],
		focusRow: 1,
	},
};

// ──────────────────────────────────────────────
// Code preview files
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, completedStep: number) {
	if (phase === 'observe') {
		// Validations land at L12 (per cumulative-patterns); service objects
		// (L16+), Dry::Validation contracts (L18+), and Active Storage (L34)
		// are also later levels. L10's "before" state is the User model with
		// plaintext PII and no encrypts declarations.
		return [
			{
				filename: 'app/models/user.rb',
				language: 'ruby',
				code: `class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy

  normalizes :email_address, with: ->(e) { e.strip.downcase }

  # PII stored in PLAINTEXT!
  # email_address: "alice@example.com"
  # phone: "+1-555-0123"
  # address: "123 Main St, NYC"

  # Every column stores exactly what was typed.
  # A database dump reads like a contact list.
  # Database breach = full PII exposure
end`,
			},
		];
	}

	if (phase === 'build') {
		// Note: Active Storage (`has_one_attached`) is L34 (not shown here).
		// Service objects (L16+) and Dry::Validation contracts (L18+) are
		// also not shown. L10's build phase teaches encryption alone.

		const baseModel = `class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy

  normalizes :email_address, with: ->(e) { e.strip.downcase }`;

		// Step 0 (generate keys): db:encryption:init prints to stdout,
		// no files are modified. Show unchanged "before" model.
		if (completedStep < 0) {
			return [
				{
					filename: 'app/models/user.rb',
					language: 'ruby',
					code: `${baseModel}

  # PII stored in PLAINTEXT!
  # email_address: "alice@example.com"
  # phone: "+1-555-0123"
  # address: "123 Main St, NYC"
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
					code: `${baseModel}

  # PII stored in PLAINTEXT!
  # email_address: "alice@example.com"
  # phone: "+1-555-0123"
  # address: "123 Main St, NYC"
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
					code: `${baseModel}

  # Keys are stored. Now encrypt the PII columns.
  # email_address: "alice@example.com"  (still plaintext)
  # phone: "+1-555-0123"                (still plaintext)
  # address: "123 Main St, NYC"         (still plaintext)
end`,
				},
			];
		}
		if (completedStep < 3) {
			return [
				{
					filename: 'app/models/user.rb',
					language: 'ruby',
					code: `${baseModel}

  encrypts :email_address, deterministic: true, downcase: true

  # phone and address are still plaintext.
  # They need encryption too.
end`,
				},
			];
		}
		// All steps complete: show the final state, model with all
		// encrypts declarations matching myapp at the level-10 tag.
		return [
			{
				filename: 'app/models/user.rb',
				language: 'ruby',
				code: `${baseModel}

  encrypts :email_address, deterministic: true, downcase: true
  encrypts :phone, deterministic: true
  encrypts :address
end`,
			},
		];
	}

	// reward, matches real myapp at the level-10 git tag.
	// Service-object lookup (FindUser) and email validators are deferred to
	// later levels (L16 Service Objects, L18 Validation Contracts); showing
	// them here is premature pedagogy. Active Storage (has_one_attached) is
	// L34. Encryption alone is what L10 teaches; everything else is noise.
	return [
		{
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy

  normalizes :email_address, with: ->(e) { e.strip.downcase }

  encrypts :email_address, deterministic: true, downcase: true
  encrypts :phone, deterministic: true
  encrypts :address
end`,
		},
		{
			// Pseudo file: the actual `config/credentials.yml.enc` is
			// encrypted gibberish on disk (not human-readable). What the
			// player needs to see is the decrypted YAML they would write
			// via `bin/rails credentials:edit`. The space in the filename
			// flags this as a pedagogical view, not a real path.
			filename: 'Credentials Entry (decrypted view)',
			language: 'yaml',
			code: `# Run: bin/rails credentials:edit
# Rails decrypts config/credentials.yml.enc into your editor.
# Add the active_record_encryption block, save, and Rails re-encrypts.

active_record_encryption:
  primary_key: <run \`bin/rails db:encryption:init\` to generate>
  deterministic_key: <...>
  key_derivation_salt: <...>`,
		},
		{
			// Pseudo file: console examples showing how the bearer-token
			// auth flow's lookup-by-email-address still works under
			// deterministic encryption. The space in the filename flags
			// this as pedagogical, not a real path.
			filename: 'Rails console (lookup by encrypted attribute)',
			language: 'ruby',
			code: `# Deterministic encryption: same plaintext encrypts to the same
# ciphertext, so find_by works as if the column were plaintext.
User.find_by(email_address: "joe@example.com")
# Active Record encrypts the query value with the same key, then
# does a normal SQL equality match against the stored ciphertext.

# Non-deterministic encryption (address): can decrypt on read but
# cannot find_by, every save produces a different ciphertext.
User.find_by(address: "123 Main St")
# => returns nil even if a user has that address.`,
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

			// Determine which columns to highlight based on probe
			const colsByProbe: Record<string, string[]> = {
				'sql-injection': ['email_address', 'phone'],
				'backup-leak': ['address'],
				'tail-query-logs': ['email_address', 'phone'],
			};
			const cols = colsByProbe[probeId] ?? [];
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
		const isAttackerView = encrypted && lastScenarioId === 'sql-injection';

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
										email_address{' '}
										{encrypted ? '(deterministic)' : '(plaintext!)'}
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
										phone {encrypted ? '(deterministic)' : '(plaintext!)'}
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
										<td className={cellClass('email_address', isHighlighted)}>
											{encrypted ? (
												<span className="flex items-center gap-1">
													<Lock className="w-3 h-3 shrink-0" />
													<span className="truncate max-w-32">
														{CIPHERTEXT[user.email_address]}
													</span>
												</span>
											) : (
												user.email_address
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
						'Trace where the PII leaks beyond the database itself.',
					]}
					scenario="A GDPR audit flagged that user PII (email_address, phone, address) is stored in plaintext in the database. A breach would expose everything."
				>
					<div className="p-4 border-t border-border space-y-4">
						<div>
							<h3 className="text-sm font-semibold text-foreground mb-2">
								Scenario
							</h3>
							<p className="text-sm text-muted-foreground">
								A GDPR audit flagged that user PII (email_address, phone,
								address) is stored in plaintext in the database. A breach would
								expose everything.
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
					goal="Apply application-layer encryption to the sensitive User columns we identified."
					instructions={[
						'Generate the three encryption keys.',
						'Store keys securely in Rails credentials.',
						'Apply application-layer encryption to email_address with the right options for login.',
						'Apply application-layer encryption to phone and address, picking the right mode for each.',
					]}
					scenario="Rails 8 ships built-in encryption via the encrypts macro. Pick the right options per column based on whether the field needs to be looked up."
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
					'Replay the same attacker actions and see only ciphertext.',
					'Authenticate by email_address and look up by phone for support.',
					'Try a non-deterministic lookup and see it return nil.',
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

					<div className="mt-auto px-6 pb-4">
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
								['email_address', 'phone', 'address'],
							)}
						{showDb &&
							renderMiniTable(
								'What the Database Stores',
								<Database className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
								'border-amber-300 dark:border-amber-700',
								true,
								['email_address', 'phone', 'address'],
							)}
					</div>
				</div>

				<div className="mt-auto px-6 pb-4">
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
					actNumber={2}
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
