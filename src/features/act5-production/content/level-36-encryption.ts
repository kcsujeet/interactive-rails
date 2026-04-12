import type { Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

export const level36Encryption: Level = {
	id: 'act5-level36-encryption',
	actId: 5,
	levelNumber: 36,
	name: 'Encrypted Attributes',
	requiresTests: true,
	trigger: {
		type: 'security_audit',
		description:
			'GDPR audit flagged: user PII (emails, phone numbers, addresses) is stored in plaintext. Encrypt at rest immediately.',
	},
	startingPipeline: standardPipeline({ modelLabel: 'User' }),
	problem: {
		observation:
			'Security audit reveals user emails, phone numbers, and addresses are stored as plaintext in the database. A database breach would expose all PII. Email lookups must still work for login.',
		rootCause:
			'No encryption-at-rest for sensitive user attributes. Rails 8 provides built-in encryption via `encrypts` but it has not been configured.',
		codeExample: `# AUDIT FINDING: Plaintext PII in database
# SELECT email, phone, address FROM users LIMIT 1;
# => "alice@example.com", "+1-555-0123", "123 Main St, NYC"

# Anyone with database access sees everything!
# A SQL injection or backup leak exposes all PII.

# Rails 8 provides: encrypts
# But we need TWO modes:
#   - Deterministic: Same input -> same ciphertext (allows find_by)
#   - Non-deterministic: Same input -> different ciphertext (more secure)

# Email needs deterministic (for login lookups)
# Phone/address need non-deterministic (no lookups needed)`,
		goal: 'Encrypt user PII at rest using Rails 8 built-in encryption. Choose the right encryption mode for each field based on whether it needs to be queryable.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'node_present', nodeType: 'model' },
		{ type: 'connection', sourceType: 'controller', targetType: 'model' },
	],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Rails 8 Encrypted Attributes',
		goal: `In this level, you'll:\n- learn how to encrypt sensitive data at the application level using Rails 8's built-in encryption.\n- understand the difference between deterministic encryption (queryable but less secure) and non-deterministic encryption (maximum security).\n- know when to use each mode for fields like SSNs, API keys, and personal data.`,
		conceptExplanation: `Rails 8 provides built-in attribute encryption via the \`encrypts\` macro. No gems needed.

**Deterministic encryption:**
- Same plaintext always produces the same ciphertext
- Enables \`find_by\`, \`where\`, and uniqueness validations
- Less secure (vulnerable to frequency analysis)
- Use for: email (login), SSN (lookup)

**Non-deterministic encryption:**
- Same plaintext produces different ciphertext each time
- Cannot query by encrypted value
- More secure (no patterns to analyze)
- Use for: phone, address, medical records

**How it works under the hood:**
- Encryption keys are stored in Rails credentials (\`rails credentials:edit\`)
- Three keys: \`primary_key\`, \`deterministic_key\`, \`key_derivation_salt\`
- Data is encrypted before writing to the database
- Data is decrypted after reading from the database
- Application code sees plaintext; database stores ciphertext`,
		railsCodeExample: `# Step 1: Generate encryption keys
# bin/rails db:encryption:init
# Outputs keys to add to credentials:
#
# active_record_encryption:
#   primary_key: <generated>
#   deterministic_key: <generated>
#   key_derivation_salt: <generated>

# Step 2: Add to credentials
# EDITOR=vim rails credentials:edit
active_record_encryption:
  primary_key: EGY8WhulUOXixybod7ZWwMIL68R9o5kC
  deterministic_key: aPA5XyALhf75NNnMzaspW7akTfZp0lPY
  key_derivation_salt: xEY0dt6TZcAMg52K7O84wYzkjvbA62Hz

# Step 3: Declare encrypted attributes
class User < ApplicationRecord
  # Deterministic: allows find_by, where, uniqueness validation
  encrypts :email, deterministic: true

  # Non-deterministic (default): more secure, no querying
  encrypts :phone
  encrypts :address

  # With options
  encrypts :ssn, deterministic: true, downcase: true

  # Validations still work
  validates :email, uniqueness: true  # Works with deterministic!
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }
end

# Usage is transparent - reads/writes plaintext in Ruby
user = User.create!(
  email: "alice@example.com",    # Stored encrypted
  phone: "+1-555-0123",          # Stored encrypted
  address: "123 Main St"         # Stored encrypted
)

# Querying deterministic attributes works normally
User.find_by(email: "alice@example.com")  # Works!

# Querying non-deterministic raises an error
User.find_by(phone: "+1-555-0123")  # Raises ActiveRecord::Encryption::Errors::Configuration

# In the database, all values are ciphertext:
# SELECT email FROM users LIMIT 1;
# => "{"p":"dB3dhj...","h":{"iv":"f9w...","at":"Ij..."}}"

# Migrating existing plaintext data
# Re-save records to trigger encryption on write:
User.find_each do |user|
  user.save!(validate: false)  # Re-saves with encryption
end

# Key rotation
Rails.application.config.active_record.encryption.previous = [
  { primary_key: "old_key", deterministic_key: "old_det_key", key_derivation_salt: "old_salt" }
]`,
		commonMistakes: [
			'Using non-deterministic encryption for attributes you need to query (find_by, where)',
			'Using deterministic encryption for highly sensitive data that never needs querying',
			'Forgetting to migrate existing plaintext data after adding encrypts',
			'Not storing encryption keys in Rails credentials (hardcoding in code)',
			'Not planning for key rotation before going to production',
		],
		whenToUse:
			'Any PII or sensitive data stored in the database. Required for GDPR, HIPAA, SOC2 compliance. Rails 8 makes this a one-liner.',
		furtherReading: [
			{
				title: 'Active Record Encryption',
				url: 'https://guides.rubyonrails.org/active_record_encryption.html',
			},
			{
				title: 'Rails 8 Encryption Guide',
				url: 'https://edgeguides.rubyonrails.org/active_record_encryption.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Use `encrypts :email, deterministic: true` for queryable fields and `encrypts :phone` (non-deterministic) for fields that never need lookups.',
	},
};
