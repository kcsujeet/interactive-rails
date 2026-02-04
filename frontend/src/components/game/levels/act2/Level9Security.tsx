/**
 * Level 9: Security & Credentials
 *
 * Learn to handle sensitive data properly with ENV variables and Rails credentials.
 * Player must secure database credentials and API keys.
 */

import { useState } from 'react';
import type { LevelComponentProps } from '../index';
import { Button } from '../../../ui/Button';
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
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Security Status
            </div>
            <div className={`p-3 rounded-lg ${exposedSecrets.length > 0 ? 'bg-destructive/20 border border-destructive' : 'bg-success/20 border border-success'}`}>
              {exposedSecrets.length > 0 ? (
                <div className="text-destructive text-sm">
                  {exposedSecrets.length} exposed secret(s)!
                </div>
              ) : (
                <div className="text-success text-sm">
                  All secrets secured
                </div>
              )}
            </div>

            {exposedSecrets.length > 0 && (
              <Button
                onClick={simulateBreach}
                variant="destructive"
                className="w-full mt-3"
              >
                Simulate Security Breach
              </Button>
            )}
          </div>

          {/* Progress */}
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Progress
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Secrets secured</span>
              <span className={securedSecrets.length === secrets.length ? 'text-success' : 'text-foreground'}>
                {securedSecrets.length} / {secrets.length}
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-success transition-all duration-300"
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

        <div className="flex-1 relative bg-background p-8 overflow-auto">
          {/* Security Breach Animation */}
          {showSecurityBreach && (
            <div className="absolute inset-0 bg-destructive/80 flex items-center justify-center z-50 animate-pulse">
              <div className="text-center">
                <div className="text-6xl mb-4">🚨</div>
                <div className="text-2xl font-bold text-foreground">SECURITY BREACH!</div>
                <div className="text-destructive-foreground mt-2">Hackers found your exposed credentials</div>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto grid grid-cols-3 gap-6">
            {/* Exposed Code */}
            <div className="bg-card rounded-xl border-2 border-destructive overflow-hidden">
              <div className="bg-destructive/20 px-4 py-3 border-b border-destructive/50">
                <div className="text-destructive font-semibold">Exposed in Code</div>
                <div className="text-destructive/80 text-xs">database.yml, config files</div>
              </div>
              <div className="p-4 space-y-2 min-h-[300px]">
                {secrets.filter(s => s.location === 'exposed').map(secret => (
                  <Button
                    key={secret.id}
                    variant="ghost"
                    onClick={() => setSelectedSecret(secret.id)}
                    className={`w-full p-3 h-auto rounded-lg text-left transition-all ${
                      selectedSecret === secret.id
                        ? 'bg-destructive/30 border-2 border-destructive'
                        : 'bg-destructive/10 border border-destructive/50 hover:border-destructive'
                    }`}
                  >
                    <div className="w-full">
                      <div className="text-destructive/80 font-medium text-sm">{secret.name}</div>
                      <div className="text-destructive font-mono text-xs truncate">{secret.value}</div>
                    </div>
                  </Button>
                ))}
                {secrets.filter(s => s.location === 'exposed').length === 0 && (
                  <div className="text-muted-foreground text-sm text-center py-8">
                    No exposed secrets
                  </div>
                )}
              </div>
            </div>

            {/* ENV Variables */}
            <div className="bg-card rounded-xl border-2 border-warning overflow-hidden">
              <div className="bg-warning/20 px-4 py-3 border-b border-warning/50">
                <div className="text-warning font-semibold">ENV Variables</div>
                <div className="text-warning/80 text-xs">.env, server config</div>
              </div>
              <div className="p-4 space-y-2 min-h-[300px]">
                {selectedSecret && (
                  <Button
                    variant="outline"
                    onClick={() => moveSecret(selectedSecret, 'env')}
                    className="w-full p-3 h-auto border-2 border-dashed border-warning text-warning hover:bg-warning/10"
                  >
                    + Move here
                  </Button>
                )}
                {secrets.filter(s => s.location === 'env').map(secret => (
                  <div
                    key={secret.id}
                    className={`p-3 rounded-lg ${
                      secret.correctLocation === 'env'
                        ? 'bg-success/20 border border-success'
                        : 'bg-destructive/20 border border-destructive'
                    }`}
                  >
                    <div className={`font-medium text-sm ${secret.correctLocation === 'env' ? 'text-success' : 'text-destructive'}`}>
                      {secret.name}
                    </div>
                    <div className="text-muted-foreground font-mono text-xs">
                      {secret.correctLocation === 'env' ? '✓ Correct' : '✗ Should be in credentials'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rails Credentials */}
            <div className="bg-card rounded-xl border-2 border-success overflow-hidden">
              <div className="bg-success/20 px-4 py-3 border-b border-success/50">
                <div className="text-success font-semibold">Rails Credentials</div>
                <div className="text-success/80 text-xs">credentials.yml.enc (encrypted)</div>
              </div>
              <div className="p-4 space-y-2 min-h-[300px]">
                {selectedSecret && (
                  <Button
                    variant="outline"
                    onClick={() => moveSecret(selectedSecret, 'credentials')}
                    className="w-full p-3 h-auto border-2 border-dashed border-success text-success hover:bg-success/10"
                  >
                    + Move here
                  </Button>
                )}
                {secrets.filter(s => s.location === 'credentials').map(secret => (
                  <div
                    key={secret.id}
                    className={`p-3 rounded-lg ${
                      secret.correctLocation === 'credentials'
                        ? 'bg-success/20 border border-success'
                        : 'bg-destructive/20 border border-destructive'
                    }`}
                  >
                    <div className={`font-medium text-sm ${secret.correctLocation === 'credentials' ? 'text-success' : 'text-destructive'}`}>
                      {secret.name}
                    </div>
                    <div className="text-muted-foreground font-mono text-xs">
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
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
              When to Use What
            </div>
            <div className="space-y-2 text-xs">
              <div className="p-2 bg-warning/10 rounded border border-warning/50">
                <div className="text-warning font-semibold">ENV Variables</div>
                <div className="text-muted-foreground">Environment, URLs, feature flags</div>
              </div>
              <div className="p-2 bg-success/10 rounded border border-success/50">
                <div className="text-success font-semibold">Credentials</div>
                <div className="text-muted-foreground">Passwords, API keys, tokens</div>
              </div>
            </div>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level9Security;
