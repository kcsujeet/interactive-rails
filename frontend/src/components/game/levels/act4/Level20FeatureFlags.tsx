/**
 * Level 20: Feature Flags
 *
 * Gradual rollout with traffic percentage control.
 * Shows A/B testing and kill switch patterns.
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
} from '../shared';

interface Request {
  id: number;
  version: 'old' | 'new';
  status: 'success' | 'error';
}

export function Level20FeatureFlags({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [flagEnabled, setFlagEnabled] = useState(false);
  const [rolloutPercentage, setRolloutPercentage] = useState(10);
  const [requests, setRequests] = useState<Request[]>([]);
  const [oldErrors, setOldErrors] = useState(0);
  const [newErrors, setNewErrors] = useState(0);
  const [oldSuccesses, setOldSuccesses] = useState(0);
  const [newSuccesses, setNewSuccesses] = useState(0);

  const isComplete = flagEnabled && rolloutPercentage === 100 && newSuccesses >= 5;

  // Simulate traffic
  useEffect(() => {
    const interval = setInterval(() => {
      const id = Date.now();
      const goesToNew = flagEnabled && Math.random() * 100 < rolloutPercentage;
      const version = goesToNew ? 'new' : 'old';
      // Old version has 20% error rate, new has 5%
      const hasError = version === 'old' ? Math.random() < 0.2 : Math.random() < 0.05;
      const status = hasError ? 'error' : 'success';

      if (status === 'error') {
        if (version === 'old') setOldErrors(e => e + 1);
        else setNewErrors(e => e + 1);
      } else {
        if (version === 'old') setOldSuccesses(s => s + 1);
        else setNewSuccesses(s => s + 1);
      }

      setRequests(prev => [...prev.slice(-20), { id, version, status }]);
    }, 300);

    return () => clearInterval(interval);
  }, [flagEnabled, rolloutPercentage]);

  const handleComplete = async () => {
    const success = await completeLevel('act4-level20-feature-flags', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const oldTotal = oldSuccesses + oldErrors;
  const newTotal = newSuccesses + newErrors;
  const oldErrorRate = oldTotal > 0 ? Math.round((oldErrors / oldTotal) * 100) : 0;
  const newErrorRate = newTotal > 0 ? Math.round((newErrors / newTotal) * 100) : 0;

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="We need to deploy a new checkout flow, but we're afraid it might have bugs. How do we test in production without affecting all users?"
          instructions={[
            'Watch the error rate on the old version',
            'Enable feature flag with small rollout',
            'Gradually increase to 100% as errors stay low',
          ]}
          goal="Learn to use feature flags for gradual rollouts and safe deployments."
        >
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={() => setFlagEnabled(true)}
              disabled={flagEnabled}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                flagEnabled
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {flagEnabled ? 'Feature Flag Enabled' : 'Enable Feature Flag'}
            </button>
          </div>

          {flagEnabled && (
            <div className="p-4 border-t border-gray-800">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Rollout Percentage
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={rolloutPercentage}
                onChange={(e) => setRolloutPercentage(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-500">0%</span>
                <span className="text-cyan-400 font-bold">{rolloutPercentage}%</span>
                <span className="text-gray-500">100%</span>
              </div>
            </div>
          )}

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Error Rates
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Old Checkout:</span>
                <span className={`font-bold ${oldErrorRate > 10 ? 'text-red-400' : 'text-green-400'}`}>
                  {oldErrorRate}% errors
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">New Checkout:</span>
                <span className={`font-bold ${newErrorRate > 10 ? 'text-red-400' : 'text-green-400'}`}>
                  {newTotal > 0 ? `${newErrorRate}% errors` : 'No data'}
                </span>
              </div>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={20}
          levelName="Feature Flags"
          actNumber={4}
          onExit={onExit}
          onReset={() => {
            setFlagEnabled(false);
            setRolloutPercentage(10);
            setRequests([]);
            setOldErrors(0);
            setNewErrors(0);
            setOldSuccesses(0);
            setNewSuccesses(0);
          }}
        />

        <div className="flex-1 relative bg-gray-950 p-8">
          {/* Traffic Split Visualization */}
          <div className="flex justify-center gap-8 mb-8">
            {/* Old Version */}
            <div className={`border rounded-xl p-4 w-48 text-center transition-colors ${
              !flagEnabled || rolloutPercentage < 100 ? 'bg-gray-800 border-gray-600' : 'bg-gray-900 border-gray-800 opacity-50'
            }`}>
              <div className="text-gray-400 font-medium">Old Checkout</div>
              <div className="text-3xl font-bold text-gray-300 mt-2">
                {flagEnabled ? 100 - rolloutPercentage : 100}%
              </div>
              <div className="text-xs text-gray-500 mt-1">of traffic</div>
              <div className={`mt-3 text-sm ${oldErrorRate > 10 ? 'text-red-400' : 'text-green-400'}`}>
                {oldErrorRate}% error rate
              </div>
            </div>

            {/* New Version */}
            <div className={`border rounded-xl p-4 w-48 text-center transition-colors ${
              flagEnabled ? 'bg-cyan-900/30 border-cyan-600' : 'bg-gray-900 border-gray-800 opacity-50'
            }`}>
              <div className="text-cyan-400 font-medium">New Checkout</div>
              <div className="text-3xl font-bold text-cyan-300 mt-2">
                {flagEnabled ? rolloutPercentage : 0}%
              </div>
              <div className="text-xs text-cyan-400/70 mt-1">of traffic</div>
              {flagEnabled && newTotal > 0 && (
                <div className={`mt-3 text-sm ${newErrorRate > 10 ? 'text-red-400' : 'text-green-400'}`}>
                  {newErrorRate}% error rate
                </div>
              )}
            </div>
          </div>

          {/* Live Traffic */}
          <div className="bg-gray-900 rounded-xl p-4 max-w-2xl mx-auto">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-3">Live Traffic</div>
            <div className="flex flex-wrap gap-2 h-32 overflow-hidden">
              {requests.map(r => (
                <div
                  key={r.id}
                  className={`w-4 h-4 rounded-sm ${
                    r.version === 'old'
                      ? r.status === 'success' ? 'bg-gray-500' : 'bg-red-600'
                      : r.status === 'success' ? 'bg-cyan-500' : 'bg-red-600'
                  }`}
                  title={`${r.version} - ${r.status}`}
                />
              ))}
            </div>
            <div className="flex gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gray-500 rounded-sm" />
                <span className="text-gray-400">Old OK</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-cyan-500 rounded-sm" />
                <span className="text-gray-400">New OK</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-600 rounded-sm" />
                <span className="text-gray-400">Error</span>
              </div>
            </div>
          </div>

          {/* Completion button */}
          {isComplete && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
              <button
                onClick={handleComplete}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold rounded-lg shadow-lg"
              >
                Complete Level
              </button>
            </div>
          )}
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[{
            filename: 'app/controllers/checkouts_controller.rb',
            language: 'ruby',
            code: `class CheckoutsController < ApplicationController
  def create
    if Flipper.enabled?(:new_checkout, current_user)
      # New checkout flow
      NewCheckoutService.new(current_user, cart).call
    else
      # Old checkout flow
      LegacyCheckoutService.new(current_user, cart).call
    end
  end
end

# config/initializers/flipper.rb
Flipper.configure do |config|
  config.default do
    adapter = Flipper::Adapters::Redis.new(Redis.current)
    Flipper.new(adapter)
  end
end

# Gradual rollout
Flipper.enable_percentage_of_actors(:new_checkout, 10)

# Instant kill switch if something goes wrong
Flipper.disable(:new_checkout)`,
            highlight: [3, 5, 8, 21, 24],
          }]}
          learningGoal="Feature flags enable gradual rollouts and instant kill switches. Always have a way to quickly disable new features in production."
        />
      </RightPanel>
    </LevelLayout>
  );
}

export default Level20FeatureFlags;
