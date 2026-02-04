/**
 * Incident Feed Component
 *
 * Displays a real-time feed of simulated log events and incidents.
 * Shows N+1 detections, slow queries, cache misses, errors, etc.
 */

import { useState, useEffect, useRef } from 'react';
import type { Incident, IncidentType } from '../game/types';
import { Button } from '../ui/Button';

interface IncidentFeedProps {
  incidents: Incident[];
  maxVisible?: number;
  className?: string;
}

// Incident type configurations
const INCIDENT_CONFIG: Record<IncidentType, { icon: string; color: string; bgColor: string }> = {
  n_plus_one_detected: { icon: '!', color: 'text-destructive', bgColor: 'bg-destructive/30' },
  slow_query: { icon: '>', color: 'text-warning', bgColor: 'bg-warning/30' },
  cache_miss: { icon: '$', color: 'text-primary', bgColor: 'bg-primary/30' },
  high_memory: { icon: 'M', color: 'text-primary', bgColor: 'bg-primary/30' },
  error_spike: { icon: 'X', color: 'text-destructive', bgColor: 'bg-destructive/30' },
  timeout: { icon: 'T', color: 'text-warning', bgColor: 'bg-warning/30' },
  rate_limit: { icon: '#', color: 'text-warning', bgColor: 'bg-warning/30' },
  connection_blocked: { icon: '/', color: 'text-muted-foreground', bgColor: 'bg-secondary/30' },
  deadlock: { icon: 'D', color: 'text-destructive', bgColor: 'bg-destructive/30' },
  circuit_open: { icon: '!', color: 'text-warning', bgColor: 'bg-warning/30' },
};

const SEVERITY_COLORS = {
  info: 'border-l-primary',
  warning: 'border-l-warning',
  error: 'border-l-destructive',
  critical: 'border-l-destructive',
};

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function IncidentItem({ incident }: { incident: Incident }) {
  const config = INCIDENT_CONFIG[incident.type] || {
    icon: '?',
    color: 'text-muted-foreground',
    bgColor: 'bg-secondary/30',
  };
  const severityBorder = SEVERITY_COLORS[incident.severity];

  return (
    <div
      className={`p-2 border-l-2 ${severityBorder} ${config.bgColor} rounded-r text-xs animate-fadeIn`}
    >
      <div className="flex items-start gap-2">
        <span className={`font-mono font-bold ${config.color}`}>[{config.icon}]</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-foreground truncate">{incident.message}</span>
            <span className="text-muted-foreground text-[10px] shrink-0">
              {formatTimestamp(incident.timestamp)}
            </span>
          </div>
          {incident.nodeIds && incident.nodeIds.length > 0 && (
            <div className="text-muted-foreground text-[10px] mt-0.5">
              Nodes: {incident.nodeIds.join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function IncidentFeed({
  incidents,
  maxVisible = 50,
  className = '',
}: IncidentFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new incidents arrive
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [incidents, autoScroll]);

  // Detect manual scroll
  const handleScroll = () => {
    if (feedRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
      setAutoScroll(isAtBottom);
    }
  };

  const visibleIncidents = incidents.slice(-maxVisible);
  const hasMore = incidents.length > maxVisible;

  // Count by severity
  const counts = {
    critical: incidents.filter(i => i.severity === 'critical').length,
    error: incidents.filter(i => i.severity === 'error').length,
    warning: incidents.filter(i => i.severity === 'warning').length,
    info: incidents.filter(i => i.severity === 'info').length,
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header with severity counts */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-card/50">
        <span className="text-xs font-semibold text-foreground">Incident Log</span>
        <div className="flex gap-2 text-[10px]">
          {counts.critical > 0 && (
            <span className="text-destructive">{counts.critical} crit</span>
          )}
          {counts.error > 0 && (
            <span className="text-destructive">{counts.error} err</span>
          )}
          {counts.warning > 0 && (
            <span className="text-warning">{counts.warning} warn</span>
          )}
          <span className="text-muted-foreground">{incidents.length} total</span>
        </div>
      </div>

      {/* Feed */}
      <div
        ref={feedRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 space-y-1 font-mono"
      >
        {hasMore && (
          <div className="text-center text-muted-foreground text-[10px] py-1">
            ... {incidents.length - maxVisible} earlier incidents hidden ...
          </div>
        )}
        {visibleIncidents.length === 0 ? (
          <div className="text-muted-foreground text-xs text-center py-4">
            No incidents recorded
          </div>
        ) : (
          visibleIncidents.map((incident) => (
            <IncidentItem key={incident.id} incident={incident} />
          ))
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <Button
          onClick={() => {
            setAutoScroll(true);
            if (feedRef.current) {
              feedRef.current.scrollTop = feedRef.current.scrollHeight;
            }
          }}
          size="sm"
          className="absolute bottom-2 right-2 text-[10px]"
        >
          Resume auto-scroll
        </Button>
      )}
    </div>
  );
}

// ============================================
// Incident Generator (for simulation)
// ============================================

let incidentIdCounter = 0;

export function generateIncidentId(): string {
  return `incident-${Date.now()}-${incidentIdCounter++}`;
}

export function createIncident(
  type: IncidentType,
  message: string,
  severity: Incident['severity'] = 'info',
  nodeIds?: string[],
): Incident {
  return {
    id: generateIncidentId(),
    timestamp: Date.now(),
    type,
    message,
    severity,
    nodeIds,
  };
}

// Pre-defined incident messages for simulation
export const INCIDENT_MESSAGES: Record<IncidentType, string[]> = {
  n_plus_one_detected: [
    'N+1 query detected: Post.find each triggers User.find',
    'N+1 pattern: Loading comments individually for each post',
    'Detected 50 individual queries for associated records',
  ],
  slow_query: [
    'Slow query: SELECT * FROM users took 2340ms',
    'Query exceeded threshold: full table scan on posts (1823ms)',
    'Slow query alert: complex JOIN took 5200ms',
  ],
  cache_miss: [
    'Cache miss: homepage_posts (regenerating)',
    'Cache expired: user_profile_42',
    'Cache miss ratio exceeded 80% in last minute',
  ],
  high_memory: [
    'Memory pressure: 85% utilization',
    'Memory spike: eager loading 10k records',
    'GC pause: 150ms due to memory pressure',
  ],
  error_spike: [
    'Error rate spiked to 12% in last 30s',
    'ActiveRecord::RecordNotFound surge',
    'Timeout errors increasing: 23 in last minute',
  ],
  timeout: [
    'Request timeout: /api/reports (30s limit)',
    'Database connection timeout',
    'External API timeout: payment_service',
  ],
  rate_limit: [
    'Rate limit exceeded for IP 192.168.1.100',
    'API rate limit: 1000 req/min exceeded',
    'Throttling requests from user_id=42',
  ],
  connection_blocked: [
    'Connection blocked: View cannot connect to Database directly',
    'Invalid connection attempt: Controller -> Cache (use Model)',
    'Blocked: direct database access from view layer',
  ],
  deadlock: [
    'Deadlock detected: transactions waiting on each other',
    'Database deadlock: rolling back transaction',
    'Lock timeout: could not acquire advisory lock',
  ],
  circuit_open: [
    'Circuit breaker open: payment_service',
    'Circuit tripped: 5 failures in 10s',
    'External service degraded: using fallback',
  ],
};

export function generateRandomIncident(nodeIds?: string[]): Incident {
  const types = Object.keys(INCIDENT_MESSAGES) as IncidentType[];
  const type = types[Math.floor(Math.random() * types.length)];
  const messages = INCIDENT_MESSAGES[type];
  const message = messages[Math.floor(Math.random() * messages.length)];

  // Determine severity based on type
  let severity: Incident['severity'] = 'info';
  if (['n_plus_one_detected', 'error_spike', 'deadlock'].includes(type)) {
    severity = 'error';
  } else if (['slow_query', 'high_memory', 'timeout', 'circuit_open'].includes(type)) {
    severity = 'warning';
  } else if (['cache_miss', 'rate_limit'].includes(type)) {
    severity = 'info';
  }

  // Random chance of critical
  if (Math.random() < 0.05 && severity === 'error') {
    severity = 'critical';
  }

  return createIncident(type, message, severity, nodeIds);
}
