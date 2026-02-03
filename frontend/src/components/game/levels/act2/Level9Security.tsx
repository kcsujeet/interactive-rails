/**
 * Level 9: Security & Credentials
 *
 * Learn to handle sensitive data properly with ENV variables and Rails credentials.
 * Player must secure database credentials and API keys.
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

interface Secret {
  id: string;
  name: string;
  value: string;
  location: 'exposed' | 'env' | 'credentials' | null;
  correctLocation: 'env' | 'credentials';
  description: string;
}

const SECRETS: Secret[] = [
  {
    id: 'db_password',
    name: 'Database Password',
    value: 'super_secret_123',
    location: 'exposed',
    correctLocation: 'credentials',
    description: 'Production database password',
  },
  {
    id: 'stripe_key',
    name: 'Stripe API Key',
    value: 'sk_live_abc123...',
    location: 'exposed',
    correctLocation: 'credentials',
    description: 'Payment processing secret key',
  },
  {
    id: 'rails_env',
    name: 'Rails Environment',
    value: 'production',
    location: null,
    correctLocation: 'env',
    description: 'Current environment (dev/staging/prod)',
  },
  {
    id: 'redis_url',
    name: 'Redis URL',
    value: 'redis://localhost:6379',
    location: null,
    correctLocation: 'env',
    description: 'Cache server connection string',
  },
];

export function Level9Security({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [secrets, setSecrets] = useState<Secret[]>(SECRETS);
  const [selectedSecret, setSelectedSecret] = useState<string | null>(null);
  const [showSecurityBreach, setShowSecurityBreach] = useState(false);

  const exposedSecrets = secrets.filter(s => s.location === 'exposed');
  const securedSecrets = secrets.filter(s => s.location === s.correctLocation);

  const validateSolution = (): ValidationResult => {
    const errors: string[] = [];

    const stillExposed = secrets.filter(s => s.location === 'exposed');
    if (stillExposed.length > 0) {
      errors.push(`${stillExposed.length} secret(s) still exposed in code!`);
    }

    const wrongLocation = secrets.filter(s => s.location && s.location !== 'exposed' && s.location !== s.correctLocation);
    if (wrongLocation.length > 0) {
      errors.push(`${wrongLocation.length} secret(s) in wrong location`);
    }

    const notPlaced = secrets.filter(s => s.location === null);
    if (notPlaced.length > 0) {
      errors.push(`${notPlaced.length} secret(s) need to be configured`);
    }

    if (errors.length > 0) {
      return { valid: false, message: 'Security vulnerabilities remain!', details: errors };
    }

    return { valid: true, message: 'All secrets properly secured!' };
  };

  const moveSecret = (secretId: string, location: 'env' | 'credentials') => {
    setSecrets(prev =>
      prev.map(s => (s.id === secretId ? { ...s, location } : s))
    );
    setSelectedSecret(null);
  };

  const simulateBreach = () => {
    if (exposedSecrets.length > 0) {
      setShowSecurityBreach(true);
      setTimeout(() => setShowSecurityBreach(false), 3000);
    }
  };

  const handleComplete = async () => {
    const success = await completeLevel('act2-level9-security', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="A security audit found credentials hardcoded in your codebase. If this gets to GitHub, hackers will find it in seconds."
          instructions={[
            'Identify exposed secrets in the code',
            'Move secrets to ENV variables or Rails credentials',
            'ENV: for non-sensitive config (environment, URLs)',
            'Credentials: for sensitive secrets (passwords, API keys)',
          ]}
          goal="Never commit secrets to version control. Use environment variables and encrypted credentials."
        >
          {/* Security Status */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Security Status
            </div>
            <div className={`p-3 rounded-lg ${exposedSecrets.length > 0 ? 'bg-red-900/30 border border-red-600' : 'bg-green-900/30 border border-green-600'}`}>
              {exposedSecrets.length > 0 ? (
                <div className="text-red-400 text-sm">
                  {exposedSecrets.length} exposed secret(s)!
                </div>
              ) : (
                <div className="text-green-400 text-sm">
                  All secrets secured
                </div>
              )}
            </div>

            {exposedSecrets.length > 0 && (
              <button
                onClick={simulateBreach}
                className="w-full mt-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
              >
                Simulate Security Breach
              </button>
            )}
          </div>

          {/* Progress */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Progress
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Secrets secured</span>
              <span className={securedSecrets.length === secrets.length ? 'text-green-400' : 'text-white'}>
                {securedSecrets.length} / {secrets.length}
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${(securedSecrets.length / secrets.length) * 100}%` }}
              />
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={9}
          levelName="Security & Credentials"
          actNumber={2}
          onExit={onExit}
          onReset={() => setSecrets(SECRETS)}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-8 overflow-auto">
          {/* Security Breach Animation */}
          {showSecurityBreach && (
            <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center z-50 animate-pulse">
              <div className="text-center">
                <div className="text-6xl mb-4">🚨</div>
                <div className="text-2xl font-bold text-white">SECURITY BREACH!</div>
                <div className="text-red-200 mt-2">Hackers found your exposed credentials</div>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto grid grid-cols-3 gap-6">
            {/* Exposed Code */}
            <div className="bg-gray-900 rounded-xl border-2 border-red-500 overflow-hidden">
              <div className="bg-red-900/40 px-4 py-3 border-b border-red-500/50">
                <div className="text-red-400 font-semibold">Exposed in Code</div>
                <div className="text-red-300 text-xs">database.yml, config files</div>
              </div>
              <div className="p-4 space-y-2 min-h-[300px]">
                {secrets.filter(s => s.location === 'exposed').map(secret => (
                  <button
                    key={secret.id}
                    onClick={() => setSelectedSecret(secret.id)}
                    className={`w-full p-3 rounded-lg text-left transition-all ${
                      selectedSecret === secret.id
                        ? 'bg-red-800 border-2 border-red-400'
                        : 'bg-red-900/30 border border-red-700 hover:border-red-500'
                    }`}
                  >
                    <div className="text-red-300 font-medium text-sm">{secret.name}</div>
                    <div className="text-red-400 font-mono text-xs truncate">{secret.value}</div>
                  </button>
                ))}
                {secrets.filter(s => s.location === 'exposed').length === 0 && (
                  <div className="text-gray-600 text-sm text-center py-8">
                    No exposed secrets
                  </div>
                )}
              </div>
            </div>

            {/* ENV Variables */}
            <div className="bg-gray-900 rounded-xl border-2 border-amber-500 overflow-hidden">
              <div className="bg-amber-900/40 px-4 py-3 border-b border-amber-500/50">
                <div className="text-amber-400 font-semibold">ENV Variables</div>
                <div className="text-amber-300 text-xs">.env, server config</div>
              </div>
              <div className="p-4 space-y-2 min-h-[300px]">
                {selectedSecret && (
                  <button
                    onClick={() => moveSecret(selectedSecret, 'env')}
                    className="w-full p-3 rounded-lg border-2 border-dashed border-amber-500 text-amber-400 text-sm hover:bg-amber-900/20 transition-colors"
                  >
                    + Move here
                  </button>
                )}
                {secrets.filter(s => s.location === 'env').map(secret => (
                  <div
                    key={secret.id}
                    className={`p-3 rounded-lg ${
                      secret.correctLocation === 'env'
                        ? 'bg-green-900/30 border border-green-600'
                        : 'bg-red-900/30 border border-red-600'
                    }`}
                  >
                    <div className={`font-medium text-sm ${secret.correctLocation === 'env' ? 'text-green-300' : 'text-red-300'}`}>
                      {secret.name}
                    </div>
                    <div className="text-gray-400 font-mono text-xs">
                      {secret.correctLocation === 'env' ? '✓ Correct' : '✗ Should be in credentials'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rails Credentials */}
            <div className="bg-gray-900 rounded-xl border-2 border-green-500 overflow-hidden">
              <div className="bg-green-900/40 px-4 py-3 border-b border-green-500/50">
                <div className="text-green-400 font-semibold">Rails Credentials</div>
                <div className="text-green-300 text-xs">credentials.yml.enc (encrypted)</div>
              </div>
              <div className="p-4 space-y-2 min-h-[300px]">
                {selectedSecret && (
                  <button
                    onClick={() => moveSecret(selectedSecret, 'credentials')}
                    className="w-full p-3 rounded-lg border-2 border-dashed border-green-500 text-green-400 text-sm hover:bg-green-900/20 transition-colors"
                  >
                    + Move here
                  </button>
                )}
                {secrets.filter(s => s.location === 'credentials').map(secret => (
                  <div
                    key={secret.id}
                    className={`p-3 rounded-lg ${
                      secret.correctLocation === 'credentials'
                        ? 'bg-green-900/30 border border-green-600'
                        : 'bg-red-900/30 border border-red-600'
                    }`}
                  >
                    <div className={`font-medium text-sm ${secret.correctLocation === 'credentials' ? 'text-green-300' : 'text-red-300'}`}>
                      {secret.name}
                    </div>
                    <div className="text-gray-400 font-mono text-xs">
                      {secret.correctLocation === 'credentials' ? '✓ Encrypted' : '✗ Should be in ENV'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[
            {
              filename: 'config/database.yml',
              language: 'yaml',
              code: secrets.find(s => s.id === 'db_password')?.location === 'credentials'
                ? `production:
  adapter: postgresql
  database: myapp_production
  password: <%= Rails.application.credentials.db_password %>`
                : `production:
  adapter: postgresql
  database: myapp_production
  # DANGER: Hardcoded password!
  password: super_secret_123`,
              highlight: [4],
            },
            {
              filename: 'config/credentials.yml.enc',
              language: 'yaml',
              code: `# Encrypted with master key
# Edit with: rails credentials:edit

db_password: [ENCRYPTED]
stripe_key: [ENCRYPTED]

# Master key in config/master.key
# NEVER commit master.key!`,
              highlight: [4, 5],
            },
          ]}
          learningGoal="ENV variables for non-sensitive config, Rails credentials for secrets. Never commit passwords or API keys to git."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">
              When to Use What
            </div>
            <div className="space-y-2 text-xs">
              <div className="p-2 bg-amber-900/20 rounded border border-amber-700">
                <div className="text-amber-400 font-semibold">ENV Variables</div>
                <div className="text-gray-400">Environment, URLs, feature flags</div>
              </div>
              <div className="p-2 bg-green-900/20 rounded border border-green-700">
                <div className="text-green-400 font-semibold">Credentials</div>
                <div className="text-gray-400">Passwords, API keys, tokens</div>
              </div>
            </div>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level9Security;
