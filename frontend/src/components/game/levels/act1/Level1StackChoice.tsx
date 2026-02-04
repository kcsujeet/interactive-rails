/**
 * Level 1: The Stack Choice
 *
 * Custom UI for Level 1 - different from the regular pipeline canvas.
 * Features slots for database and frontend choices with live code preview.
 */

import { useState } from 'react';
import type { LevelComponentProps } from '../index';
import { Button } from '../../../ui/Button';

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
    <div className="h-full flex bg-background">
      {/* Left Panel - Scenario & Instructions & Palette */}
      <div className="w-72 bg-card border-r border-border flex flex-col">
        {/* Scenario */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 text-warning text-sm font-medium mb-2">
            <span>!</span>
            <span>Scenario</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Day 1. You are initializing the repository. Your architectural choices today will determine your scaling limits in Act IV.
          </p>
        </div>

        {/* Instructions */}
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground mb-3">Instructions</h3>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary">1.</span>
              <span>Drag a Database System to the Database slot</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">2.</span>
              <span>Drag a Frontend Architecture to the Frontend slot</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary">3.</span>
              <span>Click 'Generate App' to initialize your Rails application</span>
            </li>
          </ol>
        </div>

        {/* Component Palette */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Component Palette</h3>

          {/* Databases */}
          <div className="mb-4">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Databases</h4>
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
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Frontend</h4>
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
        <div className="h-14 border-b border-border flex items-center justify-between px-6">
          <Button variant="ghost" size="sm" onClick={onExit}>
            &larr; Levels
          </Button>
          <div className="text-center">
            <div className="text-xs text-primary font-medium">LEVEL 1</div>
            <div className="text-lg font-bold text-foreground">The Stack Choice</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setDatabase(null); setFrontend(null); }}
          >
            Reset
          </Button>
        </div>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-2xl">
            <h3 className="text-center text-sm font-medium text-muted-foreground mb-8">Architecture Canvas</h3>

            {/* Terminal Node */}
            <div className="flex justify-center mb-8">
              <div className="bg-gradient-to-br from-primary/20 to-primary/10 border border-primary rounded-lg px-8 py-4 shadow-lg shadow-primary/20">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-mono">&gt;_</span>
                  <div>
                    <div className="text-primary font-semibold">Terminal</div>
                    <div className="text-primary/70 text-sm font-mono">$ rails new</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Connection Lines */}
            <div className="flex justify-center mb-4">
              <svg width="200" height="40" className="text-primary/50">
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
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                size="lg"
                className={canGenerate ? 'shadow-lg shadow-primary/30' : ''}
              >
                <span>*</span>
                <span>GENERATE APP</span>
              </Button>
            </div>
            {!canGenerate && (
              <div className="text-center mt-2 text-xs text-muted-foreground">Fill all slots to generate</div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Code Preview & Learning */}
      <div className="w-80 bg-card border-l border-border flex flex-col">
        {/* Generated Code */}
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground mb-3">Generated Rails Code</h3>
          <div className="bg-background rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <div className="w-3 h-3 rounded-full bg-warning" />
              <div className="w-3 h-3 rounded-full bg-success" />
              <span className="text-xs text-muted-foreground ml-2">rails_generator.sh</span>
            </div>
            <pre className="text-sm font-mono">
              <span className="text-muted-foreground"># Your generated command:</span>
              {'\n'}
              <span className="text-primary">rails new</span>
              <span className="text-foreground"> myapp</span>
              {database && (
                <>
                  {' \\\n  '}
                  <span className="text-muted-foreground">--database=</span>
                  <span className="text-success">{database}</span>
                </>
              )}
              {frontend === 'react' && (
                <>
                  {' \\\n  '}
                  <span className="text-warning">--api</span>
                </>
              )}
              {!database && !frontend && (
                <>
                  {' \\\n  '}
                  <span className="text-muted-foreground">{'<options>'}</span>
                </>
              )}
            </pre>
          </div>
        </div>

        {/* Learning Goal */}
        <div className="p-4">
          <div className="text-xs font-semibold text-success uppercase tracking-wider mb-2">Learning Goal</div>
          <p className="text-sm text-muted-foreground">
            Understanding rails new flags and database trade-offs.
          </p>
        </div>

        {/* Trade-offs Info */}
        {(database || frontend) && (
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-warning uppercase tracking-wider mb-2">Your Choices</div>
            <div className="space-y-2 text-sm">
              {database === 'postgresql' && (
                <div className="text-muted-foreground">
                  + <span className="text-success">PostgreSQL</span> - Can scale to sharding in Act IV
                </div>
              )}
              {database === 'sqlite' && (
                <div className="text-muted-foreground">
                  ! <span className="text-warning">SQLite</span> - Cannot shard (Level 22 blocked)
                </div>
              )}
              {frontend === 'hotwire' && (
                <div className="text-muted-foreground">
                  + <span className="text-success">Hotwire</span> - Monolithic, simpler architecture
                </div>
              )}
              {frontend === 'react' && (
                <div className="text-muted-foreground">
                  ! <span className="text-warning">React</span> - Requires API-only mode
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
          ? 'bg-secondary/50 border-border opacity-50 cursor-not-allowed'
          : 'bg-secondary border-border hover:border-primary cursor-grab active:cursor-grabbing'
        }
      `}
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-foreground" style={{ backgroundColor: color }}>{icon}</span>
          <span className="font-medium text-foreground">{name}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-1">{description}</p>
      {warning && (
        <p className="text-xs text-warning">! {warning}</p>
      )}
      {benefit && (
        <p className="text-xs text-success">+ {benefit}</p>
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
        <Button
          onClick={onClear}
          variant="secondary"
          size="icon"
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-xs z-10"
        >
          x
        </Button>
        <div
          className="w-56 p-4 rounded-lg border-2 transition-all"
          style={{ borderColor: filledInfo.color, backgroundColor: `${filledInfo.color}15` }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold text-foreground" style={{ backgroundColor: filledInfo.color }}>{filledInfo.icon}</span>
            <div>
              <div className="font-semibold text-foreground">{filledInfo.name}</div>
              <div className="text-xs text-muted-foreground">{filledInfo.description}</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{sublabel}</div>
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
          ? 'border-primary bg-primary/10 scale-105'
          : 'border-border bg-card/50 hover:border-muted-foreground'
        }
      `}
    >
      <div className="text-3xl text-muted-foreground mb-2">+</div>
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="text-xs text-muted-foreground">{sublabel}</div>
      <div className="text-xs text-primary mt-2">Drag & drop here</div>
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
