/**
 * Level 15: Idempotency
 *
 * Prevent duplicate processing with idempotency keys.
 * Shows webhook delivery retries being handled safely.
 */

import { useState, useEffect } from 'react';
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

interface WebhookDelivery {
  id: number;
  eventId: string;
  attempt: number;
  status: 'pending' | 'processed' | 'duplicate' | 'error';
}

export function Level15Idempotency({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [idempotencyEnabled, setIdempotencyEnabled] = useState(false);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [chargeCount, setChargeCount] = useState(0);
  const [duplicatesBlocked, setDuplicatesBlocked] = useState(0);
  const [processedEventIds, setProcessedEventIds] = useState<Set<string>>(new Set());
  const [sawOvercharge, setSawOvercharge] = useState(false);

  // Validation function
  const validateSolution = (): ValidationResult => {
    const errors: string[] = [];

    if (!sawOvercharge) {
      errors.push('Wait to see a customer get overcharged first (observe the problem)');
    }

    if (!idempotencyEnabled) {
      errors.push('Enable Idempotency to prevent duplicate charges');
    }

    if (duplicatesBlocked < 2) {
      errors.push(`Need to block at least 2 duplicate webhooks (currently ${duplicatesBlocked})`);
    }

    if (errors.length > 0) {
      return {
        valid: false,
        message: 'Idempotency not working yet!',
        details: errors,
      };
    }

    return {
      valid: true,
      message: 'Duplicate webhooks are now safely handled!',
    };
  };

  // Simulate webhook deliveries (with retries)
  useEffect(() => {
    const eventIds = ['evt_001', 'evt_002', 'evt_003'];
    let deliveryIndex = 0;

    const interval = setInterval(() => {
      // Stripe sends webhooks with retries
      const eventId = eventIds[deliveryIndex % 3];
      const attempt = Math.floor(deliveryIndex / 3) + 1;

      const delivery: WebhookDelivery = {
        id: Date.now(),
        eventId,
        attempt,
        status: 'pending',
      };

      setDeliveries(prev => [...prev.slice(-8), delivery]);

      // Process after a short delay
      setTimeout(() => {
        setDeliveries(prev => prev.map(d => {
          if (d.id !== delivery.id) return d;

          if (idempotencyEnabled) {
            // Check if already processed
            if (processedEventIds.has(eventId)) {
              setDuplicatesBlocked(c => c + 1);
              return { ...d, status: 'duplicate' };
            }
            // Mark as processed
            setProcessedEventIds(prev => new Set([...prev, eventId]));
          }

          // Process the charge
          setChargeCount(c => {
            // If this is a duplicate (attempt > 1 for same event), customer is overcharged
            if (!idempotencyEnabled && attempt > 1) {
              setSawOvercharge(true);
            }
            return c + 1;
          });
          return { ...d, status: 'processed' };
        }));
      }, 500);

      deliveryIndex++;
      if (deliveryIndex >= 12) {
        clearInterval(interval);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [idempotencyEnabled, processedEventIds]);

  const handleComplete = async () => {
    const success = await completeLevel('act3-level15-idempotency', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Stripe sends payment webhooks with automatic retries. Without idempotency, customers get charged multiple times for the same order!"
          instructions={[
            'Watch the duplicate webhook deliveries (same event ID)',
            'Notice customers being charged multiple times',
            'Enable idempotency to safely handle duplicates',
          ]}
          goal="Learn to use idempotency keys to prevent duplicate processing."
        >
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={() => {
                setIdempotencyEnabled(true);
                setProcessedEventIds(new Set());
              }}
              disabled={idempotencyEnabled}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                idempotencyEnabled
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {idempotencyEnabled ? 'Idempotency Enabled' : 'Enable Idempotency'}
            </button>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-lg p-3 text-center ${
                !idempotencyEnabled && chargeCount > 3 ? 'bg-red-900/30' : 'bg-gray-800'
              }`}>
                <div className={`text-2xl font-bold ${
                  !idempotencyEnabled && chargeCount > 3 ? 'text-red-400' : 'text-white'
                }`}>
                  ${chargeCount * 99}
                </div>
                <div className="text-xs text-gray-400">Total Charged</div>
                {!idempotencyEnabled && chargeCount > 3 && (
                  <div className="text-red-400 text-xs mt-1">Customer overcharged!</div>
                )}
              </div>
              <div className="bg-green-900/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{duplicatesBlocked}</div>
                <div className="text-xs text-green-400/70">Duplicates Blocked</div>
              </div>
            </div>
          </div>

        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={15}
          levelName="Idempotency"
          actNumber={3}
          onExit={onExit}
          onReset={() => {
            setIdempotencyEnabled(false);
            setDeliveries([]);
            setChargeCount(0);
            setDuplicatesBlocked(0);
            setProcessedEventIds(new Set());
            setSawOvercharge(false);
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-8">
          {/* Architecture */}
          <div className="flex items-center justify-center gap-8 mb-8">
            {/* Stripe */}
            <div className="bg-purple-900/40 border border-purple-600 rounded-xl p-4 w-40 text-center">
              <div className="text-2xl mb-2">S</div>
              <div className="text-purple-400 text-sm">Stripe</div>
              <div className="text-purple-300 text-xs mt-1">Sends webhooks</div>
            </div>

            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>

            {/* Idempotency Check */}
            {idempotencyEnabled && (
              <>
                <div className="bg-cyan-900/40 border border-cyan-600 rounded-xl p-4 w-40 text-center">
                  <div className="text-2xl mb-2">K</div>
                  <div className="text-cyan-400 text-sm">Idempotency</div>
                  <div className="text-cyan-300 text-xs mt-1">Check event_id</div>
                </div>

                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}

            {/* Your App */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 w-40 text-center">
              <div className="text-2xl mb-2">A</div>
              <div className="text-gray-400 text-sm">Your App</div>
              <div className="text-gray-500 text-xs mt-1">Charges customer</div>
            </div>
          </div>

          {/* Webhook Log */}
          <div className="bg-gray-900 rounded-xl p-4 max-w-2xl mx-auto">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-3">Webhook Deliveries</div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {deliveries.map(d => (
                <div
                  key={d.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    d.status === 'pending' ? 'bg-gray-800' :
                    d.status === 'processed' ? 'bg-green-900/30' :
                    d.status === 'duplicate' ? 'bg-yellow-900/30' :
                    'bg-red-900/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      d.status === 'pending' ? 'bg-gray-500 animate-pulse' :
                      d.status === 'processed' ? 'bg-green-500' :
                      d.status === 'duplicate' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`} />
                    <div>
                      <span className="text-gray-300 font-mono text-sm">{d.eventId}</span>
                      <span className="text-gray-500 text-xs ml-2">Attempt #{d.attempt}</span>
                    </div>
                  </div>
                  <div className="text-sm">
                    {d.status === 'pending' && (
                      <span className="text-gray-500">Processing...</span>
                    )}
                    {d.status === 'processed' && (
                      <span className="text-green-400">Charged $99</span>
                    )}
                    {d.status === 'duplicate' && (
                      <span className="text-yellow-400">Skipped (duplicate)</span>
                    )}
                  </div>
                </div>
              ))}
              {deliveries.length === 0 && (
                <div className="text-gray-600 text-center py-4">Waiting for webhooks...</div>
              )}
            </div>
          </div>

        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[{
            filename: 'app/services/webhook_processor.rb',
            language: 'ruby',
            code: `class WebhookProcessor
  def process(event)
    # Use event ID as idempotency key
    idempotency_key = "stripe:#{event.id}"

    # Check if already processed
    return if Redis.current.get(idempotency_key)

    # Process the webhook
    case event.type
    when 'payment_intent.succeeded'
      ChargeService.new(event.data).call
    when 'customer.subscription.updated'
      SubscriptionService.new(event.data).call
    end

    # Mark as processed (expire in 24h)
    Redis.current.setex(idempotency_key, 86400, '1')
  rescue => e
    # Don't mark as processed - allow retry
    raise e
  end
end`,
            highlight: [4, 7, 18],
          }]}
          learningGoal="Idempotency keys ensure operations are only processed once, even when webhooks are delivered multiple times."
        />
      </RightPanel>
    </LevelLayout>
  );
}

export default Level15Idempotency;
