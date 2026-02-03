/**
 * Level 24: File Storage
 *
 * Handle file uploads with ActiveStorage and cloud providers.
 * Player learns direct uploads, variants, and storage configuration.
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

interface StorageConfig {
  provider: 'local' | 's3' | 'gcs' | null;
  directUpload: boolean;
  variants: boolean;
  cdn: boolean;
}

interface UploadSimulation {
  id: number;
  filename: string;
  size: number;
  progress: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  path: 'server' | 'direct';
}

const PROVIDERS = [
  { id: 'local', name: 'Local Disk', icon: '💾', description: 'Development only', pros: ['Simple', 'No cost'], cons: ['Not scalable', 'No CDN'] },
  { id: 's3', name: 'Amazon S3', icon: '☁️', description: 'Most popular choice', pros: ['Scalable', 'Cheap storage', 'Global CDN'], cons: ['AWS lock-in', 'Complex pricing'] },
  { id: 'gcs', name: 'Google Cloud', icon: '🌐', description: 'GCP integration', pros: ['ML integration', 'Strong CDN'], cons: ['Less common', 'GCP-centric'] },
];

export function Level24FileStorage({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [config, setConfig] = useState<StorageConfig>({
    provider: null,
    directUpload: false,
    variants: false,
    cdn: false,
  });
  const [uploads, setUploads] = useState<UploadSimulation[]>([]);
  const [serverLoad, setServerLoad] = useState(0);

  const simulateUpload = () => {
    const file: UploadSimulation = {
      id: Date.now(),
      filename: `photo_${Math.random().toString(36).substr(2, 6)}.jpg`,
      size: Math.floor(Math.random() * 5 + 1) * 1024 * 1024, // 1-5 MB
      progress: 0,
      status: 'uploading',
      path: config.directUpload ? 'direct' : 'server',
    };

    setUploads(prev => [...prev.slice(-4), file]);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploads(prev => prev.map(u => {
        if (u.id !== file.id) return u;
        if (u.progress >= 100) {
          clearInterval(interval);
          return { ...u, status: config.variants ? 'processing' : 'done' };
        }
        return { ...u, progress: Math.min(u.progress + 20, 100) };
      }));

      // Server load increases when not using direct upload
      if (!config.directUpload) {
        setServerLoad(prev => Math.min(prev + 10, 100));
      }
    }, 300);

    // Process variants
    if (config.variants) {
      setTimeout(() => {
        setUploads(prev => prev.map(u =>
          u.id === file.id ? { ...u, status: 'done' } : u
        ));
      }, 2500);
    }

    // Decay server load
    setTimeout(() => {
      setServerLoad(prev => Math.max(prev - 30, 0));
    }, 2000);
  };

  const selectProvider = (providerId: string) => {
    setConfig(prev => ({ ...prev, provider: providerId as StorageConfig['provider'] }));
  };

  const toggleFeature = (feature: 'directUpload' | 'variants' | 'cdn') => {
    setConfig(prev => ({ ...prev, [feature]: !prev[feature] }));
  };

  const validateSolution = (): ValidationResult => {
    if (!config.provider || config.provider === 'local') {
      return {
        valid: false,
        message: 'Choose a cloud storage provider!',
        details: ['Local disk is not suitable for production'],
      };
    }
    if (!config.directUpload) {
      return {
        valid: false,
        message: 'Enable direct uploads!',
        details: ['Direct uploads prevent server overload'],
      };
    }
    if (!config.cdn) {
      return {
        valid: false,
        message: 'Enable CDN!',
        details: ['CDN provides fast global access to files'],
      };
    }
    return { valid: true, message: 'Production-ready file storage configured!' };
  };

  const handleComplete = async () => {
    const success = await completeLevel('act4-level24-file-storage', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Users are uploading profile photos. Large files are clogging your server memory, and downloads are slow for users in other countries. Time to set up proper file storage!"
          instructions={[
            'Choose a cloud storage provider',
            'Enable direct uploads to bypass server',
            'Generate image variants for different sizes',
            'Use CDN for fast global delivery',
          ]}
          goal="Configure scalable file storage with ActiveStorage for production."
        >
          {/* Server Load */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Server Memory Usage
            </div>
            <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  serverLoad > 70 ? 'bg-red-500' :
                  serverLoad > 40 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${serverLoad}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1 text-center">
              {serverLoad > 70 ? 'High load! Enable direct uploads' :
               serverLoad > 40 ? 'Moderate load' : 'Healthy'}
            </div>
          </div>

          <div className="p-4 border-t border-gray-800">
            <button
              onClick={simulateUpload}
              className="w-full py-2 rounded-lg font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-all"
            >
              Simulate File Upload
            </button>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Configuration</span>
              <span className={config.provider && config.directUpload && config.cdn ? 'text-green-400' : 'text-white'}>
                {[config.provider, config.directUpload, config.cdn].filter(Boolean).length} / 3 required
              </span>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={24}
          levelName="File Storage"
          actNumber={4}
          onExit={onExit}
          onReset={() => {
            setConfig({ provider: null, directUpload: false, variants: false, cdn: false });
            setUploads([]);
            setServerLoad(0);
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            {/* Storage Provider Selection */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">1. Choose Storage Provider</div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-4">
                {PROVIDERS.map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => selectProvider(provider.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      config.provider === provider.id
                        ? 'border-green-500 bg-green-900/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-2xl mb-2">{provider.icon}</div>
                    <div className={`font-semibold ${config.provider === provider.id ? 'text-green-400' : 'text-white'}`}>
                      {provider.name}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{provider.description}</div>
                    <div className="text-xs space-y-1">
                      {provider.pros.map(p => (
                        <div key={p} className="text-green-400">+ {p}</div>
                      ))}
                      {provider.cons.map(c => (
                        <div key={c} className="text-red-400">- {c}</div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mb-6">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">2. Configure Features</div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-4">
                {[
                  { key: 'directUpload', name: 'Direct Upload', icon: '⬆️', desc: 'Browser uploads directly to S3, bypasses server' },
                  { key: 'variants', name: 'Image Variants', icon: '🖼️', desc: 'Auto-generate thumbnails and sizes' },
                  { key: 'cdn', name: 'CDN Delivery', icon: '🌍', desc: 'CloudFront/Cloudflare for fast global access' },
                ].map(feature => (
                  <button
                    key={feature.key}
                    onClick={() => toggleFeature(feature.key as 'directUpload' | 'variants' | 'cdn')}
                    disabled={!config.provider || config.provider === 'local'}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      config[feature.key as keyof StorageConfig]
                        ? 'border-green-500 bg-green-900/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                    } ${(!config.provider || config.provider === 'local') ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-2xl mb-2">{feature.icon}</div>
                    <div className={`font-semibold ${config[feature.key as keyof StorageConfig] ? 'text-green-400' : 'text-white'}`}>
                      {feature.name}
                    </div>
                    <div className="text-xs text-gray-500">{feature.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Visualization */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Upload Flow</div>
              </div>
              <div className="p-6">
                {/* Flow Diagram */}
                <div className="flex items-center justify-between mb-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-2">
                      <span className="text-2xl">👤</span>
                    </div>
                    <div className="text-xs text-gray-400">Browser</div>
                  </div>

                  <div className="flex-1 relative h-20">
                    {/* Server path */}
                    <div className={`absolute top-0 left-0 right-0 flex items-center ${config.directUpload ? 'opacity-30' : ''}`}>
                      <div className="flex-1 h-0.5 bg-red-500" />
                      <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-2">
                        <span className="text-xl">🖥️</span>
                      </div>
                      <div className="flex-1 h-0.5 bg-red-500" />
                    </div>
                    <div className={`absolute top-0 left-0 text-xs text-red-400 ${config.directUpload ? 'opacity-30' : ''}`}>
                      Through server (slow)
                    </div>

                    {/* Direct path */}
                    <div className={`absolute bottom-0 left-0 right-0 flex items-center ${!config.directUpload ? 'opacity-30' : ''}`}>
                      <div className="flex-1 h-0.5 bg-green-500" style={{ marginTop: '2rem' }} />
                    </div>
                    <div className={`absolute bottom-0 right-0 text-xs text-green-400 ${!config.directUpload ? 'opacity-30' : ''}`}>
                      Direct upload (fast)
                    </div>
                  </div>

                  <div className="text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 ${
                      config.provider === 's3' ? 'bg-orange-500' :
                      config.provider === 'gcs' ? 'bg-blue-500' : 'bg-gray-600'
                    }`}>
                      <span className="text-2xl">{config.provider === 's3' ? '☁️' : config.provider === 'gcs' ? '🌐' : '💾'}</span>
                    </div>
                    <div className="text-xs text-gray-400">{config.provider || 'Storage'}</div>
                  </div>
                </div>

                {/* Upload List */}
                <div className="space-y-2">
                  {uploads.map(upload => (
                    <div key={upload.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
                      <span className="text-gray-400">📄</span>
                      <span className="text-sm text-white flex-1">{upload.filename}</span>
                      <span className="text-xs text-gray-500">{(upload.size / 1024 / 1024).toFixed(1)} MB</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        upload.path === 'direct' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
                      }`}>
                        {upload.path}
                      </span>
                      <div className="w-24">
                        {upload.status === 'done' ? (
                          <span className="text-green-400 text-xs">✓ Complete</span>
                        ) : upload.status === 'processing' ? (
                          <span className="text-blue-400 text-xs">Processing variants...</span>
                        ) : (
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 transition-all"
                              style={{ width: `${upload.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {uploads.length === 0 && (
                    <div className="text-center py-4 text-gray-600">
                      Click "Simulate File Upload" to test
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[
            {
              filename: 'config/storage.yml',
              language: 'yaml',
              code: config.provider === 's3' ? `amazon:
  service: S3
  access_key_id: <%= ENV['AWS_ACCESS_KEY_ID'] %>
  secret_access_key: <%= ENV['AWS_SECRET_ACCESS_KEY'] %>
  region: us-east-1
  bucket: myapp-production` :
config.provider === 'gcs' ? `google:
  service: GCS
  project: myapp-production
  credentials: <%= ENV['GCS_CREDENTIALS'] %>
  bucket: myapp-production` :
`local:
  service: Disk
  root: <%= Rails.root.join("storage") %>`,
              highlight: [],
            },
            {
              filename: 'app/models/user.rb',
              language: 'ruby',
              code: `class User < ApplicationRecord
  has_one_attached :avatar${config.variants ? `

  # Generate variants on demand
  def avatar_thumbnail
    avatar.variant(resize_to_limit: [100, 100])
  end

  def avatar_medium
    avatar.variant(resize_to_limit: [300, 300])
  end` : ''}
end${config.directUpload ? `

# View: Enable direct uploads
# <%= form.file_field :avatar, direct_upload: true %>` : ''}`,
              highlight: config.directUpload ? [11, 12] : [],
            },
          ]}
          learningGoal="ActiveStorage abstracts cloud storage. Use direct uploads to scale, variants for images, CDN for delivery."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Best Practices</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Always use direct uploads in production</li>
              <li>• Generate variants lazily (on first request)</li>
              <li>• Use CDN for all file serving</li>
              <li>• Set proper cache headers</li>
            </ul>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Variants</div>
            <pre className="text-xs text-gray-400 bg-gray-800 p-2 rounded overflow-x-auto">
{`# On-demand processing
image.variant(
  resize_to_limit: [100, 100],
  format: :webp
)`}
            </pre>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level24FileStorage;
