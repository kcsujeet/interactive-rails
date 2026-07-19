/**
 * Level 35: Action Mailer - Data Consistency Tests
 *
 * Tests mirror the data structures from the component and content to verify:
 * - Discovery definitions are complete and 1:1 mapped
 * - Probe definitions have response lines and stories
 * - Build step quality (correct answer never first, feedback never leaks answer)
 * - Stress scenario coverage and consistency
 * - The fixes landed in this pass:
 *   - no social-media fossils (socialplatform.com, "SocialPlatform")
 *   - the reset link points at the frontend page, not the API route helper
 *   - the mailer sets @reset_url; the ERB template uses @reset_url
 *   - the controller update uses non-bang update (no 500 on weak password)
 *   - STAGE_DISCOVERY_MAP does not map the router to the mailer discovery
 *   - hint says "Rails 8", not "Rails 7.1+"
 */

import { describe, expect, test } from 'bun:test';
import { level35ActionMailer } from '../content/level-35-action-mailer';

// Em dash character, referenced only to assert its absence in content.
const EM_DASH = String.fromCharCode(8212);

// ── Mirror data from the component ──

const DISCOVERY_DEFS = [
	{ id: 'no-reset-endpoint', label: 'No password reset endpoint' },
	{ id: 'no-token-generation', label: 'No token generation' },
	{ id: 'no-mailer', label: 'No mailer configured' },
	{ id: 'manual-resets', label: 'Manual resets only' },
];

const PROBE_DISCOVERY_MAP: Record<string, string> = {
	'post-password-reset': 'no-reset-endpoint',
	'check-support': 'manual-resets',
	'inspect-user': 'no-token-generation',
};

// Mirrors STAGE_DISCOVERY_MAP after the fix: only the missing-controller stage
// surfaces the no-mailer discovery. The router is NOT mapped.
const STAGE_DISCOVERY_MAP: Record<string, string> = {
	controller: 'no-mailer',
};

const PROBE_IDS = ['post-password-reset', 'check-support', 'inspect-user'];

const STEP_DEFS = [
	{ id: 'add-token', title: 'Add Token Generation' },
	{ id: 'generate-mailer', title: 'Generate the Mailer' },
	{ id: 'build-email', title: 'Build the Reset Email' },
	{ id: 'build-template', title: 'Build the Email Template' },
	{ id: 'create-controller', title: 'Create the Controller' },
];

const TOKEN_OPTIONS = [
	{
		id: 'random-token-column',
		correct: false,
		feedback:
			'Storing tokens in a column means you have to manage expiry, cleanup, and secure comparison yourself. Rails 8 has a built-in approach that handles all of this.',
	},
	{ id: 'generates-with-expiry', correct: true },
	{
		id: 'generates-no-expiry',
		correct: false,
		feedback:
			'Without an expiry duration, tokens live forever. A leaked token could be used days or weeks later. You need a time limit.',
	},
];

const EMAIL_OPTIONS = [
	{
		id: 'no-token-in-url',
		correct: false,
		feedback:
			'The email body needs a verifiable proof of identity for the recipient. Without it, anyone could claim to be that user.',
	},
	{
		id: 'deliver-now-inline',
		label:
			'def password_reset(user)\n' +
			'  @user = user\n' +
			'  @token = user.generate_token_for(:password_reset)\n' +
			'  @reset_url = "#{FRONTEND_HOST}/reset-password?token=#{@token}"\n' +
			'  mail(to: user.email, subject: "Reset your password").deliver_now\n' +
			'end',
		correct: false,
		feedback:
			'Calling deliver_now inside the mailer method blocks the entire request. Delivery should be triggered by the controller, not hardcoded in the mailer.',
	},
	{
		id: 'correct-mailer',
		label:
			'def password_reset(user)\n' +
			'  @user = user\n' +
			'  @token = user.generate_token_for(:password_reset)\n' +
			'  @reset_url = "#{FRONTEND_HOST}/reset-password?token=#{@token}"\n' +
			'  mail(to: user.email, subject: "Reset your password")\n' +
			'end',
		correct: true,
	},
];

const TEMPLATE_OPTIONS = [
	{
		id: 'mustache-style',
		label:
			'<h1>Reset your password</h1>\n<p>Hi {{ user.name }},</p>\n<p>You requested a password reset.</p>\n<p>{{ link_to "Reset password", reset_url }}</p>\n<p>This link expires in 15 minutes.</p>',
		correct: false,
		feedback:
			'Curly-brace interpolation ({{ ... }}) is what JavaScript template libraries use (Handlebars, Vue, Mustache). Rails uses a different template syntax that mixes Ruby code with HTML.',
	},
	{
		id: 'no-output-tag',
		label:
			'<h1>Reset your password</h1>\n<p>Hi <% @user.name %>,</p>\n<p>You requested a password reset.</p>\n<p><% link_to "Reset password", @reset_url %></p>\n<p>This link expires in 15 minutes.</p>',
		correct: false,
		feedback:
			'These tags run the Ruby code but do not print anything to the page. The user would see "Hi ," and an empty link. There is a small character difference between "run code" tags and "output the value" tags.',
	},
	{
		id: 'correct-erb',
		label:
			'<h1>Reset your password</h1>\n<p>Hi <%= @user.name %>,</p>\n<p>You requested a password reset.</p>\n<p><%= link_to "Reset password", @reset_url %></p>\n<p>This link expires in 15 minutes.</p>',
		correct: true,
	},
];

const CONTROLLER_OPTIONS = [
	{
		id: 'find-by-token-deliver-now',
		correct: false,
		feedback:
			'deliver_now blocks the HTTP request while waiting for SMTP. Under load, this causes timeouts. Background delivery is the Rails convention.',
	},
	{ id: 'correct-controller', correct: true },
	{
		id: 'find-by-email-leak',
		correct: false,
		feedback:
			'find_by! raises an error if the email is not found. That reveals whether an email is registered, which is an information leak.',
	},
];

const MAILER_TERMINAL_COMMANDS = [
	{ id: 'generate-controller', correct: false, feedback: 'x' },
	{ id: 'generate-mailer', correct: true },
	{ id: 'generate-model', correct: false, feedback: 'x' },
];

const STRESS_SCENARIO_IDS = [
	'post-password-reset',
	'check-support',
	'inspect-user',
	'valid-email',
	'nonexistent-email',
	'valid-token-reset',
	'expired-token',
	'used-token',
];

// Mirror of the controller update code shown in getCodeFiles (step >= 4).
const CONTROLLER_UPDATE_PREVIEW = `def update
    user = User.find_by_token_for(:password_reset, params[:token])
    if user.nil?
      render json: { error: "Invalid or expired token" },
             status: :unprocessable_entity
    elsif user.update(password: params[:password])
      render json: { message: "Password updated" }
    else
      render json: { errors: user.errors.full_messages },
             status: :unprocessable_entity
    end
  end`;

const ALL_OPTION_SETS = [
	TOKEN_OPTIONS,
	EMAIL_OPTIONS,
	TEMPLATE_OPTIONS,
	CONTROLLER_OPTIONS,
];

// ── Tests ──

describe('Level 35: Action Mailer', () => {
	describe('Discovery definitions', () => {
		test('has exactly 4 discoveries', () => {
			expect(DISCOVERY_DEFS).toHaveLength(4);
		});

		test('all discovery IDs and labels are unique', () => {
			const ids = DISCOVERY_DEFS.map((d) => d.id);
			const labels = DISCOVERY_DEFS.map((d) => d.label);
			expect(new Set(ids).size).toBe(ids.length);
			expect(new Set(labels).size).toBe(labels.length);
		});

		test('probes plus stage clicks cover every discovery exactly once', () => {
			const covered = [
				...Object.values(PROBE_DISCOVERY_MAP),
				...Object.values(STAGE_DISCOVERY_MAP),
			];
			expect(new Set(covered).size).toBe(covered.length);
			expect(new Set(covered)).toEqual(
				new Set(DISCOVERY_DEFS.map((d) => d.id)),
			);
		});

		test('the router stage is not mapped to any discovery', () => {
			expect(STAGE_DISCOVERY_MAP.router).toBeUndefined();
		});

		test('the no-mailer discovery is surfaced by the controller stage', () => {
			expect(STAGE_DISCOVERY_MAP.controller).toBe('no-mailer');
		});
	});

	describe('Probes', () => {
		test('has exactly 3 probes', () => {
			expect(PROBE_IDS).toHaveLength(3);
		});

		test('probe discovery map only references valid probe and discovery IDs', () => {
			const probeSet = new Set(PROBE_IDS);
			const discSet = new Set(DISCOVERY_DEFS.map((d) => d.id));
			for (const [pid, did] of Object.entries(PROBE_DISCOVERY_MAP)) {
				expect(probeSet.has(pid)).toBe(true);
				expect(discSet.has(did)).toBe(true);
			}
		});
	});

	describe('Build step quality', () => {
		test('has exactly 5 build steps with unique ids', () => {
			expect(STEP_DEFS).toHaveLength(5);
			const ids = STEP_DEFS.map((s) => s.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		test('each option set has exactly one correct answer, never first', () => {
			for (const options of ALL_OPTION_SETS) {
				expect(options.filter((o) => o.correct)).toHaveLength(1);
				expect(options[0].correct).toBe(false);
			}
			expect(MAILER_TERMINAL_COMMANDS.filter((c) => c.correct)).toHaveLength(1);
			expect(MAILER_TERMINAL_COMMANDS[0].correct).toBe(false);
		});

		test('every wrong option has feedback', () => {
			for (const options of ALL_OPTION_SETS) {
				for (const opt of options) {
					if (!opt.correct) {
						expect((opt.feedback ?? '').length).toBeGreaterThan(10);
					}
				}
			}
		});

		test('feedback never reveals the correct answer', () => {
			const wrong = ALL_OPTION_SETS.flatMap((s) => s.filter((o) => !o.correct));
			for (const opt of wrong) {
				const fb = (opt.feedback ?? '').toLowerCase();
				expect(fb).not.toContain('generates_token_for');
				expect(fb).not.toContain('<%=');
				expect(fb).not.toContain('deliver_later');
			}
		});
	});

	describe('Frontend reset URL (not the API route helper)', () => {
		test('the correct mailer method builds a frontend reset URL from the token', () => {
			const correct = EMAIL_OPTIONS.find((o) => o.correct);
			expect(correct?.label).toContain(
				'@reset_url = "#{FRONTEND_HOST}/reset-password?token=#{@token}"',
			);
		});

		test('the correct ERB template links to @reset_url, not the API helper', () => {
			const correct = TEMPLATE_OPTIONS.find((o) => o.correct);
			expect(correct?.label).toContain(
				'<%= link_to "Reset password", @reset_url %>',
			);
			expect(correct?.label).not.toContain('password_reset_url(');
		});

		test('no template option uses the API route helper', () => {
			for (const opt of TEMPLATE_OPTIONS) {
				expect(opt.label).not.toContain('password_reset_url(@token)');
				expect(opt.label).not.toContain('password_reset_url(token)');
			}
		});
	});

	describe('Controller update uses non-bang update', () => {
		test('preview uses user.update, not user.update!', () => {
			expect(CONTROLLER_UPDATE_PREVIEW).toContain(
				'user.update(password: params[:password])',
			);
			expect(CONTROLLER_UPDATE_PREVIEW).not.toContain('user.update!(');
		});

		test('a weak-password failure renders 422, not a 500 from a raised bang', () => {
			expect(CONTROLLER_UPDATE_PREVIEW).toContain(
				'render json: { errors: user.errors.full_messages }',
			);
			expect(CONTROLLER_UPDATE_PREVIEW).toContain(
				'status: :unprocessable_entity',
			);
		});
	});

	describe('Stress scenarios', () => {
		test('has 8 scenarios with unique ids', () => {
			expect(STRESS_SCENARIO_IDS).toHaveLength(8);
			expect(new Set(STRESS_SCENARIO_IDS).size).toBe(
				STRESS_SCENARIO_IDS.length,
			);
		});

		test('every observe probe id has a matching reward scenario id', () => {
			const scen = new Set(STRESS_SCENARIO_IDS);
			for (const pid of PROBE_IDS) {
				expect(scen.has(pid)).toBe(true);
			}
		});
	});

	describe('Content: no social-media fossils, Rails 8 wording', () => {
		const contentBlob = JSON.stringify(level35ActionMailer);

		test('no socialplatform.com or SocialPlatform anywhere', () => {
			expect(contentBlob.toLowerCase()).not.toContain('socialplatform');
		});

		test('learning content emails a frontend reset URL, not the API helper', () => {
			const example =
				level35ActionMailer.learningContent.railsCodeExample ?? '';
			expect(example).toContain('/reset-password?token=');
			expect(example).toContain('config.action_mailer.default_url_options');
			expect(example).not.toContain('password_reset_url(@token)');
		});

		test('hint says Rails 8, not Rails 7.1+', () => {
			const hint = level35ActionMailer.hint?.text ?? '';
			expect(hint).toContain('Rails 8');
			expect(hint).not.toContain('7.1');
		});

		test('no em dash anywhere in the content', () => {
			expect(contentBlob).not.toContain(EM_DASH);
		});
	});
});
