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
- Application code sees plaintext; database stores ciphertext

**Frequency analysis (why deterministic is "less secure"):**
Deterministic encryption produces the same ciphertext for the same plaintext. An attacker who steals the database can count how often each ciphertext appears. If \`status\` is encrypted deterministically, the most common ciphertext is almost certainly \`active\`, and the rare one is \`banned\`. They have not broken the encryption, but they have learned which rows mean what. The rule of thumb: deterministic for fields where the value space is large and uniformly distributed (emails, SSNs); non-deterministic for low-cardinality categorical fields where the distribution itself is sensitive (medical diagnosis, account tier).

**Migrating existing plaintext data (the real procedure):**
Adding \`encrypts :email\` to a model with existing rows does NOT encrypt them. Reads of those old rows raise an error by default once \`encrypts\` is declared. The safe migration path:

1. Add \`encrypts :email, deterministic: true, support_unencrypted_data: true\` first. The flag tells Rails to read old plaintext rows and encrypt new writes.
2. Backfill in batches (do NOT load the whole table at once):
\`\`\`ruby
User.find_each(batch_size: 1000) do |user|
  next if user.attribute_was_encrypted?(:email)
  user.email = user.email   # forces a re-write through the encryptor
  user.save!(validate: false)
end
\`\`\`
3. Once the backfill completes and verification passes, remove \`support_unencrypted_data: true\` and deploy. From then on, any plaintext row raises and you know the backfill missed something.

The flag \`Rails.application.config.active_record.encryption.support_unencrypted_data = true\` exists as a global escape hatch but is dangerous: a single unencrypted row past the cut-over slips through silently. Per-attribute is safer.

**Key rotation (the production procedure):**
Rails supports key rotation via the \`previous\` keys list. The procedure:

\`\`\`ruby
# config/application.rb (or an initializer)
config.active_record.encryption.previous = [
  { primary_key: ENV['OLD_PRIMARY_KEY'],
    deterministic_key: ENV['OLD_DETERMINISTIC_KEY'],
    key_derivation_salt: ENV['OLD_SALT'] }
]
\`\`\`
Reads try the current key first, fall back to each \`previous\` entry. Writes always use the current key. To complete the rotation:

1. Generate new keys, deploy with both current and previous configured.
2. Re-encrypt the data: \`Rails.application.config.active_record.encryption.previous_schemes\` lets you trigger \`User.find_each(&:encrypt!)\` (model-level) or batch by attribute.
3. Once re-encryption is verified, remove the \`previous\` entry. From then on, anything still encrypted with the old key raises.

Compliance review (SOC 2, HIPAA, PCI) usually requires documented rotation cadence (annual at minimum, faster on suspected compromise). Plan for it before launch, not after the audit finding.

**External key management (HSM / cloud KMS):**
For shops with strict compliance posture (FedRAMP High, HIPAA with BAAs, PCI Level 1), the encryption key cannot live in Rails credentials at all. The pattern is to fetch the data key at boot from AWS KMS, GCP KMS, HashiCorp Vault, or a hardware HSM, and pass it into the encryption config:

\`\`\`ruby
# config/initializers/encryption_keys.rb
keys = AwsKmsClient.fetch_encryption_keys  # returns the three-key hash
Rails.application.config.active_record.encryption.primary_key = keys[:primary]
Rails.application.config.active_record.encryption.deterministic_key = keys[:deterministic]
Rails.application.config.active_record.encryption.key_derivation_salt = keys[:salt]
\`\`\`
This way the key never sits on disk, key rotation is a KMS API call, and an attacker who reads the application server filesystem still cannot decrypt the database.

**What encryption does NOT replace:**
- It does not encrypt the column name or row count (an attacker still sees how many users you have).
- It does not encrypt query patterns (\`WHERE email = ?\` still leaks that you queried by email).
- Backups inherit the same encryption, but backups also need the key. Plan key escrow for backups.
- Full-text search becomes impossible. \`encrypts :description\` (non-deterministic) means \`WHERE description LIKE '%foo%'\` returns nothing. If the field needs both encryption and search, use deterministic encryption for exact-match lookup OR push search to a separate index that you encrypt at the document level.`,
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
			'Adding encrypts to a column with existing rows without support_unencrypted_data: true (every existing row read raises until backfilled)',
			'Backfilling existing data with User.update_all (skips the encryptor; rows look encrypted but are still plaintext on disk)',
			'Using deterministic encryption on low-cardinality fields like status or tier (the ciphertext distribution leaks the value distribution)',
			"Assuming WHERE description LIKE '%foo%' still works after encrypts :description (non-deterministic encryption makes substring search impossible; plan a separate searchable index)",
			'Storing the encryption key in the same credentials file you commit to git (leaked repo == leaked database). Use ENV-injected keys or a KMS for production',
			'No documented key rotation cadence (compliance auditors will ask; design for it before launch)',
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
			{
				title: 'AWS KMS for application-layer encryption',
				url: 'https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html',
			},
			{
				title: 'GCP Cloud KMS',
				url: 'https://cloud.google.com/kms/docs/key-management-service',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Use `encrypts :email, deterministic: true` for queryable fields and `encrypts :phone` (non-deterministic) for fields that never need lookups.',
	},
};
