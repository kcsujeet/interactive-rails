/**
 * Level 35: Microservices - CAPSTONE
 *
 * Break a monolith into microservices using the Scalpel tool.
 * Player learns bounded contexts and service extraction.
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

interface Domain {
  id: string;
  name: string;
  icon: string;
  description: string;
  dependencies: string[];
  extracted: boolean;
  color: string;
}

const INITIAL_DOMAINS: Domain[] = [
  { id: 'users', name: 'Users', icon: '👤', description: 'Authentication, profiles, roles', dependencies: [], extracted: false, color: '#3b82f6' },
  { id: 'products', name: 'Products', icon: '📦', description: 'Catalog, inventory, pricing', dependencies: [], extracted: false, color: '#22c55e' },
  { id: 'orders', name: 'Orders', icon: '🛒', description: 'Cart, checkout, order history', dependencies: ['users', 'products', 'payments'], extracted: false, color: '#f59e0b' },
  { id: 'payments', name: 'Payments', icon: '💳', description: 'Transactions, refunds, billing', dependencies: ['users'], extracted: false, color: '#ef4444' },
  { id: 'notifications', name: 'Notifications', icon: '🔔', description: 'Email, SMS, push notifications', dependencies: ['users'], extracted: false, color: '#8b5cf6' },
  { id: 'analytics', name: 'Analytics', icon: '📊', description: 'Metrics, reports, dashboards', dependencies: ['users', 'orders', 'products'], extracted: false, color: '#06b6d4' },
];

export function Level35Microservices({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [domains, setDomains] = useState<Domain[]>(INITIAL_DOMAINS);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [extractionOrder, setExtractionOrder] = useState<string[]>([]);
  const [showDependencies, setShowDependencies] = useState(true);

  const extractedCount = domains.filter(d => d.extracted).length;
  const monolithDomains = domains.filter(d => !d.extracted);
  const extractedDomains = domains.filter(d => d.extracted);

  const canExtract = (domainId: string): boolean => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) return false;

    // Can only extract if all dependencies are already extracted or being extracted together
    return domain.dependencies.every(depId => {
      const dep = domains.find(d => d.id === depId);
      return dep?.extracted;
    });
  };

  const extractDomain = (domainId: string) => {
    if (!canExtract(domainId)) {
      alert(`Extract dependencies first: ${domains.find(d => d.id === domainId)?.dependencies.filter(depId => !domains.find(d => d.id === depId)?.extracted).join(', ')}`);
      return;
    }

    setDomains(prev => prev.map(d =>
      d.id === domainId ? { ...d, extracted: true } : d
    ));
    setExtractionOrder(prev => [...prev, domainId]);
  };

  const returnToMonolith = (domainId: string) => {
    // Check if any extracted domain depends on this one
    const dependents = extractedDomains.filter(d =>
      d.dependencies.includes(domainId) && d.extracted
    );

    if (dependents.length > 0) {
      alert(`Cannot return: ${dependents.map(d => d.name).join(', ')} depend on this service`);
      return;
    }

    setDomains(prev => prev.map(d =>
      d.id === domainId ? { ...d, extracted: false } : d
    ));
    setExtractionOrder(prev => prev.filter(id => id !== domainId));
  };

  const validateSolution = (): ValidationResult => {
    if (extractedCount < 3) {
      return {
        valid: false,
        message: 'Extract more services!',
        details: ['Extract at least 3 bounded contexts as microservices'],
      };
    }

    // Check extraction order makes sense (dependencies first)
    const orderValid = extractionOrder.every((id, index) => {
      const domain = domains.find(d => d.id === id);
      if (!domain) return true;
      return domain.dependencies.every(depId => {
        const depIndex = extractionOrder.indexOf(depId);
        return depIndex < index;
      });
    });

    if (!orderValid) {
      return {
        valid: false,
        message: 'Extraction order has issues!',
        details: ['Services should be extracted after their dependencies'],
      };
    }

    return { valid: true, message: 'Congratulations! You\'ve mastered Rails architecture!' };
  };

  const handleComplete = async () => {
    const success = await completeLevel('act6-level35-microservices', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="CAPSTONE LEVEL: Your monolith has grown into a beast. Different teams stepping on each other, deployments are risky, and scaling is impossible. Time for the Strangler Fig pattern!"
          instructions={[
            '1. Identify bounded contexts (domains)',
            '2. Extract services with no/few dependencies first',
            '3. Use API Gateway for routing',
            '4. Gradually migrate traffic',
          ]}
          goal="Successfully decompose the monolith into microservices following proper extraction order."
        >
          {/* Extraction Order */}
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Extraction Order
            </div>
            {extractionOrder.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-2">
                No services extracted yet
              </div>
            ) : (
              <div className="space-y-1">
                {extractionOrder.map((id, index) => {
                  const domain = domains.find(d => d.id === id);
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 text-xs p-2 rounded"
                      style={{ backgroundColor: `${domain?.color}20` }}
                    >
                      <span className="text-muted-foreground">{index + 1}.</span>
                      <span>{domain?.icon}</span>
                      <span style={{ color: domain?.color }}>{domain?.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={showDependencies}
                onChange={(e) => setShowDependencies(e.target.checked)}
                className="rounded"
              />
              Show dependencies
            </label>
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Services extracted</span>
              <span className={extractedCount >= 3 ? 'text-success' : 'text-foreground'}>
                {extractedCount} / {domains.length}
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-success transition-all"
                style={{ width: `${(extractedCount / domains.length) * 100}%` }}
              />
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={35}
          levelName="Microservices"
          actNumber={6}
          onExit={onExit}
          onReset={() => {
            setDomains(INITIAL_DOMAINS);
            setSelectedDomain(null);
            setExtractionOrder([]);
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-background p-6 overflow-auto">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 gap-8">
              {/* Monolith */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="bg-destructive/30 px-4 py-3 border-b border-border">
                  <div className="text-destructive font-semibold flex items-center gap-2">
                    <span className="text-2xl">🏔️</span>
                    Monolith
                  </div>
                  <div className="text-xs text-muted-foreground">{monolithDomains.length} domains remaining</div>
                </div>
                <div className="p-4">
                  {monolithDomains.length === 0 ? (
                    <div className="text-center py-8 text-success">
                      Monolith fully decomposed!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {monolithDomains.map(domain => {
                        const extractable = canExtract(domain.id);
                        const unmetDeps = domain.dependencies.filter(
                          depId => !domains.find(d => d.id === depId)?.extracted
                        );

                        return (
                          <div
                            key={domain.id}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              extractable
                                ? 'border-success bg-success/10 cursor-pointer hover:bg-success/20'
                                : 'border-border bg-secondary/50'
                            }`}
                            onClick={() => extractable && extractDomain(domain.id)}
                            style={{ borderColor: extractable ? '#22c55e' : undefined }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{domain.icon}</span>
                                <div>
                                  <div className="font-semibold" style={{ color: domain.color }}>
                                    {domain.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{domain.description}</div>
                                </div>
                              </div>
                              {extractable ? (
                                <span className="text-success text-xs px-2 py-1 bg-success/40 rounded">
                                  Extract
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  Blocked
                                </span>
                              )}
                            </div>
                            {showDependencies && unmetDeps.length > 0 && (
                              <div className="mt-2 text-xs text-warning">
                                Needs: {unmetDeps.map(id => domains.find(d => d.id === id)?.name).join(', ')}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Microservices */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="bg-success/30 px-4 py-3 border-b border-border">
                  <div className="text-success font-semibold flex items-center gap-2">
                    <span className="text-2xl">🔬</span>
                    Microservices
                  </div>
                  <div className="text-xs text-muted-foreground">{extractedDomains.length} services deployed</div>
                </div>
                <div className="p-4">
                  {extractedDomains.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Click domains on the left to extract them as microservices.
                      <br /><br />
                      <span className="text-primary">Tip:</span> Start with services that have no dependencies!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {extractedDomains.map(domain => (
                        <div
                          key={domain.id}
                          className="p-4 rounded-lg border-2 cursor-pointer hover:opacity-80 transition-all"
                          style={{ borderColor: domain.color, backgroundColor: `${domain.color}10` }}
                          onClick={() => returnToMonolith(domain.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{domain.icon}</span>
                              <div>
                                <div className="font-semibold" style={{ color: domain.color }}>
                                  {domain.name} Service
                                </div>
                                <div className="text-xs text-muted-foreground">{domain.description}</div>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Click to return
                            </span>
                          </div>
                          {showDependencies && domain.dependencies.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Uses: {domain.dependencies.map(id => domains.find(d => d.id === id)?.name).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Architecture Tips */}
            {extractedCount >= 3 && (
              <div className="mt-6 bg-gradient-to-r from-primary/30 to-purple-900/30 border border-primary rounded-xl p-6">
                <div className="text-center">
                  <div className="text-3xl mb-2">🎓</div>
                  <div className="text-xl font-bold text-primary mb-2">
                    Congratulations, Rails Expert!
                  </div>
                  <div className="text-muted-foreground max-w-lg mx-auto">
                    You've completed the journey from "Hello Rails" to microservices architecture.
                    You now understand how to build, scale, and maintain production Rails applications.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[
            {
              filename: 'Architecture Decision',
              language: 'markdown',
              code: `# Microservices Extraction Guide

## Extraction Order Matters!

1. **Independent services first**
   - Users (no dependencies)
   - Products (no dependencies)

2. **Then dependent services**
   - Payments (needs Users)
   - Orders (needs Users, Products, Payments)

3. **Finally, cross-cutting services**
   - Analytics (reads from everything)
   - Notifications (needs Users)

## Communication Patterns

- **Sync**: REST/gRPC for queries
- **Async**: Events for commands
- **Saga**: For distributed transactions`,
              highlight: [],
            },
            {
              filename: 'docker-compose.yml',
              language: 'yaml',
              code: extractedDomains.length > 0 ? `version: '3.8'

services:
${extractedDomains.map(d => `  ${d.id}-service:
    build: ./${d.id}
    ports:
      - "${3000 + extractedDomains.indexOf(d)}:3000"
    environment:
      - DATABASE_URL=postgres://${d.id}_db
      - REDIS_URL=redis://redis:6379`).join('\n\n')}

  api-gateway:
    image: nginx
    ports:
      - "80:80"
    depends_on:
${extractedDomains.map(d => `      - ${d.id}-service`).join('\n')}` :
`# Extract services to generate
# docker-compose configuration`,
              highlight: [],
            },
          ]}
          learningGoal="Microservices enable independent deployment, scaling, and technology choices. But they add complexity - only extract when you have a good reason!"
        >
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">When to Extract</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✓ Different scaling needs</li>
              <li>✓ Different team ownership</li>
              <li>✓ Different release cycles</li>
              <li>✓ Technology diversity needed</li>
            </ul>
          </div>

          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2">Common Mistakes</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✗ Too many services too soon</li>
              <li>✗ Distributed monolith</li>
              <li>✗ Ignoring data consistency</li>
              <li>✗ No observability</li>
            </ul>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level35Microservices;
