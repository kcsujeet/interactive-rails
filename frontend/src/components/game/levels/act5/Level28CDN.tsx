/**
 * Level 28: CDN (Content Delivery Network)
 *
 * Serve static assets from edge locations worldwide.
 * Player learns CDN configuration and cache invalidation.
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
import { Button } from '../../../ui/Button';

interface CDNConfig {
  enabled: boolean;
  staticAssets: boolean;
  imageOptimization: boolean;
  cacheControl: boolean;
}

interface EdgeLocation {
  id: string;
  name: string;
  region: string;
  latency: number;
  cached: boolean;
}

const EDGE_LOCATIONS: EdgeLocation[] = [
  { id: 'us-east', name: 'US East', region: 'Virginia', latency: 0, cached: false },
  { id: 'us-west', name: 'US West', region: 'California', latency: 0, cached: false },
  { id: 'eu-west', name: 'Europe', region: 'Frankfurt', latency: 0, cached: false },
  { id: 'ap-east', name: 'Asia', region: 'Tokyo', latency: 0, cached: false },
  { id: 'ap-south', name: 'Australia', region: 'Sydney', latency: 0, cached: false },
];

interface UserRequest {
  id: number;
  location: string;
  asset: string;
  latency: number;
  source: 'origin' | 'edge';
}

export function Level28CDN({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [config, setConfig] = useState<CDNConfig>({
    enabled: false,
    staticAssets: false,
    imageOptimization: false,
    cacheControl: false,
  });
  const [locations, setLocations] = useState<EdgeLocation[]>(EDGE_LOCATIONS);
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [originLatency] = useState(200); // Base latency to origin

  const simulateRequest = () => {
    const location = locations[Math.floor(Math.random() * locations.length)];
    const assets = ['app.js', 'styles.css', 'logo.png', 'hero.jpg', 'fonts.woff2'];
    const asset = assets[Math.floor(Math.random() * assets.length)];

    const isStaticAsset = ['app.js', 'styles.css', 'fonts.woff2'].includes(asset);
    const isImage = ['logo.png', 'hero.jpg'].includes(asset);

    let latency: number;
    let source: 'origin' | 'edge';

    if (config.enabled) {
      const edgeLatency = 20 + Math.random() * 30; // 20-50ms from edge

      // Check if cached at edge
      const isCached = config.staticAssets && (isStaticAsset || (config.imageOptimization && isImage));

      if (isCached && location.cached) {
        latency = edgeLatency;
        source = 'edge';
      } else {
        latency = originLatency + edgeLatency;
        source = 'origin';

        // Cache at edge for next time
        if (isCached) {
          setLocations(prev => prev.map(l =>
            l.id === location.id ? { ...l, cached: true } : l
          ));
        }
      }
    } else {
      latency = originLatency + (Math.random() * 100);
      source = 'origin';
    }

    const request: UserRequest = {
      id: Date.now(),
      location: location.name,
      asset,
      latency: Math.round(latency),
      source,
    };

    setRequests(prev => [...prev.slice(-9), request]);
  };

  const toggleConfig = (key: keyof CDNConfig) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
    // Reset cache when config changes
    if (key === 'enabled') {
      setLocations(EDGE_LOCATIONS);
    }
  };

  const invalidateCache = () => {
    setLocations(prev => prev.map(l => ({ ...l, cached: false })));
  };

  const validateSolution = (): ValidationResult => {
    if (!config.enabled) {
      return {
        valid: false,
        message: 'Enable CDN!',
        details: ['CDN is required for global performance'],
      };
    }
    if (!config.staticAssets || !config.cacheControl) {
      return {
        valid: false,
        message: 'Configure CDN features!',
        details: ['Enable static assets and cache control'],
      };
    }
    return { valid: true, message: 'CDN configured for global delivery!' };
  };

  const handleComplete = async () => {
    const success = await completeLevel('act5-level28-cdn', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const avgLatency = requests.length > 0
    ? Math.round(requests.reduce((sum, r) => sum + r.latency, 0) / requests.length)
    : 0;
  const cacheHitRate = requests.length > 0
    ? Math.round((requests.filter(r => r.source === 'edge').length / requests.length) * 100)
    : 0;

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Your app is hosted in US East, but users in Tokyo are experiencing 500ms+ latencies. Time to deploy a CDN for global performance!"
          instructions={[
            'CDN caches content at edge locations',
            'Static assets (JS, CSS, images) are perfect',
            'Set proper cache headers',
            'Learn to invalidate when needed',
          ]}
          goal="Deliver fast experiences to users worldwide with CDN edge caching."
        >
          {/* Metrics */}
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Performance Metrics
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-card p-2 rounded text-center">
                <div className={`text-xl font-bold ${
                  avgLatency < 100 ? 'text-success' :
                  avgLatency < 200 ? 'text-warning' : 'text-destructive'
                }`}>
                  {avgLatency}ms
                </div>
                <div className="text-xs text-muted-foreground">Avg Latency</div>
              </div>
              <div className="bg-card p-2 rounded text-center">
                <div className={`text-xl font-bold ${
                  cacheHitRate > 70 ? 'text-success' :
                  cacheHitRate > 30 ? 'text-warning' : 'text-destructive'
                }`}>
                  {cacheHitRate}%
                </div>
                <div className="text-xs text-muted-foreground">Cache Hit Rate</div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border space-y-2">
            <Button
              onClick={simulateRequest}
              className="w-full"
            >
              Simulate Request
            </Button>
            {config.enabled && (
              <Button
                onClick={invalidateCache}
                variant="outline"
                className="w-full bg-warning/20 border-warning text-warning hover:bg-warning/30"
              >
                Invalidate Cache
              </Button>
            )}
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={28}
          levelName="CDN"
          actNumber={5}
          onExit={onExit}
          onReset={() => {
            setConfig({ enabled: false, staticAssets: false, imageOptimization: false, cacheControl: false });
            setLocations(EDGE_LOCATIONS);
            setRequests([]);
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-background p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* CDN Configuration */}
            <div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
              <div className="bg-secondary px-4 py-3 border-b border-border">
                <div className="text-foreground font-semibold">CDN Configuration</div>
              </div>
              <div className="p-4 grid grid-cols-4 gap-3">
                {[
                  { key: 'enabled', name: 'Enable CDN', icon: '🌐', desc: 'CloudFront/Cloudflare' },
                  { key: 'staticAssets', name: 'Static Assets', icon: '📦', desc: 'JS, CSS, fonts' },
                  { key: 'imageOptimization', name: 'Image Optim', icon: '🖼️', desc: 'Auto-resize, WebP' },
                  { key: 'cacheControl', name: 'Cache Headers', icon: '⏱️', desc: 'max-age, s-maxage' },
                ].map(item => (
                  <Button
                    key={item.key}
                    onClick={() => toggleConfig(item.key as keyof CDNConfig)}
                    disabled={item.key !== 'enabled' && !config.enabled}
                    variant={config[item.key as keyof CDNConfig] ? 'default' : 'outline'}
                    className={`p-3 h-auto rounded-lg border-2 text-center transition-all flex-col ${
                      config[item.key as keyof CDNConfig]
                        ? 'border-success bg-success/20'
                        : 'border-border bg-secondary hover:border-muted-foreground'
                    } ${item.key !== 'enabled' && !config.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-2xl mb-1">{item.icon}</div>
                    <div className={`text-xs font-semibold ${config[item.key as keyof CDNConfig] ? 'text-success' : 'text-foreground'}`}>
                      {item.name}
                    </div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Global Map */}
            <div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
              <div className="bg-secondary px-4 py-3 border-b border-border">
                <div className="text-foreground font-semibold">Edge Locations</div>
                <div className="text-xs text-muted-foreground">Green = cached, Gray = empty</div>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-center">
                  {/* Origin */}
                  <div className="text-center">
                    <div className="w-20 h-20 bg-purple-600 rounded-lg flex flex-col items-center justify-center mb-2">
                      <span className="text-2xl">🏠</span>
                      <span className="text-xs text-foreground">Origin</span>
                    </div>
                    <div className="text-xs text-muted-foreground">US East</div>
                  </div>

                  {/* CDN Cloud */}
                  {config.enabled && (
                    <div className="flex-1 mx-8">
                      <div className="flex justify-center gap-4">
                        {locations.map(loc => (
                          <div key={loc.id} className="text-center">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-1 ${
                              loc.cached ? 'bg-success' : 'bg-secondary'
                            }`}>
                              <span className="text-lg">📍</span>
                            </div>
                            <div className="text-xs text-muted-foreground">{loc.name}</div>
                            <div className={`text-xs ${loc.cached ? 'text-success' : 'text-muted-foreground'}`}>
                              {loc.cached ? 'Cached' : 'Empty'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Users */}
                  <div className="text-center">
                    <div className="w-20 h-20 bg-blue-600 rounded-lg flex flex-col items-center justify-center mb-2">
                      <span className="text-2xl">👥</span>
                      <span className="text-xs text-foreground">Users</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Worldwide</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Request Log */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="bg-secondary px-4 py-3 border-b border-border">
                <div className="text-foreground font-semibold">Request Log</div>
              </div>
              <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                {requests.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Click "Simulate Request" to see traffic
                  </div>
                ) : (
                  requests.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-2 bg-secondary rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${req.source === 'edge' ? 'bg-success' : 'bg-warning'}`} />
                        <span className="text-sm text-foreground">{req.asset}</span>
                        <span className="text-xs text-muted-foreground">from {req.location}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          req.source === 'edge' ? 'bg-success/40 text-success' : 'bg-warning/40 text-warning'
                        }`}>
                          {req.source === 'edge' ? 'CDN HIT' : 'ORIGIN'}
                        </span>
                        <span className={`text-sm ${req.latency < 100 ? 'text-success' : 'text-warning'}`}>
                          {req.latency}ms
                        </span>
                      </div>
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
              filename: 'config/environments/production.rb',
              language: 'ruby',
              code: `# CDN Configuration
config.action_controller.asset_host = ENV['CDN_HOST']
# => "https://d123.cloudfront.net"

# Asset fingerprinting for cache busting
config.assets.digest = true

# Long cache for immutable assets
config.public_file_server.headers = {
  'Cache-Control' => 'public, max-age=31536000'
}`,
              highlight: [2, 9],
            },
            {
              filename: 'nginx.conf',
              language: 'nginx',
              code: `# Cache control headers
location /assets/ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location /images/ {
  expires 7d;
  add_header Cache-Control "public";
}`,
              highlight: [],
            },
          ]}
          learningGoal="CDN caches at the edge for fast global delivery. Set long cache times for static assets, short for dynamic content."
        >
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">CDN Providers</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• CloudFront - AWS native</li>
              <li>• Cloudflare - Easy setup, free tier</li>
              <li>• Fastly - Real-time purging</li>
              <li>• Akamai - Enterprise</li>
            </ul>
          </div>

          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Cache Headers</div>
            <pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
{`# Browser cache for 1 day
Cache-Control: public, max-age=86400

# CDN cache for 1 year
Cache-Control: s-maxage=31536000`}
            </pre>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level28CDN;
