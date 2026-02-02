/**
 * Metrics Display Component
 *
 * Shows latency, throughput, database, cache, memory, and error metrics.
 * Supports both nested SimulationMetrics format and flat LiveMetrics format.
 */

import type { SimulationMetrics } from '../../stores/simulation';
import type { LiveMetrics } from '../game/types';

// Unified metrics type that handles both formats
type MetricsInput = SimulationMetrics | LiveMetrics | null;

interface MetricsDisplayProps {
  metrics: MetricsInput;
  className?: string;
}

// Helper to extract values from either format
function getMetricValue(
  metrics: MetricsInput,
  nestedPath: string[],
  flatKey: keyof LiveMetrics
): number {
  if (!metrics) return 0;

  // Try nested format first (SimulationMetrics)
  let value: unknown = metrics;
  for (const key of nestedPath) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      value = undefined;
      break;
    }
  }

  if (typeof value === 'number') return value;

  // Fall back to flat format (LiveMetrics)
  if (flatKey in metrics) {
    const flatValue = metrics[flatKey as keyof typeof metrics];
    if (typeof flatValue === 'number') return flatValue;
  }

  return 0;
}

// Gauge component for latency display
function LatencyGauge({
  label,
  value,
  max,
  thresholds,
}: {
  label: string;
  value: number;
  max: number;
  thresholds: { good: number; warning: number };
}) {
  const percentage = Math.min(100, (value / max) * 100);
  const color =
    value < thresholds.good
      ? '#22c55e'
      : value < thresholds.warning
        ? '#f59e0b'
        : '#ef4444';

  return (
    <div className="flex flex-col">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono" style={{ color }}>
          {value.toFixed(0)}ms
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

// Progress bar for percentages
function PercentageBar({
  label,
  value,
  inverted = false,
}: {
  label: string;
  value: number;
  inverted?: boolean;
}) {
  const displayValue = inverted ? 100 - value : value;
  const color = displayValue > 80 ? '#22c55e' : displayValue > 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono" style={{ color }}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${Math.min(100, value)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

// Stat card with icon
function StatCard({
  icon,
  label,
  value,
  suffix,
  color = 'text-white',
  warning,
}: {
  icon: string;
  label: string;
  value: string | number;
  suffix?: string;
  color?: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`bg-gray-700 rounded-lg p-3 ${warning ? 'border-2 border-amber-500' : ''}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className={`text-xl font-bold ${color}`}>
        {value}
        {suffix && <span className="text-sm font-normal text-gray-400">{suffix}</span>}
      </div>
    </div>
  );
}

export function MetricsDisplay({ metrics, className = '' }: MetricsDisplayProps) {
  if (!metrics) {
    return (
      <div className={`p-4 ${className}`}>
        <p className="text-gray-400 text-center">No simulation data</p>
      </div>
    );
  }

  // Extract values using helper that handles both formats
  const latencyP50 = getMetricValue(metrics, ['latency', 'p50'], 'latency');
  const latencyP95 = getMetricValue(metrics, ['latency', 'p95'], 'latency');
  const latencyP99 = getMetricValue(metrics, ['latency', 'p99'], 'latency');

  const requestsPerSecond = getMetricValue(metrics, ['throughput', 'requestsPerSecond'], 'queryCount');
  const completedRequests = getMetricValue(metrics, ['throughput', 'completedRequests'], 'queryCount');
  const failedRequests = getMetricValue(metrics, ['throughput', 'failedRequests'], 'queryCount');

  const queryTotal = getMetricValue(metrics, ['queries', 'total'], 'queryCount');
  const queriesPerRequest = getMetricValue(metrics, ['queries', 'perRequest'], 'queriesPerRequest');
  const nPlusOneCount = getMetricValue(metrics, ['queries', 'nPlusOneCount'], 'queryCount');

  const cacheHitRate = getMetricValue(metrics, ['cache', 'hitRate'], 'cacheHitRate');
  const cacheSize = getMetricValue(metrics, ['cache', 'size'], 'queryCount');

  const memoryUsage = getMetricValue(metrics, ['memory', 'usage'], 'memoryUsage');
  const memoryPressure = (metrics as SimulationMetrics)?.memory?.pressure || 'low';

  const errorRate = getMetricValue(metrics, ['errors', 'rate'], 'errorRate');
  const errorTypes = (metrics as SimulationMetrics)?.errors?.types || {};

  // Determine warning states
  const hasNPlusOne = nPlusOneCount > 0;
  const hasHighLatency = latencyP95 > 500 || (metrics as LiveMetrics)?.latency > 500;
  const hasHighErrorRate = errorRate > 5;
  const hasMemoryPressure = memoryPressure !== 'low';

  return (
    <div className={`p-4 space-y-4 ${className}`}>
      {/* Latency Section */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <span>Latency</span>
          {hasHighLatency && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded">
              HIGH
            </span>
          )}
        </h3>
        <div className="space-y-2">
          <LatencyGauge
            label="p50"
            value={latencyP50 || (metrics as LiveMetrics)?.latency || 0}
            max={1000}
            thresholds={{ good: 100, warning: 300 }}
          />
          <LatencyGauge
            label="p95"
            value={latencyP95 || (metrics as LiveMetrics)?.latency || 0}
            max={1000}
            thresholds={{ good: 200, warning: 500 }}
          />
          <LatencyGauge
            label="p99"
            value={latencyP99 || (metrics as LiveMetrics)?.latency || 0}
            max={1000}
            thresholds={{ good: 300, warning: 750 }}
          />
        </div>
      </div>

      {/* Throughput Section */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Throughput</h3>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon="/"
            label="req/s"
            value={requestsPerSecond}
          />
          <StatCard
            icon="#"
            label="Completed"
            value={completedRequests || queryTotal}
          />
        </div>
      </div>

      {/* Database Section */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <span>Database</span>
          {hasNPlusOne && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded animate-pulse">
              N+1 DETECTED
            </span>
          )}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon="Q"
            label="Queries"
            value={queryTotal || (metrics as LiveMetrics)?.queryCount || 0}
            warning={hasNPlusOne}
          />
          <StatCard
            icon="Q/R"
            label="Queries/Request"
            value={(queriesPerRequest || 0).toFixed(1)}
            color={queriesPerRequest > 10 ? 'text-red-400' : 'text-white'}
          />
        </div>
        {hasNPlusOne && (
          <div className="mt-2 p-2 bg-red-900/30 rounded text-xs text-red-300">
            {nPlusOneCount} N+1 query patterns detected. Use eager loading!
          </div>
        )}
      </div>

      {/* Cache Section */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Cache</h3>
        <PercentageBar label="Cache Hit Rate" value={cacheHitRate || 0} />
        {cacheHitRate < 50 && cacheSize > 0 && (
          <p className="text-xs text-amber-400 mt-1">
            Low cache hit rate. Consider cache warming or adjusting TTL.
          </p>
        )}
      </div>

      {/* Memory Section */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <span>Memory</span>
          {hasMemoryPressure && (
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                memoryPressure === 'critical'
                  ? 'bg-red-500 text-white'
                  : memoryPressure === 'high'
                    ? 'bg-amber-500 text-black'
                    : 'bg-yellow-500 text-black'
              }`}
            >
              {memoryPressure.toUpperCase()}
            </span>
          )}
        </h3>
        <PercentageBar
          label="Memory Usage"
          value={memoryUsage || (metrics as LiveMetrics)?.cpuLoad || 0}
          inverted
        />
      </div>

      {/* Errors Section */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <span>Errors</span>
          {hasHighErrorRate && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded">
              {errorRate.toFixed(1)}%
            </span>
          )}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon="X"
            label="Failed"
            value={failedRequests}
            color={hasHighErrorRate ? 'text-red-400' : 'text-white'}
          />
          <StatCard
            icon="%"
            label="Error Rate"
            value={errorRate.toFixed(1)}
            suffix="%"
            color={hasHighErrorRate ? 'text-red-400' : 'text-white'}
          />
        </div>
        {Object.keys(errorTypes).length > 0 && (
          <div className="mt-2 text-xs">
            <span className="text-gray-400">Error types:</span>
            <ul className="mt-1">
              {Object.entries(errorTypes).map(([type, count]) => (
                <li key={type} className="text-red-300">
                  {type}: {count}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
