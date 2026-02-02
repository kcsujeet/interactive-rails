/**
 * Level 24: Observability
 *
 * Distributed tracing with flame graph visualization.
 * Find the slow service causing latency issues.
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

interface Span {
  id: string;
  service: string;
  operation: string;
  duration: number;
  start: number;
  traced: boolean;
}

export function Level24Observability({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [tracingEnabled, setTracingEnabled] = useState(false);
  const [spans, setSpans] = useState<Span[]>([
    { id: 'auth', service: 'Auth', operation: 'verify_token', duration: 50, start: 0, traced: false },
    { id: 'billing', service: 'Billing', operation: 'get_subscription', duration: 1800, start: 50, traced: false },
    { id: 'orders', service: 'Orders', operation: 'recent_orders', duration: 120, start: 1850, traced: false },
    { id: 'db', service: 'Database', operation: 'query', duration: 30, start: 1970, traced: false },
  ]);
  const [selectedSpan, setSelectedSpan] = useState<string | null>(null);
  const [problemFound, setProblemFound] = useState(false);

  const totalDuration = spans.reduce((max, s) => Math.max(max, s.start + s.duration), 0);
  const isComplete = tracingEnabled && problemFound;

  const enableTracing = () => {
    setTracingEnabled(true);
    // Reveal spans one by one
    let index = 0;
    const interval = setInterval(() => {
      if (index >= spans.length) {
        clearInterval(interval);
        return;
      }
      setSpans(prev => prev.map((s, i) => i === index ? { ...s, traced: true } : s));
      index++;
    }, 500);
  };

  const handleSpanClick = (spanId: string) => {
    setSelectedSpan(spanId);
    if (spanId === 'billing') {
      setProblemFound(true);
    }
  };

  const handleComplete = async () => {
    const success = await completeLevel('act4-level24-observability', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const getSpanColor = (service: string) => {
    const colors: Record<string, string> = {
      'Auth': '#22c55e',
      'Billing': '#ef4444',
      'Orders': '#3b82f6',
      'Database': '#a855f7',
    };
    return colors[service] || '#6b7280';
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Users report the checkout page takes 2+ seconds to load. But which service is causing the delay? We need distributed tracing to find out."
          instructions={[
            'Notice the slow 2s total request time',
            'Enable distributed tracing',
            'Click on spans to identify the bottleneck',
          ]}
          goal="Learn distributed tracing for debugging latency in microservices."
        >
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={enableTracing}
              disabled={tracingEnabled}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                tracingEnabled
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {tracingEnabled ? 'Tracing Enabled' : 'Enable Distributed Tracing'}
            </button>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Request Metrics
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Duration:</span>
                <span className={`font-bold ${totalDuration > 1000 ? 'text-red-400' : 'text-green-400'}`}>
                  {totalDuration}ms
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Services:</span>
                <span className="text-white">{spans.length}</span>
              </div>
            </div>
          </div>

          {selectedSpan && (
            <div className="p-4 border-t border-gray-800">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Selected Span
              </div>
              {spans.filter(s => s.id === selectedSpan).map(span => (
                <div key={span.id} className={`p-3 rounded-lg ${
                  span.id === 'billing' ? 'bg-red-900/30 border border-red-500' : 'bg-gray-800'
                }`}>
                  <div className="text-white font-medium">{span.service}</div>
                  <div className="text-gray-400 text-sm">{span.operation}</div>
                  <div className={`text-sm mt-1 ${span.duration > 500 ? 'text-red-400' : 'text-green-400'}`}>
                    {span.duration}ms
                  </div>
                  {span.id === 'billing' && (
                    <div className="text-red-400 text-xs mt-2">
                      BOTTLENECK FOUND! This service is slow.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={24}
          levelName="Observability"
          actNumber={4}
          onExit={onExit}
          onReset={() => {
            setTracingEnabled(false);
            setSpans([
              { id: 'auth', service: 'Auth', operation: 'verify_token', duration: 50, start: 0, traced: false },
              { id: 'billing', service: 'Billing', operation: 'get_subscription', duration: 1800, start: 50, traced: false },
              { id: 'orders', service: 'Orders', operation: 'recent_orders', duration: 120, start: 1850, traced: false },
              { id: 'db', service: 'Database', operation: 'query', duration: 30, start: 1970, traced: false },
            ]);
            setSelectedSpan(null);
            setProblemFound(false);
          }}
        />

        <div className="flex-1 relative bg-gray-950 p-8">
          {/* Flame Graph */}
          <div className="bg-gray-900 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-gray-400 text-xs uppercase tracking-wider">Trace: checkout-request</div>
              <div className="text-gray-500 text-xs">Total: {totalDuration}ms</div>
            </div>

            {/* Timeline */}
            <div className="relative mb-4">
              <div className="absolute top-0 left-0 right-0 h-px bg-gray-700" />
              <div className="flex justify-between text-xs text-gray-600">
                <span>0ms</span>
                <span>{Math.round(totalDuration / 4)}ms</span>
                <span>{Math.round(totalDuration / 2)}ms</span>
                <span>{Math.round(totalDuration * 3 / 4)}ms</span>
                <span>{totalDuration}ms</span>
              </div>
            </div>

            {/* Spans */}
            <div className="space-y-2">
              {spans.map(span => {
                const width = (span.duration / totalDuration) * 100;
                const left = (span.start / totalDuration) * 100;

                return (
                  <div key={span.id} className="relative h-10">
                    {tracingEnabled && span.traced ? (
                      <button
                        onClick={() => handleSpanClick(span.id)}
                        className={`absolute h-full rounded transition-all hover:opacity-90 ${
                          selectedSpan === span.id ? 'ring-2 ring-white' : ''
                        }`}
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          backgroundColor: getSpanColor(span.service),
                          minWidth: '60px',
                        }}
                      >
                        <div className="flex items-center justify-between px-2 h-full text-white text-xs">
                          <span className="truncate">{span.service}</span>
                          <span>{span.duration}ms</span>
                        </div>
                      </button>
                    ) : (
                      <div
                        className="absolute h-full rounded bg-gray-700"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          minWidth: '60px',
                        }}
                      >
                        <div className="flex items-center justify-center h-full text-gray-500 text-xs">
                          {tracingEnabled ? '...' : '???'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-6">
              {Array.from(new Set(spans.map(s => s.service))).map(service => (
                <div key={service} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: getSpanColor(service) }}
                  />
                  <span className="text-gray-400">{service}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Problem indicator */}
          {problemFound && (
            <div className="mt-6 bg-red-900/30 border border-red-500 rounded-lg p-4 max-w-md mx-auto">
              <div className="text-red-400 font-medium">Bottleneck Identified!</div>
              <div className="text-red-300 text-sm mt-1">
                The Billing service takes 1800ms (90% of total time).
                Investigate database queries or cache the subscription data.
              </div>
            </div>
          )}

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
            filename: 'config/initializers/opentelemetry.rb',
            language: 'ruby',
            code: `require 'opentelemetry/sdk'
require 'opentelemetry/exporter/otlp'
require 'opentelemetry/instrumentation/all'

OpenTelemetry::SDK.configure do |c|
  c.service_name = 'checkout-service'

  c.add_span_processor(
    OpenTelemetry::SDK::Trace::Export::BatchSpanProcessor.new(
      OpenTelemetry::Exporter::OTLP::Exporter.new
    )
  )

  # Auto-instrument Rails, ActiveRecord, Faraday, etc.
  c.use_all
end

# Manual span for custom operations:
tracer = OpenTelemetry.tracer_provider.tracer('app')

tracer.in_span('get_subscription') do |span|
  span.set_attribute('user.id', user.id)
  BillingClient.get_subscription(user)
end`,
            highlight: [5, 6, 15, 20, 21, 22, 23, 24],
          }]}
          learningGoal="Distributed tracing shows the full journey of a request across services. Use it to find bottlenecks and debug latency issues."
        />
      </RightPanel>
    </LevelLayout>
  );
}

export default Level24Observability;
