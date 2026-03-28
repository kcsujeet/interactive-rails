/**
 * Act 5: Production Features
 * "Real users, real money, real failures."
 *
 * Levels 32-40: Polymorphic Associations, Transactions & Locking, Locking, Active Storage,
 * Encrypted Attributes, Real-Time, External APIs, Webhooks & Idempotency, API Versioning
 * App context: SaaS API with payments
 */

import type { Act, Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

// ============================================
// Level 32: Polymorphic Associations
// ============================================

const level32Polymorphic: Level = {
	id: 'act5-level32-polymorphic',
	actId: 5,
	levelNumber: 32,
	name: 'Polymorphic Associations',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			'Users want to review Products, ProductImages, AND ProductVideos. Three separate review tables with identical schemas exist. Polymorphic associations can unify them.',
	},
	startingPipeline: standardPipeline(),
	problem: {
		observation:
			'Three separate review tables exist: post_reviews, photo_reviews, video_reviews. Schema is duplicated, queries are scattered, and adding a new reviewable type means a new table and new controller.',
		rootCause:
			'Each reviewable model has its own dedicated reviews table instead of using a single polymorphic reviews table.',
		codeExample: `# Three separate service objects doing the same thing!
# app/services/create_post_review.rb
class CreatePostReview < ApplicationService
  Result = Data.define(:success?, :review, :errors)

  def initialize(post:, user:, params:)
    @post = post; @user = user; @params = params
  end

  def call
    v = PostReviewContract.new.call(@params)
    return Result.new(success?: false,
      review: nil, errors: v.errors.to_h) if v.failure?
    review = @product.product_reviews.create!(
      user: @user, body: v[:body])
    Result.new(success?: true, review:, errors: [])
  end
end

# CreatePhotoReview, CreateVideoReview are identical copies!
# 3 tables, 3 models, 3 contracts, 3 services, 3 controllers
# Adding "review on Articles" means ANOTHER full set.`,
		goal: 'Replace three review tables with one polymorphic Review model that can belong to any reviewable resource. Build a single CreateReview service with contract validation.',
		thresholds: {},
	},
	successConditions: [],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Polymorphic Associations',
		goal: `In this level, you'll:\n- learn how polymorphic associations let a single model belong to multiple different parent types.\n- use reviewable_type and reviewable_id columns so one Review model can belong to a Product, ProductImage, or ProductVideo.\n- understand when this pattern is the right choice versus separate tables.`,
		conceptExplanation: `Polymorphic associations let a model belong to more than one other model using a single association.

**How it works:**
- The child table stores two columns: \`reviewable_type\` (string) and \`reviewable_id\` (integer)
- \`reviewable_type\` holds the class name ("Product", "Photo", "Video")
- \`reviewable_id\` holds the foreign key
- Rails resolves the correct parent model at runtime

**When to use polymorphic:**
- Reviews on multiple types (Posts, Photos, Videos)
- Taggings across models
- Attachments on different record types
- Activity logs referencing various models

**When NOT to use polymorphic:**
- When types need different columns (use STI or separate tables)
- When you need database-level foreign key constraints
- When the number of types is fixed at 2 (just use two belongs_to)`,
		railsCodeExample: `# Migration
class CreateReviews < ActiveRecord::Migration[8.0]
  def change
    create_table :reviews do |t|
      t.text :body, null: false
      t.references :reviewable, polymorphic: true, null: false
      t.references :user, null: false, foreign_key: true
      t.timestamps
    end
    add_index :reviews, [:reviewable_type, :reviewable_id]
  end
end

# app/models/review.rb
class Review < ApplicationRecord
  belongs_to :reviewable, polymorphic: true
  belongs_to :user
  validates :body, presence: true, length: { maximum: 10_000 }
end

# app/models/post.rb (same for Photo, Video)
class Product < ApplicationRecord
  has_many :reviews, as: :reviewable, dependent: :destroy
end

# app/contracts/review_contract.rb
class ReviewContract < Dry::Validation::Contract
  params do
    required(:body).filled(:string, max_size?: 10_000)
  end
end

# app/services/create_review.rb
class CreateReview < ApplicationService
  Result = Data.define(:success?, :review, :errors)

  def initialize(reviewable:, user:, params:)
    @reviewable = reviewable
    @user = user
    @params = params
  end

  def call
    v = ReviewContract.new.call(@params)
    return Result.new(success?: false,
      review: nil, errors: v.errors.to_h) if v.failure?
    review = @reviewable.reviews.create!(
      user: @user, body: v[:body])
    Result.new(success?: true, review:, errors: [])
  end
end

# app/controllers/api/v1/reviews_controller.rb
class Api::V1::ReviewsController < ApplicationController
  def create
    result = CreateReview.call(
      reviewable: find_reviewable,
      user: Current.user,
      params: params.expect(review: [:body]))
    if result.success?
      render json: ReviewSerializer.new(result.review),
        status: :created
    else
      render json: { error: { code: "VALIDATION_FAILED",
        message: "Invalid review",
        details: result.errors } }, status: :unprocessable_entity
    end
  end
end`,
		commonMistakes: [
			'Not adding a composite index on [reviewable_type, reviewable_id]',
			'Forgetting that database-level foreign keys cannot enforce polymorphic associations',
			'Not using eager loading with polymorphic associations (causes N+1)',
			'Storing full namespaced class names when STI is involved',
			'Not validating that reviewable_type is in an allowed list',
		],
		whenToUse:
			'When the same child model (reviews, tags, attachments) needs to belong to multiple unrelated parent models with identical schemas.',
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
		text: 'Add a single Review model with polymorphic: true. Connect it to Product, ProductImage, and ProductVideo using `as: :reviewable`.',
	},
};

// ============================================
// Level 33: Transactions (Atomicity)
// ============================================

const level33Transactions: Level = {
	id: 'act5-level33-transactions',
	actId: 5,
	levelNumber: 33,
	name: 'Transactions',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'A user spends 10 credits to boost a post, but the boost record never gets created. The credits are gone with no record of what happened.',
	},
	startingPipeline: standardPipeline(),
	problem: {
		observation:
			'The boost pipeline deducts user credits, creates a boost record, and writes a credit log. When step 2 or 3 fails, the credits are already deducted and cannot be restored.',
		rootCause:
			'Each database write commits independently. Without a transaction boundary, a failure midway leaves partial writes that corrupt data integrity.',
		codeExample: `# BAD: Each operation commits independently
class BoostPost < ApplicationService
  Result = Data.define(:success?, :boost, :errors)

  def initialize(user_id:, post_id:, cost:)
    @user_id = user_id
    @post_id = post_id
    @cost = cost
  end

  def call
    v = BoostContract.new.call(
      user_id: @user_id,
      post_id: @post_id, cost: @cost)
    return Result.new(success?: false,
      boost: nil, errors: v.errors.to_h) if v.failure?

    user = User.find(@user_id)
    user.credits -= @cost
    user.save!
    # Step 1 committed. If step 2 fails...
    boost = Boost.create!(user:, post_id: @post_id,
      reach: 5000)
    # Step 2 committed. If step 3 fails...
    CreditLog.create!(user:, amount: -@cost,
      reason: "boost_post_#{@post_id}")
    Result.new(success?: true, boost:, errors: [])
  end
end`,
		goal: 'Identify the atomicity problem, wrap operations in a transaction, handle custom abort with raise ActiveRecord::Rollback, and build a BoostPost service with contract validation.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'node_present', nodeType: 'model' },
		{ type: 'connection', sourceType: 'controller', targetType: 'model' },
	],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Transactions (Atomicity)',
		goal: `In this level, you'll:\n- understand why multi-step writes need atomicity guarantees\n- wrap related database writes in ActiveRecord::Base.transaction\n- use raise ActiveRecord::Rollback for business-rule aborts\n- build a service object that ensures all-or-nothing semantics`,
		conceptExplanation: `Transactions ensure a group of database operations either ALL succeed or ALL fail (rollback). Without transactions, a failure midway through a multi-step write leaves data in an inconsistent state.

**The problem:**
\`\`\`ruby
user.save!              # Step 1: committed
Boost.create!(...)      # Step 2: might fail
CreditLog.create!(...)  # Step 3: might fail
# If step 2 fails, step 1 is already persisted!
\`\`\`

**The solution:**
\`\`\`ruby
ActiveRecord::Base.transaction do
  user.save!
  Boost.create!(...)
  CreditLog.create!(...)
end
# If ANY step raises, ALL are rolled back
\`\`\`

**Custom aborts:**
- \`raise ActiveRecord::Rollback\` silently aborts the transaction
- Unlike other exceptions, it does not propagate outside the block
- Use it for business rule failures (e.g., insufficient credits)

**Key rules:**
- Always wrap related writes in a transaction
- Any exception inside the block triggers rollback
- The transaction returns nil when rolled back via Rollback`,
		railsCodeExample: `# app/contracts/boost_contract.rb
class BoostContract < Dry::Validation::Contract
  params do
    required(:user_id).filled(:integer)
    required(:post_id).filled(:integer)
    required(:cost).filled(:integer, gt?: 0)
  end
end

# app/services/boost_post.rb
class BoostPost < ApplicationService
  Result = Data.define(:success?, :boost, :errors)

  def initialize(user_id:, post_id:, cost:)
    @user_id = user_id
    @post_id = post_id
    @cost = cost
  end

  def call
    v = BoostContract.new.call(
      user_id: @user_id,
      post_id: @post_id, cost: @cost)
    return Result.new(success?: false,
      boost: nil, errors: v.errors.to_h) if v.failure?

    ActiveRecord::Base.transaction do
      user = User.find(@user_id)
      raise ActiveRecord::Rollback if user.credits < @cost
      user.credits -= @cost
      user.save!
      boost = Boost.create!(user:, post_id: @post_id,
        reach: 5000)
      CreditLog.create!(user:, amount: -@cost,
        reason: "boost_post_#{@post_id}")
      Result.new(success?: true, boost:, errors: [])
    end || Result.new(success?: false, boost: nil,
      errors: ["Insufficient credits"])
  end
end`,
		commonMistakes: [
			'Not wrapping related writes in a transaction (partial failures corrupt data)',
			'Using begin/rescue/reload instead of a real transaction for rollback',
			'Returning false inside a transaction and expecting rollback (only raise works)',
			'Nesting transactions without understanding savepoints',
		],
		whenToUse:
			'Any time multiple database writes must succeed or fail together: deduct credits + create record, transfer between accounts, multi-table updates.',
		furtherReading: [
			{
				title: 'Active Record Transactions',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Transactions/ClassMethods.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'What guarantees that all three steps succeed or fail together? Think about database-level atomicity.',
	},
};

// ============================================
// Level 34: Locking (Concurrency Control)
// ============================================

const level34Locking: Level = {
	id: 'act5-level34-locking',
	actId: 5,
	levelNumber: 34,
	name: 'Locking',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'Two customers check out the same product simultaneously. Both see "15 in stock." Customer A buys 10, Customer B buys 8. Final stock is 7, not the expected result. 18 units sold, only 8 deducted.',
	},
	startingPipeline: standardPipeline(),
	problem: {
		observation:
			'Customer A reads stock (15), Customer B reads stock (15). A buys 10, saves 5. B buys 8, saves 7, overwriting A. 18 units sold, only 8 deducted. Lost update.',
		rootCause:
			'No row-level locking. Concurrent reads followed by concurrent writes cause lost updates because each request operates on stale data.',
		codeExample: `# BAD: No locking in the service
class PlaceOrder < ApplicationService
  Result = Data.define(:success?, :order, :errors)

  def initialize(product_id:, quantity:)
    @product_id = product_id
    @quantity = quantity
  end

  def call
    v = OrderContract.new.call(
      product_id: @product_id, quantity: @quantity)
    return Result.new(success?: false,
      order: nil, errors: v.errors.to_h) if v.failure?

    product = Product.find(@product_id)
    # Request A reads 15, Request B reads 15 (stale!)
    product.stock_count -= @quantity
    product.save!
    # Request A saves 5, Request B saves 5 (overwrites!)
    Result.new(success?: true, order: nil, errors: [])
  end
end`,
		goal: 'Add a lock_version column, run the migration, add pessimistic locking with Product.lock.find(id), build a PlaceOrder service with contract, and handle StaleObjectError for optimistic locking.',
		thresholds: {},
	},
	successConditions: [
		{ type: 'node_present', nodeType: 'model' },
		{ type: 'connection', sourceType: 'controller', targetType: 'model' },
	],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Locking (Concurrency Control)',
		goal: `In this level, you'll:\n- understand how concurrent access causes lost updates\n- add a lock_version column for optimistic locking\n- use Product.lock.find(id) for pessimistic locking (SELECT ... FOR UPDATE)\n- handle StaleObjectError for conflict detection on low-contention resources`,
		conceptExplanation: `Locking prevents concurrent access from corrupting shared data. Two strategies exist:

**Optimistic Locking (lock_version column):**
- No database locks held during read
- On save, Rails checks if \`lock_version\` has changed since the record was loaded
- If changed, raises \`ActiveRecord::StaleObjectError\`
- Best for low-contention resources (product edits, CMS pages)

**Pessimistic Locking (SELECT ... FOR UPDATE):**
- Acquires a database row lock when reading
- Other transactions must wait until the lock is released (on COMMIT/ROLLBACK)
- Best for high-contention resources (inventory counts, order totals)

**Rule of thumb:**
- Low contention + user-facing: Optimistic (detect conflict, ask user to retry)
- High contention + financial: Pessimistic (serialize access, no lost updates)

**Key API:**
\`\`\`ruby
# Pessimistic
Product.lock.find(id)     # SELECT ... FOR UPDATE
product.with_lock { ... } # lock + block

# Optimistic (needs lock_version column)
product.save! # raises StaleObjectError if version mismatch
\`\`\``,
		railsCodeExample: `# app/contracts/order_contract.rb
class OrderContract < Dry::Validation::Contract
  params do
    required(:product_id).filled(:integer)
    required(:quantity).filled(:integer, gt?: 0)
  end
end

# app/services/place_order.rb
class PlaceOrder < ApplicationService
  Result = Data.define(:success?, :order, :errors)

  def initialize(product_id:, quantity:)
    @product_id = product_id
    @quantity = quantity
  end

  def call
    v = OrderContract.new.call(
      product_id: @product_id, quantity: @quantity)
    return Result.new(success?: false,
      order: nil, errors: v.errors.to_h) if v.failure?

    ActiveRecord::Base.transaction do
      product = Product.lock.find(@product_id)
      raise InsufficientStockError if product.stock_count < @quantity
      product.stock_count -= @quantity
      product.save!
      order = Order.create!(product:, quantity: @quantity,
        user: Current.user)
      Result.new(success?: true, order:, errors: [])
    end
  rescue InsufficientStockError
    Result.new(success?: false, order: nil,
      errors: ["Insufficient stock"])
  end
end

# app/controllers/api/v1/orders_controller.rb
class Api::V1::OrdersController < ApplicationController
  def create
    result = PlaceOrder.call(
      product_id: params.expect(order: [:product_id])[:product_id],
      quantity: params.expect(order: [:quantity])[:quantity])
    if result.success?
      render json: OrderSerializer.new(result.order),
        status: :created
    else
      render json: { error: { code: "ORDER_FAILED",
        message: "Could not place order",
        details: result.errors } },
        status: :unprocessable_entity
    end
  rescue ActiveRecord::StaleObjectError
    render json: { error: { code: "CONFLICT",
      message: "Product was modified by another request",
      details: {} } }, status: :conflict
  end
end`,
		commonMistakes: [
			'Using optimistic locking for inventory operations (too many retries under load)',
			'Holding pessimistic locks too long (causes deadlocks and timeouts)',
			'Forgetting to handle StaleObjectError when using optimistic locking',
			'Using pessimistic locks for low-contention product edits (overkill)',
		],
		whenToUse:
			'Pessimistic locking for inventory and financial data. Optimistic locking for product details and content edits.',
		furtherReading: [
			{
				title: 'Active Record Locking',
				url: 'https://api.rubyonrails.org/classes/ActiveRecord/Locking.html',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Think about what happens when two checkout requests read the same product row. What mechanism can serialize their writes?',
	},
};

// ============================================
// Level 35: Active Storage
// ============================================

const level35ActiveStorage: Level = {
	id: 'act5-level35-active-storage',
	actId: 5,
	levelNumber: 35,
	name: 'Active Storage',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			'Users want profile photos. The product team wants image uploads with automatic thumbnail generation.',
	},
	startingPipeline: standardPipeline({ modelLabel: 'User' }),
	problem: {
		observation:
			'Users upload 5MB profile photos through the Rails server via the UploadAvatar service. Memory spikes on every upload. No thumbnails generated. Serving originals costs bandwidth.',
		rootCause:
			'Files are uploaded through the application server instead of directly to object storage. No variant processing for thumbnails or resized images.',
		codeExample: `# No Active Storage. Manual file handling.
class UploadAvatar < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(user_id:, file:)
    @user_id = user_id
    @file = file  # 5MB in memory!
  end

  def call
    user = User.find(@user_id)
    path = Rails.root.join(
      "storage/avatars/#{user.id}.jpg")
    File.binwrite(path, @file.read)  # 5MB buffered!
    # 10 concurrent uploads = 50MB memory spike
    user.update!(avatar_path: path.to_s)
    Result.new(success?: true, user:, errors: [])
  end
end

# No thumbnails, no variants, no CDN redirect
# Downloads also go through Rails: send_file user.avatar_path`,
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
		railsCodeExample: `# Setup: bin/rails active_storage:install && rails db:migrate

# config/storage.yml
amazon:
  service: S3
  access_key_id: <%= Rails.application.credentials
    .dig(:aws, :access_key_id) %>
  secret_access_key: <%= Rails.application.credentials
    .dig(:aws, :secret_access_key) %>
  region: us-east-1
  bucket: myapp-production

# app/models/user.rb
class User < ApplicationRecord
  has_one_attached :avatar do |attachable|
    attachable.variant :thumb, resize_to_limit: [100, 100]
    attachable.variant :medium, resize_to_limit: [300, 300]
  end
  has_many_attached :documents
end

# app/services/upload_avatar.rb
class UploadAvatar < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(user_id:, blob_signed_id:)
    @user_id = user_id
    @blob_signed_id = blob_signed_id
  end

  def call
    v = AvatarUploadContract.new.call(
      user_id: @user_id, blob_signed_id: @blob_signed_id)
    return Result.new(success?: false,
      user: nil, errors: v.errors.to_h) if v.failure?

    user = User.find(@user_id)
    blob = ActiveStorage::Blob.find_signed!(@blob_signed_id)
    validate_content_type!(blob)
    validate_file_size!(blob)

    user.avatar.attach(@blob_signed_id)
    Result.new(success?: true, user:, errors: [])
  end
end

# app/controllers/api/v1/direct_uploads_controller.rb
class Api::V1::DirectUploadsController < ApplicationController
  def create
    blob = ActiveStorage::Blob.create_before_direct_upload!(
      **blob_args)
    render json: {
      direct_upload: {
        url: blob.service_url_for_direct_upload,
        headers: blob.service_headers_for_direct_upload
      },
      blob_signed_id: blob.signed_id
    }
  end

  private

  def blob_args
    params.expect(file: [:filename, :byte_size,
                         :checksum, :content_type])
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
// Level 36: Encrypted Attributes
// ============================================

const level36Encryption: Level = {
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
// Level 37: Real-Time
// ============================================

const level37Realtime: Level = {
	id: 'act5-level37-realtime',
	actId: 5,
	levelNumber: 37,
	name: 'Real-Time',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			'Users want live notifications when their payments complete. The ProcessPayment service has no way to push updates. HTTP polling every 2 seconds is killing the server with 50,000 concurrent users.',
	},
	startingPipeline: {
		nodes: [],
		connections: [],
	},
	problem: {
		observation:
			'50,000 users polling every 2 seconds = 25,000 requests/second. 99% of polls return empty. Server CPU at 95%. The ProcessPayment service creates records but has no real-time push mechanism.',
		rootCause:
			'HTTP polling wastes resources when there are no new events. Need server-push via WebSockets to only send data when something actually changes.',
		codeExample: `# The ProcessPayment service completes payments,
# but has no way to notify users in real-time.
# Clients must poll GET /notifications every 2 seconds.
#
# 50K users x 0.5 req/sec = 25K wasted requests/sec
# 99% return empty arrays. CPU at 95%.
#
# app/services/process_payment.rb
class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)

  def call
    validation = PaymentContract.new.call(@params)
    return failure(validation) if validation.failure?

    payment = @user.payments.create!(amount: @params[:amount])
    # No way to tell the user their payment completed!
    # They find out on their next poll cycle (up to 2s delay)
    Result.new(success?: true, payment:, errors: {})
  end
end`,
		goal: 'Install Solid Cable, generate a notifications channel, authenticate WebSocket connections, and build a broadcast service using after_create_commit.',
		thresholds: {},
	},
	successConditions: [],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Real-Time with Action Cable & Solid Cable',
		goal: `In this level, you'll:\n- Replace HTTP polling with WebSocket push using Action Cable\n- Install Solid Cable (Rails 8 database-backed adapter, no Redis)\n- Authenticate WebSocket connections via encrypted cookies\n- Build a BroadcastNotification service with after_create_commit callbacks`,
		conceptExplanation: `Action Cable integrates WebSockets with Rails. Rails 8 uses Solid Cable as the default adapter, storing pub/sub messages in the database instead of Redis.

**Solid Cable (Rails 8 default):**
- Uses the database for pub/sub instead of Redis
- No additional infrastructure needed
- Handles most apps (< 100K concurrent connections)
- Automatic message pruning via configurable retention

**Action Cable concepts:**
- **Channel**: Like a controller for WebSockets (subscribe/unsubscribe/receive)
- **Stream**: A named broadcast target (e.g., "notifications:user_42")
- **Connection**: The WebSocket connection with authentication
- **Subscription**: Client subscribes to a channel to receive pushes`,
		railsCodeExample: `# config/cable.yml (Solid Cable, no Redis!)
production:
  adapter: solid_cable
  polling_interval: 0.1.seconds
  message_retention: 1.day

# app/channels/application_cable/connection.rb
module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    def find_verified_user
      verified = User.find_by(id: cookies.encrypted[:user_id])
      verified || reject_unauthorized_connection
    end
  end
end

# app/channels/notifications_channel.rb
class NotificationsChannel < ApplicationCable::Channel
  def subscribed
    stream_for current_user
  end
end

# app/services/broadcast_notification.rb
class BroadcastNotification < ApplicationService
  Result = Data.define(:success?, :notification, :errors)

  def initialize(user:, title:, body:)
    @user = user
    @title = title
    @body = body
  end

  def call
    validation = NotificationContract.new.call(
      title: @title, body: @body
    )
    if validation.failure?
      return Result.new(
        success?: false, notification: nil,
        errors: validation.errors.to_h
      )
    end

    notification = @user.notifications.create!(
      title: @title, body: @body
    )
    # after_create_commit on Notification broadcasts automatically
    Result.new(success?: true, notification:, errors: {})
  end
end

# app/models/notification.rb
class Notification < ApplicationRecord
  belongs_to :user
  validates :title, :body, presence: true

  after_create_commit :broadcast_to_user

  private

  def broadcast_to_user
    NotificationsChannel.broadcast_to(
      user,
      NotificationSerializer.new(self).serializable_hash
    )
  end
end`,
		commonMistakes: [
			'Not authenticating WebSocket connections (anyone can subscribe)',
			'Broadcasting too much data (send IDs, let client fetch details)',
			'Using Redis when Solid Cable is sufficient (unnecessary infrastructure)',
			'Broadcasting in the request cycle instead of via model callbacks',
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
		text: 'Install solid_cable, generate a NotificationsChannel, authenticate connections via encrypted cookies, then build a service that creates notifications with after_create_commit broadcasting.',
	},
};

// ============================================
// Level 38: External APIs
// ============================================

const level38ExternalAPIs: Level = {
	id: 'act5-level38-external-apis',
	actId: 5,
	levelNumber: 38,
	name: 'External APIs',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'Stripe API returned HTTP 503 for 5 minutes. The ProcessPayment service hung for 30 seconds per request, blocking all Puma threads. Entire app unresponsive.',
	},
	startingPipeline: {
		nodes: [],
		connections: [],
	},
	problem: {
		observation:
			'The ProcessPayment service calls Stripe with no timeout, no retry, and no circuit breaker. One failing dependency cascades into total application failure.',
		rootCause:
			'No timeout configured on HTTP client. No retry with backoff. No circuit breaker to stop calling a failing service.',
		codeExample: `# The ProcessPayment service calls Stripe with no resilience.
# No timeout: thread blocks for 30+ seconds
# No retry: transient 503 errors fail immediately
# No circuit breaker: keeps hammering a dead service
#
# app/services/process_payment.rb
class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)

  def call
    validation = PaymentContract.new.call(@params)
    return failure(validation) if validation.failure?

    # HTTParty with no timeout, no retry, no circuit breaker
    response = HTTParty.post(
      'https://api.stripe.com/v1/charges',
      body: { amount: @params[:amount] }
    )
    # If Stripe is down, ALL of our app is down
    payment = @user.payments.create!(stripe_id: response["id"])
    Result.new(success?: true, payment:, errors: {})
  end
end`,
		goal: 'Install Faraday and Stoplight, configure timeouts, retry with exponential backoff, and a circuit breaker that fails fast when Stripe is down.',
		thresholds: {},
	},
	successConditions: [],
	availableNodes: [],
	unlockedNodes: [],
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
// Level 39: Webhooks & Idempotency
// ============================================

const level39Webhooks: Level = {
	id: 'act5-level39-webhooks',
	actId: 5,
	levelNumber: 39,
	name: 'Webhooks & Idempotency',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'Stripe sends payment results to your app via webhook callbacks (HTTP POST to /webhooks/stripe). A network hiccup caused Stripe to retry the same event. The handler processed it twice, double-crediting the customer. Support tickets flooding in.',
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
			'When a payment succeeds, Stripe POSTs a payment.succeeded event to your webhook endpoint. The handler credits the user $50. A network hiccup causes Stripe to retry the same event. The handler credits another $50. User now has $100 instead of $50.',
		rootCause:
			'Webhook handler is not idempotent. No signature verification (anyone could spoof webhooks). No deduplication of already-processed events. Processing happens synchronously, risking timeout.',
		codeExample: `# app/controllers/webhooks_controller.rb
class WebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token

  def stripe
    result = HandleStripeWebhook.call(
      payload: request.body.read)
    head :ok
  end
end

# app/services/handle_stripe_webhook.rb
# BAD: Not idempotent, not secure
class HandleStripeWebhook < ApplicationService
  Result = Data.define(:success?, :resource, :errors)

  def initialize(payload:)
    @payload = payload
  end

  def call
    event = JSON.parse(@payload)
    # No signature verification! Anyone can spoof!

    case event['type']
    when 'payment_intent.succeeded'
      payment = Payment.find_by(
        stripe_id: event['data']['object']['id'])
      payment.mark_completed!
      payment.user.credits.create!(amount: payment.amount)
      # Duplicate webhook = duplicate credit!
    end

    Result.new(success?: true, resource: nil, errors: {})
  end
end

# Stripe retries webhooks up to 7 times over 72 hours
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
// Level 40: API Versioning
// ============================================

const level40APIVersioning: Level = {
	id: 'act5-level40-api-versioning',
	actId: 5,
	levelNumber: 40,
	name: 'API Versioning',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			'Product needs to change the order total from integer cents (1999) to a money object ({ amount: "19.99", currency: "USD" }). But 200 partners depend on the current /api/v1 format. Changing it breaks them all.',
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
			'The API returns `{ "total": 1999 }` (integer cents). Product wants to change it to `{ "total": { "amount": "19.99", "currency": "USD" } }` (structured object). 200 partners parse the current format. Deploying the new shape breaks all of them.',
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
	tagline: 'Time to ship what pays the bills.',
	description:
		'The API is fast and clean. Now build the features that make it a real product: polymorphic associations, transactions, locking, file uploads, encryption, real-time notifications, external API integrations, webhooks, and API versioning.',
	levels: [
		level32Polymorphic,
		level33Transactions,
		level34Locking,
		level35ActiveStorage,
		level36Encryption,
		level37Realtime,
		level38ExternalAPIs,
		level39Webhooks,
		level40APIVersioning,
	],
	unlockedNodes: ['circuit_breaker', 's3'],
	metricsVisible: true,
};
