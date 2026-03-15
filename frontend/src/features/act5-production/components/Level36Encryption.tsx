/**
 * Level 36: Encrypted Attributes
 *
 * Sequential phase flow: observe -> build -> activate -> reward
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
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Encryption" button
 * Phase 4 (ADVANTAGE - reward): Same table, now showing ciphertext for PII.
 *   Allowed: Deterministic find_by works, app code reads plaintext.
 *   Blocked: Non-deterministic find_by fails, attacker sees gibberish.
 *
 * Teaches: Rails 8 encrypts, deterministic vs non-deterministic,
 *   db:encryption:init, credentials, transparent encryption
 */

import {
	ArrowRight,
	Database,
	Eye,
	Key,
	Lock,
	Play,
	Star,
	Zap,
} from 'lucide-react';
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
import type { LevelComponentProps } from '@/features/levels-registry';
import {
	type DiscoveryDef,
	useDiscoveryGating,
} from '@/hooks/useDiscoveryGating';
import { type StepDef, useStepGating } from '@/hooks/useStepGating';
import { type StressScenario, useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'activate' | 'reward';

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
	},
];

// ──────────────────────────────────────────────
// Build step definitions
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'generate-keys', title: 'Generate Encryption Keys' },
	{ id: 'add-credentials', title: 'Store Keys in Credentials' },
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
  # Non-deterministic (default)
  # Cannot use find_by(email: ...)
  # Cannot validate uniqueness
end`,
		correct: false,
		feedback:
			'Non-deterministic encryption means the same email produces different ciphertext each time. The database cannot match on it, breaking login lookups and uniqueness validation.',
	},
	{
		id: 'correct-deterministic',
		label: `class User < ApplicationRecord
  encrypts :email, deterministic: true
  # Same email always produces same ciphertext
  # Allows: find_by(email:), where(email:)
  # Allows: validates :email, uniqueness: true
end`,
		correct: true,
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
  # All fields deterministic
end`,
		correct: false,
		feedback:
			'Deterministic encryption is less secure because identical values produce identical ciphertext. An attacker can perform frequency analysis. Only use deterministic for fields that need querying.',
	},
	{
		id: 'correct-non-deterministic',
		label: `class User < ApplicationRecord
  encrypts :email, deterministic: true
  encrypts :phone          # non-deterministic (default)
  encrypts :address        # non-deterministic (default)
  # Phone/address: max security, no querying needed
end`,
		correct: true,
	},
	{
		id: 'wrong-encrypt-name',
		label: `class User < ApplicationRecord
  encrypts :email, deterministic: true
  encrypts :phone
  encrypts :address
  encrypts :name  # Encrypt everything!
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

    # ActiveRecord encrypts the query value automatically
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
		label: 'SQL injection attempt',
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
];

// ──────────────────────────────────────────────
// Code preview files
// ──────────────────────────────────────────────

function getCodeFiles(phase: Phase, furthestStep: number) {
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
		if (furthestStep <= 0) {
			return [
				{
					filename: 'app/models/user.rb',
					language: 'ruby',
					code: `class User < ApplicationRecord
  has_secure_password
  # No encryption keys generated yet.
  # Run: bin/rails db:encryption:init
  # to generate primary_key, deterministic_key,
  # and key_derivation_salt.
end`,
				},
			];
		}
		if (furthestStep <= 1) {
			return [
				{
					filename: 'config/credentials.yml.enc',
					language: 'yaml',
					code: `# Keys generated, now store them securely.
# Choose the right storage mechanism.
active_record_encryption:
  primary_key: EGY8WhulUOXixybod7ZWwMIL68R9o5kC
  deterministic_key: aPA5XyALhf75NNnMzaspW7akTfZp0lPY
  key_derivation_salt: xEY0dt6TZcAMg52K7O84wYzkjvbA62Hz`,
				},
			];
		}
		if (furthestStep <= 2) {
			return [
				{
					filename: 'app/models/user.rb',
					language: 'ruby',
					code: `class User < ApplicationRecord
  has_secure_password

  encrypts :email, deterministic: true
  # Same email -> same ciphertext
  # Allows: find_by(email:), validates uniqueness

  # phone and address still plaintext...

  validates :email, uniqueness: true
end`,
				},
			];
		}
		if (furthestStep <= 3) {
			return [
				{
					filename: 'app/models/user.rb',
					language: 'ruby',
					code: `class User < ApplicationRecord
  has_secure_password

  encrypts :email, deterministic: true
  encrypts :phone          # non-deterministic (default)
  encrypts :address        # non-deterministic (default)
  # name: plaintext (not PII)

  has_one_attached :avatar do |attachable|
    attachable.variant :thumb, resize_to_limit: [100, 100]
    attachable.variant :medium, resize_to_limit: [300, 300]
  end

  validates :email, uniqueness: true
end`,
				},
			];
		}
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

	// reward / activate
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

export function Level36Encryption({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<Phase>('observe');
	const [flowPhase, setFlowPhase] = useState(-1);
	const [wrongFeedback, setWrongFeedback] = useState<string | null>(null);
	const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
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

	// Auto-advance to activate when build completes
	useEffect(() => {
		if (stepper.isComplete && phase === 'build') {
			setPhase('activate');
		}
	}, [stepper.isComplete, phase]);

	// ── Observe phase: probe handler ──
	const handleProbe = useCallback(
		(probeId: string) => {
			if (flowPhase !== -1) return;

			const discoveries = PROBE_DISCOVERY_MAP[probeId];
			if (discoveries) {
				for (const d of discoveries) discoveryGating.discover(d);
			}

			// Animate: rows flash red sequentially
			setFlowPhase(0);
			const timers: ReturnType<typeof setTimeout>[] = [];
			for (let i = 0; i < SAMPLE_USERS.length; i++) {
				const t = setTimeout(() => {
					setHighlightedRow(SAMPLE_USERS[i].id);
				}, i * ANIMATION_DURATION_MS);
				timers.push(t);
			}
			const tEnd = setTimeout(() => {
				setHighlightedRow(null);
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
			stressTest.fireRequest(scenarioId);

			const _scenario = STRESS_SCENARIOS.find((s) => s.id === scenarioId);
			setFlowPhase(0);

			if (
				scenarioId === 'attacker-dump' ||
				scenarioId === 'transparent-read' ||
				scenarioId === 'backup-safe'
			) {
				// Animate all rows
				const timers: ReturnType<typeof setTimeout>[] = [];
				for (let i = 0; i < SAMPLE_USERS.length; i++) {
					const t = setTimeout(() => {
						setHighlightedRow(SAMPLE_USERS[i].id);
					}, i * ANIMATION_DURATION_MS);
					timers.push(t);
				}
				const tEnd = setTimeout(() => {
					setHighlightedRow(null);
					setFlowPhase(-1);
				}, SAMPLE_USERS.length * ANIMATION_DURATION_MS);
				timers.push(tEnd);
				timersRef.current.push(...timers);
			} else {
				// Single row flash
				setHighlightedRow(1);
				const t1 = setTimeout(() => {
					setHighlightedRow(null);
					setFlowPhase(-1);
				}, ANIMATION_DURATION_MS * 2);
				timersRef.current.push(t1);
			}
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
		onComplete({ stars: 3 });
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
											isHighlighted &&
												!encrypted &&
												'bg-red-100 dark:bg-red-900/30',
											isHighlighted &&
												encrypted &&
												'bg-emerald-100 dark:bg-emerald-900/30',
										)}
										key={user.id}
									>
										<td className="px-3 py-2 font-mono text-muted-foreground">
											{user.id}
										</td>
										<td
											className={cn(
												'px-3 py-2 font-mono',
												encrypted
													? 'text-emerald-700 dark:text-emerald-400'
													: 'text-red-700 dark:text-red-400',
											)}
										>
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
										<td
											className={cn(
												'px-3 py-2 font-mono',
												encrypted
													? 'text-emerald-700 dark:text-emerald-400'
													: 'text-red-700 dark:text-red-400',
											)}
										>
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
										<td
											className={cn(
												'px-3 py-2 font-mono',
												encrypted
													? 'text-emerald-700 dark:text-emerald-400'
													: 'text-red-700 dark:text-red-400',
											)}
										>
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
					<div className="p-4 border-t border-border">
						<DiscoveryChecklist
							definitions={DISCOVERY_DEFS}
							isDiscovered={discoveryGating.isDiscovered}
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
							furthestStep={stepper.furthestStep}
							steps={STEP_DEFS}
						/>
					</div>
				</InstructionPanel>
			);
		}

		if (phase === 'activate') {
			return (
				<InstructionPanel
					goal="Encryption configured. Test the encrypted database."
					instructions={[]}
					scenario="All PII is encrypted at rest. Deterministic email allows login lookups. Non-deterministic phone/address provides maximum security."
				/>
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

					<div className="px-6 pb-2">
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
								feedback={wrongFeedback}
								onDismiss={() => setWrongFeedback(null)}
							/>
						</div>
					)}

					<div className="space-y-3">
						{config.options.map((opt) => (
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
								<Button onClick={stepper.nextStep} variant="outline">
									Next Step
									<ArrowRight className="w-4 h-4 ml-2" />
								</Button>
							</div>
						)}
				</div>
			);
		}

		if (phase === 'activate') {
			return (
				<div className="flex-1 flex flex-col items-center justify-center gap-6">
					<div className="flex gap-1">
						{[1, 2, 3].map((s) => (
							<Star className="w-8 h-8 fill-amber-400 text-amber-400" key={s} />
						))}
					</div>
					<Button onClick={() => setPhase('reward')} size="lg">
						<Play className="w-4 h-4 mr-2" />
						Visualize Encryption
					</Button>
				</div>
			);
		}

		// reward
		return (
			<div className="flex-1 flex flex-col">
				{renderDatabaseTable(true)}

				<div className="px-6 pb-2">
					<StressTestPanel
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
					levelNumber={35}
					onComplete={handleComplete}
					onReset={() => {
						setPhase('observe');
						setFlowPhase(-1);
						setWrongFeedback(null);
						setHighlightedRow(null);
						discoveryGating.reset();
						stepper.reset();
						stressTest.reset();
					}}
					onValidate={handleValidate}
				/>
				{renderCenterPanel()}
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(phase, stepper.furthestStep)}
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

export default Level36Encryption;
