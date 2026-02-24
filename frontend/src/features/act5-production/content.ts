/**
 * Act 5: Production Features
 * "Real users, real money, real failures."
 *
 * Levels 29-36: Polymorphic Associations, Transactions & Locking, Active Storage,
 * Encrypted Attributes, Real-Time, External APIs, Webhooks & Idempotency, API Versioning
 * App context: SaaS API with payments
 */

import type { Act, Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

// ============================================
// Level 29: Polymorphic Associations
// ============================================

const level30Polymorphic: Level = {
	id: 'act5-level33-polymorphic',
	actId: 5,
	levelNumber: 33,
	name: 'Polymorphic Associations',
	trigger: {
		type: 'new_feature',
		description:
			'Users want to comment on Posts, Photos, AND Videos. Product asks: do we need three separate comment tables?',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
			{ id: 'router-node', type: 'router', x: 260, y: 250, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 440,
				y: 250,
				locked: true,
			},
			{
				id: 'post-model',
				type: 'model',
				x: 640,
				y: 150,
				locked: true,
				config: { label: 'Post' },
			},
			{
				id: 'photo-model',
				type: 'model',
				x: 640,
				y: 250,
				locked: true,
				config: { label: 'Photo' },
			},
			{
				id: 'video-model',
				type: 'model',
				x: 640,
				y: 350,
				locked: true,
				config: { label: 'Video' },
			},
			{ id: 'database-node', type: 'database', x: 860, y: 250, locked: true },
			{ id: 'response-node', type: 'response', x: 1040, y: 250, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-node', targetNodeId: 'router-node' },
			{
				id: 'c2',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'post-model' },
			{
				id: 'c4',
				sourceNodeId: 'controller-node',
				targetNodeId: 'photo-model',
			},
			{
				id: 'c5',
				sourceNodeId: 'controller-node',
				targetNodeId: 'video-model',
			},
			{ id: 'c6', sourceNodeId: 'post-model', targetNodeId: 'database-node' },
			{ id: 'c7', sourceNodeId: 'photo-model', targetNodeId: 'database-node' },
			{ id: 'c8', sourceNodeId: 'video-model', targetNodeId: 'database-node' },
		],
	},
	problem: {
		observation:
			'Three separate comment tables exist: post_comments, photo_comments, video_comments. Schema is duplicated, queries are scattered, and adding a new commentable type means a new table and new controller.',
		rootCause:
			'Each commentable model has its own dedicated comments table instead of using a single polymorphic comments table.',
		codeExample: `# Current mess: Three separate tables!
class PostComment < ApplicationRecord
  belongs_to :post
end

class PhotoComment < ApplicationRecord
  belongs_to :photo
end

class VideoComment < ApplicationRecord
  belongs_to :video
end

# Three controllers, three serializers, three sets of tests...
# Adding "comment on Articles" means ANOTHER table.

# What if we had ONE Comment that belongs to anything?
# comments table: commentable_type + commentable_id`,
		goal: 'Replace three comment tables with one polymorphic Comment model that can belong to any commentable resource.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'node_present', nodeType: 'model' },
		{ type: 'connection', sourceType: 'model', targetType: 'model' },
	],
	availableNodes: ['model'],
	unlockedNodes: [],
	learningContent: {
		title: 'Polymorphic Associations',
		goal: `In this level, you'll:\n- learn how polymorphic associations let a single model belong to multiple different parent types.\n- use commentable_type and commentable_id columns so one Comment model can belong to a Post, Photo, or Video.\n- understand when this pattern is the right choice versus separate tables.`,
		conceptExplanation: `Polymorphic associations let a model belong to more than one other model using a single association.

**How it works:**
- The child table stores two columns: \`commentable_type\` (string) and \`commentable_id\` (integer)
- \`commentable_type\` holds the class name ("Post", "Photo", "Video")
- \`commentable_id\` holds the foreign key
- Rails resolves the correct parent model at runtime

**When to use polymorphic:**
- Comments on multiple types (Posts, Photos, Videos)
- Taggings across models
- Attachments on different record types
- Activity logs referencing various models

**When NOT to use polymorphic:**
- When types need different columns (use STI or separate tables)
- When you need database-level foreign key constraints
- When the number of types is fixed at 2 (just use two belongs_to)`,
		railsCodeExample: `# Migration
class CreateComments < ActiveRecord::Migration[8.0]
  def change
    create_table :comments do |t|
      t.text :body, null: false
      t.references :commentable, polymorphic: true, null: false
      t.references :user, null: false, foreign_key: true
      t.timestamps
    end
  end
end

# app/models/comment.rb
class Comment < ApplicationRecord
  belongs_to :commentable, polymorphic: true
  belongs_to :user
end

# app/models/post.rb
class Post < ApplicationRecord
  has_many :comments, as: :commentable, dependent: :destroy
end

# app/models/photo.rb
class Photo < ApplicationRecord
  has_many :comments, as: :commentable, dependent: :destroy
end

# app/models/video.rb
class Video < ApplicationRecord
  has_many :comments, as: :commentable, dependent: :destroy
end

# Usage:
post = Post.find(1)
post.comments.create!(body: "Great post!", user: current_user)

photo = Photo.find(1)
photo.comments.create!(body: "Nice shot!", user: current_user)

# Works the same way for all types!
comment = Comment.first
comment.commentable  # Returns Post, Photo, or Video

# Eager loading polymorphic associations
Comment.includes(:commentable).where(user: current_user)

# Shared controller using polymorphic routing
# config/routes.rb
resources :posts do
  resources :comments, module: :posts
end
resources :photos do
  resources :comments, module: :photos
end`,
		commonMistakes: [
			'Not adding a composite index on [commentable_type, commentable_id]',
			'Forgetting that database-level foreign keys cannot enforce polymorphic associations',
			'Not using eager loading with polymorphic associations (causes N+1)',
			'Storing full namespaced class names when STI is involved',
			'Not validating that commentable_type is in an allowed list',
		],
		whenToUse:
			'When the same child model (comments, tags, attachments) needs to belong to multiple unrelated parent models with identical schemas.',
		furtherReading: [
			{
				title: 'Rails Polymorphic Associations',
				url: 'https://guides.rubyonrails.org/association_basics.html#polymorphic-associations',
			},
			{
				title: 'Polymorphic Routes in Rails',
				url: 'https://api.rubyonrails.org/classes/ActionDispatch/Routing/PolymorphicRoutes.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Add a single Comment model with polymorphic: true. Connect it to Post, Photo, and Video using `as: :commentable`.',
	},
};

// ============================================
// Level 30: Transactions & Locking
// ============================================

const level31Transactions: Level = {
	id: 'act5-level34-transactions',
	actId: 5,
	levelNumber: 34,
	name: 'Transactions & Locking',
	trigger: {
		type: 'incident',
		description:
			'Two users update the same subscription simultaneously. The last write silently overwrites the first. Account balance is now corrupted.',
	},
	startingPipeline: {
		nodes: [
			{
				id: 'request-a',
				type: 'request',
				x: 80,
				y: 150,
				locked: true,
				config: { label: 'User A' },
			},
			{
				id: 'request-b',
				type: 'request',
				x: 80,
				y: 350,
				locked: true,
				config: { label: 'User B' },
			},
			{
				id: 'controller-node',
				type: 'controller',
				x: 300,
				y: 250,
				locked: true,
			},
			{
				id: 'model-node',
				type: 'model',
				x: 500,
				y: 250,
				locked: true,
				config: { label: 'Account' },
			},
			{ id: 'database-node', type: 'database', x: 700, y: 250, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-a', targetNodeId: 'controller-node' },
			{ id: 'c2', sourceNodeId: 'request-b', targetNodeId: 'controller-node' },
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
			{ id: 'c4', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
		],
	},
	problem: {
		observation:
			'User A reads balance ($100), User B reads balance ($100). A deducts $30, saves $70. B deducts $50, saves $50. Actual balance should be $20 but is $50. Lost update.',
		rootCause:
			'No transaction isolation or locking. Concurrent reads followed by concurrent writes cause lost updates.',
		codeExample: `# BAD: Race condition - lost update
def deduct(amount)
  account = Account.find(params[:id])
  # User A reads balance: $100
  # User B reads balance: $100 (same stale value!)
  account.balance -= amount
  account.save!
  # User A saves: $70
  # User B saves: $50 (overwrites A's deduction!)
end

# Balance is $50 instead of $20
# User A's $30 deduction vanished!`,
		goal: 'Wrap the deduction in a transaction with proper locking to prevent lost updates.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'node_present', nodeType: 'model' },
		{ type: 'connection', sourceType: 'controller', targetType: 'model' },
	],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Transactions & Locking',
		goal: `In this level, you'll:\n- learn how to protect data integrity when multiple operations must succeed or fail together.\n- wrap related writes in database transactions.\n- use optimistic locking with lock_version for low-contention edits.\n- apply pessimistic locking with FOR UPDATE for critical operations like financial transfers.`,
		conceptExplanation: `Transactions ensure a group of operations either ALL succeed or ALL fail. Locking prevents concurrent access from corrupting data.

**Transactions:**
- Wrap multiple writes in \`ActiveRecord::Base.transaction\`
- If any operation raises, everything is rolled back
- Essential for multi-step operations (charge + create order + send email)

**Optimistic Locking (lock_version column):**
- No database locks held
- Checks \`lock_version\` on save; raises \`StaleObjectError\` if changed
- Best for low-contention resources (profile edits, CMS pages)

**Pessimistic Locking (SELECT ... FOR UPDATE):**
- Acquires a database row lock
- Other transactions wait until lock is released
- Best for high-contention resources (account balances, inventory counts)

**Rule of thumb:**
- Low contention + user-facing: Optimistic (retry on conflict)
- High contention + financial: Pessimistic (serialize access)`,
		railsCodeExample: `# OPTIMISTIC LOCKING
# Migration: add lock_version column
add_column :accounts, :lock_version, :integer, default: 0, null: false

# Rails automatically uses lock_version for optimistic locking
class Account < ApplicationRecord
  # lock_version column is automatically detected
end

# Usage:
account = Account.find(1)
account.balance -= 30
account.save!
# If another process updated the row, raises:
# ActiveRecord::StaleObjectError
rescue ActiveRecord::StaleObjectError
  retry  # Re-read and try again

# PESSIMISTIC LOCKING
def deduct(amount)
  Account.transaction do
    # SELECT * FROM accounts WHERE id = 1 FOR UPDATE
    account = Account.lock.find(params[:id])
    # Other transactions block here until this one commits

    raise InsufficientFundsError if account.balance < amount

    account.balance -= amount
    account.save!

    # Creates an audit trail within the same transaction
    account.transactions.create!(
      amount: -amount,
      balance_after: account.balance
    )
  end
end

# TRANSACTION with multiple models
ActiveRecord::Base.transaction do
  order = Order.create!(user: current_user, total: amount)
  payment = Payment.create!(order: order, amount: amount)
  account.update!(balance: account.balance - amount)
  # If ANY of these fail, ALL are rolled back
end

# Rails 8: with_lock shorthand
account = Account.find(1)
account.with_lock do
  account.balance -= amount
  account.save!
end`,
		commonMistakes: [
			'Not wrapping related writes in a transaction (partial failures corrupt data)',
			'Using optimistic locking for financial operations (too many retries under load)',
			'Holding pessimistic locks too long (causes deadlocks and timeouts)',
			'Forgetting to handle StaleObjectError when using optimistic locking',
			'Nesting transactions without understanding savepoints',
		],
		whenToUse:
			'Transactions for any multi-step write. Pessimistic locking for financial data. Optimistic locking for low-contention edits.',
		furtherReading: [
			{
				title: 'Active Record Transactions',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Transactions/ClassMethods.html',
			},
			{
				title: 'Active Record Locking',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Locking.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Use Account.transaction with Account.lock.find to prevent lost updates on balances.',
	},
};

// ============================================
// Level 31: Active Storage
// ============================================

const level32ActiveStorage: Level = {
	id: 'act5-level35-active-storage',
	actId: 5,
	levelNumber: 35,
	name: 'Active Storage',
	trigger: {
		type: 'new_feature',
		description:
			'Users want profile photos. The product team wants image uploads with automatic thumbnail generation.',
	},
	startingPipeline: standardPipeline({ modelLabel: 'User' }),
	problem: {
		observation:
			'Users upload 5MB profile photos through the Rails server. Memory spikes on every upload. No thumbnails generated. Serving originals costs bandwidth.',
		rootCause:
			'Files are uploaded through the application server instead of directly to object storage. No variant processing for thumbnails or resized images.',
		codeExample: `# BAD: File goes through app server
# Browser -> App Server (5MB in memory!) -> S3
def update
  @user.avatar.attach(params[:avatar])
  # Entire file loaded into Rails process memory
  # 10 concurrent uploads = 50MB memory spike
end

# No thumbnails - serving 5MB originals on listing pages
# GET /users -> each avatar is the full-resolution original

# No presigned URLs - every file download routes through Rails
def show_avatar
  send_data @user.avatar.download  # Blocks a Rails worker!
end`,
		goal: 'Configure Active Storage with direct uploads via presigned URLs, generate image variants for thumbnails, and serve files through a CDN.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'storage_configured' },
		{ type: 'node_present', nodeType: 'model' },
	],
	availableNodes: ['s3'],
	unlockedNodes: ['s3'],
	learningContent: {
		title: 'Active Storage: Uploads, Variants & Direct Upload',
		goal: `In this level, you'll:\n- learn how to handle file uploads in Rails using Active Storage.\n- attach files to models with has_one_attached and has_many_attached.\n- upload directly to S3 via presigned URLs to bypass the app server.\n- generate image variants like thumbnails and crops on the fly.`,
		conceptExplanation: `Active Storage manages file uploads in Rails, connecting files to Active Record models.

**Key concepts:**
- \`has_one_attached\`: Single file per record (avatar, resume)
- \`has_many_attached\`: Multiple files per record (photos, documents)
- **Direct Upload**: Browser uploads directly to S3 via presigned URL (Rails never touches the file)
- **Variants**: On-the-fly image transformations (resize, crop, convert)
- **Presigned URLs**: Time-limited URLs that grant temporary access to private files

**Architecture:**
1. Client requests a presigned URL from Rails
2. Client uploads directly to S3 using that URL
3. Client sends the blob signed_id back to Rails
4. Rails attaches the blob to the model
5. Variants are generated lazily on first access`,
		railsCodeExample: `# Setup: rails active_storage:install
# This creates active_storage_blobs and active_storage_attachments tables

# config/storage.yml
amazon:
  service: S3
  access_key_id: <%= ENV['AWS_ACCESS_KEY_ID'] %>
  secret_access_key: <%= ENV['AWS_SECRET_ACCESS_KEY'] %>
  region: us-east-1
  bucket: myapp-production

# config/environments/production.rb
config.active_storage.service = :amazon

# app/models/user.rb
class User < ApplicationRecord
  has_one_attached :avatar do |attachable|
    # Pre-define variants for consistent usage
    attachable.variant :thumb, resize_to_limit: [100, 100]
    attachable.variant :medium, resize_to_limit: [300, 300]
  end

  has_many_attached :documents
end

# Direct Upload: API endpoint returns presigned URL
# app/controllers/api/v1/direct_uploads_controller.rb
class Api::V1::DirectUploadsController < ApplicationController
  def create
    blob = ActiveStorage::Blob.create_before_direct_upload!(
      **blob_params
    )
    render json: {
      direct_upload: {
        url: blob.service_url_for_direct_upload,
        headers: blob.service_headers_for_direct_upload
      },
      blob_signed_id: blob.signed_id
    }
  end

  private

  def blob_params
    params.expect(file: [:filename, :byte_size, :checksum, :content_type])
  end
end

# Client-side: Upload directly to S3
# PUT <presigned_url> with file body
# Then attach: user.avatar.attach(blob_signed_id)

# Serving variants (lazy-generated)
url_for(user.avatar.variant(:thumb))
# First request: generates thumbnail, caches it
# Subsequent: serves cached variant

# In serializer / API response
class UserSerializer < BaseSerializer
  attribute :avatar_url do |user|
    if user.avatar.attached?
      Rails.application.routes.url_helpers
        .rails_representation_url(
          user.avatar.variant(:medium),
          only_path: false
        )
    end
  end
end`,
		commonMistakes: [
			'Uploading large files through the Rails server instead of using direct upload',
			'Not defining named variants (inconsistent resize dimensions across views)',
			'Serving files through Rails instead of S3/CDN (blocks workers)',
			'Not validating content type and file size before upload',
			'Forgetting to install image processing gems (image_processing, vips)',
		],
		whenToUse:
			'Any file upload in Rails. Use direct upload for files over 1MB. Always define variants for images.',
		furtherReading: [
			{
				title: 'Active Storage Overview',
				url: 'https://guides.rubyonrails.org/active_storage_overview.html',
			},
			{
				title: 'Active Storage Direct Uploads',
				url: 'https://guides.rubyonrails.org/active_storage_overview.html#direct-uploads',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Configure an S3 storage service, use has_one_attached with named variants, and set up a direct upload endpoint with presigned URLs.',
	},
};

// ============================================
// Level 33: Encrypted Attributes
// ============================================

const level33Encryption: Level = {
	id: 'act5-level36-encryption',
	actId: 5,
	levelNumber: 36,
	name: 'Encrypted Attributes',
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
		goal: 'Use Rails 8 `encrypts` to encrypt user PII at rest. Use deterministic encryption for email (login lookups) and non-deterministic for phone/address.',
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
		goal: `In this level, you'll:\n- learn how to encrypt sensitive data at the application level using Rails 8's built-in encrypts macro.\n- understand the difference between deterministic encryption (queryable but less secure) and non-deterministic encryption (maximum security).\n- know when to use each for fields like SSNs, API keys, and personal data.`,
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

// ============================================
// Level 34: Real-Time
// ============================================

const level34Realtime: Level = {
	id: 'act5-level37-realtime',
	actId: 5,
	levelNumber: 37,
	name: 'Real-Time',
	trigger: {
		type: 'new_feature',
		description:
			'Users want live notifications when their payments complete. HTTP polling every 2 seconds is killing the server with 50,000 concurrent users.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 150, locked: true },
			{
				id: 'poll-request',
				type: 'request',
				x: 80,
				y: 350,
				locked: true,
				config: { label: 'Polling' },
			},
			{
				id: 'controller-node',
				type: 'controller',
				x: 300,
				y: 250,
				locked: true,
			},
			{
				id: 'model-node',
				type: 'model',
				x: 500,
				y: 250,
				locked: true,
				config: { label: 'Notification' },
			},
			{ id: 'database-node', type: 'database', x: 700, y: 250, locked: true },
			{ id: 'response-node', type: 'response', x: 900, y: 250, locked: true },
		],
		connections: [
			{
				id: 'c1',
				sourceNodeId: 'request-node',
				targetNodeId: 'controller-node',
			},
			{
				id: 'c2',
				sourceNodeId: 'poll-request',
				targetNodeId: 'controller-node',
			},
			{ id: 'c3', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
			{ id: 'c4', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
			{
				id: 'c5',
				sourceNodeId: 'database-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'50,000 users polling every 2 seconds = 25,000 requests/second. 99% of polls return "no new notifications." Server CPU at 95%. Database connections exhausted.',
		rootCause:
			'HTTP polling wastes resources when there are no new events. Need server-push via WebSockets to only send data when something actually changes.',
		codeExample: `# BAD: Polling - wastes resources
# Client polls every 2 seconds:
setInterval(() => {
  fetch('/api/notifications/unread')
    .then(r => r.json())
    .then(data => updateUI(data))
}, 2000)

# Server handles 25,000 req/sec, most return empty:
# GET /api/notifications/unread => { notifications: [] }
# GET /api/notifications/unread => { notifications: [] }
# GET /api/notifications/unread => { notifications: [] }
# ...99% are wasted requests

# Need: Push notifications only when something happens
# WebSocket connection: open once, receive events as they occur`,
		goal: 'Replace HTTP polling with Action Cable WebSockets using Solid Cable (Rails 8 default, no Redis required).',
		thresholds: {},
	},
	successConditions: [
		{ type: 'node_present', nodeType: 'controller' },
		{ type: 'connection', sourceType: 'controller', targetType: 'model' },
	],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Real-Time with Action Cable & Solid Cable',
		goal: `In this level, you'll:\n- add real-time capabilities to your API using Action Cable and WebSockets.\n- set up channels for live communication.\n- use Solid Cable (Rails 8's database-backed adapter that replaces Redis).\n- broadcast updates to connected clients so they see changes instantly without polling.`,
		conceptExplanation: `Action Cable integrates WebSockets with Rails. Rails 8 introduces Solid Cable as the default adapter.

**Solid Cable (Rails 8 default):**
- Uses the database for pub/sub instead of Redis
- No additional infrastructure needed
- Perfectly fine for most apps (< 100K concurrent connections)
- Backed by a database table with automatic message pruning

**Action Cable concepts:**
- **Channel**: Like a controller for WebSockets (handles subscribe/unsubscribe/receive)
- **Stream**: A named broadcast channel (e.g., "notifications:user_42")
- **Connection**: The WebSocket connection with authentication
- **Subscription**: Client subscribes to a channel

**When to upgrade from Solid Cable to Redis:**
- More than 100K concurrent WebSocket connections
- Sub-millisecond broadcast latency requirements
- Multi-region deployments needing shared pub/sub`,
		railsCodeExample: `# Rails 8: Solid Cable is the default (no Redis!)
# config/cable.yml
production:
  adapter: solid_cable
  # Messages stored in database, auto-pruned
  # polling_interval: 0.1.seconds
  # message_retention: 1.day

# Step 1: Connection authentication
# app/channels/application_cable/connection.rb
module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    def find_verified_user
      # For API: Verify JWT from query params
      token = request.params[:token]
      user = User.find_by_token(token)
      user || reject_unauthorized_connection
    end
  end
end

# Step 2: Create a channel
# app/channels/notifications_channel.rb
class NotificationsChannel < ApplicationCable::Channel
  def subscribed
    stream_for current_user
    # Creates stream: "notifications:user_42"
  end

  def unsubscribed
    # Cleanup when client disconnects
  end

  # Client can send messages to the channel
  def mark_read(data)
    notification = current_user.notifications.find(data["id"])
    notification.update!(read_at: Time.current)
  end
end

# Step 3: Broadcast from anywhere in the app
# app/models/notification.rb
class Notification < ApplicationRecord
  belongs_to :user

  after_create_commit :broadcast_to_user

  private

  def broadcast_to_user
    NotificationsChannel.broadcast_to(
      user,
      {
        id: id,
        title: title,
        body: body,
        created_at: created_at.iso8601
      }
    )
  end
end

# Or broadcast from a job
class PaymentCompletedJob < ApplicationJob
  def perform(payment_id)
    payment = Payment.find(payment_id)
    notification = payment.user.notifications.create!(
      title: "Payment received",
      body: "Your payment of #{payment.amount} was processed."
    )
    # Notification broadcasts automatically via after_create_commit
  end
end

# Step 4: Client-side (JavaScript)
import { createConsumer } from "@rails/actioncable"

const cable = createConsumer(
  "wss://api.example.com/cable?token=" + authToken
)

cable.subscriptions.create("NotificationsChannel", {
  received(data) {
    showNotification(data.title, data.body)
  },
  markRead(id) {
    this.perform("mark_read", { id })
  }
})`,
		commonMistakes: [
			'Not authenticating WebSocket connections (anyone can subscribe)',
			'Broadcasting too much data (send IDs, let client fetch details)',
			'Using Redis adapter when Solid Cable is sufficient (unnecessary infrastructure)',
			'Not handling disconnections and reconnections on the client',
			'Broadcasting in the request cycle instead of from a background job',
		],
		whenToUse:
			'Live notifications, chat, real-time dashboards, collaborative editing. Replace polling whenever events are infrequent relative to poll interval.',
		furtherReading: [
			{
				title: 'Action Cable Overview',
				url: 'https://guides.rubyonrails.org/action_cable_overview.html',
			},
			{
				title: 'Solid Cable (Rails 8)',
				url: 'https://github.com/rails/solid_cable',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Create a NotificationsChannel with stream_for current_user. Use after_create_commit to broadcast. Solid Cable needs no Redis.',
	},
};

// ============================================
// Level 35: External APIs
// ============================================

const level35ExternalAPIs: Level = {
	id: 'act5-level38-external-apis',
	actId: 5,
	levelNumber: 38,
	name: 'External APIs',
	trigger: {
		type: 'incident',
		description:
			'Stripe payment API timed out. The checkout controller hung for 30 seconds, then crashed. Users saw 500 errors. The cascade took down 3 other services.',
	},
	startingPipeline: {
		nodes: [
			{ id: 'request-node', type: 'request', x: 80, y: 250, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 280,
				y: 250,
				locked: true,
			},
			{
				id: 'model-node',
				type: 'model',
				x: 500,
				y: 150,
				locked: true,
				config: { label: 'Order' },
			},
			{
				id: 'external-api',
				type: 'model',
				x: 500,
				y: 350,
				locked: true,
				config: { label: 'Stripe API' },
			},
			{ id: 'database-node', type: 'database', x: 720, y: 150, locked: true },
			{ id: 'response-node', type: 'response', x: 920, y: 250, locked: true },
		],
		connections: [
			{
				id: 'c1',
				sourceNodeId: 'request-node',
				targetNodeId: 'controller-node',
			},
			{ id: 'c2', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
			{
				id: 'c3',
				sourceNodeId: 'controller-node',
				targetNodeId: 'external-api',
			},
			{ id: 'c4', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
			{
				id: 'c5',
				sourceNodeId: 'database-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'Stripe API returned HTTP 503 for 5 minutes. During that time, every checkout request waited 30 seconds (default timeout), consumed a Puma thread, and timed out. All Puma threads were blocked. The entire application became unresponsive, not just checkout.',
		rootCause:
			'No timeout configured on HTTP client. No retry with backoff. No circuit breaker to stop calling a failing service. One failing dependency cascades into total application failure.',
		codeExample: `# BAD: No resilience at all
class CheckoutService
  def charge(order)
    # No timeout! Blocks thread for 30+ seconds
    response = HTTParty.post(
      'https://api.stripe.com/v1/charges',
      body: { amount: order.total_cents }
    )
    # No error handling
    # No retry
    # No circuit breaker
    # If Stripe is down, ALL of our app is down
    JSON.parse(response.body)
  end
end

# Result: Stripe 5-minute outage = our 5-minute outage
# 50 concurrent checkouts = 50 blocked Puma threads = full app down`,
		goal: 'Build a resilient Stripe integration with timeouts, retries with exponential backoff, and a circuit breaker that fails fast when Stripe is down.',
		thresholds: {},
	},
	successConditions: [{ type: 'api_resilience_configured' }],
	availableNodes: ['circuit_breaker'],
	unlockedNodes: ['circuit_breaker'],
	learningContent: {
		title: 'Resilient External API Integration',
		goal: `In this level, you'll:\n- learn how to call external APIs without letting their failures take down your app.\n- set timeouts on every HTTP call.\n- implement retries with exponential backoff for transient errors.\n- use the circuit breaker pattern to fail fast when an external service is unresponsive.`,
		conceptExplanation: `External APIs will fail. Your app must not fail with them.

**Three layers of resilience:**

1. **Timeouts** (always set these):
   - \`open_timeout\`: Max time to establish connection (2-5 seconds)
   - \`read_timeout\`: Max time to receive response (5-15 seconds)
   - Without timeouts, a hung API blocks your thread forever

2. **Retries with exponential backoff**:
   - Retry on 5xx errors and timeouts (NOT on 4xx)
   - Exponential backoff: 1s, 2s, 4s, 8s... (prevents thundering herd)
   - Add jitter (random delay) to spread retries
   - Max 3 retries, then give up

3. **Circuit breaker**:
   - Tracks failure count over a window
   - **Closed** (normal): Requests pass through
   - **Open** (broken): Fails immediately without calling the API
   - **Half-open** (testing): Allows one request to test recovery
   - Prevents cascading failures when a service is down`,
		railsCodeExample: `# Faraday with resilience middleware
class StripeClient
  TIMEOUT = 10       # seconds
  OPEN_TIMEOUT = 3   # seconds
  MAX_RETRIES = 3

  def initialize
    @connection = Faraday.new(url: 'https://api.stripe.com') do |f|
      f.request :authorization, 'Bearer', ENV['STRIPE_SECRET_KEY']
      f.request :json
      f.request :retry, {
        max: MAX_RETRIES,
        interval: 0.5,
        interval_randomness: 0.5,  # Jitter
        backoff_factor: 2,         # Exponential: 0.5s, 1s, 2s
        retry_statuses: [429, 500, 502, 503, 504],
        retry_if: ->(env, _exc) { env.method != :post }  # Don't retry POST!
      }
      f.response :json
      f.options.timeout = TIMEOUT
      f.options.open_timeout = OPEN_TIMEOUT
    end
  end

  def create_charge(amount_cents:, currency: 'usd', idempotency_key:)
    @connection.post('/v1/charges', {
      amount: amount_cents,
      currency: currency
    }) do |req|
      req.headers['Idempotency-Key'] = idempotency_key
    end
  rescue Faraday::TimeoutError => e
    Rails.logger.error("Stripe timeout: #{e.message}")
    raise PaymentTimeoutError
  rescue Faraday::ConnectionFailed => e
    Rails.logger.error("Stripe connection failed: #{e.message}")
    raise PaymentConnectionError
  end
end

# Circuit breaker with the stoplight gem
require 'stoplight'

class PaymentService
  def charge(order)
    Stoplight('stripe-charges')
      .with_threshold(5)           # Open after 5 failures
      .with_cool_off_time(30)      # Try again after 30s
      .with_error_handler do |error, handle|
        raise error if error.is_a?(Stripe::InvalidRequestError) # Don't trip on 4xx
        handle.call(error)
      end
      .run do
        stripe_client.create_charge(
          amount_cents: order.total_cents,
          idempotency_key: order.idempotency_key
        )
      end
  rescue Stoplight::Error::RedLight
    # Circuit is open - fail fast
    order.update!(status: 'payment_pending')
    PaymentRetryJob.perform_in(5.minutes, order.id)
    { status: 'pending', message: 'Payment queued for processing' }
  end
end

# Wrapper pattern for any external service
module Resilient
  def self.call(service_name, timeout: 10, retries: 3, &block)
    Timeout.timeout(timeout) do
      Stoplight(service_name)
        .with_threshold(5)
        .with_cool_off_time(60)
        .run(&block)
    end
  rescue Timeout::Error
    raise ServiceTimeoutError, "#{service_name} timed out"
  rescue Stoplight::Error::RedLight
    raise CircuitOpenError, "#{service_name} circuit is open"
  end
end

# Usage:
result = Resilient.call('stripe') do
  stripe_client.create_charge(amount: 1000)
end`,
		commonMistakes: [
			'No timeouts on HTTP clients (threads block indefinitely)',
			'Retrying POST requests without idempotency keys (double charges)',
			'No circuit breaker (one failing service takes down everything)',
			'Retrying on 4xx errors (client errors will never succeed)',
			'Not logging failures for observability and alerting',
		],
		whenToUse:
			'Every single external API call. No exceptions. If it crosses a network boundary, it needs timeouts and error handling.',
		furtherReading: [
			{
				title: 'Circuit Breaker Pattern',
				url: 'https://martinfowler.com/bliki/CircuitBreaker.html',
			},
			{
				title: 'Faraday HTTP Client',
				url: 'https://lostisland.github.io/faraday/',
			},
			{
				title: 'Stoplight Gem (Circuit Breaker)',
				url: 'https://github.com/bolshakov/stoplight',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Set timeouts on the HTTP client, add retries with exponential backoff for 5xx only, and wrap the call in a circuit breaker that fails fast.',
	},
};

// ============================================
// Level 36: Webhooks & Idempotency
// ============================================

const level36Webhooks: Level = {
	id: 'act5-level39-webhooks',
	actId: 5,
	levelNumber: 39,
	name: 'Webhooks & Idempotency',
	trigger: {
		type: 'incident',
		description:
			'Stripe webhook fires twice for the same payment.succeeded event. User is charged once but credited twice in the system. Support tickets flooding in.',
	},
	startingPipeline: {
		nodes: [
			{
				id: 'webhook-request',
				type: 'request',
				x: 80,
				y: 250,
				locked: true,
				config: { label: 'Stripe Webhook' },
			},
			{
				id: 'controller-node',
				type: 'controller',
				x: 300,
				y: 250,
				locked: true,
			},
			{
				id: 'payment-model',
				type: 'model',
				x: 500,
				y: 150,
				locked: true,
				config: { label: 'Payment' },
			},
			{
				id: 'credit-model',
				type: 'model',
				x: 500,
				y: 350,
				locked: true,
				config: { label: 'Credit' },
			},
			{ id: 'database-node', type: 'database', x: 700, y: 250, locked: true },
			{ id: 'response-node', type: 'response', x: 860, y: 250, locked: true },
		],
		connections: [
			{
				id: 'c1',
				sourceNodeId: 'webhook-request',
				targetNodeId: 'controller-node',
			},
			{
				id: 'c2',
				sourceNodeId: 'controller-node',
				targetNodeId: 'payment-model',
			},
			{
				id: 'c3',
				sourceNodeId: 'controller-node',
				targetNodeId: 'credit-model',
			},
			{
				id: 'c4',
				sourceNodeId: 'payment-model',
				targetNodeId: 'database-node',
			},
			{ id: 'c5', sourceNodeId: 'credit-model', targetNodeId: 'database-node' },
			{
				id: 'c6',
				sourceNodeId: 'database-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'Stripe sends payment.succeeded webhook. System credits user account $50. Network hiccup causes Stripe to retry the same webhook. System credits another $50. User now has $100 credit instead of $50.',
		rootCause:
			'Webhook handler is not idempotent. No signature verification (anyone could spoof webhooks). No deduplication of already-processed events. Processing happens synchronously, risking timeout.',
		codeExample: `# BAD: Not idempotent, not secure
class WebhooksController < ApplicationController
  def stripe
    event = JSON.parse(request.body.read)
    # No signature verification! Anyone can POST fake events!

    case event['type']
    when 'payment_intent.succeeded'
      payment = Payment.find_by(stripe_id: event['data']['object']['id'])
      payment.mark_completed!
      payment.user.credits.create!(amount: payment.amount)
      # Duplicate webhook = duplicate credit!
    end

    head :ok
  end
end

# Stripe retries webhooks up to 7 times over 72 hours
# Network issues, slow responses, and bugs all cause retries
# Your handler MUST handle duplicates gracefully`,
		goal: 'Build a secure, idempotent webhook handler: verify signatures, deduplicate events, and process asynchronously.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'webhooks_configured' },
		{ type: 'idempotency_configured' },
	],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Webhook Security & Idempotency',
		goal: `In this level, you'll:\n- learn how to receive and process webhooks from external services like Stripe and GitHub securely.\n- verify HMAC-SHA256 signatures to prevent spoofing.\n- deduplicate events using stored event IDs for idempotency.\n- process payloads in background jobs so you can return 200 immediately.`,
		conceptExplanation: `Webhooks are incoming HTTP callbacks from external services. They are unreliable by nature.

**Three pillars of webhook handling:**

1. **Signature verification:**
   - Stripe signs every webhook with HMAC-SHA256
   - Verify the signature before processing
   - Reject unsigned/spoofed requests immediately

2. **Idempotency (deduplicate events):**
   - Store processed event IDs in a database table
   - Check before processing: if already seen, return 200 and skip
   - Use unique constraints to handle race conditions

3. **Asynchronous processing:**
   - Return 200 OK immediately (Stripe times out at 20 seconds)
   - Process the event in a background job
   - If processing fails, the job retries (not the webhook)

**Idempotency key pattern:**
- Every Stripe event has a unique \`event.id\`
- Store it in a \`webhook_events\` table with a unique index
- INSERT fails on duplicate = already processed = skip`,
		railsCodeExample: `# Migration: webhook events table
class CreateWebhookEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :webhook_events do |t|
      t.string :provider, null: false          # "stripe", "github"
      t.string :event_id, null: false          # Unique event ID from provider
      t.string :event_type, null: false        # "payment_intent.succeeded"
      t.jsonb :payload                         # Raw event data
      t.string :status, default: 'pending'     # pending, processing, completed, failed
      t.datetime :processed_at
      t.timestamps
    end

    add_index :webhook_events, [:provider, :event_id], unique: true
  end
end

# app/controllers/webhooks/stripe_controller.rb
module Webhooks
  class StripeController < ApplicationController
    # Skip CSRF - Stripe can't send CSRF tokens
    skip_before_action :verify_authenticity_token

    def create
      # Step 1: Verify signature
      payload = request.body.read
      sig_header = request.headers['Stripe-Signature']

      begin
        event = Stripe::Webhook.construct_event(
          payload, sig_header, ENV['STRIPE_WEBHOOK_SECRET']
        )
      rescue JSON::ParserError
        return head :bad_request
      rescue Stripe::SignatureVerificationError
        return head :unauthorized
      end

      # Step 2: Idempotency check - deduplicate
      webhook_event = WebhookEvent.create_with(
        event_type: event.type,
        payload: event.data.to_h,
        status: 'pending'
      ).find_or_create_by!(
        provider: 'stripe',
        event_id: event.id
      )

      # Already processed? Return 200 (tell Stripe to stop retrying)
      if webhook_event.status == 'completed'
        return head :ok
      end

      # Step 3: Process asynchronously - return 200 FAST
      ProcessStripeWebhookJob.perform_later(webhook_event.id)

      head :ok
    end
  end
end

# app/jobs/process_stripe_webhook_job.rb
class ProcessStripeWebhookJob < ApplicationJob
  queue_as :webhooks
  retry_on StandardError, wait: :polynomially_longer, attempts: 5

  def perform(webhook_event_id)
    webhook_event = WebhookEvent.find(webhook_event_id)

    # Double-check idempotency (job could be retried)
    return if webhook_event.completed?

    webhook_event.update!(status: 'processing')

    case webhook_event.event_type
    when 'payment_intent.succeeded'
      handle_payment_succeeded(webhook_event)
    when 'payment_intent.payment_failed'
      handle_payment_failed(webhook_event)
    when 'customer.subscription.deleted'
      handle_subscription_cancelled(webhook_event)
    end

    webhook_event.update!(status: 'completed', processed_at: Time.current)
  rescue => e
    webhook_event.update!(status: 'failed')
    raise  # Re-raise so the job retries
  end

  private

  def handle_payment_succeeded(webhook_event)
    stripe_payment_id = webhook_event.payload.dig('object', 'id')
    amount = webhook_event.payload.dig('object', 'amount')

    ActiveRecord::Base.transaction do
      payment = Payment.lock.find_by!(stripe_id: stripe_payment_id)

      # Idempotent: Only credit if not already completed
      return if payment.completed?

      payment.update!(status: 'completed')
      payment.user.credits.create!(
        amount: amount,
        source: 'payment',
        idempotency_key: "payment-#{payment.id}"
      )
    end
  end
end

# config/routes.rb
namespace :webhooks do
  post 'stripe', to: 'stripe#create'
end`,
		commonMistakes: [
			'Not verifying webhook signatures (anyone can spoof events)',
			'Processing webhooks synchronously (risks timeout, Stripe retries)',
			'No idempotency check (duplicate events = duplicate side effects)',
			'Using the event payload for amount/status instead of re-fetching from Stripe API',
			'Not handling race conditions between webhook and polling (both try to complete payment)',
		],
		whenToUse:
			'Every webhook integration. Stripe, GitHub, Twilio, SendGrid all retry. Your handler MUST be idempotent.',
		furtherReading: [
			{
				title: 'Stripe Webhooks Best Practices',
				url: 'https://stripe.com/docs/webhooks/best-practices',
			},
			{
				title: 'Stripe Webhook Signatures',
				url: 'https://stripe.com/docs/webhooks/signatures',
			},
			{
				title: 'Idempotent Requests (Stripe)',
				url: 'https://stripe.com/docs/api/idempotent_requests',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Verify the Stripe signature first, then check if the event_id already exists in webhook_events. If new, enqueue a background job and return 200 immediately.',
	},
};

// ============================================
// Level 37: API Versioning
// ============================================

const level37APIVersioning: Level = {
	id: 'act5-level40-api-versioning',
	actId: 5,
	levelNumber: 40,
	name: 'API Versioning',
	trigger: {
		type: 'new_feature',
		description:
			'Partners integrated with v1 of your API six months ago. Product wants breaking changes for v2, but you cannot break existing clients.',
	},
	startingPipeline: {
		nodes: [
			{
				id: 'request-v1',
				type: 'request',
				x: 80,
				y: 150,
				locked: true,
				config: { label: 'v1 Client' },
			},
			{
				id: 'request-v2',
				type: 'request',
				x: 80,
				y: 350,
				locked: true,
				config: { label: 'v2 Client' },
			},
			{ id: 'router-node', type: 'router', x: 260, y: 250, locked: true },
			{
				id: 'controller-node',
				type: 'controller',
				x: 440,
				y: 250,
				locked: true,
			},
			{
				id: 'model-node',
				type: 'model',
				x: 620,
				y: 250,
				locked: true,
				config: { label: 'Order' },
			},
			{ id: 'database-node', type: 'database', x: 800, y: 250, locked: true },
			{ id: 'response-node', type: 'response', x: 620, y: 400, locked: true },
		],
		connections: [
			{ id: 'c1', sourceNodeId: 'request-v1', targetNodeId: 'router-node' },
			{ id: 'c2', sourceNodeId: 'request-v2', targetNodeId: 'router-node' },
			{
				id: 'c3',
				sourceNodeId: 'router-node',
				targetNodeId: 'controller-node',
			},
			{ id: 'c4', sourceNodeId: 'controller-node', targetNodeId: 'model-node' },
			{ id: 'c5', sourceNodeId: 'model-node', targetNodeId: 'database-node' },
			{
				id: 'c6',
				sourceNodeId: 'database-node',
				targetNodeId: 'response-node',
			},
		],
	},
	problem: {
		observation:
			'v1 API returns `{ "total": 1999 }` (cents). Product wants v2 to return `{ "total": { "amount": "19.99", "currency": "USD" } }` (object). 200 partners use v1. Changing the shape breaks their integrations.',
		rootCause:
			'No API versioning strategy. A single controller serves all clients. Any change to the response shape is a breaking change for everyone.',
		codeExample: `# Current: One controller, one version
# app/controllers/api/orders_controller.rb
class Api::OrdersController < ApplicationController
  def show
    order = Order.find(params[:id])
    render json: {
      id: order.id,
      total: order.total_cents  # Cents as integer
    }
  end
end

# Partner A expects: { "total": 1999 }
# Product wants:     { "total": { "amount": "19.99", "currency": "USD" } }
# Changing this breaks Partner A!

# We need BOTH responses to coexist:
# GET /api/v1/orders/1 => { "total": 1999 }
# GET /api/v2/orders/1 => { "total": { "amount": "19.99", "currency": "USD" } }`,
		goal: 'Implement API versioning with namespaced routes and controllers so v1 and v2 coexist. Add deprecation headers to v1 responses.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'node_present', nodeType: 'router' },
		{ type: 'node_present', nodeType: 'controller' },
		{ type: 'connection', sourceType: 'router', targetType: 'controller' },
	],
	availableNodes: ['controller', 'serializer'],
	unlockedNodes: [],
	learningContent: {
		title: 'API Versioning & Deprecation',
		goal: `In this level, you'll:\n- learn how to evolve your API without breaking existing clients.\n- namespace controllers under Api::V1:: and Api::V2:: to run multiple versions side by side.\n- route requests to the correct version.\n- use Sunset headers to announce deprecation dates so clients have time to migrate.`,
		conceptExplanation: `API versioning lets you evolve your API without breaking existing clients.

**Three versioning strategies:**

1. **URL path versioning** (recommended for Rails):
   - \`/api/v1/orders\` and \`/api/v2/orders\`
   - Explicit, easy to understand, easy to route
   - Each version gets its own controllers and serializers

2. **Header versioning:**
   - \`Accept: application/vnd.myapp.v2+json\`
   - Cleaner URLs but harder to test and debug
   - Requires custom content negotiation middleware

3. **Query parameter versioning:**
   - \`/api/orders?version=2\`
   - Simple but pollutes query string
   - Easy to forget or misconfigure

**Deprecation strategy:**
- Announce deprecation date in response headers
- Add \`Sunset\` header with retirement date
- Log v1 usage to track migration progress
- Give partners 6-12 months to migrate`,
		railsCodeExample: `# config/routes.rb
Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :orders, only: [:index, :show, :create]
    end

    namespace :v2 do
      resources :orders, only: [:index, :show, :create]
    end
  end
end

# Shared base controller
# app/controllers/api/base_controller.rb
class Api::BaseController < ApplicationController
  before_action :set_default_format

  private

  def set_default_format
    request.format = :json unless params[:format]
  end
end

# V1 controller (frozen - no changes)
# app/controllers/api/v1/orders_controller.rb
module Api
  module V1
    class OrdersController < Api::BaseController
      before_action :add_deprecation_headers

      def show
        order = Order.find(params[:id])
        render json: Api::V1::OrderSerializer.new(order).serializable_hash.to_json
      end

      private

      def add_deprecation_headers
        response.headers['Deprecation'] = 'true'
        response.headers['Sunset'] = 'Sat, 01 Jun 2026 00:00:00 GMT'
        response.headers['Link'] = '<https://api.example.com/api/v2/docs>; rel="successor-version"'
      end
    end
  end
end

# V2 controller (new features)
# app/controllers/api/v2/orders_controller.rb
module Api
  module V2
    class OrdersController < Api::BaseController
      def show
        order = Order.find(params[:id])
        render json: Api::V2::OrderSerializer.new(order).serializable_hash.to_json
      end
    end
  end
end

# V1 serializer (frozen output shape)
# app/serializers/api/v1/order_serializer.rb
module Api
  module V1
    class OrderSerializer < BaseSerializer
      attribute :total do |order|
        order.total_cents  # Integer cents
      end
      attribute :status
      attribute :created_at
    end
  end
end

# V2 serializer (new output shape)
# app/serializers/api/v2/order_serializer.rb
module Api
  module V2
    class OrderSerializer < BaseSerializer
      attribute :total do |order|
        {
          amount: (order.total_cents / 100.0).to_s,
          currency: order.currency
        }
      end
      attribute :status
      attribute :created_at

      attribute :line_items do |order|
        order.line_items.map do |li|
          { product_id: li.product_id, quantity: li.quantity }
        end
      end
    end
  end
end

# Shared model logic stays in one place
# app/models/order.rb
class Order < ApplicationRecord
  has_many :line_items
  belongs_to :user
  # Both v1 and v2 controllers use the same model
end

# Track v1 usage for migration planning
class Api::V1::BaseController < Api::BaseController
  after_action :track_v1_usage

  private

  def track_v1_usage
    Rails.logger.info(
      "[API_V1_USAGE] path=#{request.path} " \\
      "client=#{request.headers['X-Client-Id']} " \\
      "ip=#{request.remote_ip}"
    )
  end
end`,
		commonMistakes: [
			'Modifying v1 controllers after v2 ships (breaks existing integrations)',
			'Not adding deprecation/sunset headers to old versions',
			'Sharing serializers between versions (changes leak across versions)',
			'Not tracking v1 usage to know when it is safe to retire',
			'Too many live versions (maintain at most 2: current and previous)',
		],
		whenToUse:
			'Whenever you need breaking changes to response shapes, authentication, or request formats. Version from day one for any public API.',
		furtherReading: [
			{
				title: 'Rails API Versioning',
				url: 'https://guides.rubyonrails.org/api_app.html',
			},
			{
				title: 'Sunset Header RFC',
				url: 'https://datatracker.ietf.org/doc/html/rfc8594',
			},
			{
				title: 'API Versioning Best Practices',
				url: 'https://www.mnot.net/blog/2012/12/04/api-evolution',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Namespace routes under /api/v1 and /api/v2 with separate controllers and serializers. Add Deprecation and Sunset headers to v1.',
	},
};

// ============================================
// Act 5 Definition
// ============================================

export const actFive: Act = {
	id: 5,
	name: 'Production Features',
	tagline: 'Real users, real money, real failures.',
	description:
		'Build production-grade features for a SaaS API with payments: polymorphic associations, transactions & locking, file uploads, encrypted attributes, real-time notifications, resilient API integrations, idempotent webhooks, and API versioning.',
	levels: [
		level30Polymorphic,
		level31Transactions,
		level32ActiveStorage,
		level33Encryption,
		level34Realtime,
		level35ExternalAPIs,
		level36Webhooks,
		level37APIVersioning,
	],
	unlockedNodes: ['circuit_breaker', 's3'],
	metricsVisible: true,
};
