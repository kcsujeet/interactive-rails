/**
 * Level 35: Active Storage
 *
 * Sequential phase flow: observe -> build -> activate -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Custom "Upload Pipeline" visualization.
 *   Three horizontal zones: Client -> App Server -> S3 Storage.
 *   Traditional flow: file data buffers through app server (memory spikes).
 *   ProbeTerminal fires upload scenarios; FlowConnectors animate data flow.
 *   Player discovers: memory spikes, no variants, downloads through Rails.
 *
 * Phase 2 (HOW - build): 6 steps (2 terminal + 4 OptionCard)
 *   Step 0: Install Active Storage (terminal)
 *   Step 1: Run migrations (terminal)
 *   Step 2: Configure S3 storage service (OptionCard)
 *   Step 3: Add model attachments with variants (OptionCard)
 *   Step 4: Build UploadAvatar service with contract (OptionCard)
 *   Step 5: Create direct upload endpoint (OptionCard)
 *
 * Phase 3 (ADVANTAGE - activate): Star rating + "Visualize Direct Upload" button
 * Phase 4 (ADVANTAGE - reward): Same pipeline, now showing direct upload path.
 *   Allowed: Files go directly to S3, variants generated lazily.
 *   Blocked: Invalid content type, oversized files caught by contract.
 *
 * Teaches: Active Storage, has_one_attached, direct upload, presigned URLs,
 *   image variants, content validation
 */

import {
	ArrowRight,
	Cloud,
	Monitor,
	Play,
	Server,
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
import { FlowConnector } from '@/components/levels/FlowConnector';
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
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'memory-spike', label: 'File buffers in app server RAM' },
	{ id: 'no-variants', label: 'No thumbnails, serving 5MB originals' },
	{ id: 'serving-through-rails', label: 'Downloads block Rails workers' },
	{
		id: 'no-direct-upload',
		label: 'No presigned URL, all traffic through app',
	},
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'upload-photo': ['memory-spike', 'no-direct-upload'],
	'request-avatar': ['serving-through-rails'],
	'list-avatars': ['no-variants'],
};

// ──────────────────────────────────────────────
// Probe definitions
// ──────────────────────────────────────────────

const PROBES: ProbeConfig[] = [
	{
		id: 'upload-photo',
		label: 'Upload 5MB profile photo',
		command: 'curl -X POST /api/v1/users/1/avatar -F "file=@photo.jpg"',
		responseLines: [
			{ text: 'Uploading 5MB through Rails process...', color: 'yellow' },
			{ text: 'Memory: 45MB -> 95MB (+50MB buffering file!)', color: 'red' },
			{ text: '10 concurrent uploads = 500MB memory spike', color: 'red' },
			{
				text: 'No presigned URL configured. File routes through app.',
				color: 'red',
			},
		],
	},
	{
		id: 'request-avatar',
		label: 'Download user avatar',
		command: 'curl GET /api/v1/users/1/avatar',
		responseLines: [
			{ text: 'send_data @user.avatar.download', color: 'yellow' },
			{
				text: 'Entire 5MB loaded into memory, streamed to client',
				color: 'red',
			},
			{
				text: 'Rails worker blocked for 3 seconds during download!',
				color: 'red',
			},
			{ text: 'No CDN or redirect_to service_url configured.', color: 'red' },
		],
	},
	{
		id: 'list-avatars',
		label: 'List users with avatars',
		command: 'curl GET /api/v1/users?per_page=25',
		responseLines: [
			{ text: 'Rendering 25 users with avatar URLs...', color: 'yellow' },
			{ text: 'Each avatar: full 5MB original, no variants!', color: 'red' },
			{ text: '25 users x 5MB = 125MB downloaded by client', color: 'red' },
			{
				text: 'No thumbnail variant defined. Wasting bandwidth.',
				color: 'red',
			},
		],
	},
];

// ──────────────────────────────────────────────
// Build step definitions
// ──────────────────────────────────────────────

const STEP_DEFS: StepDef[] = [
	{ id: 'install-storage', title: 'Install Active Storage' },
	{ id: 'run-migration', title: 'Run Migrations' },
	{ id: 'configure-s3', title: 'Configure Storage Service' },
	{ id: 'model-attachment', title: 'Add Model Attachment' },
	{ id: 'build-service', title: 'Build Upload Service' },
	{ id: 'direct-upload', title: 'Create Upload Endpoint' },
];

// Terminal step 0: Install Active Storage
const INSTALL_COMMANDS = [
	{
		id: 'wrong-gem',
		label: 'bundle add activestorage',
		command: 'bundle add activestorage',
		correct: false,
		feedback:
			'Active Storage is included in Rails by default. It needs to be installed via the Rails generator, not added as a separate gem.',
	},
	{
		id: 'correct-install',
		label: 'bin/rails active_storage:install',
		command: 'bin/rails active_storage:install',
		correct: true,
	},
	{
		id: 'wrong-generate',
		label: 'rails generate storage',
		command: 'rails generate storage',
		correct: false,
		feedback:
			'There is no "storage" generator. Active Storage has its own install command that creates the necessary migration files.',
	},
];

const INSTALL_OUTPUT = [
	{
		text: '  Copied migration ...create_active_storage_tables.migration',
		color: 'green' as const,
	},
	{
		text: '  create  db/migrate/..._create_active_storage_tables.rb',
		color: 'green' as const,
	},
];

// Terminal step 1: Run migrations
const MIGRATE_COMMANDS = [
	{
		id: 'wrong-setup',
		label: 'rails db:setup',
		command: 'rails db:setup',
		correct: false,
		feedback:
			'db:setup drops and recreates the database. You only need to run the pending Active Storage migration.',
	},
	{
		id: 'correct-migrate',
		label: 'rails db:migrate',
		command: 'rails db:migrate',
		correct: true,
	},
	{
		id: 'wrong-seed',
		label: 'rails db:seed',
		command: 'rails db:seed',
		correct: false,
		feedback:
			'db:seed populates data, not schema. The Active Storage tables need to be created first via migration.',
	},
];

const MIGRATE_OUTPUT = [
	{
		text: '  == CreateActiveStorageTables: migrating ==',
		color: 'green' as const,
	},
	{ text: '  -- create_table(:active_storage_blobs)', color: 'green' as const },
	{
		text: '  -- create_table(:active_storage_attachments)',
		color: 'green' as const,
	},
	{
		text: '  -- create_table(:active_storage_variant_records)',
		color: 'green' as const,
	},
	{
		text: '  == CreateActiveStorageTables: migrated ==',
		color: 'green' as const,
	},
];

const TERMINAL_STEP_MAP: (TerminalStepData | null)[] = [
	{ commands: INSTALL_COMMANDS, outputLines: INSTALL_OUTPUT },
	{ commands: MIGRATE_COMMANDS, outputLines: MIGRATE_OUTPUT },
	null, // step 2: OptionCard
	null, // step 3: OptionCard
	null, // step 4: OptionCard
	null, // step 5: OptionCard
];

// OptionCard step 2: Configure S3 storage
const STORAGE_OPTIONS = [
	{
		id: 'wrong-local',
		label: `# config/storage.yml
local:
  service: Disk
  root: storage/

# config/environments/production.rb
config.active_storage.service = :local
# Files stored on the Rails server's disk`,
		correct: false,
		feedback:
			'Disk storage keeps files on the Rails server. Files are lost on deploy, cannot be shared across workers, and there is no CDN or direct upload support.',
	},
	{
		id: 'correct-s3',
		label: `# config/storage.yml
amazon:
  service: S3
  access_key_id: <%= Rails.application.credentials
    .dig(:aws, :access_key_id) %>
  secret_access_key: <%= Rails.application.credentials
    .dig(:aws, :secret_access_key) %>
  region: us-east-1
  bucket: myapp-production

# config/environments/production.rb
config.active_storage.service = :amazon`,
		correct: true,
	},
	{
		id: 'wrong-hardcoded',
		label: `# config/storage.yml
amazon:
  service: S3
  access_key_id: "AKIA1234567890EXAMPLE"
  secret_access_key: "wJalrXUtn/EXAMPLE/K7MDENG"
  region: us-east-1
  bucket: myapp-production`,
		correct: false,
		feedback:
			'Hardcoded credentials in YAML files get committed to version control. Use Rails credentials or environment variables to keep secrets out of the repository.',
	},
];

// OptionCard step 3: Model attachment with variants
const ATTACHMENT_OPTIONS = [
	{
		id: 'wrong-no-variants',
		label: `class User < ApplicationRecord
  has_one_attached :avatar
  # No variants defined
  # Clients must request full-size originals
end`,
		correct: false,
		feedback:
			'Without named variants, every avatar request downloads the full 5MB original. Named variants define pre-set transforms (thumbnail, medium) that are generated on first access.',
	},
	{
		id: 'wrong-has-many',
		label: `class User < ApplicationRecord
  has_many_attached :avatar do |attachable|
    attachable.variant :thumb, resize_to_limit: [100, 100]
  end
end`,
		correct: false,
		feedback:
			'has_many_attached is for multiple files (photos gallery, documents). A user has one avatar, so use has_one_attached.',
	},
	{
		id: 'correct-with-variants',
		label: `class User < ApplicationRecord
  has_one_attached :avatar do |attachable|
    attachable.variant :thumb, resize_to_limit: [100, 100]
    attachable.variant :medium, resize_to_limit: [300, 300]
  end

  has_many_attached :documents
end`,
		correct: true,
	},
];

// OptionCard step 4: Build upload service
const SERVICE_OPTIONS = [
	{
		id: 'wrong-no-contract',
		label: `class UploadAvatar < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(user_id:, blob_signed_id:)
    @user_id = user_id
    @blob_signed_id = blob_signed_id
  end

  def call
    user = User.find(@user_id)
    user.avatar.attach(@blob_signed_id)
    Result.new(success?: true, user:, errors: [])
  rescue ActiveRecord::RecordNotFound
    Result.new(success?: false, user: nil,
      errors: ["User not found"])
  end
end`,
		correct: false,
		feedback:
			'Missing input validation via contract. Services must validate input through a Dry::Validation::Contract before executing business logic.',
	},
	{
		id: 'correct-with-contract',
		label: `class UploadAvatar < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(user_id:, blob_signed_id:)
    @user_id = user_id
    @blob_signed_id = blob_signed_id
  end

  def call
    v = AvatarUploadContract.new.call(
      user_id: @user_id,
      blob_signed_id: @blob_signed_id)
    return Result.new(success?: false,
      user: nil, errors: v.errors.to_h) if v.failure?

    user = User.find(@user_id)
    blob = ActiveStorage::Blob.find_signed!(@blob_signed_id)
    validate_content_type!(blob)
    validate_file_size!(blob)

    user.avatar.attach(@blob_signed_id)
    Result.new(success?: true, user:, errors: [])
  rescue ActiveStorage::FileNotFoundError
    Result.new(success?: false, user: nil,
      errors: ["File not found"])
  end
end`,
		correct: true,
	},
];

// OptionCard step 5: Direct upload endpoint
const DIRECT_UPLOAD_OPTIONS = [
	{
		id: 'wrong-through-rails',
		label: `class Api::V1::AvatarsController < ApplicationController
  def create
    result = UploadAvatar.call(
      user_id: Current.user.id,
      file: params[:file])
    # File uploaded THROUGH Rails, not direct!
    if result.success?
      render json: UserSerializer.new(result.user)
    else
      render json: { error: { code: "UPLOAD_FAILED",
        message: "Upload failed",
        details: result.errors } },
        status: :unprocessable_entity
    end
  end
end`,
		correct: false,
		feedback:
			'This sends the file through Rails (params[:file]). Direct upload uses a two-step process: Rails provides a presigned URL, then the client uploads directly to S3.',
	},
	{
		id: 'correct-presigned',
		label: `class Api::V1::DirectUploadsController < ApplicationController
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
    params.expect(
      file: [:filename, :byte_size,
             :checksum, :content_type])
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-manual-s3',
		label: `class Api::V1::DirectUploadsController < ApplicationController
  def create
    s3 = Aws::S3::Client.new
    presigned = s3.presigned_url(:put_object,
      bucket: ENV['S3_BUCKET'],
      key: "uploads/#{SecureRandom.uuid}")
    render json: { upload_url: presigned }
  end
end`,
		correct: false,
		feedback:
			"Building presigned URLs manually bypasses Active Storage entirely. Rails cannot track the blob, attach it to models, or generate variants. Use Active Storage's built-in direct upload support.",
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
	2: {
		title: 'Configure Storage Service',
		description:
			'Choose the right storage configuration for production. Consider security, scalability, and deployment.',
		options: STORAGE_OPTIONS,
	},
	3: {
		title: 'Add Model Attachment with Variants',
		description:
			'Add file attachment to the User model with pre-defined image variants for consistent sizing.',
		options: ATTACHMENT_OPTIONS,
	},
	4: {
		title: 'Build the Upload Service',
		description:
			'Create a service object that handles avatar uploads with proper validation.',
		options: SERVICE_OPTIONS,
	},
	5: {
		title: 'Create Direct Upload Endpoint',
		description:
			'Build the API endpoint that provides presigned URLs for client-side direct upload.',
		options: DIRECT_UPLOAD_OPTIONS,
	},
};

// ──────────────────────────────────────────────
// Stress test scenarios (reward phase)
// ──────────────────────────────────────────────

const STRESS_SCENARIOS: StressScenario[] = [
	{
		id: 'direct-upload-avatar',
		label: 'POST direct upload (5MB avatar)',
		description: 'Client gets presigned URL, uploads directly to S3',
		method: 'POST',
		path: '/api/v1/direct_uploads',
		actor: 'authenticated user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: 'Presigned URL issued. Client uploads directly to S3.',
				color: 'cyan',
			},
			{
				text: 'Server memory: 45MB (unchanged, file never touches Rails)',
				color: 'green',
			},
		],
	},
	{
		id: 'attach-with-variant',
		label: 'POST attach + generate thumbnail',
		description: 'Attach uploaded blob, request thumbnail variant',
		method: 'POST',
		path: '/api/v1/users/1/avatar',
		actor: 'authenticated user',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{ text: 'Avatar attached via blob_signed_id.', color: 'cyan' },
			{
				text: 'Variant :thumb (100x100) generated lazily on first request.',
				color: 'green',
			},
		],
	},
	{
		id: 'concurrent-uploads',
		label: 'POST 10 concurrent uploads',
		description: '10 users upload avatars simultaneously via direct upload',
		method: 'POST',
		path: '/api/v1/direct_uploads',
		actor: '10 users',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK (all 10 succeed)', color: 'green' },
			{ text: '10 presigned URLs issued in parallel.', color: 'cyan' },
			{
				text: 'Server memory: 45MB (unchanged, zero file buffering)',
				color: 'green',
			},
		],
	},
	{
		id: 'invalid-content-type',
		label: 'POST upload .exe file',
		description: 'Upload executable file disguised as image',
		method: 'POST',
		path: '/api/v1/users/1/avatar',
		actor: 'attacker',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{ text: '{ error: { code: "INVALID_CONTENT_TYPE" } }', color: 'yellow' },
			{
				text: 'Content type application/x-msdownload not allowed.',
				color: 'red',
			},
		],
	},
	{
		id: 'oversized-file',
		label: 'POST upload 50MB file',
		description: 'Upload file exceeding size limit',
		method: 'POST',
		path: '/api/v1/users/1/avatar',
		actor: 'authenticated user',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{ text: '{ error: { code: "FILE_TOO_LARGE" } }', color: 'yellow' },
			{
				text: 'AvatarUploadContract: file size must be under 10MB.',
				color: 'red',
			},
		],
	},
	{
		id: 'serve-variant',
		label: 'GET avatar thumbnail variant',
		description: 'Request pre-defined thumbnail variant via CDN',
		method: 'GET',
		path: '/api/v1/users/1/avatar?variant=thumb',
		actor: 'any client',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '302 Found -> CDN URL', color: 'green' },
			{
				text: 'Redirect to S3/CDN URL (Rails worker freed instantly)',
				color: 'cyan',
			},
			{
				text: 'Variant: 100x100 thumbnail, 15KB instead of 5MB',
				color: 'green',
			},
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
				filename: 'app/services/upload_avatar.rb',
				language: 'ruby',
				code: `class UploadAvatar < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(user_id:, file:)
    @user_id = user_id
    @file = file  # Entire file in memory!
  end

  def call
    v = AvatarUploadContract.new.call(
      user_id: @user_id, file: @file)
    return Result.new(success?: false,
      user: nil, errors: v.errors.to_h) if v.failure?

    user = User.find(@user_id)
    user.avatar.attach(@file)  # 5MB buffered in Rails!
    Result.new(success?: true, user:, errors: [])
  end
end`,
			},
			{
				filename: 'app/controllers/api/v1/avatars_controller.rb',
				language: 'ruby',
				code: `class Api::V1::AvatarsController < ApplicationController
  def create
    result = UploadAvatar.call(
      user_id: Current.user.id,
      file: params[:file])  # File uploaded THROUGH Rails
    if result.success?
      render json: UserSerializer.new(result.user)
    else
      render json: { error: { code: "UPLOAD_FAILED",
        message: "Upload failed",
        details: result.errors } },
        status: :unprocessable_entity
    end
  end

  def show
    user = User.find(params[:user_id])
    send_data user.avatar.download  # Blocks worker!
    # No variants, no CDN redirect
  end
end`,
			},
		];
	}

	if (phase === 'build') {
		if (furthestStep <= 0) {
			return [
				{
					filename: 'app/services/upload_avatar.rb',
					language: 'ruby',
					code: `# Active Storage not installed yet.
# No active_storage_blobs or active_storage_attachments tables.
# File uploads go through Rails process memory.

class UploadAvatar < ApplicationService
  Result = Data.define(:success?, :user, :errors)
  # ...
  def call
    # File buffered entirely in Rails memory
    user.avatar.attach(@file)
  end
end`,
				},
			];
		}
		if (furthestStep <= 1) {
			return [
				{
					filename: 'db/migrate/..._create_active_storage_tables.rb',
					language: 'ruby',
					code: `# Generated by: bin/rails active_storage:install
class CreateActiveStorageTables < ActiveRecord::Migration[8.0]
  def change
    create_table :active_storage_blobs do |t|
      t.string   :key,          null: false
      t.string   :filename,     null: false
      t.string   :content_type
      t.text     :metadata
      t.string   :service_name, null: false
      t.bigint   :byte_size,    null: false
      t.string   :checksum
      t.datetime :created_at,   null: false
    end

    create_table :active_storage_attachments do |t|
      t.string     :name,     null: false
      t.references :record,   null: false, polymorphic: true
      t.references :blob,     null: false
      t.datetime   :created_at, null: false
    end

    create_table :active_storage_variant_records do |t|
      t.belongs_to :blob, null: false
      t.string     :variation_digest, null: false
    end
  end
end`,
				},
			];
		}
		if (furthestStep <= 2) {
			return [
				{
					filename: 'config/storage.yml',
					language: 'yaml',
					code: `# Storage service configured for S3
amazon:
  service: S3
  access_key_id: <%= Rails.application.credentials
    .dig(:aws, :access_key_id) %>
  secret_access_key: <%= Rails.application.credentials
    .dig(:aws, :secret_access_key) %>
  region: us-east-1
  bucket: myapp-production

# config/environments/production.rb
# config.active_storage.service = :amazon`,
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
  encrypts :phone
  encrypts :address

  has_one_attached :avatar do |attachable|
    attachable.variant :thumb, resize_to_limit: [100, 100]
    attachable.variant :medium, resize_to_limit: [300, 300]
  end

  has_many_attached :documents
end`,
				},
				{
					filename: 'config/storage.yml',
					language: 'yaml',
					code: `amazon:
  service: S3
  access_key_id: <%= Rails.application.credentials
    .dig(:aws, :access_key_id) %>
  secret_access_key: <%= Rails.application.credentials
    .dig(:aws, :secret_access_key) %>
  region: us-east-1
  bucket: myapp-production`,
				},
			];
		}
		if (furthestStep <= 4) {
			return [
				{
					filename: 'app/services/upload_avatar.rb',
					language: 'ruby',
					code: `class UploadAvatar < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(user_id:, blob_signed_id:)
    @user_id = user_id
    @blob_signed_id = blob_signed_id
  end

  def call
    v = AvatarUploadContract.new.call(
      user_id: @user_id,
      blob_signed_id: @blob_signed_id)
    return Result.new(success?: false,
      user: nil, errors: v.errors.to_h) if v.failure?

    user = User.find(@user_id)
    blob = ActiveStorage::Blob.find_signed!(@blob_signed_id)
    validate_content_type!(blob)
    validate_file_size!(blob)

    user.avatar.attach(@blob_signed_id)
    Result.new(success?: true, user:, errors: [])
  rescue ActiveStorage::FileNotFoundError
    Result.new(success?: false, user: nil,
      errors: ["File not found"])
  end
end`,
				},
				{
					filename: 'app/contracts/avatar_upload_contract.rb',
					language: 'ruby',
					code: `class AvatarUploadContract < Dry::Validation::Contract
  params do
    required(:user_id).filled(:integer)
    required(:blob_signed_id).filled(:string)
  end
end`,
				},
			];
		}
		return [
			{
				filename: 'app/controllers/api/v1/direct_uploads_controller.rb',
				language: 'ruby',
				code: `class Api::V1::DirectUploadsController < ApplicationController
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
    params.expect(
      file: [:filename, :byte_size,
             :checksum, :content_type])
  end
end`,
			},
			{
				filename: 'app/services/upload_avatar.rb',
				language: 'ruby',
				code: `class UploadAvatar < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(user_id:, blob_signed_id:)
    @user_id = user_id
    @blob_signed_id = blob_signed_id
  end

  def call
    v = AvatarUploadContract.new.call(
      user_id: @user_id,
      blob_signed_id: @blob_signed_id)
    return Result.new(success?: false,
      user: nil, errors: v.errors.to_h) if v.failure?

    user = User.find(@user_id)
    blob = ActiveStorage::Blob.find_signed!(@blob_signed_id)
    validate_content_type!(blob)
    validate_file_size!(blob)

    user.avatar.attach(@blob_signed_id)
    Result.new(success?: true, user:, errors: [])
  rescue ActiveStorage::FileNotFoundError
    Result.new(success?: false, user: nil,
      errors: ["File not found"])
  end
end`,
			},
		];
	}

	// reward / activate
	return [
		{
			filename: 'app/controllers/api/v1/direct_uploads_controller.rb',
			language: 'ruby',
			code: `class Api::V1::DirectUploadsController < ApplicationController
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
    params.expect(
      file: [:filename, :byte_size,
             :checksum, :content_type])
  end
end`,
		},
		{
			filename: 'app/services/upload_avatar.rb',
			language: 'ruby',
			code: `class UploadAvatar < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(user_id:, blob_signed_id:)
    @user_id = user_id
    @blob_signed_id = blob_signed_id
  end

  def call
    v = AvatarUploadContract.new.call(
      user_id: @user_id,
      blob_signed_id: @blob_signed_id)
    return Result.new(success?: false,
      user: nil, errors: v.errors.to_h) if v.failure?

    user = User.find(@user_id)
    blob = ActiveStorage::Blob.find_signed!(@blob_signed_id)
    validate_content_type!(blob)
    validate_file_size!(blob)

    user.avatar.attach(@blob_signed_id)
    Result.new(success?: true, user:, errors: [])
  rescue ActiveStorage::FileNotFoundError
    Result.new(success?: false, user: nil,
      errors: ["File not found"])
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

  has_many_attached :documents
end`,
		},
	];
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level35ActiveStorage({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<Phase>('observe');
	const [flowPhase, setFlowPhase] = useState(-1);
	const [wrongFeedback, setWrongFeedback] = useState<string | null>(null);
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

			// Animate flow: client -> app -> s3
			setFlowPhase(0);
			const t1 = setTimeout(() => setFlowPhase(1), ANIMATION_DURATION_MS);
			const t2 = setTimeout(() => setFlowPhase(2), ANIMATION_DURATION_MS * 2);
			const t3 = setTimeout(() => setFlowPhase(-1), ANIMATION_DURATION_MS * 3);
			timersRef.current.push(t1, t2, t3);
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

			// Animate: for allowed scenarios, show direct path (client -> s3)
			// For blocked, show rejection at app
			const scenario = STRESS_SCENARIOS.find((s) => s.id === scenarioId);
			setFlowPhase(0);
			if (scenario?.expectedResult === 'allowed') {
				const t1 = setTimeout(() => setFlowPhase(1), ANIMATION_DURATION_MS);
				const t2 = setTimeout(() => setFlowPhase(2), ANIMATION_DURATION_MS * 2);
				const t3 = setTimeout(
					() => setFlowPhase(-1),
					ANIMATION_DURATION_MS * 3,
				);
				timersRef.current.push(t1, t2, t3);
			} else {
				const t1 = setTimeout(() => setFlowPhase(1), ANIMATION_DURATION_MS);
				const t2 = setTimeout(
					() => setFlowPhase(-1),
					ANIMATION_DURATION_MS * 2,
				);
				timersRef.current.push(t1, t2);
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
		return { valid: true, message: 'Direct upload configured with variants!' };
	}, [phase]);

	const handleComplete = async () => {
		onComplete({ stars: 3 });
	};

	// ── Determine last scenario for reward viz ──
	const lastResult =
		stressTest.results.length > 0
			? stressTest.results[stressTest.results.length - 1]
			: null;

	// ── Render helpers ──
	const renderUploadPipeline = (isReward: boolean) => {
		const isAnimating = flowPhase >= 0;
		const _lastWasAllowed = lastResult?.expectedResult === 'allowed';
		const lastWasBlocked = lastResult?.expectedResult === 'blocked';

		// Zone states
		const clientActive = isAnimating && flowPhase >= 0;
		const appActive = isAnimating && flowPhase >= 1;
		const s3Active = isAnimating && flowPhase >= 2;

		// Colors depend on phase
		const appColor = isReward
			? appActive
				? 'border-emerald-500 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30'
				: 'border-border bg-card'
			: appActive
				? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/30'
				: 'border-border bg-card';

		const s3Color =
			isAnimating && s3Active
				? 'border-emerald-500 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30'
				: 'border-border bg-card';

		return (
			<div className="flex items-center justify-center gap-2 py-6">
				{/* Client zone */}
				<div
					className={cn(
						'rounded-xl border-2 p-4 w-36 text-center transition-colors',
						clientActive
							? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
							: 'border-border bg-card',
					)}
				>
					<Monitor className="w-6 h-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
					<div className="text-sm font-medium text-foreground">Client</div>
					{clientActive && (
						<div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
							{isReward ? 'Uploading...' : 'Sending file...'}
						</div>
					)}
				</div>

				{/* Client -> App connector */}
				<div className="flex flex-col items-center">
					<FlowConnector
						active={clientActive}
						direction="right"
						dotColor={isReward ? 'green' : 'red'}
					/>
					<span className="text-xs text-muted-foreground mt-1">
						{isReward ? 'presigned URL' : '5MB file data'}
					</span>
				</div>

				{/* App Server zone */}
				<div
					className={cn(
						'rounded-xl border-2 p-4 w-40 text-center transition-colors',
						appColor,
					)}
				>
					<Server className="w-6 h-6 mx-auto mb-2 text-foreground" />
					<div className="text-sm font-medium text-foreground">App Server</div>
					{!isReward && appActive && (
						<div className="text-xs text-red-600 dark:text-red-400 mt-1">
							Memory spike!
						</div>
					)}
					{isReward && appActive && !lastWasBlocked && (
						<div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
							Low memory
						</div>
					)}
					{isReward && appActive && lastWasBlocked && (
						<div className="text-xs text-red-600 dark:text-red-400 mt-1">
							Rejected
						</div>
					)}
				</div>

				{/* App -> S3 connector */}
				<div className="flex flex-col items-center">
					<FlowConnector
						active={appActive && (!isReward || !lastWasBlocked)}
						direction="right"
						dotColor={isReward ? 'green' : 'red'}
					/>
					<span className="text-xs text-muted-foreground mt-1">
						{isReward ? (lastWasBlocked ? '' : 'direct upload') : 'relay to S3'}
					</span>
				</div>

				{/* S3 zone */}
				<div
					className={cn(
						'rounded-xl border-2 p-4 w-36 text-center transition-colors',
						isReward && lastWasBlocked
							? 'border-border bg-card opacity-50'
							: s3Color,
					)}
				>
					<Cloud className="w-6 h-6 mx-auto mb-2 text-amber-600 dark:text-amber-400" />
					<div className="text-sm font-medium text-foreground">S3 Storage</div>
					{s3Active && !lastWasBlocked && (
						<div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
							Stored
						</div>
					)}
				</div>
			</div>
		);
	};

	// ── Left panel content ──
	const renderLeftPanel = () => {
		if (phase === 'observe') {
			return (
				<InstructionPanel
					goal="Discover why uploading files through the Rails server is a problem."
					instructions={[
						'Fire probes to see memory spikes during uploads.',
						'Watch how file downloads block Rails workers.',
						'Notice the lack of image variants.',
					]}
					scenario="Users upload 5MB profile photos through the Rails app server. Memory spikes on every upload. Avatar downloads block workers. No thumbnails exist."
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
					goal="Set up Active Storage with direct upload and image variants."
					instructions={[
						'Install Active Storage and run migrations.',
						'Configure S3 as the storage backend.',
						'Add model attachments with named variants.',
						'Build the upload service and direct upload endpoint.',
					]}
					scenario="Users need to upload profile photos without spiking server memory. Files should go directly to S3, and thumbnails should be generated on demand."
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
					goal="Active Storage is configured. Test the direct upload pipeline."
					instructions={[]}
					scenario="Direct upload with presigned URLs, image variants, and content validation are all in place."
				/>
			);
		}

		// reward
		return (
			<InstructionPanel
				goal="Stress-test the direct upload pipeline."
				instructions={[
					'Fire upload scenarios and watch files bypass the app server.',
					'See invalid files get rejected by the contract.',
					'Watch variants served through CDN redirect.',
				]}
				scenario="Direct upload sends files straight to S3. Variants generate lazily. The app server stays lean."
			>
				<div className="p-4 border-t border-border">
					<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
						Legend
					</div>
					<div className="space-y-2 text-xs">
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded bg-emerald-500" />
							<span className="text-foreground">
								Direct upload (no memory spike)
							</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded bg-red-500" />
							<span className="text-foreground">
								Rejected by contract validation
							</span>
						</div>
					</div>
					<div className="mt-4 grid grid-cols-2 gap-3">
						<div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-lg p-3 text-center">
							<div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
								{stressTest.allowedCount}
							</div>
							<div className="text-xs text-emerald-600 dark:text-emerald-400">
								Uploaded
							</div>
						</div>
						<div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-3 text-center">
							<div className="text-xl font-bold text-red-700 dark:text-red-400">
								{stressTest.blockedCount}
							</div>
							<div className="text-xs text-red-600 dark:text-red-400">
								Rejected
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
					{renderUploadPipeline(false)}

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
									{currentStep === 0
										? 'Install Active Storage to create the required tables for blob tracking and file attachments.'
										: 'Run the migration to create Active Storage tables.'}
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
						Visualize Direct Upload
					</Button>
				</div>
			);
		}

		// reward
		return (
			<div className="flex-1 flex flex-col">
				{renderUploadPipeline(true)}

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
					levelName="Active Storage"
					levelNumber={34}
					onComplete={handleComplete}
					onReset={() => {
						setPhase('observe');
						setFlowPhase(-1);
						setWrongFeedback(null);
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
							? 'Files upload through Rails, spiking memory. No variants or CDN.'
							: phase === 'build'
								? 'Configure Active Storage with S3, direct upload, and variants.'
								: 'Direct upload bypasses Rails. Variants generated lazily. CDN serves files.'
					}
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level35ActiveStorage;
