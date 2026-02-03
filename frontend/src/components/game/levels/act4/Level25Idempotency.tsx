/**
 * Level 25: Idempotency
 *
 * Prevent duplicate operations with idempotency keys.
 * Player learns to handle retries safely.
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

interface PaymentAttempt {
  id: number;
  idempotencyKey: string | null;
  amount: number;
  status: 'processing' | 'success' | 'duplicate' | 'error';
  chargeCreated: boolean;
}

interface Config {
  useIdempotencyKey: boolean;
  storeResults: boolean;
  returnCached: boolean;
}

export function Level25Idempotency({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [config, setConfig] = useState<Config>({
    useIdempotencyKey: false,
    storeResults: false,
    returnCached: false,
  });
  const [attempts, setAttempts] = useState<PaymentAttempt[]>([]);
  const [totalCharges, setTotalCharges] = useState(0);
  const [processedKeys] = useState<Map<string, PaymentAttempt>>(new Map());
  const [currentKey, setCurrentKey] = useState<string>(`key_${Math.random().toString(36).substr(2, 8)}`);

  const chargeAmount = 99.99;

  const processPayment = (isRetry: boolean = false) => {
    const key = config.useIdempotencyKey ? currentKey : null;
    const attempt: PaymentAttempt = {
      id: Date.now(),
      idempotencyKey: key,
      amount: chargeAmount,
      status: 'processing',
      chargeCreated: false,
    };

    setAttempts(prev => [...prev.slice(-9), attempt]);

    setTimeout(() => {
      setAttempts(prev => prev.map(a => {
        if (a.id !== attempt.id) return a;

        // Check for duplicate with idempotency
        if (config.useIdempotencyKey && key && processedKeys.has(key)) {
          if (config.returnCached) {
            return { ...a, status: 'duplicate', chargeCreated: false };
          }
        }

        // Process payment
        const success = Math.random() > 0.3; // 70% success rate

        if (success) {
          // Only create charge if not already processed
          if (!config.useIdempotencyKey || !processedKeys.has(key!)) {
            setTotalCharges(prev => prev + 1);
            if (config.storeResults && key) {
              processedKeys.set(key, { ...a, status: 'success', chargeCreated: true });
            }
            return { ...a, status: 'success', chargeCreated: true };
          } else {
            return { ...a, status: 'duplicate', chargeCreated: false };
          }
        } else {
          return { ...a, status: 'error', chargeCreated: false };
        }
      }));
    }, 1000);
  };

  const retryPayment = () => {
    processPayment(true);
  };

  const newPayment = () => {
    setCurrentKey(`key_${Math.random().toString(36).substr(2, 8)}`);
    processPayment(false);
  };

  const toggleConfig = (key: keyof Config) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const validateSolution = (): ValidationResult => {
    if (!config.useIdempotencyKey) {
      return {
        valid: false,
        message: 'Enable idempotency keys!',
        details: ['Idempotency keys prevent duplicate charges'],
      };
    }
    if (!config.storeResults || !config.returnCached) {
      return {
        valid: false,
        message: 'Enable all idempotency features!',
        details: ['Store results and return cached responses'],
      };
    }
    return { valid: true, message: 'Idempotent payment processing configured!' };
  };

  const handleComplete = async () => {
    const success = await completeLevel('act4-level25-idempotency', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const duplicateCharges = totalCharges > attempts.filter(a => a.status === 'success' && a.chargeCreated).length;

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="A user clicks 'Pay' but gets a network error. They click again. Without idempotency, you charge them twice! This is a lawsuit waiting to happen."
          instructions={[
            'Generate unique idempotency key per operation',
            'Store the result with the key',
            'Return cached result for duplicate keys',
            'Never process the same key twice',
          ]}
          goal="Make payment processing safe for retries with idempotency."
        >
          {/* Charge Counter */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Actual Charges Created
            </div>
            <div className={`text-center p-4 rounded-lg border-2 ${
              duplicateCharges ? 'border-red-500 bg-red-900/20' : 'border-green-500 bg-green-900/20'
            }`}>
              <div className={`text-4xl font-bold ${duplicateCharges ? 'text-red-400' : 'text-green-400'}`}>
                {totalCharges}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {duplicateCharges ? '⚠️ Duplicate charges detected!' : 'No duplicates'}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Current Idempotency Key
            </div>
            <div className="font-mono text-xs text-cyan-400 bg-gray-800 p-2 rounded break-all">
              {config.useIdempotencyKey ? currentKey : 'None (unsafe!)'}
            </div>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Safety features</span>
              <span className={Object.values(config).filter(Boolean).length === 3 ? 'text-green-400' : 'text-white'}>
                {Object.values(config).filter(Boolean).length} / 3
              </span>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={25}
          levelName="Idempotency"
          actNumber={4}
          onExit={onExit}
          onReset={() => {
            setConfig({ useIdempotencyKey: false, storeResults: false, returnCached: false });
            setAttempts([]);
            setTotalCharges(0);
            processedKeys.clear();
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* Configuration */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Idempotency Configuration</div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-4">
                {[
                  { key: 'useIdempotencyKey', name: 'Use Idempotency Key', icon: '🔑', desc: 'Client sends unique key per request' },
                  { key: 'storeResults', name: 'Store Results', icon: '💾', desc: 'Save result with idempotency key' },
                  { key: 'returnCached', name: 'Return Cached', icon: '📦', desc: 'Return stored result for duplicate key' },
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => toggleConfig(item.key as keyof Config)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      config[item.key as keyof Config]
                        ? 'border-green-500 bg-green-900/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <div className={`font-semibold text-sm ${config[item.key as keyof Config] ? 'text-green-400' : 'text-white'}`}>
                      {item.name}
                    </div>
                    <div className="text-xs text-gray-500">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Simulation */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Payment Simulation</div>
                <div className="text-xs text-gray-500">Simulate a user making a payment with potential retries</div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="text-center p-6 bg-gray-800 rounded-xl">
                    <div className="text-3xl mb-2">💳</div>
                    <div className="text-white font-semibold">${chargeAmount}</div>
                    <div className="text-xs text-gray-500">Purchase</div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={newPayment}
                      className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-all"
                    >
                      New Payment
                    </button>
                    <button
                      onClick={retryPayment}
                      className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-medium transition-all"
                    >
                      Retry (Same Key)
                    </button>
                  </div>
                </div>

                {/* Scenario Explanation */}
                <div className="bg-gray-800 rounded-lg p-4 text-sm">
                  <div className="text-yellow-400 font-semibold mb-2">Scenario:</div>
                  <div className="text-gray-400">
                    User clicks "Pay" → Request times out → User clicks "Retry"
                    <br />
                    <span className={config.useIdempotencyKey ? 'text-green-400' : 'text-red-400'}>
                      {config.useIdempotencyKey
                        ? '✓ Same idempotency key = safe to retry'
                        : '✗ No idempotency key = potential double charge!'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Attempt Log */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Payment Attempts</div>
              </div>
              <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                {attempts.length === 0 ? (
                  <div className="text-center py-4 text-gray-600">
                    Click "New Payment" or "Retry" to simulate payments
                  </div>
                ) : (
                  attempts.map(attempt => (
                    <div
                      key={attempt.id}
                      className={`p-3 rounded-lg border ${
                        attempt.status === 'success' ? 'border-green-600 bg-green-900/10' :
                        attempt.status === 'duplicate' ? 'border-yellow-600 bg-yellow-900/10' :
                        attempt.status === 'error' ? 'border-red-600 bg-red-900/10' :
                        'border-gray-700 bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`text-lg ${
                            attempt.status === 'success' ? '✓' :
                            attempt.status === 'duplicate' ? '↩️' :
                            attempt.status === 'error' ? '✗' : '⏳'
                          }`}>
                            {attempt.status === 'success' ? '✓' :
                             attempt.status === 'duplicate' ? '↩️' :
                             attempt.status === 'error' ? '✗' : '⏳'}
                          </span>
                          <div>
                            <div className="text-white text-sm">${attempt.amount}</div>
                            <div className="text-xs text-gray-500 font-mono">
                              {attempt.idempotencyKey || 'no key'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm ${
                            attempt.status === 'success' ? 'text-green-400' :
                            attempt.status === 'duplicate' ? 'text-yellow-400' :
                            attempt.status === 'error' ? 'text-red-400' : 'text-gray-400'
                          }`}>
                            {attempt.status}
                          </div>
                          <div className="text-xs text-gray-500">
                            {attempt.chargeCreated ? 'Charge created' : 'No charge'}
                          </div>
                        </div>
                      </div>
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
              filename: 'app/services/payment_service.rb',
              language: 'ruby',
              code: `class PaymentService
  def charge(amount:, idempotency_key:)
    # Check for existing result
    if (cached = IdempotencyStore.get(idempotency_key))
      return cached  # Return same result
    end

    # Process payment
    result = Stripe::Charge.create(
      amount: amount,
      idempotency_key: idempotency_key
    )

    # Store result
    IdempotencyStore.set(
      idempotency_key,
      result,
      expires_in: 24.hours
    )

    result
  end
end`,
              highlight: [3, 4, 5, 6, 14, 15, 16, 17, 18],
            },
          ]}
          learningGoal="Idempotency ensures the same request produces the same result, no matter how many times it's sent. Critical for payments!"
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Key Principles</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Client generates unique key</li>
              <li>• Server stores result with key</li>
              <li>• Same key = same result returned</li>
              <li>• Expires after reasonable time</li>
            </ul>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Use Cases</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Payment processing</li>
              <li>• Order creation</li>
              <li>• Account creation</li>
              <li>• Any non-repeatable action</li>
            </ul>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level25Idempotency;
