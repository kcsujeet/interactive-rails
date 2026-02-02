/**
 * Level 19: Event-Driven Architecture
 *
 * Decouple services using event bus pub/sub.
 * Shows domain events pattern.
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

interface Service {
  id: string;
  name: string;
  status: 'idle' | 'processing' | 'done';
}

interface Event {
  id: number;
  type: string;
  from: string;
  to: string[];
}

export function Level19EventDriven({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [eventBusEnabled, setEventBusEnabled] = useState(false);
  const [services, setServices] = useState<Service[]>([
    { id: 'email', name: 'Email Service', status: 'idle' },
    { id: 'inventory', name: 'Inventory Service', status: 'idle' },
    { id: 'analytics', name: 'Analytics Service', status: 'idle' },
    { id: 'shipping', name: 'Shipping Service', status: 'idle' },
  ]);
  const [events, setEvents] = useState<Event[]>([]);
  const [orderCount, setOrderCount] = useState(0);
  const [orderCountBefore, setOrderCountBefore] = useState(0); // Orders processed before enabling event bus
  const [orderCountAfter, setOrderCountAfter] = useState(0); // Orders processed after enabling event bus
  const [isProcessing, setIsProcessing] = useState(false);

  // Validation function
  const validateSolution = (): ValidationResult => {
    const errors: string[] = [];

    if (orderCountBefore === 0) {
      errors.push('Process at least one order WITHOUT the Event Bus first to see the problem');
    }

    if (!eventBusEnabled) {
      errors.push('Enable the Event Bus to decouple services');
    }

    if (orderCountAfter < 1) {
      errors.push('Process at least one order WITH the Event Bus to see the improvement');
    }

    if (errors.length > 0) {
      return {
        valid: false,
        message: 'Experience both architectures first!',
        details: errors,
      };
    }

    return {
      valid: true,
      message: 'Services are now loosely coupled via events!',
    };
  };

  const processOrder = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setOrderCount(c => c + 1);

    // Track orders before/after event bus
    if (eventBusEnabled) {
      setOrderCountAfter(c => c + 1);
    } else {
      setOrderCountBefore(c => c + 1);
    }

    // Reset services
    setServices(prev => prev.map(s => ({ ...s, status: 'idle' })));

    if (eventBusEnabled) {
      // Event-driven: publish once, all subscribe
      const eventId = Date.now();
      setEvents(prev => [...prev.slice(-5), {
        id: eventId,
        type: 'OrderCompleted',
        from: 'Checkout',
        to: ['email', 'inventory', 'analytics', 'shipping'],
      }]);

      // All services process in parallel
      await new Promise(r => setTimeout(r, 300));
      setServices(prev => prev.map(s => ({ ...s, status: 'processing' })));
      await new Promise(r => setTimeout(r, 800));
      setServices(prev => prev.map(s => ({ ...s, status: 'done' })));
    } else {
      // Direct coupling: call each service sequentially
      for (const service of services) {
        setServices(prev => prev.map(s =>
          s.id === service.id ? { ...s, status: 'processing' } : s
        ));
        await new Promise(r => setTimeout(r, 600));
        setServices(prev => prev.map(s =>
          s.id === service.id ? { ...s, status: 'done' } : s
        ));
      }
    }

    setIsProcessing(false);
  };

  const handleComplete = async () => {
    const success = await completeLevel('act4-level19-event-driven', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Checkout service directly calls Email, Inventory, Analytics, and Shipping. If one is slow, the whole order fails. Adding a new service means modifying Checkout."
          instructions={[
            'Click \"Place Order\" to see direct coupling (sequential)',
            'Enable Event Bus',
            'See services process in parallel via events',
          ]}
          goal="Learn event-driven architecture for loose coupling between services."
        >
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={() => setEventBusEnabled(true)}
              disabled={eventBusEnabled}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                eventBusEnabled
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {eventBusEnabled ? 'Event Bus Enabled' : 'Enable Event Bus'}
            </button>
          </div>

          <div className="p-4 border-t border-gray-800">
            <button
              onClick={processOrder}
              disabled={isProcessing}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                isProcessing
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              {isProcessing ? 'Processing...' : 'Place Order'}
            </button>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Architecture
            </div>
            <div className={`text-sm p-3 rounded-lg ${
              eventBusEnabled ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
            }`}>
              {eventBusEnabled ? (
                <div>Pub/Sub - Loosely coupled</div>
              ) : (
                <div>Direct calls - Tightly coupled</div>
              )}
            </div>
          </div>

        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={19}
          levelName="Event-Driven"
          actNumber={4}
          onExit={onExit}
          onReset={() => {
            setEventBusEnabled(false);
            setServices([
              { id: 'email', name: 'Email Service', status: 'idle' },
              { id: 'inventory', name: 'Inventory Service', status: 'idle' },
              { id: 'analytics', name: 'Analytics Service', status: 'idle' },
              { id: 'shipping', name: 'Shipping Service', status: 'idle' },
            ]);
            setEvents([]);
            setOrderCount(0);
            setOrderCountBefore(0);
            setOrderCountAfter(0);
            setIsProcessing(false);
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-8">
          {/* Architecture Visualization */}
          <div className="flex flex-col items-center">
            {/* Checkout */}
            <div className="bg-purple-900/40 border border-purple-600 rounded-xl p-4 w-48 text-center mb-6">
              <div className="text-purple-400 font-medium">Checkout Service</div>
              <div className="text-purple-300 text-xs mt-1">Orders #{orderCount}</div>
            </div>

            {/* Connection visualization */}
            {eventBusEnabled ? (
              /* Event Bus */
              <div className="relative mb-6">
                <div className="bg-cyan-900/40 border border-cyan-600 rounded-full px-6 py-2">
                  <span className="text-cyan-400 text-sm">Event Bus</span>
                </div>
                {events.length > 0 && events[events.length - 1] && (
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-cyan-800 text-cyan-200 text-xs px-2 py-1 rounded whitespace-nowrap">
                    {events[events.length - 1].type}
                  </div>
                )}
              </div>
            ) : (
              /* Direct arrows */
              <div className="h-12 flex items-center">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                <span className="text-red-400 text-xs ml-2">Direct calls (sequential)</span>
              </div>
            )}

            {/* Services Grid */}
            <div className="grid grid-cols-2 gap-4 mt-8">
              {services.map(service => (
                <div
                  key={service.id}
                  className={`border rounded-xl p-4 w-40 text-center transition-all ${
                    service.status === 'idle' ? 'bg-gray-800 border-gray-700' :
                    service.status === 'processing' ? 'bg-yellow-900/40 border-yellow-500' :
                    'bg-green-900/40 border-green-500'
                  }`}
                >
                  <div className={`text-sm font-medium ${
                    service.status === 'idle' ? 'text-gray-400' :
                    service.status === 'processing' ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {service.name}
                  </div>
                  <div className="text-xs mt-1">
                    {service.status === 'idle' && <span className="text-gray-500">Waiting</span>}
                    {service.status === 'processing' && <span className="text-yellow-400">Processing...</span>}
                    {service.status === 'done' && <span className="text-green-400">Done</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[{
            filename: 'app/events/order_completed_event.rb',
            language: 'ruby',
            code: `class OrderCompletedEvent
  include Wisper::Publisher

  def initialize(order)
    @order = order
  end

  def call
    broadcast(:order_completed, @order)
  end
end

# Subscribers register globally
Rails.application.config.after_initialize do
  OrderCompletedEvent.subscribe(EmailSubscriber.new)
  OrderCompletedEvent.subscribe(InventorySubscriber.new)
  OrderCompletedEvent.subscribe(AnalyticsSubscriber.new)
  OrderCompletedEvent.subscribe(ShippingSubscriber.new)
end

# In Checkout Service:
class CheckoutService
  def call(order)
    order.complete!
    OrderCompletedEvent.new(order).call
    # That's it! No direct dependencies!
  end
end`,
            highlight: [8, 9, 15, 16, 17, 18, 25, 26],
          }]}
          learningGoal="Event-driven architecture decouples services. Publishers don't know about subscribers, making the system easier to extend."
        />
      </RightPanel>
    </LevelLayout>
  );
}

export default Level19EventDriven;
