/**
 * Level 17: Webhooks
 *
 * Implement async webhook callbacks instead of polling.
 * Shows fire-and-forget pattern with status updates.
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
import { Button } from '../../../ui/Button';

interface Payment {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  method: 'polling' | 'webhook';
  pollCount: number;
}

export function Level17Webhooks({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [apiCalls, setApiCalls] = useState(0);
  const [webhooksReceived, setWebhooksReceived] = useState(0);

  const isComplete = webhookEnabled && webhooksReceived >= 2;

  // Simulate payment processing with polling or webhooks
  useEffect(() => {
    if (payments.length >= 4) return;

    const timeout = setTimeout(() => {
      const id = `pay_${Date.now().toString(36)}`;
      const payment: Payment = {
        id,
        status: 'pending',
        method: webhookEnabled ? 'webhook' : 'polling',
        pollCount: 0,
      };

      setPayments(prev => [...prev, payment]);

      // Simulate processing
      if (webhookEnabled) {
        // Fire and forget - webhook will update status
        setTimeout(() => {
          setPayments(prev => prev.map(p =>
            p.id === id ? { ...p, status: 'processing' } : p
          ));

          // Webhook callback after processing
          setTimeout(() => {
            setWebhooksReceived(c => c + 1);
            setPayments(prev => prev.map(p =>
              p.id === id ? { ...p, status: 'completed' } : p
            ));
          }, 1500);
        }, 500);
      } else {
        // Polling - keep checking status
        let pollCount = 0;
        const pollInterval = setInterval(() => {
          pollCount++;
          setApiCalls(c => c + 1);
          setPayments(prev => prev.map(p =>
            p.id === id ? { ...p, pollCount, status: pollCount < 5 ? 'processing' : 'completed' } : p
          ));

          if (pollCount >= 5) {
            clearInterval(pollInterval);
          }
        }, 600);
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [payments.length, webhookEnabled]);

  const handleComplete = async () => {
    const success = await completeLevel('act3-level17-webhooks', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="The app polls Stripe every second to check if a payment is complete. This wastes API calls and creates race conditions."
          instructions={[
            'Watch the polling requests pile up',
            'Enable webhook endpoint',
            'See payments complete with just one callback',
          ]}
          goal="Learn to use webhooks for async event notifications instead of polling."
        >
          <div className="p-4 border-t border-border">
            <Button
              onClick={() => {
                setWebhookEnabled(true);
                setPayments([]);
                setApiCalls(0);
              }}
              disabled={webhookEnabled}
              variant={webhookEnabled ? 'secondary' : 'default'}
              className={`w-full py-3 ${webhookEnabled ? 'bg-success text-success-foreground cursor-default' : ''}`}
            >
              {webhookEnabled ? 'Webhook Enabled' : 'Enable Webhook Endpoint'}
            </Button>
          </div>

          <div className="p-4 border-t border-border">
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-lg p-3 text-center ${
                apiCalls > 10 ? 'bg-destructive/20' : 'bg-secondary'
              }`}>
                <div className={`text-2xl font-bold ${apiCalls > 10 ? 'text-destructive' : 'text-foreground'}`}>
                  {apiCalls}
                </div>
                <div className="text-xs text-muted-foreground">Polling Calls</div>
              </div>
              <div className="bg-success/20 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-success">{webhooksReceived}</div>
                <div className="text-xs text-success/70">Webhooks</div>
              </div>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={17}
          levelName="Webhooks"
          actNumber={3}
          onExit={onExit}
          onReset={() => {
            setWebhookEnabled(false);
            setPayments([]);
            setApiCalls(0);
            setWebhooksReceived(0);
          }}
        />

        <div className="flex-1 relative bg-background p-8">
          {/* Architecture */}
          <div className="flex items-center justify-center gap-8 mb-8">
            {/* Your App */}
            <div className="bg-card border border-border rounded-xl p-4 w-40 text-center">
              <div className="text-2xl mb-2">A</div>
              <div className="text-muted-foreground text-sm">Your App</div>
              {webhookEnabled && (
                <div className="mt-2 text-xs text-primary">/webhooks/stripe</div>
              )}
            </div>

            {/* Arrows */}
            <div className="flex flex-col items-center gap-2">
              {webhookEnabled ? (
                <>
                  <div className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span className="text-xs text-muted-foreground">create payment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span className="text-xs text-success">webhook callback</span>
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      <span className="text-xs text-destructive">poll #{i}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stripe */}
            <div className="bg-purple-900/40 border border-purple-600 rounded-xl p-4 w-40 text-center">
              <div className="text-2xl mb-2">S</div>
              <div className="text-purple-400 text-sm">Stripe</div>
              <div className="text-purple-300 text-xs mt-1">Payment Provider</div>
            </div>
          </div>

          {/* Payment Log */}
          <div className="bg-card rounded-xl p-4 max-w-2xl mx-auto">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-3">Payment Status</div>
            <div className="space-y-3">
              {payments.map(p => (
                <div key={p.id} className="bg-secondary rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-foreground font-mono text-sm">{p.id}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      p.status === 'completed' ? 'bg-success/30 text-success' :
                      p.status === 'processing' ? 'bg-warning/30 text-warning' :
                      p.status === 'failed' ? 'bg-destructive/30 text-destructive' :
                      'bg-secondary text-muted-foreground'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.method === 'polling' ? (
                      <span>Method: Polling ({p.pollCount} API calls)</span>
                    ) : (
                      <span>Method: Webhook (1 callback)</span>
                    )}
                  </div>
                </div>
              ))}
              {payments.length === 0 && (
                <div className="text-muted-foreground text-center py-4">Waiting for payments...</div>
              )}
            </div>
          </div>

          {/* Completion button */}
          {isComplete && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
              <Button
                onClick={handleComplete}
                size="lg"
                className="bg-gradient-to-r from-success to-success/80 text-success-foreground font-bold shadow-lg"
              >
                Complete Level
              </Button>
            </div>
          )}
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[{
            filename: 'app/controllers/webhooks_controller.rb',
            language: 'ruby',
            code: `class WebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token

  def stripe
    payload = request.body.read
    sig_header = request.headers['Stripe-Signature']

    event = Stripe::Webhook.construct_event(
      payload, sig_header, ENV['STRIPE_WEBHOOK_SECRET']
    )

    case event.type
    when 'payment_intent.succeeded'
      payment = Payment.find_by!(
        stripe_id: event.data.object.id
      )
      payment.complete!
      PaymentMailer.receipt(payment).deliver_later

    when 'payment_intent.payment_failed'
      # Handle failure...
    end

    head :ok
  rescue Stripe::SignatureVerificationError
    head :bad_request
  end
end`,
            highlight: [7, 8, 9, 12, 13, 14, 15, 16, 17, 18],
          }]}
          learningGoal="Webhooks push updates to your app when events happen, eliminating the need for wasteful polling."
        />
      </RightPanel>
    </LevelLayout>
  );
}

export default Level17Webhooks;
