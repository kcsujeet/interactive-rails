/**
 * Level 1: The Stack Choice
 *
 * Custom UI for Level 1 - different from the regular pipeline canvas.
 * Features slots for database and frontend choices with live code preview.
 */

import { useState } from 'react';
import type { LevelComponentProps } from '../index';

type DatabaseChoice = 'postgresql' | 'sqlite' | null;
type FrontendChoice = 'react' | 'hotwire' | null;

export function Level1StackChoice({ onComplete, onExit }: LevelComponentProps) {
  const [database, setDatabase] = useState<DatabaseChoice>(null);
  const [frontend, setFrontend] = useState<FrontendChoice>(null);
  const [dragOverSlot, setDragOverSlot] = useState<'database' | 'frontend' | null>(null);

  const canGenerate = database !== null && frontend !== null;

  function handleDragStart(e: React.DragEvent, type: string) {
    e.dataTransfer.setData('nodeType', type);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDropDatabase(e: React.DragEvent) {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType');
    if (nodeType === 'postgresql' || nodeType === 'sqlite') {
      setDatabase(nodeType);
    }
    setDragOverSlot(null);
  }

  function handleDropFrontend(e: React.DragEvent) {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType');
    if (nodeType === 'react' || nodeType === 'hotwire') {
      setFrontend(nodeType);
    }
    setDragOverSlot(null);
  }

  function handleGenerate() {
    if (!canGenerate) return;

    const choices = {
      database,
      frontend,
      constraints: {
        apiOnly: frontend === 'react',
        canShard: database === 'postgresql',
      },
    };

    // Persist choices to localStorage for future levels
    try {
      localStorage.setItem('rails-expert-game-choices', JSON.stringify(choices));
    } catch (e) {
      console.error('Failed to save game choices:', e);
    }

    onComplete({ stars: 3 });
  }

  function clearDatabase() {
    setDatabase(null);
  }

  function clearFrontend() {
    setFrontend(null);
  }

  return (
    <div className="h-full flex bg-gray-950">
      {/* Left Panel - Scenario & Instructions & Palette */}
      <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Scenario */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium mb-2">
            <span>!</span>
            <span>Scenario</span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">
            Day 1. You are initializing the repository. Your architectural choices today will determine your scaling limits in Act IV.
          </p>
        </div>

        {/* Instructions */}
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white mb-3">Instructions</h3>
          <ol className="space-y-2 text-sm text-gray-400">
            <li className="flex gap-2">
              <span className="text-cyan-400">1.</span>
              <span>Drag a Database System to the Database slot</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400">2.</span>
              <span>Drag a Frontend Architecture to the Frontend slot</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400">3.</span>
              <span>Click 'Generate App' to initialize your Rails application</span>
            </li>
          </ol>
        </div>

        {/* Component Palette */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Component Palette</h3>

          {/* Databases */}
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Databases</h4>
            <div className="space-y-2">
              <PaletteItem
                type="postgresql"
                name="PostgreSQL"
                description="Production-ready relational database"
                color="#336791"
                icon="P"
                disabled={database === 'postgresql'}
                onDragStart={handleDragStart}
              />
              <PaletteItem
                type="sqlite"
                name="SQLite"
                description="Simple file-based database"
                color="#003b57"
                icon="S"
                warning="Cannot support Sharding (Level 22)"
                disabled={database === 'sqlite'}
                onDragStart={handleDragStart}
              />
            </div>
          </div>

          {/* Frontend */}
          <div>
            <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Frontend</h4>
            <div className="space-y-2">
              <PaletteItem
                type="hotwire"
                name="Hotwire/ERB"
                description="Rails-native frontend with Turbo"
                color="#ff6b6b"
                icon="H"
                benefit="Monolithic, fast development"
                disabled={frontend === 'hotwire'}
                onDragStart={handleDragStart}
              />
              <PaletteItem
                type="react"
                name="React"
                description="Modern SPA with API backend"
                color="#61dafb"
                icon="R"
                warning="Requires separate API layer"
                disabled={frontend === 'react'}
                onDragStart={handleDragStart}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Center - Architecture Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-gray-800 flex items-center justify-between px-6">
          <button onClick={onExit} className="text-gray-400 hover:text-white text-sm">
            &larr; Levels
          </button>
          <div className="text-center">
            <div className="text-xs text-cyan-400 font-medium">LEVEL 1</div>
            <div className="text-lg font-bold text-white">The Stack Choice</div>
          </div>
          <button
            onClick={() => { setDatabase(null); setFrontend(null); }}
            className="text-gray-400 hover:text-white text-sm"
          >
            Reset
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-2xl">
            <h3 className="text-center text-sm font-medium text-gray-500 mb-8">Architecture Canvas</h3>

            {/* Terminal Node */}
            <div className="flex justify-center mb-8">
              <div className="bg-gradient-to-br from-cyan-900 to-cyan-950 border border-cyan-700 rounded-lg px-8 py-4 shadow-lg shadow-cyan-900/20">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-mono">&gt;_</span>
                  <div>
                    <div className="text-cyan-300 font-semibold">Terminal</div>
                    <div className="text-cyan-500 text-sm font-mono">$ rails new</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Connection Lines */}
            <div className="flex justify-center mb-4">
              <svg width="200" height="40" className="text-cyan-800">
                <path d="M 100 0 L 50 40" stroke="currentColor" strokeWidth="2" strokeDasharray="4" fill="none" />
                <path d="M 100 0 L 150 40" stroke="currentColor" strokeWidth="2" strokeDasharray="4" fill="none" />
              </svg>
            </div>

            {/* Slots */}
            <div className="flex justify-center gap-8 mb-8">
              {/* Database Slot */}
              <Slot
                label="Database System"
                sublabel="DATABASE SYSTEM"
                filled={database}
                filledInfo={database ? getDatabaseInfo(database) : null}
                onDrop={handleDropDatabase}
                onDragOver={handleDragOver}
                onDragEnter={() => setDragOverSlot('database')}
                onDragLeave={() => setDragOverSlot(null)}
                isDragOver={dragOverSlot === 'database'}
                onClear={clearDatabase}
              />

              {/* Frontend Slot */}
              <Slot
                label="Frontend Architecture"
                sublabel="Choose your UI approach"
                filled={frontend}
                filledInfo={frontend ? getFrontendInfo(frontend) : null}
                onDrop={handleDropFrontend}
                onDragOver={handleDragOver}
                onDragEnter={() => setDragOverSlot('frontend')}
                onDragLeave={() => setDragOverSlot(null)}
                isDragOver={dragOverSlot === 'frontend'}
                onClear={clearFrontend}
              />
            </div>

            {/* Generate Button */}
            <div className="flex justify-center">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={`
                  px-8 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all
                  ${canGenerate
                    ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white hover:from-cyan-500 hover:to-cyan-400 shadow-lg shadow-cyan-900/30'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                  }
                `}
              >
                <span>*</span>
                <span>GENERATE APP</span>
              </button>
            </div>
            {!canGenerate && (
              <div className="text-center mt-2 text-xs text-gray-500">Fill all slots to generate</div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Code Preview & Learning */}
      <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
        {/* Generated Code */}
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white mb-3">Generated Rails Code</h3>
          <div className="bg-gray-950 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-gray-500 ml-2">rails_generator.sh</span>
            </div>
            <pre className="text-sm font-mono">
              <span className="text-gray-500"># Your generated command:</span>
              {'\n'}
              <span className="text-cyan-400">rails new</span>
              <span className="text-white"> myapp</span>
              {database && (
                <>
                  {' \\\n  '}
                  <span className="text-gray-500">--database=</span>
                  <span className="text-green-400">{database}</span>
                </>
              )}
              {frontend === 'react' && (
                <>
                  {' \\\n  '}
                  <span className="text-yellow-400">--api</span>
                </>
              )}
              {!database && !frontend && (
                <>
                  {' \\\n  '}
                  <span className="text-gray-600">{'<options>'}</span>
                </>
              )}
            </pre>
          </div>
        </div>

        {/* Learning Goal */}
        <div className="p-4">
          <div className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">Learning Goal</div>
          <p className="text-sm text-gray-300">
            Understanding rails new flags and database trade-offs.
          </p>
        </div>

        {/* Trade-offs Info */}
        {(database || frontend) && (
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-2">Your Choices</div>
            <div className="space-y-2 text-sm">
              {database === 'postgresql' && (
                <div className="text-gray-300">
                  + <span className="text-green-400">PostgreSQL</span> - Can scale to sharding in Act IV
                </div>
              )}
              {database === 'sqlite' && (
                <div className="text-gray-300">
                  ! <span className="text-yellow-400">SQLite</span> - Cannot shard (Level 22 blocked)
                </div>
              )}
              {frontend === 'hotwire' && (
                <div className="text-gray-300">
                  + <span className="text-green-400">Hotwire</span> - Monolithic, simpler architecture
                </div>
              )}
              {frontend === 'react' && (
                <div className="text-gray-300">
                  ! <span className="text-yellow-400">React</span> - Requires API-only mode
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper components

interface PaletteItemProps {
  type: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  warning?: string;
  benefit?: string;
  disabled?: boolean;
  onDragStart: (e: React.DragEvent, type: string) => void;
}

function PaletteItem({ type, name, description, color, icon, warning, benefit, disabled, onDragStart }: PaletteItemProps) {
  return (
    <div
      draggable={!disabled}
      onDragStart={(e) => onDragStart(e, type)}
      className={`
        p-3 rounded-lg border transition-all
        ${disabled
          ? 'bg-gray-800/50 border-gray-700 opacity-50 cursor-not-allowed'
          : 'bg-gray-800 border-gray-700 hover:border-cyan-600 cursor-grab active:cursor-grabbing'
        }
      `}
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: color }}>{icon}</span>
          <span className="font-medium text-white">{name}</span>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-1">{description}</p>
      {warning && (
        <p className="text-xs text-yellow-500">! {warning}</p>
      )}
      {benefit && (
        <p className="text-xs text-green-500">+ {benefit}</p>
      )}
    </div>
  );
}

interface SlotProps {
  label: string;
  sublabel: string;
  filled: string | null;
  filledInfo: { name: string; description: string; icon: string; color: string } | null;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  isDragOver: boolean;
  onClear: () => void;
}

function Slot({ label, sublabel, filled, filledInfo, onDrop, onDragOver, onDragEnter, onDragLeave, isDragOver, onClear }: SlotProps) {
  if (filled && filledInfo) {
    return (
      <div className="relative">
        <button
          onClick={onClear}
          className="absolute -top-2 -right-2 w-5 h-5 bg-gray-700 hover:bg-gray-600 rounded-full text-gray-400 hover:text-white text-xs z-10"
        >
          x
        </button>
        <div
          className="w-56 p-4 rounded-lg border-2 transition-all"
          style={{ borderColor: filledInfo.color, backgroundColor: `${filledInfo.color}15` }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold text-white" style={{ backgroundColor: filledInfo.color }}>{filledInfo.icon}</span>
            <div>
              <div className="font-semibold text-white">{filledInfo.name}</div>
              <div className="text-xs text-gray-400">{filledInfo.description}</div>
            </div>
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">{sublabel}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      className={`
        w-56 h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all
        ${isDragOver
          ? 'border-cyan-500 bg-cyan-500/10 scale-105'
          : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
        }
      `}
    >
      <div className="text-3xl text-gray-600 mb-2">+</div>
      <div className="text-sm font-medium text-gray-400">{label}</div>
      <div className="text-xs text-gray-600">{sublabel}</div>
      <div className="text-xs text-cyan-500 mt-2">Drag & drop here</div>
    </div>
  );
}

// Helper functions
function getDatabaseInfo(db: 'postgresql' | 'sqlite' | null) {
  if (db === 'postgresql') {
    return { name: 'PostgreSQL', description: 'Production-ready relational database', icon: 'P', color: '#336791' };
  }
  if (db === 'sqlite') {
    return { name: 'SQLite', description: 'Simple file-based database', icon: 'S', color: '#003b57' };
  }
  return null;
}

function getFrontendInfo(fe: 'react' | 'hotwire' | null) {
  if (fe === 'hotwire') {
    return { name: 'Hotwire/ERB', description: 'Rails-native frontend with Turbo', icon: 'H', color: '#ff6b6b' };
  }
  if (fe === 'react') {
    return { name: 'React', description: 'Modern SPA with API backend', icon: 'R', color: '#61dafb' };
  }
  return null;
}

export default Level1StackChoice;
