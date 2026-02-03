/**
 * Level 2: Your First Model
 *
 * Learn what a Model is: data + behavior in one place.
 * Player creates their first ActiveRecord model by choosing attributes.
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

interface ModelAttribute {
  id: string;
  name: string;
  type: string;
  description: string;
  selected: boolean;
  required: boolean;
}

const AVAILABLE_ATTRIBUTES: ModelAttribute[] = [
  { id: 'title', name: 'title', type: 'string', description: 'The title of the post', selected: false, required: true },
  { id: 'body', name: 'body', type: 'text', description: 'The main content', selected: false, required: true },
  { id: 'published', name: 'published', type: 'boolean', description: 'Is the post visible?', selected: false, required: false },
  { id: 'views_count', name: 'views_count', type: 'integer', description: 'How many times viewed', selected: false, required: false },
  { id: 'published_at', name: 'published_at', type: 'datetime', description: 'When it was published', selected: false, required: false },
];

export function Level2Model({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [attributes, setAttributes] = useState<ModelAttribute[]>(AVAILABLE_ATTRIBUTES);
  const [modelName, setModelName] = useState('Post');
  const [showMigration, setShowMigration] = useState(false);

  const selectedAttributes = attributes.filter(a => a.selected);
  const requiredSelected = attributes.filter(a => a.required && a.selected).length;
  const requiredTotal = attributes.filter(a => a.required).length;

  // Validation function
  const validateSolution = (): ValidationResult => {
    const errors: string[] = [];

    if (!modelName.trim()) {
      errors.push('Enter a model name');
    }

    if (modelName.trim() && !/^[A-Z][a-zA-Z]*$/.test(modelName.trim())) {
      errors.push('Model name should be singular and capitalized (e.g., Post, User)');
    }

    const missingRequired = attributes.filter(a => a.required && !a.selected);
    if (missingRequired.length > 0) {
      errors.push(`Select required attributes: ${missingRequired.map(a => a.name).join(', ')}`);
    }

    if (selectedAttributes.length < 2) {
      errors.push('Select at least 2 attributes for your model');
    }

    if (errors.length > 0) {
      return {
        valid: false,
        message: 'Model needs more work!',
        details: errors,
      };
    }

    return {
      valid: true,
      message: 'Your first ActiveRecord model is ready!',
    };
  };

  const toggleAttribute = (id: string) => {
    setAttributes(prev =>
      prev.map(a => (a.id === id ? { ...a, selected: !a.selected } : a))
    );
  };

  const handleComplete = async () => {
    const success = await completeLevel('act1-level2-your-first-model', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  // Generate migration code
  const generateMigrationCode = () => {
    const tableName = modelName.toLowerCase() + 's';
    const attrLines = selectedAttributes
      .map(a => `      t.${a.type} :${a.name}`)
      .join('\n');

    return `class Create${modelName}s < ActiveRecord::Migration[7.1]
  def change
    create_table :${tableName} do |t|
${attrLines}

      t.timestamps
    end
  end
end`;
  };

  // Generate model code
  const generateModelCode = () => {
    return `class ${modelName} < ApplicationRecord
  # Your ${modelName} model is ready!
  # It automatically gets:
  # - id (primary key)
  # - created_at (when created)
  # - updated_at (when modified)
${selectedAttributes.map(a => `  # - ${a.name} (${a.type})`).join('\n')}
end`;
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="You're starting a blog. Before writing any code, you need to decide what a 'Post' looks like. In Rails, this is called a Model."
          instructions={[
            'A Model represents data in your app',
            'Choose attributes (columns) for your Post',
            'Required: title and body are essential',
            'Optional: add more to track extra info',
          ]}
          goal="Understand that Models define the shape of your data. Each attribute becomes a database column."
        >
          {/* Model Name Input */}
          <div className="p-4 border-t border-gray-800">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
              Model Name
            </label>
            <input
              type="text"
              value={modelName}
              onChange={e => setModelName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              placeholder="Post"
            />
            <div className="text-xs text-gray-500 mt-1">
              Singular, capitalized (Post, not posts)
            </div>
          </div>

          {/* Attribute Selection */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Choose Attributes ({selectedAttributes.length} selected)
            </div>
            <div className="space-y-2">
              {attributes.map(attr => (
                <button
                  key={attr.id}
                  onClick={() => toggleAttribute(attr.id)}
                  className={`w-full p-3 rounded-lg text-left transition-all border-2 ${
                    attr.selected
                      ? 'bg-cyan-900/40 border-cyan-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-sm">{attr.name}</span>
                      <span className="text-xs text-gray-500 ml-2">:{attr.type}</span>
                      {attr.required && (
                        <span className="text-xs text-amber-400 ml-2">(required)</span>
                      )}
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      attr.selected ? 'bg-cyan-500 border-cyan-500' : 'border-gray-600'
                    }`}>
                      {attr.selected && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{attr.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Progress
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Required attributes</span>
              <span className={requiredSelected === requiredTotal ? 'text-green-400' : 'text-white'}>
                {requiredSelected} / {requiredTotal}
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${(requiredSelected / requiredTotal) * 100}%` }}
              />
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={2}
          levelName="Your First Model"
          actNumber={1}
          onExit={onExit}
          onReset={() => setAttributes(AVAILABLE_ATTRIBUTES)}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-8 overflow-auto">
          {/* Visual Model Representation */}
          <div className="max-w-lg mx-auto">
            {/* Model Card */}
            <div className="bg-gray-900 rounded-xl border-2 border-purple-500 overflow-hidden">
              {/* Header */}
              <div className="bg-purple-900/40 px-4 py-3 border-b border-purple-500/50">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold text-lg">
                    M
                  </span>
                  <div>
                    <div className="text-white font-semibold text-lg">{modelName || 'Model'}</div>
                    <div className="text-purple-300 text-xs">ActiveRecord Model</div>
                  </div>
                </div>
              </div>

              {/* Attributes */}
              <div className="p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Attributes</div>

                {/* Built-in attributes */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="font-mono">id</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-800 rounded">integer</span>
                    <span className="text-xs">(automatic)</span>
                  </div>
                </div>

                {/* Selected attributes */}
                {selectedAttributes.length > 0 ? (
                  <div className="space-y-2">
                    {selectedAttributes.map(attr => (
                      <div key={attr.id} className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-cyan-400">{attr.name}</span>
                        <span className="text-xs px-2 py-0.5 bg-cyan-900/40 text-cyan-300 rounded">{attr.type}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-600 text-sm italic">
                    Select attributes from the left panel
                  </div>
                )}

                {/* Timestamps */}
                <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="font-mono">created_at</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-800 rounded">datetime</span>
                    <span className="text-xs">(automatic)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="font-mono">updated_at</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-800 rounded">datetime</span>
                    <span className="text-xs">(automatic)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Arrow to Database */}
            {selectedAttributes.length >= 2 && (
              <div className="flex flex-col items-center my-6">
                <svg className="w-6 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 48">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 0v40m0 0l-6-6m6 6l6-6" />
                </svg>
                <div className="text-xs text-gray-500 mt-1">maps to</div>
              </div>
            )}

            {/* Database Table Preview */}
            {selectedAttributes.length >= 2 && (
              <div className="bg-gray-900 rounded-xl border-2 border-cyan-500 overflow-hidden">
                <div className="bg-cyan-900/40 px-4 py-3 border-b border-cyan-500/50">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg bg-cyan-600 flex items-center justify-center text-white font-bold text-lg">
                      D
                    </span>
                    <div>
                      <div className="text-white font-semibold">{modelName.toLowerCase()}s</div>
                      <div className="text-cyan-300 text-xs">Database Table</div>
                    </div>
                  </div>
                </div>
                <div className="p-4 text-xs text-gray-500">
                  Rails automatically creates a database table with columns for each attribute.
                </div>
              </div>
            )}
          </div>

          {/* Toggle migration view */}
          <div className="mt-8 text-center">
            <button
              onClick={() => setShowMigration(!showMigration)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {showMigration ? 'Hide' : 'Show'} migration preview
            </button>
          </div>
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[
            {
              filename: `app/models/${modelName.toLowerCase()}.rb`,
              language: 'ruby',
              code: generateModelCode(),
              highlight: [1],
            },
            ...(showMigration ? [{
              filename: `db/migrate/create_${modelName.toLowerCase()}s.rb`,
              language: 'ruby',
              code: generateMigrationCode(),
              highlight: selectedAttributes.map((_, i) => i + 4),
            }] : []),
          ]}
          learningGoal="A Model is a Ruby class that inherits from ApplicationRecord. It represents a database table and gives you methods to query and manipulate data."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">
              Key Concepts
            </div>
            <ul className="text-xs text-gray-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-purple-400">M</span>
                <span>Model = Data + Behavior in one class</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400">D</span>
                <span>Each Model maps to a database table</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">+</span>
                <span>Attributes become columns automatically</span>
              </li>
            </ul>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level2Model;
