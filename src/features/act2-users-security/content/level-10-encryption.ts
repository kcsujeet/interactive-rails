import type { Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

export const level10Encryption: Level = {
	id: 'act2-level10-encryption',
	actId: 2,
	levelNumber: 10,
	name: 'Encrypted Attributes',
	requiresTests: true,
	trigger: {
		type: 'security_audit',
		description:
			'Pre-launch security review: every PII column on `users` (email_address, phone, address) is stored as plaintext. Anyone with DB access, a leaked backup, a misconfigured staging environment, a SQL injection, sees every customer. Encrypt at rest before the first signup.',
	},
	startingPipeline: standardPipeline({ modelLabel: 'User' }),
	problem: {
		observation:
			'The User model has PII columns (email_address, phone, address) sitting unencrypted in PostgreSQL. Backups, replicas, DB admin access, or a SQL injection would all expose them in plaintext. Login still has to work via `User.authenticate_by(email_address:, password:)`, so any encryption has to keep email lookups working.',
		rootCause:
			'No encryption-at-rest for sensitive user attributes. Rails 8 provides built-in encryption via `encrypts`, but the keys have not been generated and the model has no `encrypts` declarations.',
		codeExample: `# Right now: plaintext PII in the database.
# psql -c "SELECT email_address, phone, address FROM users LIMIT 1;"
# => "alice@example.com" | "+1-555-0123" | "123 Main St, NYC"
#
# Anyone with database access sees everything. A leaked
# backup or SQL injection exposes every customer's identity.
#
# Rails 8 ships two encryption modes for a column:
#   - One mode produces the SAME ciphertext for the same
#     plaintext, so equality lookups (find_by) still work.
#     Use this for fields you have to look up by value.
#   - The other mode produces a DIFFERENT ciphertext each
#     time, so it cannot be queried but is harder to
#     attack. Use this for fields you only ever read out.
#
# Constraint: login goes through a method that looks the
# user up by email_address, so whatever encryption mode
# you pick for that column has to keep that lookup
# working.`,
		goal: 'Encrypt the sensitive User columns at the application layer so the database stores ciphertext while the app keeps reading plaintext. Login lookups must keep working.',
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
		goal: `In this level, you'll:\n- learn how to encrypt sensitive User columns at the application layer using Rails 8's built-in encryption.\n- understand why some fields need to stay queryable (login lookups) while others do not.\n- choose the right encryption mode per field for fields like emails, phone numbers, addresses, SSNs, and API keys.`,
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

1. Set the global flag in an initializer: \`config.active_record.encryption.support_unencrypted_data = true\`. Per the [Active Record Encryption guide](https://guides.rubyonrails.org/active_record_encryption.html), this is a Rails-application-wide setting (not a per-attribute option). With it on, reads of plaintext rows succeed without raising.
2. Add \`encrypts :email, deterministic: true\` to the model and deploy.
3. Backfill in batches. Rails provides \`record.encrypt\` (a real method on encryptable records, per the encryption guide) that re-encrypts all encrypted attributes on that row in one call:
\`\`\`ruby
User.find_each(batch_size: 1000, &:encrypt)
\`\`\`
Re-running the backfill is idempotent: a row that is already encrypted decrypts to its plaintext, then re-encrypts to the same logical value. The cost is the unconditional write, not duplicate data.

4. Once the backfill completes and verification passes, set \`support_unencrypted_data = false\` (or remove the line, since false is the default) and deploy. From then on, any plaintext row raises \`ActiveRecord::Encryption::Errors::Decryption\` and you know the backfill missed something.

The escape-hatch nature of \`support_unencrypted_data\` is dangerous: while it is on, a single unencrypted row past the cut-over slips through silently. Keep it on only as long as the backfill is running.

**Key rotation (the production procedure):**
Rails supports key rotation by listing multiple keys; reads try them in order until one decrypts, writes use the first one. Per the [Active Record Encryption guide](https://guides.rubyonrails.org/active_record_encryption.html):

\`\`\`yaml
# config/credentials.yml.enc (edited via bin/rails credentials:edit)
active_record_encryption:
  primary_key:
    - <new_primary_key>     # used for writes; tried first for reads
    - <old_primary_key>     # fallback for reading old rows
  key_derivation_salt: <salt>
\`\`\`
Procedure:

1. Add the new primary key at the top of the list, keeping the old one below. Deploy. Old rows decrypt via fallback; new writes use the new key.
2. Re-encrypt every row through the current key:
\`\`\`ruby
User.find_each(batch_size: 1000, &:encrypt)
\`\`\`
3. Once re-encryption is verified, remove the old key and deploy. From then on, any row still encrypted with the old key raises on read, surfacing missed rows.

**Critical caveat: rotation is NOT supported for deterministic encryption** ([encryption guide](https://guides.rubyonrails.org/active_record_encryption.html)). If \`encrypts :email, deterministic: true\` (which the example above uses), the deterministic key cannot be rotated. Re-encrypting the same plaintext under a new deterministic key would produce a different ciphertext, breaking the equality lookups (\`find_by(email: ...)\`) that deterministic encryption exists to support. Plan deterministic-key choice as a one-time decision, and isolate any data that may need rotation under non-deterministic encryption.

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
			'Picking the same encryption mode for every field. The choice between modes is per-attribute and depends on whether the field needs to be queryable.',
			'Forgetting to backfill the rows that existed before `encrypts` was added. The new column declaration only encrypts on write; old plaintext rows raise on read once the support flag is removed.',
			'Hardcoding encryption keys in source files instead of in Rails credentials. A leaked repo then leaks the database too.',
			'Not planning a key rotation cadence. Compliance audits ask for one, and adding it after the fact is expensive.',
			'Adding encrypts to a column with existing rows without setting config.active_record.encryption.support_unencrypted_data = true during the backfill window (every existing row read raises until backfilled)',
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
		text: 'Two encryption modes exist. One produces the same ciphertext every time for a given input -- so equality lookups still work. The other produces a different ciphertext each time -- harder to crack but unqueryable. Pick per-attribute based on whether you ever need to look the row up by that value.',
	},
};
