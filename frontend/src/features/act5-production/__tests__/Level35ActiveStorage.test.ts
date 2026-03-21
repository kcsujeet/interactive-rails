/**
 * Level 35: Active Storage - Data Consistency Tests
 *
 * Tests mirror the data structures from the component to verify:
 * - Discovery definitions are complete and correctly mapped
 * - Probe definitions have proper response lines
 * - Build step quality (correct answer position, feedback quality)
 * - Stress test scenario coverage and consistency
 * - Cross-phase consistency (probe labels match stress test labels)
 * - Cumulative pattern compliance (service objects, contracts, error handling)
 */

import { describe, expect, test } from 'bun:test';

// ── Mirror data from component ──

const DISCOVERY_DEFS = [
	{ id: 'memory-spike', label: 'File buffers in app server RAM' },
	{ id: 'no-variants', label: 'No thumbnails, serving 5MB originals' },
	{ id: 'serving-through-rails', label: 'Downloads block Rails workers' },
	{ id: 'no-direct-upload', label: 'No presigned URL, all traffic through app' },
];

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'upload-photo': ['memory-spike', 'no-direct-upload'],
	'request-avatar': ['serving-through-rails'],
	'list-avatars': ['no-variants'],
};

const PROBES = [
	{
		id: 'upload-photo',
		label: 'Upload 5MB profile photo',
		command: 'curl -X POST /api/v1/users/1/avatar -F "file=@photo.jpg"',
		responseLines: [
			{ text: 'Uploading 5MB through Rails process...', color: 'yellow' },
			{ text: 'Memory: 45MB -> 95MB (+50MB buffering file!)', color: 'red' },
			{ text: '10 concurrent uploads = 500MB memory spike', color: 'red' },
			{ text: 'No presigned URL configured. File routes through app.', color: 'red' },
		],
	},
	{
		id: 'request-avatar',
		label: 'Download user avatar',
		command: 'curl GET /api/v1/users/1/avatar',
		responseLines: [
			{ text: 'send_file user.avatar_path', color: 'yellow' },
			{ text: 'Entire 5MB read from disk, streamed to client', color: 'red' },
			{ text: 'Rails worker blocked for 3 seconds during download!', color: 'red' },
			{ text: 'No CDN or redirect configured.', color: 'red' },
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
			{ text: 'No thumbnail variant defined. Wasting bandwidth.', color: 'red' },
		],
	},
];

const STEP_DEFS = [
	{ id: 'install-storage', title: 'Install Active Storage' },
	{ id: 'run-migration', title: 'Run Migrations' },
	{ id: 'configure-s3', title: 'Configure Storage Service' },
	{ id: 'model-attachment', title: 'Add Model Attachment' },
	{ id: 'build-service', title: 'Build Upload Service' },
	{ id: 'direct-upload', title: 'Create Upload Endpoint' },
];

const INSTALL_COMMANDS = [
	{ id: 'wrong-gem', label: 'bundle add activestorage', correct: false, feedback: 'Active Storage is included in Rails by default. It needs to be installed via the Rails generator, not added as a separate gem.' },
	{ id: 'correct-install', label: 'bin/rails active_storage:install', correct: true },
	{ id: 'wrong-generate', label: 'rails generate storage', correct: false, feedback: 'There is no "storage" generator. Active Storage has its own install command that creates the necessary migration files.' },
];

const MIGRATE_COMMANDS = [
	{ id: 'wrong-setup', label: 'rails db:setup', correct: false, feedback: 'db:setup drops and recreates the database. You only need to run the pending Active Storage migration.' },
	{ id: 'correct-migrate', label: 'rails db:migrate', correct: true },
	{ id: 'wrong-seed', label: 'rails db:seed', correct: false, feedback: 'db:seed populates data, not schema. The Active Storage tables need to be created first via migration.' },
];

const STORAGE_OPTIONS = [
	{ id: 'wrong-local', correct: false, feedback: 'Disk storage keeps files on the Rails server. Files are lost on deploy, cannot be shared across workers, and there is no CDN or direct upload support.' },
	{ id: 'correct-s3', correct: true },
	{ id: 'wrong-hardcoded', correct: false, feedback: 'Hardcoded credentials in YAML files get committed to version control. Use Rails credentials or environment variables to keep secrets out of the repository.' },
];

const ATTACHMENT_OPTIONS = [
	{ id: 'wrong-no-variants', correct: false, feedback: 'Without named variants, every avatar request downloads the full 5MB original. Named variants define pre-set transforms (thumbnail, medium) that are generated on first access.' },
	{ id: 'wrong-has-many', correct: false, feedback: 'has_many_attached is for multiple files (photos gallery, documents). A user has one avatar, so use has_one_attached.' },
	{ id: 'correct-with-variants', correct: true },
];

const SERVICE_OPTIONS = [
	{ id: 'wrong-no-contract', correct: false, feedback: 'Missing input validation via contract. Services must validate input through a Dry::Validation::Contract before executing business logic.' },
	{ id: 'correct-with-contract', correct: true },
];

const DIRECT_UPLOAD_OPTIONS = [
	{ id: 'wrong-through-rails', correct: false, feedback: 'This sends the file through Rails (params[:file]). Direct upload uses a two-step process: Rails provides a presigned URL, then the client uploads directly to S3.' },
	{ id: 'correct-presigned', correct: true },
	{ id: 'wrong-manual-s3', correct: false, feedback: "Building presigned URLs manually bypasses Active Storage entirely. Rails cannot track the blob, attach it to models, or generate variants. Use Active Storage's built-in direct upload support." },
];

const STRESS_SCENARIOS = [
	{ id: 'upload-photo', label: 'Upload 5MB photo', expectedResult: 'allowed' as const },
	{ id: 'upload-10-photos', label: '10 sellers upload photos', expectedResult: 'allowed' as const },
	{ id: 'view-profile', label: 'View profile photo', expectedResult: 'allowed' as const },
	{ id: 'upload-exe', label: 'Upload .exe file', expectedResult: 'blocked' as const },
	{ id: 'upload-50mb', label: 'Upload 50MB photo', expectedResult: 'blocked' as const },
];

// ── Observe probe animation frames (mirrored from component) ──
// Observe phase: 2 zones only (Client + App Server with local disk). No S3.

interface AnimationFrame {
	client?: { label?: string; flash?: string };
	connA?: { active?: boolean; reverse?: boolean; label?: string; dotColor?: string };
	app?: { label?: string; flash?: string };
	connB?: { active?: boolean; reverse?: boolean; label?: string; dotColor?: string };
	s3?: { label?: string; flash?: string };
	memoryMB?: number;
	warningMessage?: string;
	bandwidthLabel?: string;
}

const UPLOAD_PROBE_FRAMES: AnimationFrame[] = [
	{ client: { label: 'Uploading...', flash: 'blue' }, connA: { active: true, reverse: false, label: '5MB file data', dotColor: 'bg-red-500 dark:bg-red-400' } },
	{ client: { label: '', flash: 'idle' }, connA: { active: false, label: '' }, app: { label: 'Buffering 5MB...', flash: 'red' }, memoryMB: 95 },
	{ app: { label: 'File.binwrite to disk...', flash: 'amber' } },
	{ app: { label: 'Saved to local disk', flash: 'amber' }, warningMessage: 'The entire 5MB file was buffered in Rails process memory. 10 concurrent uploads = 500MB memory spike. Files saved to local disk (lost on deploy, no CDN).' },
];

const DOWNLOAD_PROBE_FRAMES: AnimationFrame[] = [
	{ client: { label: 'Requesting avatar...', flash: 'blue' }, app: { label: 'send_file avatar_path', flash: 'amber' } },
	{ app: { label: 'Reading 5MB from disk...', flash: 'red' }, memoryMB: 95 },
	{ connA: { active: true, reverse: true, label: '5MB streaming...', dotColor: 'bg-red-500 dark:bg-red-400' }, app: { label: 'Worker BLOCKED 3s', flash: 'red' } },
	{ connA: { active: false, label: '' }, client: { label: 'Received 5MB original', flash: 'amber' }, app: { label: 'Worker freed', flash: 'amber' }, warningMessage: 'Rails read the entire 5MB from disk and streamed it to the client. The worker was blocked for 3 seconds. No CDN or redirect configured.' },
];

const LIST_PROBE_FRAMES: AnimationFrame[] = [
	{ client: { label: 'GET /users?per_page=25', flash: 'blue' }, app: { label: 'Rendering 25 users...', flash: 'amber' } },
	{ app: { label: 'User 1: 5MB from disk', flash: 'amber' }, bandwidthLabel: '5MB' },
	{ app: { label: 'User 2: 5MB from disk', flash: 'amber' }, bandwidthLabel: '10MB' },
	{ app: { label: '...x25 users, no variants!', flash: 'red' }, bandwidthLabel: '125MB (should be 375KB with variants)', warningMessage: 'Each avatar is the 5MB original from local disk. No thumbnail variant defined. 25 users x 5MB = 125MB downloaded by the client. With a :thumb variant, that would be 25 x 15KB = 375KB.' },
];

const ALL_OBSERVE_PROBE_FRAMES = [
	{ name: 'upload', frames: UPLOAD_PROBE_FRAMES },
	{ name: 'download', frames: DOWNLOAD_PROBE_FRAMES },
	{ name: 'list', frames: LIST_PROBE_FRAMES },
];

// ── Code preview content per completed step (mirrored from getCodeFiles) ──
// completedStep = -1 means nothing completed (working on step 0)
// completedStep = N means step N was just completed

// Correct answer snippets for each OptionCard step (steps 2-5)
// These strings MUST NOT appear in the code preview while working on that step
const STEP_CORRECT_ANSWER_SIGNATURES: Record<number, string[]> = {
	// Step 2: Configure S3 - correct answer has credentials.dig
	2: ['Rails.application.credentials', 'service: S3', 'bucket: myapp-production'],
	// Step 3: Model attachment - correct answer has has_one_attached with variants
	3: ['has_one_attached :avatar', 'attachable.variant :thumb', 'attachable.variant :medium'],
	// Step 4: Build service - correct answer has contract validation
	4: ['AvatarUploadContract.new.call', 'validate_content_type!(blob)', 'validate_file_size!(blob)'],
	// Step 5: Direct upload endpoint - correct answer has create_before_direct_upload!
	5: ['create_before_direct_upload!', 'service_url_for_direct_upload', 'service_headers_for_direct_upload'],
};

// Code preview content for each completedStep value
// We mirror the filenames + key content identifiers (not full code)
const CODE_PREVIEW_FILES: Record<number, { filename: string; containsSnippet: string }[]> = {
	[-1]: [{ filename: 'app/services/upload_avatar.rb', containsSnippet: 'No Active Storage yet' }],
	0: [{ filename: 'db/migrate/..._create_active_storage_tables.rb', containsSnippet: 'create_table :active_storage_blobs' }],
	1: [
		{ filename: 'db/schema.rb', containsSnippet: 'active_storage_blobs' },
		{ filename: 'config/storage.yml', containsSnippet: 'Active Storage needs a storage service' },
	],
	2: [
		{ filename: 'config/storage.yml', containsSnippet: 'service: S3' },
		{ filename: 'app/models/user.rb', containsSnippet: 'No file attachments yet' },
	],
	3: [
		{ filename: 'app/models/user.rb', containsSnippet: 'has_one_attached :avatar' },
		{ filename: 'config/storage.yml', containsSnippet: 'service: S3' },
	],
	4: [
		{ filename: 'app/services/upload_avatar.rb', containsSnippet: 'AvatarUploadContract' },
		{ filename: 'app/contracts/avatar_upload_contract.rb', containsSnippet: 'Dry::Validation::Contract' },
	],
	5: [
		{ filename: 'app/controllers/api/v1/direct_uploads_controller.rb', containsSnippet: 'create_before_direct_upload!' },
		{ filename: 'app/services/upload_avatar.rb', containsSnippet: 'AvatarUploadContract' },
	],
};

// ── Tests ──

describe('Level 35: Active Storage', () => {
	describe('Discovery definitions', () => {
		test('has exactly 4 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(4);
		});

		test('all discovery IDs are unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all discovery labels are unique', () => {
			const labels = DISCOVERY_DEFS.map((d) => d.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('every discovery is reachable via probes', () => {
			const probeDiscoveries = new Set(Object.values(PROBE_DISCOVERY_MAP).flat());
			for (const def of DISCOVERY_DEFS) {
				expect(probeDiscoveries.has(def.id)).toBe(true);
			}
		});

		test('probe discovery map only references valid probe IDs', () => {
			const probeIds = new Set(PROBES.map((p) => p.id));
			for (const key of Object.keys(PROBE_DISCOVERY_MAP)) {
				expect(probeIds.has(key)).toBe(true);
			}
		});

		test('probe discovery map only references valid discovery IDs', () => {
			const discoveryIds = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const discoveries of Object.values(PROBE_DISCOVERY_MAP)) {
				for (const id of discoveries) {
					expect(discoveryIds.has(id)).toBe(true);
				}
			}
		});
	});

	describe('Probes', () => {
		test('has exactly 3 probes', () => {
			expect(PROBES).toHaveLength(3);
		});

		test('all probe IDs are unique', () => {
			const ids = PROBES.map((p) => p.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('every probe has response lines', () => {
			for (const probe of PROBES) {
				expect(probe.responseLines.length).toBeGreaterThan(0);
			}
		});

		test('every probe has a command', () => {
			for (const probe of PROBES) {
				expect(probe.command.length).toBeGreaterThan(0);
			}
		});

		test('every probe response line has a color', () => {
			for (const probe of PROBES) {
				for (const line of probe.responseLines) {
					expect(line.color).toBeDefined();
				}
			}
		});

		test('upload probe shows memory spike', () => {
			const probe = PROBES.find((p) => p.id === 'upload-photo');
			const texts = probe?.responseLines.map((l) => l.text).join(' ') ?? '';
			expect(texts).toContain('Memory');
			expect(texts).toContain('5MB');
		});

		test('download probe shows worker blocking', () => {
			const probe = PROBES.find((p) => p.id === 'request-avatar');
			const texts = probe?.responseLines.map((l) => l.text).join(' ') ?? '';
			expect(texts).toContain('worker blocked');
		});
	});

	describe('Build step quality', () => {
		test('has exactly 6 build steps', () => {
			expect(STEP_DEFS).toHaveLength(6);
		});

		test('all step IDs are unique', () => {
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('step titles do not reveal specific API names', () => {
			for (const step of STEP_DEFS) {
				expect(step.title).not.toContain('has_one_attached');
				expect(step.title).not.toContain('S3');
				expect(step.title).not.toContain('presigned');
				expect(step.title).not.toContain('active_storage:install');
			}
		});

		test('correct install command is never first', () => {
			const correctIdx = INSTALL_COMMANDS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct migrate command is never first', () => {
			const correctIdx = MIGRATE_COMMANDS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct storage option is never first', () => {
			const correctIdx = STORAGE_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct attachment option is never first', () => {
			const correctIdx = ATTACHMENT_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct service option is never first', () => {
			const correctIdx = SERVICE_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('correct direct upload option is never first', () => {
			const correctIdx = DIRECT_UPLOAD_OPTIONS.findIndex((c) => c.correct);
			expect(correctIdx).toBeGreaterThan(0);
		});

		test('each step has exactly one correct answer', () => {
			const allStepOptions = [
				INSTALL_COMMANDS,
				MIGRATE_COMMANDS,
				STORAGE_OPTIONS,
				ATTACHMENT_OPTIONS,
				SERVICE_OPTIONS,
				DIRECT_UPLOAD_OPTIONS,
			];
			for (const options of allStepOptions) {
				const correctCount = options.filter((o) => o.correct).length;
				expect(correctCount).toBe(1);
			}
		});

		test('every wrong option has feedback', () => {
			const allStepOptions = [
				INSTALL_COMMANDS,
				MIGRATE_COMMANDS,
				STORAGE_OPTIONS,
				ATTACHMENT_OPTIONS,
				SERVICE_OPTIONS,
				DIRECT_UPLOAD_OPTIONS,
			];
			for (const options of allStepOptions) {
				for (const opt of options) {
					if (!opt.correct) {
						expect(opt.feedback).toBeDefined();
						expect(opt.feedback?.length).toBeGreaterThan(0);
					}
				}
			}
		});

		test('feedback never reveals the correct answer', () => {
			const allWrongOptions = [
				...INSTALL_COMMANDS.filter((o) => !o.correct),
				...MIGRATE_COMMANDS.filter((o) => !o.correct),
				...STORAGE_OPTIONS.filter((o) => !o.correct),
				...ATTACHMENT_OPTIONS.filter((o) => !o.correct),
				...SERVICE_OPTIONS.filter((o) => !o.correct),
				...DIRECT_UPLOAD_OPTIONS.filter((o) => !o.correct),
			];
			for (const opt of allWrongOptions) {
				const fb = opt.feedback?.toLowerCase() ?? '';
				expect(fb).not.toContain('active_storage:install');
				expect(fb).not.toContain('rails db:migrate');
				expect(fb).not.toContain('blob.service_url_for_direct_upload');
			}
		});

		test('db:migrate step follows install step (step ordering)', () => {
			const installIdx = STEP_DEFS.findIndex((s) => s.id === 'install-storage');
			const migrateIdx = STEP_DEFS.findIndex((s) => s.id === 'run-migration');
			expect(migrateIdx).toBe(installIdx + 1);
		});

		test('terminal steps are 0 and 1, option steps are 2-5', () => {
			expect(STEP_DEFS[0].id).toBe('install-storage');
			expect(STEP_DEFS[1].id).toBe('run-migration');
			expect(STEP_DEFS[2].id).toBe('configure-s3');
			expect(STEP_DEFS[3].id).toBe('model-attachment');
			expect(STEP_DEFS[4].id).toBe('build-service');
			expect(STEP_DEFS[5].id).toBe('direct-upload');
		});
	});

	describe('Stress test scenarios', () => {
		test('has 5 scenarios', () => {
			expect(STRESS_SCENARIOS).toHaveLength(5);
		});

		test('all scenario IDs are unique', () => {
			const ids = STRESS_SCENARIOS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('all scenario labels are unique', () => {
			const labels = STRESS_SCENARIOS.map((s) => s.label);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('has mix of allowed and blocked results', () => {
			const allowed = STRESS_SCENARIOS.filter((s) => s.expectedResult === 'allowed');
			const blocked = STRESS_SCENARIOS.filter((s) => s.expectedResult === 'blocked');
			expect(allowed.length).toBeGreaterThan(0);
			expect(blocked.length).toBeGreaterThan(0);
		});

		test('has 3 allowed and 2 blocked scenarios', () => {
			const allowed = STRESS_SCENARIOS.filter((s) => s.expectedResult === 'allowed');
			const blocked = STRESS_SCENARIOS.filter((s) => s.expectedResult === 'blocked');
			expect(allowed).toHaveLength(3);
			expect(blocked).toHaveLength(2);
		});

		test('includes photo upload scenario (full user flow)', () => {
			const upload = STRESS_SCENARIOS.find((s) => s.id === 'upload-photo');
			expect(upload).toBeDefined();
			expect(upload?.expectedResult).toBe('allowed');
		});

		test('includes concurrent uploads scenario', () => {
			const concurrent = STRESS_SCENARIOS.find((s) => s.id === 'upload-10-photos');
			expect(concurrent).toBeDefined();
			expect(concurrent?.expectedResult).toBe('allowed');
		});

		test('includes profile view with variant scenario', () => {
			const view = STRESS_SCENARIOS.find((s) => s.id === 'view-profile');
			expect(view).toBeDefined();
			expect(view?.expectedResult).toBe('allowed');
		});

		test('includes content type validation (blocked)', () => {
			const exe = STRESS_SCENARIOS.find((s) => s.id === 'upload-exe');
			expect(exe).toBeDefined();
			expect(exe?.expectedResult).toBe('blocked');
		});

		test('includes file size validation (blocked)', () => {
			const oversized = STRESS_SCENARIOS.find((s) => s.id === 'upload-50mb');
			expect(oversized).toBeDefined();
			expect(oversized?.expectedResult).toBe('blocked');
		});
	});

	describe('Cross-phase consistency', () => {
		test('probe discoveries cover all discovery definitions', () => {
			const probeDiscoveryIds = new Set(Object.values(PROBE_DISCOVERY_MAP).flat());
			for (const def of DISCOVERY_DEFS) {
				expect(probeDiscoveryIds.has(def.id)).toBe(true);
			}
		});

		test('probe and stress test button labels use consistent format', () => {
			for (const probe of PROBES) {
				expect(probe.label.length).toBeLessThan(60);
			}
			for (const scenario of STRESS_SCENARIOS) {
				expect(scenario.label.length).toBeLessThan(60);
			}
		});

		test('reward scenarios address all observe problems', () => {
			// Memory spike -> upload photo (direct upload, no memory spike)
			const upload = STRESS_SCENARIOS.find((s) => s.id === 'upload-photo');
			expect(upload).toBeDefined();
			// No variants -> view profile (lazy variant generation + CDN)
			const view = STRESS_SCENARIOS.find((s) => s.id === 'view-profile');
			expect(view).toBeDefined();
			// Concurrent memory spikes -> 10 sellers upload (zero buffering)
			const concurrent = STRESS_SCENARIOS.find((s) => s.id === 'upload-10-photos');
			expect(concurrent).toBeDefined();
		});
	});

	describe('Cumulative pattern compliance', () => {
		test('service option uses contract validation', () => {
			const correct = SERVICE_OPTIONS.find((o) => o.correct);
			expect(correct?.id).toBe('correct-with-contract');
		});

		test('wrong service option explains contract requirement', () => {
			const noContract = SERVICE_OPTIONS.find((o) => o.id === 'wrong-no-contract');
			expect(noContract?.feedback).toContain('contract');
			expect(noContract?.feedback).toContain('Dry::Validation::Contract');
		});

		test('direct upload wrong option explains why file-through-rails is bad', () => {
			const throughRails = DIRECT_UPLOAD_OPTIONS.find((o) => o.id === 'wrong-through-rails');
			expect(throughRails?.feedback).toContain('presigned URL');
		});

		test('storage wrong option explains credentials security', () => {
			const hardcoded = STORAGE_OPTIONS.find((o) => o.id === 'wrong-hardcoded');
			expect(hardcoded?.feedback).toContain('credentials');
		});
	});

	describe('Data consistency', () => {
		test('minRequired (4) matches total discoveries', () => {
			expect(DISCOVERY_DEFS.length).toBe(4);
		});

		test('all option step arrays have at least 2 options', () => {
			expect(STORAGE_OPTIONS.length).toBeGreaterThanOrEqual(2);
			expect(ATTACHMENT_OPTIONS.length).toBeGreaterThanOrEqual(2);
			expect(SERVICE_OPTIONS.length).toBeGreaterThanOrEqual(2);
			expect(DIRECT_UPLOAD_OPTIONS.length).toBeGreaterThanOrEqual(2);
		});

		test('step progression follows logical order', () => {
			const stepIds = STEP_DEFS.map((s) => s.id);
			// Install before migrate
			expect(stepIds.indexOf('install-storage')).toBeLessThan(stepIds.indexOf('run-migration'));
			// Configure before model
			expect(stepIds.indexOf('configure-s3')).toBeLessThan(stepIds.indexOf('model-attachment'));
			// Model before service
			expect(stepIds.indexOf('model-attachment')).toBeLessThan(stepIds.indexOf('build-service'));
			// Service before direct upload endpoint
			expect(stepIds.indexOf('build-service')).toBeLessThan(stepIds.indexOf('direct-upload'));
		});
	});

	describe('Observe probe frames: narrative consistency (no S3 in before state)', () => {
		for (const { name, frames } of ALL_OBSERVE_PROBE_FRAMES) {
			test(`${name} probe frames have no s3 zone state`, () => {
				for (const frame of frames) {
					expect(frame.s3).toBeUndefined();
				}
			});

			test(`${name} probe frames have no connB (App <-> S3) state`, () => {
				for (const frame of frames) {
					expect(frame.connB).toBeUndefined();
				}
			});
		}

		test('upload probe shows local disk write (not S3 store)', () => {
			const labels = UPLOAD_PROBE_FRAMES.map((f) => f.app?.label ?? '').join(' ');
			expect(labels).toContain('disk');
			expect(labels).not.toContain('S3');
		});

		test('download probe shows reading from disk (not S3)', () => {
			const labels = DOWNLOAD_PROBE_FRAMES.map((f) => f.app?.label ?? '').join(' ');
			expect(labels).toContain('disk');
			expect(labels).not.toContain('S3');
		});

		test('list probe shows disk-based accumulation (not S3)', () => {
			const labels = LIST_PROBE_FRAMES.map((f) => f.app?.label ?? '').join(' ');
			expect(labels).toContain('disk');
			expect(labels).not.toContain('S3');
		});

		test('each observe probe has a warning message in its final frame', () => {
			for (const { name, frames } of ALL_OBSERVE_PROBE_FRAMES) {
				const lastFrame = frames[frames.length - 1];
				expect(lastFrame.warningMessage).toBeDefined();
				expect(lastFrame.warningMessage?.length).toBeGreaterThan(0);
			}
		});
	});

	describe('Code preview does not reveal answers for current step', () => {
		// For each OptionCard step (2-5), verify that the code preview shown
		// while WORKING ON that step does not contain the correct answer.
		// The code preview for "working on step N" = completedStep N-1.
		for (const stepIdx of [2, 3, 4, 5]) {
			test(`step ${stepIdx} (${STEP_DEFS[stepIdx].title}): code preview while working does not reveal the answer`, () => {
				const completedStep = stepIdx - 1;
				const previewFiles = CODE_PREVIEW_FILES[completedStep];
				expect(previewFiles).toBeDefined();

				const answerSignatures = STEP_CORRECT_ANSWER_SIGNATURES[stepIdx];
				expect(answerSignatures).toBeDefined();

				// None of the answer signatures should appear in the code preview
				// shown while working on this step
				for (const file of previewFiles) {
					for (const signature of answerSignatures) {
						expect(file.containsSnippet).not.toContain(signature);
					}
				}
			});
		}

		test('step 2: code preview before answering shows schema + hint, not configured S3', () => {
			// completedStep = 1 (after running migrations, before configuring S3)
			const files = CODE_PREVIEW_FILES[1];
			const filenames = files.map((f) => f.filename);
			expect(filenames).toContain('db/schema.rb');
			expect(filenames).toContain('config/storage.yml');
			// The storage.yml should be a hint, not the configured answer
			const storageFile = files.find((f) => f.filename === 'config/storage.yml');
			expect(storageFile?.containsSnippet).not.toContain('service: S3');
			expect(storageFile?.containsSnippet).not.toContain('bucket');
		});

		test('step 3: code preview before answering shows configured S3, not model with variants', () => {
			// completedStep = 2 (after configuring S3, before adding model attachment)
			const files = CODE_PREVIEW_FILES[2];
			const userFile = files.find((f) => f.filename === 'app/models/user.rb');
			expect(userFile).toBeDefined();
			// user.rb should show "no file attachments yet", not has_one_attached
			expect(userFile?.containsSnippet).toContain('No file attachments yet');
			expect(userFile?.containsSnippet).not.toContain('has_one_attached');
		});

		test('after completing a step, code preview shows the result', () => {
			// completedStep = 3 (after adding model attachment)
			const files = CODE_PREVIEW_FILES[3];
			const userFile = files.find((f) => f.filename === 'app/models/user.rb');
			expect(userFile).toBeDefined();
			expect(userFile?.containsSnippet).toContain('has_one_attached');
		});

		test('every completedStep value (-1 through 5) has non-empty code preview', () => {
			for (let step = -1; step <= 5; step++) {
				const files = CODE_PREVIEW_FILES[step];
				expect(files).toBeDefined();
				expect(files.length).toBeGreaterThan(0);
				for (const file of files) {
					expect(file.filename.length).toBeGreaterThan(0);
					expect(file.containsSnippet.length).toBeGreaterThan(0);
				}
			}
		});
	});
});
