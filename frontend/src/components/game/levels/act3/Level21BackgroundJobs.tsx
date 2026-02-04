/**
 * Level 21: Background Jobs
 *
 * Move slow operations to background workers.
 * Player learns to use Sidekiq for async processing.
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
import { Button } from '../../../ui/Button';

interface SlowOperation {
  id: string;
  name: string;
  description: string;
  duration: number;
  icon: string;
  isBackground: boolean;
  isRunning: boolean;
  progress: number;
}

const INITIAL_OPERATIONS: SlowOperation[] = [
  { id: 'email', name: 'Send Email', description: 'Send welcome email to user', duration: 2000, icon: '📧', isBackground: false, isRunning: false, progress: 0 },
  { id: 'pdf', name: 'Generate PDF', description: 'Create invoice PDF', duration: 5000, icon: '📄', isBackground: false, isRunning: false, progress: 0 },
  { id: 'image', name: 'Process Image', description: 'Resize and optimize avatar', duration: 3000, icon: '🖼️', isBackground: false, isRunning: false, progress: 0 },
  { id: 'webhook', name: 'Call Webhook', description: 'Notify external service', duration: 1500, icon: '🔗', isBackground: false, isRunning: false, progress: 0 },
  { id: 'import', name: 'Import CSV', description: 'Process uploaded data file', duration: 8000, icon: '📊', isBackground: false, isRunning: false, progress: 0 },
];

interface QueuedJob {
  id: number;
  operationId: string;
  operationName: string;
  status: 'queued' | 'running' | 'completed';
  progress: number;
}

export function Level21BackgroundJobs({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [operations, setOperations] = useState<SlowOperation[]>(INITIAL_OPERATIONS);
  const [requestTime, setRequestTime] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [queuedJobs, setQueuedJobs] = useState<QueuedJob[]>([]);
  const [jobIdCounter, setJobIdCounter] = useState(1);

  const backgroundOps = operations.filter(op => op.isBackground);
  const syncOps = operations.filter(op => !op.isBackground);

  // Process queued jobs
  useEffect(() => {
    const interval = setInterval(() => {
      setQueuedJobs(prev => {
        const updated = [...prev];
        const runningJob = updated.find(j => j.status === 'running');

        if (runningJob) {
          runningJob.progress += 10;
          if (runningJob.progress >= 100) {
            runningJob.status = 'completed';
          }
        } else {
          const nextJob = updated.find(j => j.status === 'queued');
          if (nextJob) {
            nextJob.status = 'running';
          }
        }

        return updated;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  const toggleBackground = (operationId: string) => {
    setOperations(prev => prev.map(op =>
      op.id === operationId ? { ...op, isBackground: !op.isBackground } : op
    ));
  };

  const simulateRequest = () => {
    setIsProcessing(true);

    // Calculate total sync time
    const syncTime = syncOps.reduce((sum, op) => sum + op.duration, 0);

    // Add background jobs to queue
    const newJobs: QueuedJob[] = backgroundOps.map(op => ({
      id: jobIdCounter + backgroundOps.indexOf(op),
      operationId: op.id,
      operationName: op.name,
      status: 'queued' as const,
      progress: 0,
    }));

    setJobIdCounter(prev => prev + newJobs.length);
    setQueuedJobs(prev => [...prev, ...newJobs]);

    // Simulate sync operations
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 100;
      setRequestTime(elapsed);

      if (elapsed >= syncTime) {
        clearInterval(interval);
        setIsProcessing(false);
      }
    }, 100);
  };

  const validateSolution = (): ValidationResult => {
    if (backgroundOps.length < 3) {
      return {
        valid: false,
        message: 'Move more operations to background!',
        details: ['At least 3 slow operations should be backgrounded'],
      };
    }
    if (syncOps.some(op => op.duration > 1000)) {
      return {
        valid: false,
        message: 'Request still too slow!',
        details: ['Move operations over 1 second to background'],
      };
    }
    return { valid: true, message: 'Fast responses with background processing!' };
  };

  const handleComplete = async () => {
    const success = await completeLevel('act3-level21-background-jobs', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const totalSyncTime = syncOps.reduce((sum, op) => sum + op.duration, 0);

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Users are waiting 15+ seconds for their signup to complete. Emails, PDFs, images... all blocking the request. Time to move slow work to background jobs!"
          instructions={[
            'Identify operations that can run later',
            'Move them to background workers',
            'Return response immediately',
            'Process jobs asynchronously',
          ]}
          goal="Keep requests fast by moving slow operations to background workers."
        >
          {/* Request Time Display */}
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Estimated Request Time
            </div>
            <div className="text-center py-4">
              <div className={`text-4xl font-bold ${
                totalSyncTime < 500 ? 'text-success' :
                totalSyncTime < 2000 ? 'text-warning' : 'text-destructive'
              }`}>
                {(totalSyncTime / 1000).toFixed(1)}s
              </div>
              <div className="text-xs text-muted-foreground">
                {totalSyncTime < 500 ? 'Fast!' :
                 totalSyncTime < 2000 ? 'Acceptable' : 'Too slow!'}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border">
            <Button
              onClick={simulateRequest}
              disabled={isProcessing}
              variant={isProcessing ? 'secondary' : 'default'}
              className={`w-full py-2 ${isProcessing ? 'cursor-not-allowed' : ''}`}
            >
              {isProcessing ? `Processing... ${requestTime}ms` : 'Simulate Request'}
            </Button>
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Operations backgrounded</span>
              <span className={backgroundOps.length >= 3 ? 'text-success' : 'text-foreground'}>
                {backgroundOps.length} / {operations.length}
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-success transition-all"
                style={{ width: `${(backgroundOps.length / operations.length) * 100}%` }}
              />
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={21}
          levelName="Background Jobs"
          actNumber={3}
          onExit={onExit}
          onReset={() => {
            setOperations(INITIAL_OPERATIONS);
            setQueuedJobs([]);
            setRequestTime(null);
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-background p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* Operations List */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Synchronous */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="bg-destructive/20 px-4 py-3 border-b border-border">
                  <div className="text-destructive font-semibold">Synchronous (Blocking)</div>
                  <div className="text-xs text-muted-foreground">Runs during request, user waits</div>
                </div>
                <div className="p-4 space-y-2 min-h-[200px]">
                  {syncOps.map(op => (
                    <Button
                      key={op.id}
                      onClick={() => toggleBackground(op.id)}
                      variant="outline"
                      className="w-full p-3 h-auto rounded-lg bg-destructive/10 border border-destructive hover:bg-destructive/20 text-left justify-start"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <span className="text-xl">{op.icon}</span>
                        <div className="flex-1">
                          <div className="text-foreground text-sm font-medium">{op.name}</div>
                          <div className="text-xs text-muted-foreground">{op.description}</div>
                        </div>
                        <div className="text-destructive text-sm font-bold">{(op.duration / 1000).toFixed(1)}s</div>
                      </div>
                    </Button>
                  ))}
                  {syncOps.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      All operations moved to background!
                    </div>
                  )}
                </div>
              </div>

              {/* Background */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="bg-success/20 px-4 py-3 border-b border-border">
                  <div className="text-success font-semibold">Background (Async)</div>
                  <div className="text-xs text-muted-foreground">Runs after response, user doesn't wait</div>
                </div>
                <div className="p-4 space-y-2 min-h-[200px]">
                  {backgroundOps.map(op => (
                    <Button
                      key={op.id}
                      onClick={() => toggleBackground(op.id)}
                      variant="default"
                      className="w-full p-3 h-auto rounded-lg bg-success/10 border border-success hover:bg-success/20 text-left justify-start"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <span className="text-xl">{op.icon}</span>
                        <div className="flex-1">
                          <div className="text-foreground text-sm font-medium">{op.name}</div>
                          <div className="text-xs text-muted-foreground">{op.description}</div>
                        </div>
                        <div className="text-success text-sm font-bold">{(op.duration / 1000).toFixed(1)}s</div>
                      </div>
                    </Button>
                  ))}
                  {backgroundOps.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Click operations to move them here
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Job Queue */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="bg-secondary px-4 py-3 border-b border-border flex justify-between items-center">
                <div>
                  <div className="text-foreground font-semibold">Sidekiq Job Queue</div>
                  <div className="text-xs text-muted-foreground">Background jobs processing asynchronously</div>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs px-2 py-1 rounded bg-warning/20 text-warning">
                    Queued: {queuedJobs.filter(j => j.status === 'queued').length}
                  </span>
                  <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">
                    Running: {queuedJobs.filter(j => j.status === 'running').length}
                  </span>
                  <span className="text-xs px-2 py-1 rounded bg-success/20 text-success">
                    Done: {queuedJobs.filter(j => j.status === 'completed').length}
                  </span>
                </div>
              </div>

              <div className="p-4 h-32 overflow-y-auto space-y-2">
                {queuedJobs.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No jobs in queue. Simulate a request to enqueue background jobs.
                  </div>
                ) : (
                  queuedJobs.slice(-10).reverse().map(job => (
                    <div key={job.id} className="flex items-center gap-3 text-sm">
                      <span className={`w-2 h-2 rounded-full ${
                        job.status === 'queued' ? 'bg-warning' :
                        job.status === 'running' ? 'bg-primary animate-pulse' : 'bg-success'
                      }`} />
                      <span className="text-muted-foreground font-mono">#{job.id}</span>
                      <span className="text-foreground">{job.operationName}</span>
                      {job.status === 'running' && (
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      )}
                      <span className={`text-xs ${
                        job.status === 'queued' ? 'text-warning' :
                        job.status === 'running' ? 'text-primary' : 'text-success'
                      }`}>
                        {job.status}
                      </span>
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
              filename: 'app/jobs/send_email_job.rb',
              language: 'ruby',
              code: `class SendEmailJob < ApplicationJob
  queue_as :default

  def perform(user_id)
    user = User.find(user_id)
    UserMailer.welcome(user).deliver_now
  end
end

# Enqueue from controller:
SendEmailJob.perform_later(user.id)

# Runs async in Sidekiq worker!`,
              highlight: [2, 11],
            },
            {
              filename: 'config/sidekiq.yml',
              language: 'yaml',
              code: `:concurrency: 10
:queues:
  - critical
  - default
  - low

# Run with: bundle exec sidekiq`,
              highlight: [],
            },
          ]}
          learningGoal="Background jobs let you respond fast and process slow work later. Essential for good UX."
        >
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">When to Background</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✓ Sending emails</li>
              <li>✓ Processing uploads</li>
              <li>✓ External API calls</li>
              <li>✓ Report generation</li>
              <li>✓ Data imports/exports</li>
            </ul>
          </div>

          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Job Runners</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Sidekiq - Most popular, Redis</li>
              <li>• Solid Queue - Rails 8 default</li>
              <li>• Good Job - Postgres-backed</li>
              <li>• Delayed Job - Classic, simple</li>
            </ul>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level21BackgroundJobs;
