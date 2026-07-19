/**
 * Level 34: Active Storage
 *
 * Sequential phase flow: observe -> build -> reward
 * Each phase occupies the full center panel. One thing at a time.
 *
 * Phase 1 (WHY - observe): Custom "Upload Pipeline" visualization.
 *   Two horizontal zones: Client -> App Server (with local disk).
 *   No S3 yet (Active Storage hasn't been installed).
 *   Each probe plays a DISTINCT animation:
 *   - Upload: Client -> App, File.binwrite to disk, memory spike
 *   - Download: App reads from disk, streams to Client, worker blocked
 *   - List: accumulation of 5MB originals from disk, no variants
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
 * Phase 3 (ADVANTAGE - reward): Three-zone pipeline (Client, App Server, S3).
 *   S3 appears for the first time, reinforcing that Active Storage added it.
 *   Allowed: Files go directly to S3 (bypassing app memory), variants served via CDN.
 *   Blocked: Invalid content type, oversized files caught by contract.
 *
 * Teaches: Active Storage, has_one_attached, direct upload, presigned URLs,
 *   image variants, content validation
 */

import type { Edge, EdgeProps, Node } from '@xyflow/react';
import { BaseEdge, EdgeLabelRenderer, getStraightPath } from '@xyflow/react';
import { ArrowRight, HardDrive, Zap } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
	AnimatedDots,
	FlowDiagram,
	FlowHandles,
	reversePath,
} from '@/components/levels/FlowDiagram';
import { FlowNode, type FlowNodeData } from '@/components/levels/FlowNode';
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

registerLevelCode('act5-level34-active-storage', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);

// ──────────────────────────────────────────────
// Phase type
// ──────────────────────────────────────────────

type Phase = 'observe' | 'build' | 'reward';

// ──────────────────────────────────────────────
// Animation types and frame data
// ──────────────────────────────────────────────

type ZoneFlash = 'idle' | 'blue' | 'red' | 'green' | 'amber';

interface ZoneState {
	label: string;
	flash: ZoneFlash;
}

interface ConnectorVizState {
	active: boolean;
	reverse: boolean; // true = dots travel left (scaleX flip)
	label: string;
	dotColor: string; // Tailwind bg class
}

interface AnimationFrame {
	client?: Partial<ZoneState>;
	connA?: Partial<ConnectorVizState>; // Client <-> App Server
	app?: Partial<ZoneState>;
	connB?: Partial<ConnectorVizState>; // App Server <-> S3
	connC?: Partial<ConnectorVizState>; // Client <-> S3 direct (bypasses App)
	s3?: Partial<ZoneState>;
	memoryMB?: number;
	warningMessage?: string;
	bandwidthLabel?: string;
}

// ── Observe: Upload probe (Client -> App, disk write, no S3) ──

const UPLOAD_PROBE_FRAMES: AnimationFrame[] = [
	{
		client: { label: 'Uploading...', flash: 'blue' },
		connA: {
			active: true,
			reverse: false,
			label: '5MB file data',
			dotColor: 'bg-red-500 dark:bg-red-400',
		},
	},
	{
		client: { label: '', flash: 'idle' },
		connA: { active: false, label: '' },
		app: { label: 'Buffering 5MB...', flash: 'red' },
		memoryMB: 50,
	},
	{
		app: { label: 'File.binwrite to disk...', flash: 'amber' },
	},
	{
		app: { label: 'Saved to local disk', flash: 'amber' },
		warningMessage:
			'The entire 5MB file was buffered in Rails process memory (45MB -> 50MB). Ten concurrent uploads spike memory by about 50MB (peak ~95MB). Files saved to local disk (lost on deploy, no CDN).',
	},
];

// ── Observe: Download probe (App -> Client, worker blocked, no S3) ──

const DOWNLOAD_PROBE_FRAMES: AnimationFrame[] = [
	{
		client: { label: 'Requesting avatar...', flash: 'blue' },
		app: { label: 'send_file avatar_path', flash: 'amber' },
	},
	{
		app: { label: 'Reading 5MB from disk...', flash: 'red' },
		memoryMB: 50,
	},
	{
		connA: {
			active: true,
			reverse: true,
			label: '5MB streaming...',
			dotColor: 'bg-red-500 dark:bg-red-400',
		},
		app: { label: 'Worker BLOCKED 3s', flash: 'red' },
	},
	{
		connA: { active: false, label: '' },
		client: { label: 'Received 5MB original', flash: 'amber' },
		app: { label: 'Worker freed', flash: 'amber' },
		warningMessage:
			'Rails read the entire 5MB from disk and streamed it to the client. The worker was blocked for 3 seconds. No CDN or redirect configured.',
	},
];

// ── Observe: List probe (accumulation on App, no S3) ──

const LIST_PROBE_FRAMES: AnimationFrame[] = [
	{
		client: { label: 'GET /users?per_page=25', flash: 'blue' },
		app: { label: 'Rendering 25 users...', flash: 'amber' },
	},
	{
		app: { label: 'User 1: 5MB from disk', flash: 'amber' },
		bandwidthLabel: '5MB',
	},
	{
		app: { label: 'User 2: 5MB from disk', flash: 'amber' },
		bandwidthLabel: '10MB',
	},
	{
		app: { label: '...x25 users, no variants!', flash: 'red' },
		bandwidthLabel: '125MB (should be 375KB with variants)',
		warningMessage:
			'Each avatar is the 5MB original from local disk. No thumbnail variant defined. 25 users x 5MB = 125MB downloaded by the client. With a :thumb variant, that would be 25 x 15KB = 375KB.',
	},
];

const PROBE_FRAME_MAP: Record<string, AnimationFrame[]> = {
	'upload-photo': UPLOAD_PROBE_FRAMES,
	'request-avatar': DOWNLOAD_PROBE_FRAMES,
	'list-avatars': LIST_PROBE_FRAMES,
};

// ── Reward: Upload a 5MB photo (full user flow) ──

const REWARD_UPLOAD_PHOTO: AnimationFrame[] = [
	{
		client: { label: 'Requesting presigned URL...', flash: 'blue' },
		connA: {
			active: true,
			reverse: false,
			label: 'metadata only',
			dotColor: 'bg-emerald-500 dark:bg-emerald-400',
		},
	},
	{
		connA: {
			active: true,
			reverse: true,
			label: 'presigned URL',
			dotColor: 'bg-emerald-500 dark:bg-emerald-400',
		},
		app: { label: 'Blob record created (local DB)', flash: 'green' },
	},
	{
		connA: { active: false, label: '' },
		client: { label: 'Uploading direct to S3...', flash: 'blue' },
		connC: {
			active: true,
			reverse: false,
			label: '5MB direct',
			dotColor: 'bg-emerald-500 dark:bg-emerald-400',
		},
		app: { label: 'Memory: 45MB (unchanged)', flash: 'green' },
	},
	{
		connC: { active: false, label: '' },
		s3: { label: '5MB stored', flash: 'green' },
		client: { label: 'Attaching to profile...', flash: 'blue' },
		connA: {
			active: true,
			reverse: false,
			label: 'signed ID',
			dotColor: 'bg-emerald-500 dark:bg-emerald-400',
		},
	},
	{
		connA: { active: false, label: '' },
		app: { label: 'Avatar attached', flash: 'green' },
		client: { label: 'Photo uploaded', flash: 'green' },
	},
];

// ── Reward: 10 sellers upload product photos at once ──

const REWARD_CONCURRENT: AnimationFrame[] = [
	{
		client: { label: '10 sellers uploading...', flash: 'blue' },
		connA: {
			active: true,
			reverse: false,
			label: '10 requests',
			dotColor: 'bg-emerald-500 dark:bg-emerald-400',
		},
	},
	{
		connA: {
			active: true,
			reverse: true,
			label: '10 presigned URLs',
			dotColor: 'bg-emerald-500 dark:bg-emerald-400',
		},
		app: { label: '10 blob records (local DB)', flash: 'green' },
	},
	{
		connA: { active: false, label: '' },
		connC: {
			active: true,
			reverse: false,
			label: '10 direct uploads',
			dotColor: 'bg-emerald-500 dark:bg-emerald-400',
		},
		app: { label: 'Memory: 45MB (zero buffering)', flash: 'green' },
	},
	{
		connC: { active: false, label: '' },
		s3: { label: '10 photos stored', flash: 'green' },
		client: { label: 'Attaching to profiles...', flash: 'blue' },
		connA: {
			active: true,
			reverse: false,
			label: '10 signed IDs',
			dotColor: 'bg-emerald-500 dark:bg-emerald-400',
		},
	},
	{
		connA: { active: false, label: '' },
		app: { label: '10 avatars attached', flash: 'green' },
		client: { label: 'All 10 complete', flash: 'green' },
	},
];

// ── Reward: Serve thumbnail variant via CDN redirect ──

const REWARD_SERVE_VARIANT: AnimationFrame[] = [
	{
		client: { label: 'GET avatar?variant=thumb', flash: 'blue' },
		connA: {
			active: true,
			reverse: false,
			label: 'request',
			dotColor: 'bg-emerald-500 dark:bg-emerald-400',
		},
	},
	{
		connA: { active: false, label: '' },
		app: { label: 'Variant exists, 302 redirect', flash: 'green' },
	},
	{
		connA: {
			active: true,
			reverse: true,
			label: '302 -> CDN URL',
			dotColor: 'bg-emerald-500 dark:bg-emerald-400',
		},
		app: { label: 'Worker freed instantly', flash: 'green' },
	},
	{
		connA: { active: false, label: '' },
		client: { label: 'Following redirect to S3...', flash: 'blue' },
		connC: {
			active: true,
			reverse: true,
			label: '15KB thumbnail',
			dotColor: 'bg-emerald-500 dark:bg-emerald-400',
		},
		s3: { label: 'Serving :thumb variant', flash: 'green' },
	},
	{
		connC: { active: false, label: '' },
		client: { label: 'Received 15KB (not 5MB)', flash: 'green' },
		bandwidthLabel: '15KB thumbnail (was 5MB original)',
	},
];

// ── Reward: List users with thumbnail variants via CDN ──

const REWARD_LIST_AVATARS: AnimationFrame[] = [
	{
		client: { label: 'GET /users?per_page=25', flash: 'blue' },
		connA: {
			active: true,
			reverse: false,
			label: 'request',
			dotColor: 'bg-emerald-500 dark:bg-emerald-400',
		},
	},
	{
		connA: { active: false, label: '' },
		app: { label: '25 variant URLs from DB', flash: 'green' },
	},
	{
		connA: {
			active: true,
			reverse: true,
			label: 'JSON + 25 CDN URLs',
			dotColor: 'bg-emerald-500 dark:bg-emerald-400',
		},
	},
	{
		connA: { active: false, label: '' },
		client: { label: 'Fetching 25 thumbnails...', flash: 'blue' },
		connC: {
			active: true,
			reverse: false,
			label: '25 requests',
			dotColor: 'bg-emerald-500 dark:bg-emerald-400',
		},
		app: { label: 'Workers free (no file I/O)', flash: 'green' },
	},
	{
		connC: {
			active: true,
			reverse: true,
			label: '25 x 15KB thumbnails',
			dotColor: 'bg-emerald-500 dark:bg-emerald-400',
		},
		s3: { label: 'Serving :thumb variants', flash: 'green' },
	},
	{
		connC: { active: false, label: '' },
		client: { label: 'Received 375KB (not 125MB)', flash: 'green' },
		bandwidthLabel: '375KB total (was 125MB without variants)',
	},
];

// ── Reward: Blocked - invalid content type ──

const REWARD_BLOCKED_CONTENT: AnimationFrame[] = [
	{
		client: { label: 'Requesting presigned URL...', flash: 'blue' },
		connA: {
			active: true,
			reverse: false,
			label: 'metadata only',
			dotColor: 'bg-amber-500 dark:bg-amber-400',
		},
	},
	{
		connA: {
			active: true,
			reverse: true,
			label: 'presigned URL',
			dotColor: 'bg-amber-500 dark:bg-amber-400',
		},
		app: { label: 'Blob record created (local DB)', flash: 'amber' },
	},
	{
		connA: { active: false, label: '' },
		client: { label: 'Uploading .exe direct to S3...', flash: 'blue' },
		connC: {
			active: true,
			reverse: false,
			label: 'file uploaded',
			dotColor: 'bg-amber-500 dark:bg-amber-400',
		},
	},
	{
		connC: { active: false, label: '' },
		s3: { label: 'File on S3 (not attached yet)', flash: 'amber' },
		client: { label: 'Attaching to profile...', flash: 'blue' },
		connA: {
			active: true,
			reverse: false,
			label: 'signed ID',
			dotColor: 'bg-red-500 dark:bg-red-400',
		},
	},
	{
		connA: {
			active: true,
			reverse: true,
			label: '422 rejected',
			dotColor: 'bg-red-500 dark:bg-red-400',
		},
		app: { label: 'UploadAvatar rejects at attach', flash: 'red' },
	},
	{
		connA: { active: false, label: '' },
		client: { label: '422 Unprocessable Entity', flash: 'red' },
		warningMessage:
			'The file reached S3 first (direct upload never touches Rails). At attach time UploadAvatar checks the blob content_type, sees application/x-msdownload, and refuses to attach it. The stray blob is never linked to a user and gets swept up by Active Storage cleanup.',
	},
];

// ── Reward: Blocked - oversized file ──

const REWARD_BLOCKED_OVERSIZED: AnimationFrame[] = [
	{
		client: { label: 'Requesting presigned URL...', flash: 'blue' },
		connA: {
			active: true,
			reverse: false,
			label: 'metadata only',
			dotColor: 'bg-amber-500 dark:bg-amber-400',
		},
	},
	{
		connA: {
			active: true,
			reverse: true,
			label: 'presigned URL',
			dotColor: 'bg-amber-500 dark:bg-amber-400',
		},
		app: { label: 'Blob record created (local DB)', flash: 'amber' },
	},
	{
		connA: { active: false, label: '' },
		client: { label: 'Uploading 50MB direct to S3...', flash: 'blue' },
		connC: {
			active: true,
			reverse: false,
			label: '50MB uploaded',
			dotColor: 'bg-amber-500 dark:bg-amber-400',
		},
	},
	{
		connC: { active: false, label: '' },
		s3: { label: '50MB on S3 (not attached yet)', flash: 'amber' },
		client: { label: 'Attaching to profile...', flash: 'blue' },
		connA: {
			active: true,
			reverse: false,
			label: 'signed ID',
			dotColor: 'bg-red-500 dark:bg-red-400',
		},
	},
	{
		connA: {
			active: true,
			reverse: true,
			label: '422 rejected',
			dotColor: 'bg-red-500 dark:bg-red-400',
		},
		app: { label: 'UploadAvatar rejects at attach', flash: 'red' },
	},
	{
		connA: { active: false, label: '' },
		client: { label: '422 Unprocessable Entity', flash: 'red' },
		warningMessage:
			'The 50MB file reached S3 first (direct upload). At attach time UploadAvatar checks blob.byte_size against the 10MB limit and refuses to attach it. The oversized blob is never linked to a user and gets swept up by Active Storage cleanup.',
	},
];

const REWARD_FRAMES_MAP: Record<string, AnimationFrame[]> = {
	'upload-photo': REWARD_UPLOAD_PHOTO,
	'request-avatar': REWARD_SERVE_VARIANT,
	'list-avatars': REWARD_LIST_AVATARS,
	'upload-10-photos': REWARD_CONCURRENT,
	'upload-exe': REWARD_BLOCKED_CONTENT,
	'upload-50mb': REWARD_BLOCKED_OVERSIZED,
};

// ──────────────────────────────────────────────
// Discovery definitions (observe phase)
// ──────────────────────────────────────────────

const DISCOVERY_DEFS: DiscoveryDef[] = [
	{ id: 'memory-spike', label: 'File buffers in app server RAM' },
	{ id: 'no-variants', label: 'No thumbnails, serving 5MB originals' },
	{ id: 'serving-through-rails', label: 'Downloads block Rails workers' },
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'upload-photo': ['memory-spike'],
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
		command: 'curl -X POST /api/users/1/avatar -F "file=@photo.jpg"',
		responseLines: [
			{ text: 'Uploading 5MB through Rails process...', color: 'yellow' },
			{ text: 'Memory: 45MB -> 50MB (+5MB buffering the file)', color: 'red' },
			{
				text: '10 concurrent uploads = +50MB spike (peak ~95MB)',
				color: 'red',
			},
			{
				text: 'No presigned URL configured. File routes through app.',
				color: 'red',
			},
		],
		story: [
			'A seller uploads a 5MB profile photo for their store page.',
			'The entire file streams through the Rails process into memory.',
			'Memory rises from 45MB to 50MB just to handle one upload.',
			'Ten sellers uploading at once would spike memory by about 50MB (peak ~95MB).',
			'No presigned URL is configured, so every byte passes through the app server.',
		],
	},
	{
		id: 'request-avatar',
		label: 'Download user avatar',
		command: 'curl GET /api/users/1/avatar',
		responseLines: [
			{ text: 'send_file user.avatar_path', color: 'yellow' },
			{
				text: 'Entire 5MB read from disk, streamed to client',
				color: 'red',
			},
			{
				text: 'Rails worker blocked for 3 seconds during download!',
				color: 'red',
			},
			{ text: 'No CDN or redirect configured.', color: 'red' },
		],
		story: [
			'A customer visits a seller profile to check their store rating.',
			'The browser requests the seller avatar image.',
			'Rails reads the entire 5MB file from disk and streams it to the client.',
			'A Puma worker is blocked for 3 seconds serving this single file.',
			'No CDN or redirect is configured, so every download ties up a worker.',
		],
	},
	{
		id: 'list-avatars',
		label: 'List users with avatars',
		command: 'curl GET /api/users?per_page=25',
		responseLines: [
			{ text: 'Rendering 25 users with avatar URLs...', color: 'yellow' },
			{ text: 'Each avatar: full 5MB original, no variants!', color: 'red' },
			{ text: '25 users x 5MB = 125MB downloaded by client', color: 'red' },
			{
				text: 'No thumbnail variant defined. Wasting bandwidth.',
				color: 'red',
			},
		],
		story: [
			'A customer browses the marketplace and loads a page of 25 sellers.',
			'Each seller card shows their avatar image.',
			'Every avatar is the full 5MB original, with no thumbnail variant.',
			'The page forces the client to download 125MB of image data.',
			'No image processing is configured to generate smaller variants.',
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
		text: '       copy  db/migrate/..._create_active_storage_tables.active_storage.rb',
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
			'has_many_attached is for collections of files. A user has exactly one avatar, so this declaration gives the model the wrong shape.',
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
			'This runs the business logic on raw, unchecked input. Since L18, every service validates its input up front and returns structured errors before touching the database.',
	},
	{
		id: 'correct-with-contract',
		label: `class UploadAvatar < ApplicationService
  InvalidUpload = Class.new(StandardError)
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
  rescue InvalidUpload => e
    Result.new(success?: false, user: nil,
      errors: [e.message])
  end

  private

  ALLOWED = %w[image/jpeg image/png image/webp].freeze
  MAX_BYTES = 10.megabytes

  def validate_content_type!(blob)
    return if ALLOWED.include?(blob.content_type)
    raise InvalidUpload, "content type not allowed"
  end

  def validate_file_size!(blob)
    return if blob.byte_size <= MAX_BYTES
    raise InvalidUpload, "file exceeds 10MB"
  end
end`,
		correct: true,
	},
];

// OptionCard step 5: Direct upload endpoint
const DIRECT_UPLOAD_OPTIONS = [
	{
		id: 'wrong-through-rails',
		label: `class Api::AvatarsController < ApplicationController
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
		label: `class Api::DirectUploadsController < ApplicationController
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
		label: `class Api::DirectUploadsController < ApplicationController
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
		id: 'upload-photo',
		label: 'Upload 5MB profile photo',
		description: 'Seller uploads a product photo',
		method: 'POST',
		path: '/api/users/1/avatar',
		actor: 'seller',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: 'Presigned URL -> direct S3 upload -> blob attached.',
				color: 'cyan',
			},
			{
				text: 'Server memory: 45MB (unchanged, file never touches Rails)',
				color: 'green',
			},
		],
	},
	{
		id: 'request-avatar',
		label: 'Download user avatar',
		description: 'Customer downloads a single user avatar via CDN',
		method: 'GET',
		path: '/api/users/1/avatar?variant=thumb',
		actor: 'customer',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '302 Found -> CDN URL', color: 'green' },
			{
				text: ':thumb variant already cached on S3. Instant 302 redirect.',
				color: 'cyan',
			},
			{
				text: '15KB thumbnail via CDN (not 5MB original through Rails)',
				color: 'green',
			},
		],
	},
	{
		id: 'list-avatars',
		label: 'List users with avatars',
		description: 'Customer views user listing page with 25 avatar thumbnails',
		method: 'GET',
		path: '/api/users?per_page=25',
		actor: 'customer',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK', color: 'green' },
			{
				text: '25 users with :thumb variant URLs via CDN redirect.',
				color: 'cyan',
			},
			{
				text: '25 x 15KB = 375KB total (was 25 x 5MB = 125MB)',
				color: 'green',
			},
		],
	},
	{
		id: 'upload-10-photos',
		label: '10 sellers upload photos',
		description: '10 sellers upload product photos at the same time',
		method: 'POST',
		path: '/api/users/*/avatar',
		actor: '10 sellers',
		expectedResult: 'allowed',
		responseLines: [
			{ text: '200 OK (all 10 succeed)', color: 'green' },
			{
				text: '10 direct uploads to S3 in parallel.',
				color: 'cyan',
			},
			{
				text: 'Server memory: 45MB (unchanged, zero file buffering)',
				color: 'green',
			},
		],
	},
	{
		id: 'upload-exe',
		label: 'Upload .exe file',
		description: 'Attacker uploads malware disguised as image',
		method: 'POST',
		path: '/api/users/1/avatar',
		actor: 'attacker',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{ text: '{ error: { code: "INVALID_CONTENT_TYPE" } }', color: 'yellow' },
			{
				text: 'File reached S3, but UploadAvatar refused to attach the .exe blob',
				color: 'red',
			},
		],
	},
	{
		id: 'upload-50mb',
		label: 'Upload 50MB photo',
		description: 'User tries to upload an oversized file',
		method: 'POST',
		path: '/api/users/1/avatar',
		actor: 'seller',
		expectedResult: 'blocked',
		responseLines: [
			{ text: '422 Unprocessable Entity', color: 'red' },
			{ text: '{ error: { code: "FILE_TOO_LARGE" } }', color: 'yellow' },
			{
				text: 'File reached S3, but UploadAvatar refused to attach 50MB (limit: 10MB)',
				color: 'red',
			},
		],
	},
];

// ──────────────────────────────────────────────
// Code preview files
// ──────────────────────────────────────────────

// Build phase code preview: `completedStep` is the index of the last
// completed step (-1 means none completed yet). This ensures the right
// panel shows the RESULT of previous steps (context), never the answer
// for the step the player is currently solving.
function getCodeFiles(phase: Phase, completedStep: number) {
	if (phase === 'observe') {
		return [
			{
				filename: 'app/services/upload_avatar.rb',
				language: 'ruby',
				code: `# No Active Storage. Manual file handling.
class UploadAvatar < ApplicationService
  Result = Data.define(:success?, :user, :errors)

  def initialize(user_id:, file:)
    @user_id = user_id
    @file = file  # Entire file in memory!
  end

  def call
    user = User.find(@user_id)
    path = Rails.root.join(
      "storage/avatars/#{user.id}.jpg")
    File.binwrite(path, @file.read)  # 5MB in memory!
    user.update!(avatar_path: path.to_s)
    Result.new(success?: true, user:, errors: [])
  end
end`,
			},
			{
				filename: 'app/controllers/api/avatars_controller.rb',
				language: 'ruby',
				code: `class Api::AvatarsController < ApplicationController
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
    send_file user.avatar_path  # Blocks worker!
    # No variants, no CDN, no blob tracking
  end
end`,
			},
		];
	}

	if (phase === 'build') {
		// completedStep < 0: nothing completed yet
		if (completedStep < 0) {
			return [
				{
					filename: 'app/services/upload_avatar.rb',
					language: 'ruby',
					code: `# No Active Storage yet. Manual file handling.
# Files saved directly to disk, no blob tracking.
# No variants, no direct upload, no CDN.

class UploadAvatar < ApplicationService
  Result = Data.define(:success?, :user, :errors)
  # ...
  def call
    # 5MB buffered in Rails memory, saved to disk
    File.binwrite(path, @file.read)
  end
end`,
				},
			];
		}
		// completedStep 0: installed Active Storage, show migration file
		if (completedStep <= 0) {
			return [
				{
					filename:
						'db/migrate/..._create_active_storage_tables.active_storage.rb',
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
		// completedStep 1: ran migrations, show tables created + storage hint
		if (completedStep <= 1) {
			return [
				{
					filename: 'db/schema.rb',
					language: 'ruby',
					code: `# Active Storage tables created
create_table "active_storage_blobs" do |t|
  t.string   "key",          null: false
  t.string   "filename",     null: false
  t.string   "content_type"
  t.text     "metadata"
  t.string   "service_name", null: false
  t.bigint   "byte_size",    null: false
  t.string   "checksum"
  t.datetime "created_at",   null: false
end

create_table "active_storage_attachments" do |t|
  t.string   "name",     null: false
  t.string   "record_type", null: false
  t.bigint   "record_id",   null: false
  t.bigint   "blob_id",     null: false
  t.datetime "created_at",  null: false
end

create_table "active_storage_variant_records" do |t|
  t.bigint "blob_id",          null: false
  t.string "variation_digest", null: false
end`,
				},
				{
					filename: 'config/storage.yml',
					language: 'yaml',
					code: `# Active Storage needs a storage service.
# Configure one for production use.
#
# Options: Disk, S3, GCS, AzureStorage
# See: guides.rubyonrails.org/active_storage_overview.html`,
				},
			];
		}
		// completedStep 2: configured S3, show storage config
		if (completedStep <= 2) {
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
				{
					filename: 'app/models/user.rb',
					language: 'ruby',
					code: `class User < ApplicationRecord
  has_secure_password
  encrypts :email, deterministic: true
  encrypts :phone
  encrypts :address

  # No file attachments yet.
  # Active Storage is installed, S3 is configured.
  # Next: attach files to models.
end`,
				},
			];
		}
		// completedStep 3: added model attachment with variants
		if (completedStep <= 3) {
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
		// completedStep 4: built upload service with contract
		if (completedStep <= 4) {
			return [
				{
					filename: 'app/services/upload_avatar.rb',
					language: 'ruby',
					code: `class UploadAvatar < ApplicationService
  InvalidUpload = Class.new(StandardError)
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
  rescue InvalidUpload => e
    Result.new(success?: false, user: nil,
      errors: [e.message])
  end

  private

  ALLOWED = %w[image/jpeg image/png image/webp].freeze
  MAX_BYTES = 10.megabytes

  def validate_content_type!(blob)
    return if ALLOWED.include?(blob.content_type)
    raise InvalidUpload, "content type not allowed"
  end

  def validate_file_size!(blob)
    return if blob.byte_size <= MAX_BYTES
    raise InvalidUpload, "file exceeds 10MB"
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
		// completedStep 5: all steps done
		return [
			{
				filename: 'app/controllers/api/direct_uploads_controller.rb',
				language: 'ruby',
				code: `class Api::DirectUploadsController < ApplicationController
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
  InvalidUpload = Class.new(StandardError)
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
  rescue InvalidUpload => e
    Result.new(success?: false, user: nil,
      errors: [e.message])
  end

  private

  ALLOWED = %w[image/jpeg image/png image/webp].freeze
  MAX_BYTES = 10.megabytes

  def validate_content_type!(blob)
    return if ALLOWED.include?(blob.content_type)
    raise InvalidUpload, "content type not allowed"
  end

  def validate_file_size!(blob)
    return if blob.byte_size <= MAX_BYTES
    raise InvalidUpload, "file exceeds 10MB"
  end
end`,
			},
		];
	}

	// reward
	return [
		{
			filename: 'app/controllers/api/direct_uploads_controller.rb',
			language: 'ruby',
			code: `class Api::DirectUploadsController < ApplicationController
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
  InvalidUpload = Class.new(StandardError)
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
  rescue InvalidUpload => e
    Result.new(success?: false, user: nil,
      errors: [e.message])
  end

  private

  ALLOWED = %w[image/jpeg image/png image/webp].freeze
  MAX_BYTES = 10.megabytes

  def validate_content_type!(blob)
    return if ALLOWED.include?(blob.content_type)
    raise InvalidUpload, "content type not allowed"
  end

  def validate_file_size!(blob)
    return if blob.byte_size <= MAX_BYTES
    raise InvalidUpload, "file exceeds 10MB"
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
// Zone visualization styles
// ──────────────────────────────────────────────

const DEFAULT_ZONE: ZoneState = { label: '', flash: 'idle' };
const DEFAULT_CONN: ConnectorVizState = {
	active: false,
	reverse: false,
	label: '',
	dotColor: 'bg-muted-foreground',
};
const DEFAULT_MEMORY = 45;

function MemoryGauge({
	current,
	max = 512,
}: {
	current: number;
	max?: number;
}) {
	const pct = Math.min((current / max) * 100, 100);
	const isHigh = current > 80;
	return (
		<div className="mt-2 w-full">
			<div className="flex justify-between text-xs font-mono mb-0.5">
				<span
					className={
						isHigh ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
					}
				>
					{current}MB
				</span>
				<span className="text-muted-foreground">/ {max}MB</span>
			</div>
			<div className="h-1.5 bg-muted rounded-full overflow-hidden">
				<div
					className={cn(
						'h-full rounded-full transition-all duration-500',
						isHigh
							? 'bg-red-500 dark:bg-red-400'
							: 'bg-emerald-500 dark:bg-emerald-400',
					)}
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}

// ──────────────────────────────────────────────
// React Flow: custom zone node (using shared FlowNode)
// ──────────────────────────────────────────────

function flashToStatus(flash: ZoneFlash): FlowNodeData['status'] {
	if (flash === 'green') return 'active';
	if (flash === 'amber' || flash === 'blue') return 'warning';
	if (flash === 'red') return 'error';
	return 'idle';
}

interface ZoneNodeData {
	zone: 'client' | 'app' | 's3';
	zoneState: ZoneState;
	memoryMB?: number;
	showDisk?: boolean;
	[key: string]: unknown;
}

const ZONE_META: Record<
	string,
	{ label: string; icon: string; color: string }
> = {
	client: { label: 'Client', icon: 'CL', color: '#3b82f6' },
	app: { label: 'App Server', icon: 'AS', color: '#6366f1' },
	s3: { label: 'S3 Storage', icon: 'S3', color: '#f59e0b' },
};

const ZoneNode = memo(function ZoneNode({ data }: { data: ZoneNodeData }) {
	const { zoneState } = data;
	const meta = ZONE_META[data.zone];
	const flowData: FlowNodeData = {
		label: meta.label,
		icon: meta.icon,
		color: meta.color,
		description: zoneState.label || undefined,
		status: flashToStatus(zoneState.flash),
		showTarget: false,
		showSource: false,
	};

	return (
		<FlowNode data={flowData}>
			<FlowHandles />
			{data.memoryMB !== undefined && <MemoryGauge current={data.memoryMB} />}
			{data.showDisk && (
				<div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
					<HardDrive className="w-3.5 h-3.5" />
					<span className="font-mono">Local Disk</span>
				</div>
			)}
		</FlowNode>
	);
});

// ──────────────────────────────────────────────
// React Flow: custom animated edge
// ──────────────────────────────────────────────

interface UploadEdgeData {
	active: boolean;
	reverse: boolean;
	label: string;
	dotColor: string;
	isDirect?: boolean; // Client <-> S3 arc
	[key: string]: unknown;
}

function toDotFill(dotColor: string): string {
	if (dotColor.includes('emerald')) return '#10b981';
	if (dotColor.includes('red')) return '#ef4444';
	return '#a1a1aa';
}

const UploadEdge = memo(function UploadEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition: _sourcePosition,
	targetPosition: _targetPosition,
	data,
}: EdgeProps) {
	const edgeData = data as UploadEdgeData;
	const { active, reverse, label, dotColor, isDirect } = edgeData;
	const fill = toDotFill(dotColor);

	// Straight line for horizontal edges, custom arc for direct (Client <-> S3)
	let edgePath: string;
	let labelX: number;
	let labelY: number;

	if (isDirect) {
		// Manual quadratic bezier: control point well above the midpoint
		const midX = (sourceX + targetX) / 2;
		const controlY = Math.min(sourceY, targetY) - 140;
		edgePath = `M ${sourceX} ${sourceY} Q ${midX} ${controlY} ${targetX} ${targetY}`;
		labelX = midX;
		labelY = (sourceY + controlY) / 2;
	} else {
		const result = getStraightPath({
			sourceX,
			sourceY,
			targetX,
			targetY,
		});
		edgePath = result[0];
		labelX = result[1];
		labelY = result[2];
	}

	// For reversed animations, reverse the path so dots travel right-to-left
	const dotPath = reverse ? reversePath(edgePath) : edgePath;

	// 3 dots, staggered 0.5s apart
	const dir = reverse ? 'rev' : 'fwd';
	const dots = active
		? [0, 1, 2].map((i) => ({
				id: `${id}-${dir}-d${i}`,
				color: fill,
				r: 5,
				dur: '1.5s',
				begin: `${i === 0 ? '0s' : `-${i * 0.5}s`}`,
			}))
		: [];

	return (
		<>
			{/* Base edge always visible as structural connection */}
			<BaseEdge
				id={id}
				path={edgePath}
				style={{
					stroke: active ? fill : undefined,
					strokeDasharray: isDirect ? '6 4' : undefined,
					strokeOpacity: isDirect ? 0.6 : undefined,
				}}
			/>
			{dots.length > 0 && <AnimatedDots dots={dots} path={dotPath} />}
			{label && (
				<EdgeLabelRenderer>
					<div
						className="nodrag nopan pointer-events-none"
						style={{
							position: 'absolute',
							transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + (isDirect ? -14 : 16)}px)`,
						}}
					>
						<span className="text-xs font-mono text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded">
							{isDirect ? `Direct: ${label}` : label}
						</span>
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
});

// ──────────────────────────────────────────────
// React Flow: type registries (stable references)
// ──────────────────────────────────────────────

const uploadNodeTypes = { zone: ZoneNode };
const uploadEdgeTypes = { upload: UploadEdge };

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function Level34ActiveStorage({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<Phase>('observe');
	const [wrongFeedback, setWrongFeedback] = useState<string | null>(null);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	// Animation state
	const [clientState, setClientState] = useState<ZoneState>(DEFAULT_ZONE);
	const [appState, setAppState] = useState<ZoneState>(DEFAULT_ZONE);
	const [s3State, setS3State] = useState<ZoneState>(DEFAULT_ZONE);
	const [connAState, setConnAState] = useState<ConnectorVizState>(DEFAULT_CONN);
	const [connBState, setConnBState] = useState<ConnectorVizState>(DEFAULT_CONN);
	const [connCState, setConnCState] = useState<ConnectorVizState>(DEFAULT_CONN); // Client <-> S3 direct
	const [memoryMB, setMemoryMB] = useState(DEFAULT_MEMORY);
	const [warningMessage, setWarningMessage] = useState<string | null>(null);
	const [bandwidthLabel, setBandwidthLabel] = useState<string | null>(null);
	const [vizAnimating, setVizAnimating] = useState(false);

	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });
	const stressTest = useStressTest(STRESS_SCENARIOS);

	// ── Animation helpers ──
	const clearTimers = useCallback(() => {
		for (const t of timersRef.current) clearTimeout(t);
		timersRef.current = [];
	}, []);

	const resetViz = useCallback(() => {
		setClientState(DEFAULT_ZONE);
		setAppState(DEFAULT_ZONE);
		setS3State(DEFAULT_ZONE);
		setConnAState(DEFAULT_CONN);
		setConnBState(DEFAULT_CONN);
		setConnCState(DEFAULT_CONN);
		setMemoryMB(DEFAULT_MEMORY);
		setWarningMessage(null);
		setBandwidthLabel(null);
	}, []);

	const applyFrame = useCallback((frame: AnimationFrame) => {
		if (frame.client) setClientState((prev) => ({ ...prev, ...frame.client }));
		if (frame.app) setAppState((prev) => ({ ...prev, ...frame.app }));
		if (frame.s3) setS3State((prev) => ({ ...prev, ...frame.s3 }));
		if (frame.connA) setConnAState((prev) => ({ ...prev, ...frame.connA }));
		if (frame.connB) setConnBState((prev) => ({ ...prev, ...frame.connB }));
		if (frame.connC) setConnCState((prev) => ({ ...prev, ...frame.connC }));
		if (frame.memoryMB !== undefined) setMemoryMB(frame.memoryMB);
		if (frame.warningMessage) setWarningMessage(frame.warningMessage);
		if (frame.bandwidthLabel) setBandwidthLabel(frame.bandwidthLabel);
	}, []);

	const runAnimation = useCallback(
		(frames: AnimationFrame[], onComplete?: () => void) => {
			setVizAnimating(true);
			clearTimers();
			resetViz();

			const step = ANIMATION_DURATION_MS;
			for (let i = 0; i < frames.length; i++) {
				const t = setTimeout(() => applyFrame(frames[i]), step * (i + 1));
				timersRef.current.push(t);
			}

			const tFinal = setTimeout(
				() => {
					setVizAnimating(false);
					onComplete?.();
				},
				step * (frames.length + 1),
			);
			timersRef.current.push(tFinal);
		},
		[clearTimers, resetViz, applyFrame],
	);

	// Clear timers on unmount
	useEffect(() => () => clearTimers(), [clearTimers]);

	const handleStartReward = useCallback(() => {
		setPhase('reward');
		stressTest.reset();
	}, [stressTest]);

	// ── Observe phase: probe handler ──
	const handleProbe = useCallback(
		(probeId: string) => {
			if (vizAnimating) return;

			const discoveries = PROBE_DISCOVERY_MAP[probeId];
			if (discoveries) {
				for (const d of discoveries) discoveryGating.discover(d);
			}

			const frames = PROBE_FRAME_MAP[probeId];
			if (frames) {
				runAnimation(frames);
			}
		},
		[vizAnimating, discoveryGating, runAnimation],
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
			if (vizAnimating) return;
			stressTest.fireRequest(scenarioId);

			const frames = REWARD_FRAMES_MAP[scenarioId] ?? REWARD_UPLOAD_PHOTO;
			runAnimation(frames);
		},
		[vizAnimating, stressTest, runAnimation],
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
		onComplete({ stars: stepper.starRating });
	};

	// ── Render: Upload Pipeline Visualization (React Flow) ──
	// Observe: 2 nodes (Client, App Server with local disk). No S3.
	// Reward: 3 nodes (Client, App Server, S3 Storage). S3 is new.
	const showS3 = phase === 'reward';

	const flowNodes = useMemo((): Node[] => {
		const nodes: Node[] = [
			{
				id: 'client',
				type: 'zone',
				position: { x: 0, y: 100 },
				data: {
					zone: 'client',
					zoneState: clientState,
				} satisfies ZoneNodeData,
			},
			{
				id: 'app',
				type: 'zone',
				position: showS3 ? { x: 320, y: 100 } : { x: 320, y: 100 },
				data: {
					zone: 'app',
					zoneState: appState,
					memoryMB: memoryMB,
					showDisk: !showS3,
				} satisfies ZoneNodeData,
			},
		];
		if (showS3) {
			nodes.push({
				id: 's3',
				type: 'zone',
				position: { x: 640, y: 100 },
				data: {
					zone: 's3',
					zoneState: s3State,
				} satisfies ZoneNodeData,
			});
		}
		return nodes;
	}, [clientState, appState, s3State, memoryMB, showS3]);

	const flowEdges = useMemo((): Edge[] => {
		// Source/target are always fixed (left-to-right structural layout).
		// The `reverse` flag only controls dot animation direction.
		const edges: Edge[] = [
			{
				id: 'e-connA',
				source: 'client',
				target: 'app',
				type: 'upload',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: {
					active: connAState.active,
					reverse: connAState.reverse,
					label: connAState.label,
					dotColor: connAState.dotColor,
				} satisfies UploadEdgeData,
			},
		];
		if (showS3) {
			// Always render connB when S3 is visible so the structural line
			// stays consistent. Dots and label toggle via active/label state.
			edges.push({
				id: 'e-connB',
				source: 'app',
				target: 's3',
				type: 'upload',
				sourceHandle: 'right-source',
				targetHandle: 'left-target',
				data: {
					active: connBState.active,
					reverse: connBState.reverse,
					label: connBState.label,
					dotColor: connBState.dotColor,
				} satisfies UploadEdgeData,
			});
			// Direct arc: Client -> S3 (top handles, curves above App Server)
			edges.push({
				id: 'e-connC',
				source: 'client',
				target: 's3',
				type: 'upload',
				sourceHandle: 'top-source',
				targetHandle: 'top-target',
				data: {
					active: connCState.active,
					reverse: connCState.reverse,
					label: connCState.label,
					dotColor: connCState.dotColor,
					isDirect: true,
				} satisfies UploadEdgeData,
			});
		}
		return edges;
	}, [showS3, connAState, connBState, connCState]);

	const renderUploadPipeline = () => {
		return (
			<div className="flex-1 flex flex-col min-h-0">
				<div className="flex-1 relative">
					<FlowDiagram
						edges={flowEdges}
						edgeTypes={uploadEdgeTypes}
						nodes={flowNodes}
						nodeTypes={uploadNodeTypes}
					/>
				</div>

				{/* Bandwidth / warning bar */}
				{(bandwidthLabel || warningMessage) && (
					<div className="px-6 py-2 space-y-1">
						{bandwidthLabel && (
							<div className="text-xs font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 animate-in fade-in duration-300">
								Bandwidth: {bandwidthLabel}
							</div>
						)}
						{warningMessage && (
							<div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 animate-in fade-in duration-300">
								{warningMessage}
							</div>
						)}
					</div>
				)}
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
					<div className="p-4 border-t border-border space-y-4">
						<div>
							<h3 className="text-sm font-semibold text-foreground mb-2">
								Scenario
							</h3>
							<p className="text-sm text-muted-foreground">
								Users upload 5MB profile photos through the Rails app server.
								Memory spikes on every upload. Avatar downloads block workers.
								No thumbnails exist.
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
							steps={stepper.steps}
						/>
					</div>
				</InstructionPanel>
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
				<div className="flex-1 flex flex-col min-h-0">
					{renderUploadPipeline()}

					<div className="px-6 pb-4">
						<ProbeTerminal
							disabled={vizAnimating}
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

					{stepper.isCurrentStepCompleted && (
						<div className="mt-4 flex justify-end">
							<Button
								onClick={
									currentStep < STEP_DEFS.length - 1
										? stepper.nextStep
										: handleStartReward
								}
								variant="outline"
							>
								Next Step
								<ArrowRight className="w-4 h-4 ml-2" />
							</Button>
						</div>
					)}
				</div>
			);
		}

		// reward
		return (
			<div className="flex-1 flex flex-col">
				{renderUploadPipeline()}

				<div className="px-6 pb-4">
					<StressTestPanel
						allowedCount={stressTest.allowedCount}
						blockedCount={stressTest.blockedCount}
						canAutoFire={stressTest.canAutoFire}
						disabled={vizAnimating}
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
						setVizAnimating(false);
						resetViz();
						clearTimers();
						setWrongFeedback(null);
					}}
					onValidate={handleValidate}
				/>
				{renderCenterPanel()}
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(
						phase,
						phase === 'build'
							? stepper.isCurrentStepCompleted
								? stepper.currentStep
								: stepper.currentStep - 1
							: stepper.furthestStep,
					)}
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

export default Level34ActiveStorage;
