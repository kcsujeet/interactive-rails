/**
 * Level 37: External APIs (Resilient Integration)
 *
 * Three-phase flow: observe -> build -> activate -> reward
 *
 * Phase 1 (observe): "Resilience Pipeline" visualization.
 *   Horizontal flow: App -> [no timeout] -> [no retry] -> [no circuit breaker] -> Stripe API
 *   Probes fire requests that hang, fail, or cascade. No resilience gates exist.
 *   The visualization shows requests getting stuck at Stripe, blocking Puma threads.
 *
 * Phase 2 (build): 6 steps
 *   Step 0: Install Faraday HTTP client (terminal)
 *   Step 1: Install Stoplight circuit breaker gem (terminal)
 *   Step 2: Configure timeout (option)
 *   Step 3: Configure retry with backoff (option)
 *   Step 4: Configure circuit breaker (option)
 *   Step 5: Build the payment service (option)
 *
 * Phase 3 (reward): Same pipeline, now with active gates.
 *   Timeouts cut slow requests. Retries handle transient errors.
 *   Circuit breaker fails fast when Stripe is down. Requests flow green.
 */

import {
	Activity,
	ArrowRight,
	Globe,
	RefreshCw,
	Server,
	Timer,
	Unplug,
	Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	buildTerminalHistory,
	CenterPanel,
	CodePreviewPanel,
	ErrorFeedback,
	LeftPanel,
	LevelLayout,
	OptionCard,
	RightPanel,
	StepProgress,
	TerminalChoiceStep,
} from '@/components/levels';
import { DiscoveryChecklist } from '@/components/levels/DiscoveryChecklist';
import { FlowConnector } from '@/components/levels/FlowConnector';
import { ProbeTerminal } from '@/components/levels/ProbeTerminal';
import { StressTestPanel } from '@/components/levels/StressTestPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
import { useDiscoveryGating } from '@/hooks/useDiscoveryGating';
import { useStepGating } from '@/hooks/useStepGating';
import { useStressTest } from '@/hooks/useStressTest';
import { ANIMATION_DURATION_MS } from '@/lib/animation';

// ─── Discovery definitions ─────────────────────────────────────────────
const DISCOVERY_DEFS = [
	{ id: 'no-timeout', label: 'No timeout on HTTP requests' },
	{ id: 'thread-blocking', label: 'Slow API blocks all Puma threads' },
	{ id: 'no-retry', label: 'Transient errors not retried' },
	{ id: 'cascade-failure', label: 'One failing API takes down entire app' },
] as const;

// ─── Probe definitions ─────────────────────────────────────────────────
const PROBES = [
	{
		id: 'slow-stripe',
		label: 'POST charge (Stripe slow)',
		command:
			'curl -X POST localhost:3000/api/v1/payments -d \'{"amount": 50}\'',
		responseLines: [
			{ text: '# Waiting... 10s... 20s... 30s...', color: 'amber' as const },
			{
				text: '# Thread blocked. No timeout configured.',
				color: 'red' as const,
			},
			{ text: '504 Gateway Timeout (after 30 seconds)', color: 'red' as const },
			{
				text: '# Puma thread wasted for 30 seconds on a single request',
				color: 'red' as const,
			},
		],
	},
	{
		id: 'stripe-503',
		label: 'POST charge (Stripe 503)',
		command:
			'curl -X POST localhost:3000/api/v1/payments -d \'{"amount": 75}\'',
		responseLines: [
			{ text: '503 Service Unavailable', color: 'red' as const },
			{
				text: '{ "error": "Stripe is temporarily unavailable" }',
				color: 'red' as const,
			},
			{
				text: '# No retry attempted. Request fails immediately.',
				color: 'amber' as const,
			},
			{
				text: '# A simple retry would likely succeed (transient error)',
				color: 'amber' as const,
			},
		],
	},
	{
		id: 'stripe-down',
		label: 'POST charge (Stripe outage)',
		command:
			'for i in {1..50}; do curl -X POST localhost:3000/api/v1/payments; done',
		responseLines: [
			{
				text: '# 50 concurrent checkout requests during Stripe outage',
				color: 'amber' as const,
			},
			{
				text: '# Each request hangs for 30 seconds (no timeout)',
				color: 'red' as const,
			},
			{
				text: '# 50 threads x 30s = all Puma threads blocked',
				color: 'red' as const,
			},
			{
				text: '# App is completely unresponsive, not just payments',
				color: 'red' as const,
			},
			{
				text: '# No circuit breaker to stop hammering a dead service',
				color: 'red' as const,
			},
		],
	},
] as const;

const PROBE_DISCOVERY_MAP: Record<string, string[]> = {
	'slow-stripe': ['no-timeout', 'thread-blocking'],
	'stripe-503': ['no-retry'],
	'stripe-down': ['cascade-failure'],
};

// ─── Build step definitions ────────────────────────────────────────────
const STEP_DEFS = [
	{ id: 'install-faraday', label: 'Install HTTP Client' },
	{ id: 'install-stoplight', label: 'Install Circuit Breaker' },
	{ id: 'configure-timeout', label: 'Configure Timeout' },
	{ id: 'configure-retry', label: 'Configure Retry' },
	{ id: 'configure-circuit', label: 'Configure Circuit Breaker' },
	{ id: 'build-service', label: 'Build Payment Service' },
] as const;

const INSTALL_FARADAY_COMMANDS = [
	{
		id: 'wrong-httparty',
		label: 'bundle add httparty',
		command: 'bundle add httparty',
		correct: false,
		feedback:
			'HTTParty lacks middleware support. You need an HTTP client with a composable middleware stack for timeouts, retries, and instrumentation.',
	},
	{
		id: 'correct',
		label: 'bundle add faraday',
		command: 'bundle add faraday',
		correct: true,
	},
	{
		id: 'wrong-rest-client',
		label: 'bundle add rest-client',
		command: 'bundle add rest-client',
		correct: false,
		feedback:
			'RestClient does not support middleware. You need pluggable middleware for retry, instrumentation, and circuit breaking.',
	},
];

const INSTALL_STOPLIGHT_COMMANDS = [
	{
		id: 'wrong-circuitbox',
		label: 'bundle add circuitbox',
		command: 'bundle add circuitbox',
		correct: false,
		feedback:
			'Circuitbox is an older gem. The modern, actively maintained option integrates cleanly with any code block.',
	},
	{
		id: 'wrong-semian',
		label: 'bundle add semian',
		command: 'bundle add semian',
		correct: false,
		feedback:
			'Semian is Shopify-specific infrastructure. A standalone circuit breaker gem is simpler and more widely applicable.',
	},
	{
		id: 'correct',
		label: 'bundle add stoplight',
		command: 'bundle add stoplight',
		correct: true,
	},
];

const CONFIGURE_TIMEOUT_OPTIONS = [
	{
		id: 'wrong-no-timeout',
		label: 'No timeout (use defaults)',
		code: `@connection = Faraday.new(url: base_url) do |f|
  f.request :json
  f.response :json
  # Use Ruby/OS default timeouts (60-120 seconds)
end`,
		correct: false,
		feedback:
			'Default timeouts are 60+ seconds. A stuck request blocks a thread that long, exhausting your thread pool under load.',
	},
	{
		id: 'correct',
		label: 'Set open_timeout and timeout',
		code: `@connection = Faraday.new(url: base_url) do |f|
  f.request :json
  f.response :json
  f.options.open_timeout = 3   # 3s to connect
  f.options.timeout = 10       # 10s total response
end`,
		correct: true,
	},
	{
		id: 'wrong-too-long',
		label: 'Set timeout to 60 seconds',
		code: `@connection = Faraday.new(url: base_url) do |f|
  f.request :json
  f.response :json
  f.options.timeout = 60  # Allow up to 60s
end`,
		correct: false,
		feedback:
			'60 seconds is far too long. Under load, slow requests pile up and exhaust your thread pool. Keep timeouts under 15 seconds.',
	},
];

const CONFIGURE_RETRY_OPTIONS = [
	{
		id: 'wrong-retry-all',
		label: 'Retry all HTTP methods',
		code: `f.request :retry, {
  max: 3,
  interval: 0.5,
  backoff_factor: 2,
  retry_statuses: [429, 500, 502, 503, 504]
}`,
		correct: false,
		feedback:
			'Retrying POST requests without idempotency is dangerous. A successful charge that timed out would be charged again on retry.',
	},
	{
		id: 'correct',
		label: 'Retry with backoff, skip non-idempotent',
		code: `f.request :retry, {
  max: 3,
  interval: 0.5,
  interval_randomness: 0.5,
  backoff_factor: 2,
  retry_statuses: [429, 500, 502, 503, 504],
  methods: [:get, :head, :options, :put, :delete]
  # POST excluded: not safe without idempotency key
}`,
		correct: true,
	},
	{
		id: 'wrong-no-backoff',
		label: 'Retry immediately (no backoff)',
		code: `f.request :retry, {
  max: 3,
  interval: 0,
  retry_statuses: [429, 500, 502, 503, 504],
  methods: [:get, :put, :delete]
}`,
		correct: false,
		feedback:
			'Retrying immediately creates a thundering herd. All clients retry at the same time, overwhelming the recovering service.',
	},
];

const CONFIGURE_CIRCUIT_OPTIONS = [
	{
		id: 'wrong-high-threshold',
		label: 'Open after 50 failures',
		code: `Stoplight('stripe-api')
  .with_threshold(50)
  .with_cool_off_time(300)
  .run { stripe_client.create_charge(params) }`,
		correct: false,
		feedback:
			'50 failures means 50 wasted requests and blocked threads before protection kicks in. The circuit should open much sooner.',
	},
	{
		id: 'wrong-no-error-filter',
		label: 'Trip on all errors including 4xx',
		code: `Stoplight('stripe-api')
  .with_threshold(5)
  .with_cool_off_time(30)
  .run { stripe_client.create_charge(params) }`,
		correct: false,
		feedback:
			'This trips the circuit on client errors (400, 422) which are never transient. The circuit should only track server-side failures.',
	},
	{
		id: 'correct',
		label: 'Threshold 5, filter client errors',
		code: `Stoplight('stripe-api')
  .with_threshold(5)
  .with_cool_off_time(30)
  .with_error_handler do |error, handle|
    raise error if error.is_a?(Faraday::ClientError)
    handle.call(error)  # Only track 5xx / timeouts
  end
  .run { stripe_client.create_charge(params) }`,
		correct: true,
	},
];

const BUILD_SERVICE_OPTIONS = [
	{
		id: 'wrong-no-service',
		label: 'Call Stripe directly in controller',
		code: `class Api::V1::PaymentsController < ApplicationController
  def create
    response = Faraday.post('https://api.stripe.com/v1/charges',
      { amount: params[:amount] })
    if response.success?
      render json: { payment: response.body }, status: :created
    else
      render json: { error: { code: "PAYMENT_FAILED",
        message: response.body } }, status: :bad_gateway
    end
  end
end`,
		correct: false,
		feedback:
			'HTTP calls in controllers violate the service object pattern. Business logic and external integrations belong in services.',
	},
	{
		id: 'correct',
		label: 'Service with contract, circuit breaker, and Result',
		code: `class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)

  def initialize(user:, params:)
    @user = user
    @params = params
  end

  def call
    validation = PaymentContract.new.call(@params)
    if validation.failure?
      return Result.new(success?: false, payment: nil,
        errors: validation.errors.to_h)
    end

    response = Stoplight('stripe-api')
      .with_threshold(5)
      .with_cool_off_time(30)
      .with_error_handler do |error, handle|
        raise error if error.is_a?(Faraday::ClientError)
        handle.call(error)
      end
      .run { stripe_client.create_charge(@params) }

    payment = @user.payments.create!(
      amount: @params[:amount], stripe_id: response["id"]
    )
    Result.new(success?: true, payment:, errors: {})
  rescue Stoplight::Error::RedLight
    Result.new(success?: false, payment: nil,
      errors: { payment: ["Service temporarily unavailable"] })
  end
end`,
		correct: true,
	},
	{
		id: 'wrong-no-circuit',
		label: 'Service without circuit breaker',
		code: `class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)

  def initialize(user:, params:)
    @user = user
    @params = params
  end

  def call
    validation = PaymentContract.new.call(@params)
    if validation.failure?
      return Result.new(success?: false, payment: nil,
        errors: validation.errors.to_h)
    end

    response = stripe_client.create_charge(@params)
    payment = @user.payments.create!(
      amount: @params[:amount], stripe_id: response["id"]
    )
    Result.new(success?: true, payment:, errors: {})
  end
end`,
		correct: false,
		feedback:
			'This service has no circuit breaker. During an outage, every request still hits the failing API, wasting threads and amplifying the problem.',
	},
];

const TERMINAL_STEP_MAP: ({
	commands: typeof INSTALL_FARADAY_COMMANDS;
	outputLines: { text: string; color: 'green' | 'cyan' }[];
} | null)[] = [
	{
		commands: INSTALL_FARADAY_COMMANDS,
		outputLines: [
			{
				text: 'Bundle complete! 1 Gemfile dependency added.',
				color: 'green' as const,
			},
		],
	},
	{
		commands: INSTALL_STOPLIGHT_COMMANDS,
		outputLines: [
			{
				text: 'Bundle complete! 1 Gemfile dependency added.',
				color: 'green' as const,
			},
		],
	},
	null, // configure-timeout: OptionCard
	null, // configure-retry: OptionCard
	null, // configure-circuit: OptionCard
	null, // build-service: OptionCard
];

// ─── Stress test scenarios ─────────────────────────────────────────────
const STRESS_SCENARIOS = [
	{
		id: 'fast-charge',
		label: 'POST charge (fast response)',
		description: 'Stripe responds in 200ms, charge succeeds',
		method: 'POST' as const,
		path: '/api/v1/payments',
		actor: 'user',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'slow-charge',
		label: 'POST charge (slow, timeout)',
		description: 'Stripe takes 15s, timeout kicks in at 10s',
		method: 'POST' as const,
		path: '/api/v1/payments',
		actor: 'user',
		expectedResult: 'blocked' as const,
	},
	{
		id: 'transient-503',
		label: 'GET balance (503, retried)',
		description: 'First attempt 503, retry succeeds',
		method: 'GET' as const,
		path: '/api/v1/balance',
		actor: 'user',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'circuit-open',
		label: 'POST charge (circuit open)',
		description: 'Circuit breaker is open, fails fast without calling Stripe',
		method: 'POST' as const,
		path: '/api/v1/payments',
		actor: 'user',
		expectedResult: 'blocked' as const,
	},
	{
		id: 'idempotent-retry',
		label: 'GET invoice (timeout, retried)',
		description: 'GET request times out, safely retried with backoff',
		method: 'GET' as const,
		path: '/api/v1/invoices/42',
		actor: 'user',
		expectedResult: 'allowed' as const,
	},
	{
		id: 'client-error',
		label: 'POST charge (400 bad params)',
		description: 'Client error, circuit breaker ignores it',
		method: 'POST' as const,
		path: '/api/v1/payments',
		actor: 'user',
		expectedResult: 'blocked' as const,
	},
];

// ─── Visualization types ───────────────────────────────────────────────
interface GateState {
	timeout: 'inactive' | 'active' | 'triggered';
	retry: 'inactive' | 'active' | 'triggered';
	circuit: 'inactive' | 'closed' | 'open' | 'half-open';
}

// ─── Code preview builder ──────────────────────────────────────────────
function getCodeFiles(
	phase: 'observe' | 'build' | 'activate' | 'reward',
	furthestStep: number,
) {
	if (phase === 'observe') {
		return [
			{
				filename: 'app/services/process_payment.rb',
				language: 'ruby',
				code: `class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)

  def initialize(user:, params:)
    @user = user
    @params = params
  end

  def call
    validation = PaymentContract.new.call(@params)
    if validation.failure?
      return Result.new(success?: false, payment: nil,
        errors: validation.errors.to_h)
    end

    # No timeout! Blocks thread for 30+ seconds
    response = HTTParty.post(
      'https://api.stripe.com/v1/charges',
      body: { amount: @params[:amount] }
    )
    # No retry on transient errors
    # No circuit breaker for outages

    payment = @user.payments.create!(
      amount: @params[:amount], stripe_id: response["id"]
    )
    Result.new(success?: true, payment:, errors: {})
  end
end`,
			},
		];
	}

	if (phase === 'build') {
		const files: { filename: string; language: string; code: string }[] = [];

		if (furthestStep >= 0) {
			files.push({
				filename: 'Gemfile',
				language: 'ruby',
				code: `gem "faraday"${furthestStep >= 1 ? '\ngem "stoplight"' : ''}`,
			});
		}

		if (furthestStep >= 2) {
			files.push({
				filename: 'app/clients/stripe_client.rb',
				language: 'ruby',
				code: `class StripeClient
  def initialize
    @connection = Faraday.new(url: 'https://api.stripe.com') do |f|
      f.request :authorization, 'Bearer', Rails.application.credentials.stripe[:secret_key]
      f.request :json
      f.response :json
      f.options.open_timeout = 3
      f.options.timeout = 10${
				furthestStep >= 3
					? `
      f.request :retry, {
        max: 3,
        interval: 0.5,
        interval_randomness: 0.5,
        backoff_factor: 2,
        retry_statuses: [429, 500, 502, 503, 504],
        methods: [:get, :head, :options, :put, :delete]
      }`
					: ''
			}
    end
  end

  def create_charge(params)
    @connection.post('/v1/charges', params)
  end
end`,
			});
		}

		if (furthestStep >= 4) {
			files.push({
				filename: 'app/services/process_payment.rb',
				language: 'ruby',
				code: `class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)
  # ... (circuit breaker wraps stripe_client calls)
end`,
			});
		}

		if (furthestStep >= 5) {
			files.push({
				filename: 'app/services/process_payment.rb',
				language: 'ruby',
				code: `class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)

  def initialize(user:, params:)
    @user = user
    @params = params
  end

  def call
    validation = PaymentContract.new.call(@params)
    if validation.failure?
      return Result.new(success?: false, payment: nil,
        errors: validation.errors.to_h)
    end

    response = Stoplight('stripe-api')
      .with_threshold(5)
      .with_cool_off_time(30)
      .with_error_handler do |error, handle|
        raise error if error.is_a?(Faraday::ClientError)
        handle.call(error)
      end
      .run { stripe_client.create_charge(@params) }

    payment = @user.payments.create!(
      amount: @params[:amount], stripe_id: response.body["id"]
    )
    Result.new(success?: true, payment:, errors: {})
  rescue Stoplight::Error::RedLight
    Result.new(success?: false, payment: nil,
      errors: { payment: ["Service temporarily unavailable"] })
  end

  private

  def stripe_client
    @stripe_client ||= StripeClient.new
  end
end`,
			});
		}

		if (files.length === 0) {
			files.push({
				filename: 'Gemfile',
				language: 'ruby',
				code: '# Step 1: Install the HTTP client gem...',
			});
		}

		return files;
	}

	// activate + reward
	return [
		{
			filename: 'app/clients/stripe_client.rb',
			language: 'ruby',
			code: `class StripeClient
  def initialize
    @connection = Faraday.new(url: 'https://api.stripe.com') do |f|
      f.request :authorization, 'Bearer',
        Rails.application.credentials.stripe[:secret_key]
      f.request :json
      f.request :retry, {
        max: 3,
        interval: 0.5,
        interval_randomness: 0.5,
        backoff_factor: 2,
        retry_statuses: [429, 500, 502, 503, 504],
        methods: [:get, :head, :options, :put, :delete]
      }
      f.response :json
      f.options.open_timeout = 3
      f.options.timeout = 10
    end
  end

  def create_charge(params)
    @connection.post('/v1/charges', params)
  end
end`,
		},
		{
			filename: 'app/services/process_payment.rb',
			language: 'ruby',
			code: `class ProcessPayment < ApplicationService
  Result = Data.define(:success?, :payment, :errors)

  def initialize(user:, params:)
    @user = user
    @params = params
  end

  def call
    validation = PaymentContract.new.call(@params)
    if validation.failure?
      return Result.new(success?: false, payment: nil,
        errors: validation.errors.to_h)
    end

    response = Stoplight('stripe-api')
      .with_threshold(5)
      .with_cool_off_time(30)
      .with_error_handler do |error, handle|
        raise error if error.is_a?(Faraday::ClientError)
        handle.call(error)
      end
      .run { stripe_client.create_charge(@params) }

    payment = @user.payments.create!(
      amount: @params[:amount], stripe_id: response.body["id"]
    )
    Result.new(success?: true, payment:, errors: {})
  rescue Stoplight::Error::RedLight
    Result.new(success?: false, payment: nil,
      errors: { payment: ["Service temporarily unavailable"] })
  end

  private

  def stripe_client
    @stripe_client ||= StripeClient.new
  end
end`,
		},
		{
			filename: 'app/contracts/payment_contract.rb',
			language: 'ruby',
			code: `class PaymentContract < Dry::Validation::Contract
  params do
    required(:amount).filled(:integer, gt?: 0)
    optional(:currency).filled(:string)
  end

  rule(:amount) do
    key.failure('must be at least 50 cents') if value < 50
  end
end`,
		},
	];
}

// ─── Main component ────────────────────────────────────────────────────
export function Level37ExternalAPIs({ onComplete }: LevelComponentProps) {
	const [phase, setPhase] = useState<
		'observe' | 'build' | 'activate' | 'reward'
	>('observe');

	// ── Observe phase ──
	const discoveryGating = useDiscoveryGating(DISCOVERY_DEFS, {
		minRequired: DISCOVERY_DEFS.length,
	});

	const [flowPhase, setFlowPhase] = useState(-1);
	const [gateState, setGateState] = useState<GateState>({
		timeout: 'inactive',
		retry: 'inactive',
		circuit: 'inactive',
	});
	const [_lastProbeId, setLastProbeId] = useState<string | null>(null);
	const flowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleProbe = useCallback(
		(probeId: string) => {
			setLastProbeId(probeId);
			const discoveries = PROBE_DISCOVERY_MAP[probeId];
			if (discoveries) {
				for (const d of discoveries) discoveryGating.discover(d);
			}

			setFlowPhase(0);

			// Show different gate states based on probe
			if (probeId === 'slow-stripe') {
				setGateState({
					timeout: 'inactive',
					retry: 'inactive',
					circuit: 'inactive',
				});
			} else if (probeId === 'stripe-503') {
				setGateState({
					timeout: 'inactive',
					retry: 'inactive',
					circuit: 'inactive',
				});
			} else if (probeId === 'stripe-down') {
				setGateState({
					timeout: 'inactive',
					retry: 'inactive',
					circuit: 'inactive',
				});
			}

			if (flowTimerRef.current) clearTimeout(flowTimerRef.current);
			flowTimerRef.current = setTimeout(() => {
				setFlowPhase(-1);
			}, ANIMATION_DURATION_MS * 3);
		},
		[discoveryGating],
	);

	useEffect(() => {
		return () => {
			if (flowTimerRef.current) clearTimeout(flowTimerRef.current);
		};
	}, []);

	// ── Build phase ──
	const stepper = useStepGating(STEP_DEFS, { autoAdvance: false });

	useEffect(() => {
		if (stepper.isComplete && phase === 'build') {
			setPhase('activate');
		}
	}, [stepper.isComplete, phase]);

	// ── Reward phase ──
	const stressTest = useStressTest(STRESS_SCENARIOS);
	const [rewardFlowPhase, setRewardFlowPhase] = useState(-1);
	const [rewardGateState, setRewardGateState] = useState<GateState>({
		timeout: 'active',
		retry: 'active',
		circuit: 'closed',
	});
	const rewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleStressFire = useCallback(
		(scenarioId: string) => {
			stressTest.fireRequest(scenarioId);
			const scenario = STRESS_SCENARIOS.find((s) => s.id === scenarioId);
			if (!scenario) return;

			setRewardFlowPhase(0);

			// Update gate visualization based on scenario
			if (scenarioId === 'slow-charge') {
				setRewardGateState({
					timeout: 'triggered',
					retry: 'active',
					circuit: 'closed',
				});
			} else if (scenarioId === 'circuit-open') {
				setRewardGateState({
					timeout: 'active',
					retry: 'active',
					circuit: 'open',
				});
			} else if (
				scenarioId === 'transient-503' ||
				scenarioId === 'idempotent-retry'
			) {
				setRewardGateState({
					timeout: 'active',
					retry: 'triggered',
					circuit: 'closed',
				});
			} else {
				setRewardGateState({
					timeout: 'active',
					retry: 'active',
					circuit: 'closed',
				});
			}

			if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
			rewardTimerRef.current = setTimeout(() => {
				setRewardFlowPhase(-1);
			}, ANIMATION_DURATION_MS * 2);
		},
		[stressTest],
	);

	useEffect(() => {
		return () => {
			if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
		};
	}, []);

	// ── Render: Resilience Pipeline visualization ──
	const renderResiliencePipeline = (isReward: boolean) => {
		const probeActive = isReward ? rewardFlowPhase !== -1 : flowPhase !== -1;
		const gates = isReward ? rewardGateState : gateState;

		const gateColor = (state: string) => {
			if (state === 'inactive')
				return 'border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50';
			if (state === 'triggered' || state === 'open')
				return 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/30';
			return 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30';
		};

		const gateTextColor = (state: string) => {
			if (state === 'inactive') return 'text-muted-foreground';
			if (state === 'triggered' || state === 'open')
				return 'text-red-600 dark:text-red-400';
			return 'text-emerald-600 dark:text-emerald-400';
		};

		return (
			<div className="flex items-center gap-2 h-full px-2">
				{/* App Server */}
				<div className="flex flex-col items-center gap-1 shrink-0">
					<div className="w-14 h-14 rounded-lg border-2 border-border bg-card flex items-center justify-center">
						<Server className="w-6 h-6 text-foreground" />
					</div>
					<span className="text-xs text-muted-foreground font-medium">App</span>
				</div>

				<FlowConnector
					active={probeActive}
					direction="right"
					variant={isReward ? 'success' : 'danger'}
				/>

				{/* Timeout Gate */}
				<div className="flex flex-col items-center gap-1 shrink-0">
					<div
						className={`w-20 h-14 rounded-lg border-2 flex flex-col items-center justify-center ${gateColor(gates.timeout)}`}
					>
						<Timer className={`w-5 h-5 ${gateTextColor(gates.timeout)}`} />
						<span
							className={`text-[10px] font-semibold ${gateTextColor(gates.timeout)}`}
						>
							{gates.timeout === 'inactive'
								? 'No Timeout'
								: gates.timeout === 'triggered'
									? 'TIMEOUT!'
									: '10s limit'}
						</span>
					</div>
					<span className="text-xs text-muted-foreground">Timeout</span>
				</div>

				<FlowConnector
					active={probeActive}
					direction="right"
					variant={isReward ? 'success' : 'danger'}
				/>

				{/* Retry Gate */}
				<div className="flex flex-col items-center gap-1 shrink-0">
					<div
						className={`w-20 h-14 rounded-lg border-2 flex flex-col items-center justify-center ${gateColor(gates.retry)}`}
					>
						<RefreshCw className={`w-5 h-5 ${gateTextColor(gates.retry)}`} />
						<span
							className={`text-[10px] font-semibold ${gateTextColor(gates.retry)}`}
						>
							{gates.retry === 'inactive'
								? 'No Retry'
								: gates.retry === 'triggered'
									? 'RETRYING'
									: '3x backoff'}
						</span>
					</div>
					<span className="text-xs text-muted-foreground">Retry</span>
				</div>

				<FlowConnector
					active={probeActive}
					direction="right"
					variant={isReward ? 'success' : 'danger'}
				/>

				{/* Circuit Breaker Gate */}
				<div className="flex flex-col items-center gap-1 shrink-0">
					<div
						className={`w-20 h-14 rounded-lg border-2 flex flex-col items-center justify-center ${gateColor(gates.circuit)}`}
					>
						<Unplug className={`w-5 h-5 ${gateTextColor(gates.circuit)}`} />
						<span
							className={`text-[10px] font-semibold ${gateTextColor(gates.circuit)}`}
						>
							{gates.circuit === 'inactive'
								? 'No Breaker'
								: gates.circuit === 'open'
									? 'OPEN'
									: gates.circuit === 'half-open'
										? 'HALF'
										: 'CLOSED'}
						</span>
					</div>
					<span className="text-xs text-muted-foreground">Circuit</span>
				</div>

				<FlowConnector
					active={probeActive}
					direction="right"
					variant={isReward ? 'success' : 'danger'}
				/>

				{/* External API (Stripe) */}
				<div className="flex flex-col items-center gap-1 shrink-0">
					<div
						className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center ${
							isReward
								? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
								: 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/30'
						}`}
					>
						<Globe
							className={`w-6 h-6 ${isReward ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
						/>
					</div>
					<span className="text-xs text-muted-foreground font-medium">
						Stripe
					</span>
					{!isReward && (
						<Badge
							className="text-[10px] text-red-600 dark:text-red-400 border-red-300 dark:border-red-700"
							variant="outline"
						>
							Unreliable
						</Badge>
					)}
				</div>
			</div>
		);
	};

	// ── Build phase: current step config ──
	const currentStepConfig = useMemo(() => {
		const idx = stepper.currentStep;
		if (idx === 0)
			return { type: 'terminal' as const, ...TERMINAL_STEP_MAP[0] };
		if (idx === 1)
			return { type: 'terminal' as const, ...TERMINAL_STEP_MAP[1] };
		if (idx === 2)
			return { type: 'option' as const, options: CONFIGURE_TIMEOUT_OPTIONS };
		if (idx === 3)
			return { type: 'option' as const, options: CONFIGURE_RETRY_OPTIONS };
		if (idx === 4)
			return { type: 'option' as const, options: CONFIGURE_CIRCUIT_OPTIONS };
		if (idx === 5)
			return { type: 'option' as const, options: BUILD_SERVICE_OPTIONS };
		return null;
	}, [stepper.currentStep]);

	// ── Left panel ──
	const renderLeftPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Scenario
						</h3>
						<p className="text-sm text-muted-foreground">
							Stripe API returned HTTP 503 for 5 minutes. Every checkout request
							waited 30 seconds, consumed a Puma thread, and timed out. All
							threads blocked. Entire app unresponsive.
						</p>
					</div>
					<DiscoveryChecklist
						discoveries={DISCOVERY_DEFS.map((d) => ({
							id: d.id,
							label: d.label,
							found: discoveryGating.isDiscovered(d.id),
						}))}
					/>
					{discoveryGating.isUnlocked && (
						<Button
							className="w-full animate-in fade-in duration-500"
							onClick={() => setPhase('build')}
						>
							Build the Fix <ArrowRight className="w-4 h-4 ml-2" />
						</Button>
					)}
				</div>
			);
		}

		if (phase === 'build') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Building
						</h3>
						<p className="text-sm text-muted-foreground">
							Add resilience layers: timeout, retry with backoff, and circuit
							breaker.
						</p>
					</div>
					<StepProgress
						currentStep={stepper.currentStep}
						furthestStep={stepper.furthestStep}
						steps={STEP_DEFS.map((s) => s.label)}
					/>
				</div>
			);
		}

		if (phase === 'activate') {
			return (
				<div className="space-y-4 p-4">
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-2">
							Solution Complete
						</h3>
						<p className="text-sm text-muted-foreground">
							Faraday with timeouts, retries, and Stoplight circuit breaker
							configured.
						</p>
					</div>
				</div>
			);
		}

		// reward
		return (
			<div className="space-y-4 p-4">
				<div>
					<h3 className="text-sm font-semibold text-foreground mb-2">Legend</h3>
					<div className="space-y-2 text-xs">
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-emerald-500" />
							<span className="text-muted-foreground">Request handled</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-3 h-3 rounded-full bg-red-500" />
							<span className="text-muted-foreground">Failed gracefully</span>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
							{stressTest.allowedCount}
						</div>
						<div className="text-xs text-muted-foreground">Succeeded</div>
					</div>
					<div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
						<div className="text-lg font-bold text-red-600 dark:text-red-400">
							{stressTest.blockedCount}
						</div>
						<div className="text-xs text-muted-foreground">Handled</div>
					</div>
				</div>
				{stressTest.canAutoFire && (
					<Button
						className="w-full"
						onClick={() => stressTest.toggleAutoFire(handleStressFire)}
						variant="outline"
					>
						{stressTest.isAutoFiring ? 'Stop Auto-Fire' : 'Auto-Fire All'}
					</Button>
				)}
				<Button
					className="w-full"
					onClick={() => onComplete({ stars: stepper.starRating })}
				>
					Submit
				</Button>
			</div>
		);
	};

	// ── Center panel ──
	const renderCenterPanel = () => {
		if (phase === 'observe') {
			return (
				<div className="flex-1 flex flex-col p-4 gap-4">
					<div className="flex-1 min-h-0 flex items-center">
						{renderResiliencePipeline(false)}
					</div>
					<div className="px-6 pb-2">
						<ProbeTerminal
							disabled={flowPhase !== -1}
							onProbe={handleProbe}
							probes={PROBES}
						/>
					</div>
				</div>
			);
		}

		if (phase === 'build' && currentStepConfig) {
			if (currentStepConfig.type === 'terminal' && currentStepConfig.commands) {
				return (
					<div className="flex-1 flex flex-col p-4">
						<TerminalChoiceStep
							commands={currentStepConfig.commands}
							completed={stepper.isCurrentStepCompleted}
							description={
								<p className="text-sm text-muted-foreground">
									{stepper.currentStep === 0 &&
										'Install an HTTP client with composable middleware for timeouts, retries, and instrumentation.'}
									{stepper.currentStep === 1 &&
										'Install a circuit breaker gem that wraps external calls and fails fast during outages.'}
								</p>
							}
							hasNext={stepper.currentStep < STEP_DEFS.length - 1}
							initialHistory={buildTerminalHistory(
								TERMINAL_STEP_MAP,
								stepper.currentStep,
							)}
							onCorrect={() => stepper.completeStep()}
							onNext={stepper.nextStep}
							onWrong={(fb) => stepper.recordWrongAttempt(fb)}
							outputLines={currentStepConfig.outputLines}
							stepKey={stepper.currentStep}
							title={STEP_DEFS[stepper.currentStep].label}
						/>
					</div>
				);
			}

			if (currentStepConfig.type === 'option') {
				return (
					<div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
						<div>
							<h3 className="text-lg font-semibold text-foreground">
								{STEP_DEFS[stepper.currentStep].label}
							</h3>
							<p className="text-sm text-muted-foreground mt-1">
								{stepper.currentStep === 2 &&
									'Set connection and response timeouts to prevent thread blocking.'}
								{stepper.currentStep === 3 &&
									'Configure retry middleware with exponential backoff for transient errors.'}
								{stepper.currentStep === 4 &&
									'Wrap external calls in a circuit breaker that fails fast during outages.'}
								{stepper.currentStep === 5 &&
									'Build the payment service with all resilience patterns integrated.'}
							</p>
						</div>
						<div className="space-y-3">
							{currentStepConfig.options.map((opt) => (
								<OptionCard
									code={opt.code}
									disabled={stepper.isCurrentStepCompleted}
									key={opt.id}
									label={opt.label}
									language="ruby"
									onClick={() => {
										if (opt.correct) {
											stepper.completeStep();
										} else {
											stepper.recordWrongAttempt(opt.feedback);
										}
									}}
								/>
							))}
						</div>
						{stepper.lastFeedback && !stepper.isCurrentStepCompleted && (
							<ErrorFeedback message={stepper.lastFeedback} />
						)}
						{stepper.isCurrentStepCompleted &&
							stepper.currentStep < STEP_DEFS.length - 1 && (
								<Button className="w-fit" onClick={stepper.nextStep}>
									Next Step <ArrowRight className="w-4 h-4 ml-2" />
								</Button>
							)}
					</div>
				);
			}
		}

		if (phase === 'activate') {
			return (
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center space-y-4">
						<div className="flex justify-center gap-1">
							{[1, 2, 3].map((star) => (
								<Activity
									className="w-8 h-8 text-amber-400 fill-amber-400"
									key={star}
								/>
							))}
						</div>
						<Button onClick={() => setPhase('reward')}>
							Visualize Resilience <Zap className="w-4 h-4 ml-2" />
						</Button>
					</div>
				</div>
			);
		}

		// reward
		return (
			<div className="flex-1 flex flex-col p-4 gap-4">
				<div className="flex-1 min-h-0 flex items-center">
					{renderResiliencePipeline(true)}
				</div>
				<div className="px-6 pb-2">
					<StressTestPanel
						disabled={rewardFlowPhase !== -1}
						onFire={handleStressFire}
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
			<CenterPanel>{renderCenterPanel()}</CenterPanel>
			<RightPanel>
				<CodePreviewPanel
					files={getCodeFiles(phase, stepper.furthestStep)}
					learningGoal="Every external API call needs timeouts, retries with backoff, and a circuit breaker."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level37ExternalAPIs;
