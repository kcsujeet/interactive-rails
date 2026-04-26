import type { Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

export const level35ActiveStorage: Level = {
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
		goal: `In this level, you'll:\n- learn how to handle file uploads in Rails using Active Storage.\n- attach single and multiple files to models.\n- upload directly to cloud storage via presigned URLs to bypass the app server.\n- generate image variants like thumbnails and crops on the fly.`,
		conceptExplanation: `Active Storage manages file uploads in Rails, connecting files to Active Record models.

**Key concepts:**
- \`has_one_attached\`: Single file per record (avatar, resume)
- \`has_many_attached\`: Multiple files per record (photos, documents)
- **Direct Upload**: Browser uploads directly to S3 via presigned URL (Rails never touches the file)
- **Variants**: On-the-fly image transformations (resize, crop, convert)
- **Presigned URLs**: Time-limited URLs that grant temporary access to private files

**How a presigned URL actually gets made:**
- A common confusion: "presigned URL" sounds like Rails asks S3 to generate one. It does not
- Rails has the AWS access key and secret in \`config/storage.yml\`. It uses those credentials to **compute the URL locally**, sign it cryptographically, and return it to the client
- There is **no network call to S3** during this step. The URL is just a string that AWS will recognize as authorized when the client later PUTs the file to it
- This is why direct upload is so cheap on the Rails side: Rails only handles a tiny metadata request (filename, size, type, checksum) and a tiny URL response. The 5MB photo never touches Rails

**Architecture:**
1. Client POSTs the file's metadata (name, byte size, content type, checksum) to Rails. No file bytes yet
2. Rails creates a \`Blob\` row in its own database and computes a presigned upload URL from \`config/storage.yml\`. Returns the URL plus a \`signed_id\` for the blob
3. Client PUTs the file bytes directly to S3 using that URL. Rails never sees the file
4. Client sends the blob's \`signed_id\` back to Rails
5. Rails calls \`record.avatar.attach(signed_id)\`, which links the blob to the model
6. Variants (thumbnails, crops) are generated lazily the first time someone requests them`,
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
