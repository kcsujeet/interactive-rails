/**
 * Level 23: Webhooks
 *
 * Receive and process webhooks from external services.
 * Player learns webhook verification, idempotency, and async processing.
 */

import { useState } from 'react';
import type { LevelComponentProps } from '../index';
import {
  LevelLayout,
  LeftPanel,
  CenterPanel,
  RightPanel,
  LevelHeader,
  InstructionPanel,
  CodePreviewPanel,
  useLevelCompletion,
  type ValidationResult,
} from '../shared';

interface WebhookConfig {
  signatureVerification: boolean;
  idempotencyCheck: boolean;
  asyncProcessing: boolean;
  logging: boolean;
}

interface WebhookEvent {
  id: string;
  type: string;
  signature: string;
  isDuplicate: boolean;
  status: 'received' | 'verified' | 'processing' | 'completed' | 'rejected' | 'duplicate';
  timestamp: number;
}

const WEBHOOK_TYPES = [
  { type: 'payment.completed', icon: '💰', description: 'Payment successful' },
  { type: 'payment.failed', icon: '❌', description: 'Payment declined' },
  { type: 'subscription.created', icon: '📋', description: 'New subscription' },
  { type: 'subscription.canceled', icon: '🚫', description: 'Subscription ended' },
  { type: 'customer.updated', icon: '👤', description: 'Customer info changed' },
];

export function Level23Webhooks({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [config, setConfig] = useState<WebhookConfig>({
    signatureVerification: false,
    idempotencyCheck: false,
    asyncProcessing: false,
    logging: false,
  });
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [processedIds] = useState<Set<string>>(new Set());

  const toggleConfig = (key: keyof WebhookConfig) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const simulateWebhook = (type: string, isDuplicate: boolean = false) => {
    const eventId = isDuplicate && events.length > 0
      ? events[events.length - 1].id
      : `evt_${Math.random().toString(36).substr(2, 9)}`;

    const hasValidSignature = Math.random() > 0.2; // 80% valid

    const event: WebhookEvent = {
      id: eventId,
      type,
      signature: hasValidSignature ? 'valid_signature' : 'invalid_signature',
      isDuplicate,
      status: 'received',
      timestamp: Date.now(),
    };

    setEvents(prev => [...prev.slice(-9), event]);

    // Process webhook based on config
    setTimeout(() => {
      setEvents(prev => prev.map(e => {
        if (e.id !== event.id || e.timestamp !== event.timestamp) return e;

        // Signature verification
        if (config.signatureVerification && !hasValidSignature) {
          return { ...e, status: 'rejected' };
        }

        // Idempotency check
        if (config.idempotencyCheck && isDuplicate && processedIds.has(event.id)) {
          return { ...e, status: 'duplicate' };
        }

        return { ...e, status: 'verified' };
      }));
    }, 500);

    setTimeout(() => {
      setEvents(prev => prev.map(e => {
        if (e.id !== event.id || e.timestamp !== event.timestamp) return e;
        if (e.status === 'rejected' || e.status === 'duplicate') return e;
        return { ...e, status: config.asyncProcessing ? 'processing' : 'completed' };
      }));
      processedIds.add(event.id);
    }, 1000);

    if (config.asyncProcessing) {
      setTimeout(() => {
        setEvents(prev => prev.map(e => {
          if (e.id !== event.id || e.timestamp !== event.timestamp) return e;
          if (e.status !== 'processing') return e;
          return { ...e, status: 'completed' };
        }));
      }, 2000);
    }
  };

  const validateSolution = (): ValidationResult => {
    const enabledCount = Object.values(config).filter(Boolean).length;
    if (enabledCount < 3) {
      return {
        valid: false,
        message: 'Enable more webhook security features!',
        details: ['At least 3 features needed for production-ready webhooks'],
      };
    }
    return { valid: true, message: 'Secure webhook handling configured!' };
  };

  const handleComplete = async () => {
    const success = await completeLevel('act4-level23-webhooks', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const getStatusColor = (status: WebhookEvent['status']) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-900/20';
      case 'verified':
      case 'processing': return 'text-blue-400 bg-blue-900/20';
      case 'rejected': return 'text-red-400 bg-red-900/20';
      case 'duplicate': return 'text-yellow-400 bg-yellow-900/20';
      default: return 'text-gray-400 bg-gray-800';
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Stripe sends you payment notifications via webhooks. But webhooks can be forged, duplicated, or fail during processing. Build a robust webhook handler!"
          instructions={[
            'Verify signatures to prevent forgery',
            'Check idempotency to handle duplicates',
            'Process async to respond quickly',
            'Log everything for debugging',
          ]}
          goal="Handle webhooks securely and reliably for production systems."
        >
          {/* Configuration */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Security Features
            </div>
            <div className="space-y-2">
              {[
                { key: 'signatureVerification', name: 'Signature Verification', desc: 'Verify webhook authenticity' },
                { key: 'idempotencyCheck', name: 'Idempotency Check', desc: 'Detect duplicate events' },
                { key: 'asyncProcessing', name: 'Async Processing', desc: 'Process in background' },
                { key: 'logging', name: 'Event Logging', desc: 'Audit trail for debugging' },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => toggleConfig(item.key as keyof WebhookConfig)}
                  className={`w-full p-2 rounded-lg text-left transition-all border ${
                    config[item.key as keyof WebhookConfig]
                      ? 'border-green-500 bg-green-900/20'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${config[item.key as keyof WebhookConfig] ? 'text-green-400' : 'text-white'}`}>
                      {item.name}
                    </span>
                    {config[item.key as keyof WebhookConfig] && (
                      <span className="text-green-400 text-xs">✓</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Features enabled</span>
              <span className={Object.values(config).filter(Boolean).length >= 3 ? 'text-green-400' : 'text-white'}>
                {Object.values(config).filter(Boolean).length} / 4
              </span>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={23}
          levelName="Webhooks"
          actNumber={4}
          onExit={onExit}
          onReset={() => {
            setConfig({ signatureVerification: false, idempotencyCheck: false, asyncProcessing: false, logging: false });
            setEvents([]);
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* Webhook Triggers */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Simulate Incoming Webhooks</div>
                <div className="text-xs text-gray-500">Click to send webhook events from Stripe</div>
              </div>

              <div className="p-4 grid grid-cols-3 gap-3">
                {WEBHOOK_TYPES.map(wh => (
                  <button
                    key={wh.type}
                    onClick={() => simulateWebhook(wh.type)}
                    className="p-3 rounded-lg bg-gray-800 border border-gray-700 hover:border-cyan-500 transition-all text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span>{wh.icon}</span>
                      <span className="text-cyan-400 text-xs font-mono">{wh.type}</span>
                    </div>
                    <div className="text-xs text-gray-500">{wh.description}</div>
                  </button>
                ))}
                <button
                  onClick={() => simulateWebhook(WEBHOOK_TYPES[0].type, true)}
                  className="p-3 rounded-lg bg-yellow-900/20 border border-yellow-600 hover:border-yellow-500 transition-all text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>🔄</span>
                    <span className="text-yellow-400 text-xs font-mono">duplicate</span>
                  </div>
                  <div className="text-xs text-gray-500">Send duplicate event</div>
                </button>
              </div>
            </div>

            {/* Processing Pipeline */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Processing Pipeline</div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  {[
                    { name: 'Receive', icon: '📥', active: true },
                    { name: 'Verify', icon: '🔐', active: config.signatureVerification },
                    { name: 'Dedupe', icon: '🔍', active: config.idempotencyCheck },
                    { name: 'Queue', icon: '📋', active: config.asyncProcessing },
                    { name: 'Process', icon: '⚙️', active: true },
                    { name: 'Log', icon: '📝', active: config.logging },
                  ].map((step, i, arr) => (
                    <div key={step.name} className="flex items-center">
                      <div className={`flex flex-col items-center ${step.active ? '' : 'opacity-30'}`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          step.active ? 'bg-cyan-600' : 'bg-gray-700'
                        }`}>
                          <span className="text-xl">{step.icon}</span>
                        </div>
                        <span className="text-xs text-gray-400 mt-2">{step.name}</span>
                      </div>
                      {i < arr.length - 1 && (
                        <div className={`w-8 h-0.5 mx-2 ${step.active ? 'bg-cyan-600' : 'bg-gray-700'}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Event Log */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Event Log</div>
              </div>
              <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                {events.length === 0 ? (
                  <div className="text-center py-8 text-gray-600">
                    Click a webhook type above to simulate receiving events
                  </div>
                ) : (
                  events.map((event, i) => (
                    <div
                      key={`${event.id}-${event.timestamp}`}
                      className={`p-3 rounded-lg border ${
                        event.status === 'rejected' ? 'border-red-600' :
                        event.status === 'duplicate' ? 'border-yellow-600' :
                        'border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-500">{event.id}</span>
                          <span className="text-cyan-400 text-xs">{event.type}</span>
                          {event.isDuplicate && (
                            <span className="text-xs px-1 bg-yellow-900/40 text-yellow-400 rounded">DUPLICATE</span>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(event.status)}`}>
                          {event.status}
                        </span>
                      </div>
                      {config.logging && (
                        <div className="text-xs text-gray-500 font-mono">
                          sig: {event.signature === 'valid_signature' ? '✓ valid' : '✗ invalid'}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[
            {
              filename: 'app/controllers/webhooks_controller.rb',
              language: 'ruby',
              code: `class WebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token

  def stripe
    payload = request.body.read
    sig = request.headers['Stripe-Signature']

    # 1. Verify signature
    event = Stripe::Webhook.construct_event(
      payload, sig, ENV['STRIPE_WEBHOOK_SECRET']
    )

    # 2. Check idempotency
    return head :ok if WebhookEvent
      .exists?(external_id: event.id)

    # 3. Log event
    WebhookEvent.create!(
      external_id: event.id,
      event_type: event.type,
      payload: payload
    )

    # 4. Process async
    ProcessWebhookJob.perform_later(event.id)

    head :ok
  rescue Stripe::SignatureVerificationError
    head :bad_request
  end
end`,
              highlight: config.signatureVerification ? [8, 9, 10] : [],
            },
          ]}
          learningGoal="Webhooks need security (signatures), reliability (idempotency), and performance (async processing)."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Key Concepts</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Always verify signatures</li>
              <li>• Handle duplicate deliveries</li>
              <li>• Return 200 quickly, process later</li>
              <li>• Log for debugging</li>
            </ul>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Common Webhooks</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Stripe - Payments</li>
              <li>• GitHub - Code events</li>
              <li>• Twilio - SMS status</li>
              <li>• Slack - Bot events</li>
            </ul>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level23Webhooks;
