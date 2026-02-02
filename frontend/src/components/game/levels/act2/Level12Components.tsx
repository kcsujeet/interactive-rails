/**
 * Level 12: ViewComponents
 *
 * Extract duplicated view code into reusable ViewComponent.
 * Shows DRY principle for view layer.
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

interface ViewBlock {
  id: string;
  view: string;
  code: string;
  extracted: boolean;
}

export function Level12Components({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [componentCreated, setComponentCreated] = useState(false);
  const [blocks, setBlocks] = useState<ViewBlock[]>([
    { id: 'user-card-1', view: 'users/index', code: 'render_user_card(@user)', extracted: false },
    { id: 'user-card-2', view: 'posts/show', code: 'render_user_card(@author)', extracted: false },
    { id: 'user-card-3', view: 'comments/show', code: 'render_user_card(@commenter)', extracted: false },
  ]);

  const extractedCount = blocks.filter(b => b.extracted).length;

  // Validation function
  const validateSolution = (): ValidationResult => {
    const errors: string[] = [];

    if (!componentCreated) {
      errors.push('Create the ViewComponent first');
    }

    const unextractedBlocks = blocks.filter(b => !b.extracted);
    if (unextractedBlocks.length > 0) {
      errors.push(`${unextractedBlocks.length} view(s) still have duplicated code`);
    }

    if (errors.length > 0) {
      return {
        valid: false,
        message: 'Duplication still exists!',
        details: errors,
      };
    }

    return {
      valid: true,
      message: 'All duplicated code extracted to ViewComponent!',
    };
  };

  const handleExtract = (blockId: string) => {
    if (!componentCreated) return;
    setBlocks(prev => prev.map(b =>
      b.id === blockId ? { ...b, extracted: true } : b
    ));
  };

  const handleComplete = async () => {
    const success = await completeLevel('act2-level12-view-components', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="The same user card HTML is duplicated across 3 different views. Every change requires updating 3 files!"
          instructions={[
            'Notice the duplicated code blocks (highlighted in yellow)',
            'Create a ViewComponent to extract the shared code',
            'Click each block to consolidate into the component',
          ]}
          goal="Learn ViewComponent pattern for reusable, testable view code."
        >
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={() => setComponentCreated(true)}
              disabled={componentCreated}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                componentCreated
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {componentCreated ? 'Component Created' : 'Create ViewComponent'}
            </button>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Extraction Progress</div>
            <div className="bg-gray-800 rounded-full h-3 overflow-hidden">
              <div
                className="bg-cyan-500 h-full transition-all duration-300"
                style={{ width: `${(extractedCount / 3) * 100}%` }}
              />
            </div>
            <div className="text-gray-400 text-sm mt-2">{extractedCount} / 3 views updated</div>
          </div>

        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={12}
          levelName="ViewComponents"
          actNumber={2}
          onExit={onExit}
          onReset={() => {
            setComponentCreated(false);
            setBlocks([
              { id: 'user-card-1', view: 'users/index', code: 'render_user_card(@user)', extracted: false },
              { id: 'user-card-2', view: 'posts/show', code: 'render_user_card(@author)', extracted: false },
              { id: 'user-card-3', view: 'comments/show', code: 'render_user_card(@commenter)', extracted: false },
            ]);
          }}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-8 overflow-auto">
          <div className="flex gap-8 justify-center">
            {/* View files with duplicated code */}
            <div className="space-y-6">
              {blocks.map(block => (
                <div
                  key={block.id}
                  className={`bg-gray-900 border-2 rounded-xl p-4 w-64 transition-all ${
                    block.extracted ? 'border-green-500' : 'border-gray-700'
                  }`}
                >
                  <div className="text-gray-400 text-sm font-mono mb-3">
                    app/views/{block.view}.html.erb
                  </div>

                  {block.extracted ? (
                    <div className="bg-green-900/30 border border-green-600 rounded-lg p-3">
                      <code className="text-green-400 text-sm">
                        {'<%= render UserCardComponent.new(user: @user) %>'}
                      </code>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleExtract(block.id)}
                      disabled={!componentCreated}
                      className={`w-full text-left ${componentCreated ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`}
                    >
                      <div className={`rounded-lg p-3 ${
                        componentCreated ? 'bg-yellow-900/40 border-2 border-yellow-500 border-dashed' : 'bg-gray-800 border border-gray-700'
                      }`}>
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap">
{`<div class="user-card">
  <img src="<%= @user.avatar %>">
  <h3><%= @user.name %></h3>
  <span><%= @user.role %></span>
</div>`}
                        </pre>
                        {componentCreated && (
                          <div className="text-yellow-400 text-xs mt-2 text-center">
                            Click to extract
                          </div>
                        )}
                      </div>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Arrow */}
            <div className="flex items-center">
              <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>

            {/* ViewComponent */}
            <div className={`bg-gray-900 border-2 rounded-xl p-6 w-80 transition-all ${
              componentCreated ? 'border-cyan-500' : 'border-gray-700 opacity-50'
            }`}>
              <div className="text-cyan-400 font-mono text-sm mb-4">
                app/components/user_card_component.rb
              </div>

              {componentCreated ? (
                <div className="space-y-4">
                  <pre className="text-xs text-gray-300 bg-gray-800 rounded-lg p-3 overflow-x-auto">
{`class UserCardComponent < ViewComponent::Base
  def initialize(user:)
    @user = user
  end
end`}
                  </pre>

                  <div className="text-gray-500 text-xs font-mono">
                    user_card_component.html.erb
                  </div>
                  <pre className="text-xs text-gray-300 bg-gray-800 rounded-lg p-3">
{`<div class="user-card">
  <img src="<%= @user.avatar %>">
  <h3><%= @user.name %></h3>
  <span><%= @user.role %></span>
</div>`}
                  </pre>

                  <div className="bg-cyan-900/30 rounded-lg p-3">
                    <div className="text-cyan-400 text-sm font-medium">Benefits:</div>
                    <ul className="text-cyan-300 text-xs mt-1 space-y-1">
                      <li>+ Single source of truth</li>
                      <li>+ Unit testable in isolation</li>
                      <li>+ Type-safe parameters</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-center py-8">
                  Create component to enable extraction
                </div>
              )}

              {extractedCount === 3 && (
                <div className="mt-4 p-3 bg-green-900/30 border border-green-500 rounded-lg text-green-400 text-sm text-center">
                  All duplications removed!
                </div>
              )}
            </div>
          </div>

        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[{
            filename: 'app/components/user_card_component.rb',
            language: 'ruby',
            code: `class UserCardComponent < ViewComponent::Base
  def initialize(user:)
    @user = user
  end

  # Preview in lookbook
  def self.preview
    new(user: User.first)
  end
end

# Usage in any view:
<%= render UserCardComponent.new(user: @author) %>

# Unit test:
RSpec.describe UserCardComponent do
  it "renders the user name" do
    user = build(:user, name: "Alice")
    render_inline(described_class.new(user: user))
    expect(page).to have_text("Alice")
  end
end`,
            highlight: [1, 2, 3, 4, 13],
          }]}
          learningGoal="ViewComponents extract reusable view code into testable Ruby classes. Use them for complex UI elements that appear in multiple places."
        />
      </RightPanel>
    </LevelLayout>
  );
}

export default Level12Components;
