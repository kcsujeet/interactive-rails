/**
 * Level 32: Message Queues
 *
 * Decouple services with asynchronous messaging.
 * Player learns pub/sub, queues, and event-driven architecture.
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

interface Message {
  id: number;
  type: string;
  payload: string;
  status: 'queued' | 'processing' | 'delivered' | 'failed';
  retries: number;
}

interface Consumer {
  id: string;
  name: string;
  icon: string;
  subscribed: boolean;
  processing: boolean;
  messagesHandled: number;
}

const INITIAL_CONSUMERS: Consumer[] = [
  { id: 'email', name: 'Email Service', icon: '📧', subscribed: false, processing: false, messagesHandled: 0 },
  { id: 'analytics', name: 'Analytics', icon: '📊', subscribed: false, processing: false, messagesHandled: 0 },
  { id: 'inventory', name: 'Inventory', icon: '📦', subscribed: false, processing: false, messagesHandled: 0 },
  { id: 'notifications', name: 'Notifications', icon: '🔔', subscribed: false, processing: false, messagesHandled: 0 },
];

const EVENT_TYPES = [
  { type: 'order.created', icon: '🛒', description: 'New order placed' },
  { type: 'order.paid', icon: '💳', description: 'Payment received' },
  { type: 'order.shipped', icon: '🚚', description: 'Order shipped' },
  { type: 'user.signup', icon: '👤', description: 'New user registered' },
];

export function Level32MessageQueues({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [consumers, setConsumers] = useState<Consumer[]>(INITIAL_CONSUMERS);
  const [messages, setMessages] = useState<Message[]>([]);
  const [queueEnabled, setQueueEnabled] = useState(false);
  const [deadLetterQueue, setDeadLetterQueue] = useState<Message[]>([]);

  // Process messages
  useEffect(() => {
    if (!queueEnabled) return;

    const interval = setInterval(() => {
      setMessages(prev => {
        const updated = [...prev];
        const subscribedConsumers = consumers.filter(c => c.subscribed);

        // Process queued messages
        updated.forEach(msg => {
          if (msg.status === 'queued' && subscribedConsumers.length > 0) {
            msg.status = 'processing';
          } else if (msg.status === 'processing') {
            // Simulate processing with 90% success rate
            if (Math.random() > 0.1) {
              msg.status = 'delivered';
              // Update consumer stats
              setConsumers(c => c.map(consumer =>
                consumer.subscribed
                  ? { ...consumer, messagesHandled: consumer.messagesHandled + 1 }
                  : consumer
              ));
            } else {
              msg.retries++;
              if (msg.retries >= 3) {
                msg.status = 'failed';
                setDeadLetterQueue(dlq => [...dlq, msg]);
              } else {
                msg.status = 'queued'; // Retry
              }
            }
          }
        });

        return updated.filter(m => m.status !== 'delivered' && m.status !== 'failed');
      });
    }, 500);

    return () => clearInterval(interval);
  }, [queueEnabled, consumers]);

  const publishEvent = (eventType: string) => {
    const message: Message = {
      id: Date.now(),
      type: eventType,
      payload: JSON.stringify({ timestamp: new Date().toISOString() }),
      status: 'queued',
      retries: 0,
    };
    setMessages(prev => [...prev, message]);
  };

  const toggleConsumer = (consumerId: string) => {
    setConsumers(prev => prev.map(c =>
      c.id === consumerId ? { ...c, subscribed: !c.subscribed } : c
    ));
  };

  const validateSolution = (): ValidationResult => {
    if (!queueEnabled) {
      return {
        valid: false,
        message: 'Enable the message queue!',
        details: ['Turn on the queue to process messages'],
      };
    }
    const subscribedCount = consumers.filter(c => c.subscribed).length;
    if (subscribedCount < 2) {
      return {
        valid: false,
        message: 'Subscribe more consumers!',
        details: ['At least 2 services should consume messages'],
      };
    }
    const totalHandled = consumers.reduce((sum, c) => sum + c.messagesHandled, 0);
    if (totalHandled < 5) {
      return {
        valid: false,
        message: 'Process more messages!',
        details: ['Publish events and let consumers handle them'],
      };
    }
    return { valid: true, message: 'Event-driven architecture working!' };
  };

  const handleComplete = async () => {
    const success = await completeLevel('act6-level32-message-queues', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Your monolith directly calls email, analytics, and inventory services. When one is slow, everything is slow. Time to decouple with a message queue!"
          instructions={[
            'Publishers send events to the queue',
            'Consumers subscribe and process async',
            'Failed messages go to dead letter queue',
            'Services are decoupled and scalable',
          ]}
          goal="Decouple services with pub/sub messaging for scalability and resilience."
        >
          {/* Queue Control */}
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Message Queue
            </div>
            <Button
              onClick={() => setQueueEnabled(!queueEnabled)}
              variant={queueEnabled ? 'default' : 'secondary'}
              className={`w-full ${queueEnabled ? 'bg-success hover:bg-success/90' : ''}`}
            >
              {queueEnabled ? '✓ Queue Active' : 'Enable Queue'}
            </Button>
          </div>

          {/* Stats */}
          <div className="p-4 border-t border-border">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-card p-2 rounded text-center">
                <div className="text-xl font-bold text-foreground">{messages.length}</div>
                <div className="text-xs text-muted-foreground">In Queue</div>
              </div>
              <div className="bg-card p-2 rounded text-center">
                <div className={`text-xl font-bold ${deadLetterQueue.length > 0 ? 'text-destructive' : 'text-success'}`}>
                  {deadLetterQueue.length}
                </div>
                <div className="text-xs text-muted-foreground">Dead Letter</div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Consumers subscribed</span>
              <span className={consumers.filter(c => c.subscribed).length >= 2 ? 'text-success' : 'text-foreground'}>
                {consumers.filter(c => c.subscribed).length} / {consumers.length}
              </span>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={32}
          levelName="Message Queues"
          actNumber={6}
          onExit={onExit}
          onReset={() => {
            setConsumers(INITIAL_CONSUMERS);
            setMessages([]);
            setQueueEnabled(false);
            setDeadLetterQueue([]);
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-background p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* Event Publishers */}
            <div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
              <div className="bg-secondary px-4 py-3 border-b border-border">
                <div className="text-foreground font-semibold">Publish Events</div>
                <div className="text-xs text-muted-foreground">Click to publish an event to the queue</div>
              </div>
              <div className="p-4 grid grid-cols-4 gap-3">
                {EVENT_TYPES.map(event => (
                  <Button
                    key={event.type}
                    onClick={() => publishEvent(event.type)}
                    disabled={!queueEnabled}
                    variant={queueEnabled ? 'default' : 'outline'}
                    className={`p-3 h-auto rounded-lg border transition-all flex-col ${
                      queueEnabled
                        ? 'border-primary bg-primary/20 hover:bg-primary/40'
                        : 'border-border bg-secondary opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="text-2xl mb-1">{event.icon}</div>
                    <div className="text-xs text-primary font-mono">{event.type}</div>
                    <div className="text-xs text-muted-foreground">{event.description}</div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Message Queue Visualization */}
            <div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
              <div className="bg-secondary px-4 py-3 border-b border-border flex justify-between items-center">
                <div className="text-foreground font-semibold">Message Queue</div>
                <span className={`w-2 h-2 rounded-full ${queueEnabled ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
              </div>
              <div className="p-4 min-h-[100px]">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {queueEnabled ? 'Queue empty - publish some events!' : 'Enable queue to start'}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`px-3 py-2 rounded-lg text-xs transition-all ${
                          msg.status === 'queued' ? 'bg-warning/40 text-warning border border-warning' :
                          msg.status === 'processing' ? 'bg-blue-900/40 text-blue-400 border border-blue-600 animate-pulse' :
                          'bg-secondary text-muted-foreground'
                        }`}
                      >
                        <div className="font-mono">{msg.type}</div>
                        <div className="text-[10px] opacity-60">
                          {msg.status} {msg.retries > 0 && `(retry ${msg.retries})`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Consumers */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="bg-secondary px-4 py-3 border-b border-border">
                <div className="text-foreground font-semibold">Consumers</div>
                <div className="text-xs text-muted-foreground">Click to subscribe/unsubscribe</div>
              </div>
              <div className="p-4 grid grid-cols-4 gap-4">
                {consumers.map(consumer => (
                  <Button
                    key={consumer.id}
                    onClick={() => toggleConsumer(consumer.id)}
                    variant={consumer.subscribed ? 'default' : 'outline'}
                    className={`p-4 h-auto rounded-lg border-2 transition-all flex-col ${
                      consumer.subscribed
                        ? 'border-success bg-success/20'
                        : 'border-border bg-secondary hover:border-muted-foreground'
                    }`}
                  >
                    <div className="text-3xl mb-2">{consumer.icon}</div>
                    <div className={consumer.subscribed ? 'text-success' : 'text-foreground'}>
                      {consumer.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {consumer.subscribed ? 'Subscribed' : 'Not subscribed'}
                    </div>
                    <div className="text-lg font-bold text-primary mt-2">
                      {consumer.messagesHandled}
                    </div>
                    <div className="text-xs text-muted-foreground">messages</div>
                  </Button>
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
              filename: 'app/events/order_created_event.rb',
              language: 'ruby',
              code: `class OrderCreatedEvent
  include Wisper::Publisher

  def initialize(order)
    @order = order
  end

  def broadcast
    # Publish to all subscribers
    publish(:order_created, @order)
  end
end

# Subscribe consumers
OrderCreatedEvent.subscribe(EmailService.new)
OrderCreatedEvent.subscribe(AnalyticsService.new)
OrderCreatedEvent.subscribe(InventoryService.new)`,
              highlight: [8, 14, 15, 16],
            },
            {
              filename: 'sidekiq_config.yml',
              language: 'yaml',
              code: `:queues:
  - [critical, 3]
  - [default, 2]
  - [low, 1]

:retry: 3  # Retry failed jobs
:dead_max_jobs: 1000  # Dead letter queue`,
              highlight: [],
            },
          ]}
          learningGoal="Message queues decouple services. Publishers don't wait for consumers. Failed messages are retried automatically."
        >
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Benefits</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>+ Services are decoupled</li>
              <li>+ Handle spikes with queue buffering</li>
              <li>+ Failed messages retry automatically</li>
              <li>+ Scale consumers independently</li>
            </ul>
          </div>

          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Tools</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Sidekiq + Redis</li>
              <li>• RabbitMQ</li>
              <li>• AWS SQS/SNS</li>
              <li>• Kafka (high volume)</li>
            </ul>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level32MessageQueues;
