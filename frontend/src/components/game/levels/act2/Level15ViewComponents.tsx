/**
 * Level 15: View Components
 *
 * Extract reusable UI components from views.
 * Player identifies duplicated markup and creates components.
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

interface UIElement {
  id: string;
  name: string;
  instances: number;
  extracted: boolean;
  code: string;
}

const UI_ELEMENTS: UIElement[] = [
  { id: 'avatar', name: 'User Avatar', instances: 12, extracted: false, code: '<div class="avatar"><img src="<%= user.avatar_url %>"></div>' },
  { id: 'card', name: 'Content Card', instances: 8, extracted: false, code: '<div class="card"><%= content %></div>' },
  { id: 'badge', name: 'Status Badge', instances: 15, extracted: false, code: '<span class="badge badge-<%= status %>"><%= text %></span>' },
  { id: 'button', name: 'Action Button', instances: 23, extracted: false, code: '<button class="btn btn-<%= variant %>"><%= label %></button>' },
];

export function Level15ViewComponents({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [elements, setElements] = useState<UIElement[]>(UI_ELEMENTS);

  const extractedCount = elements.filter(e => e.extracted).length;
  const totalDuplication = elements.reduce((sum, e) => sum + e.instances, 0);
  const remainingDuplication = elements.filter(e => !e.extracted).reduce((sum, e) => sum + e.instances, 0);

  const validateSolution = (): ValidationResult => {
    const unextracted = elements.filter(e => !e.extracted);
    if (unextracted.length > 0) {
      return {
        valid: false,
        message: 'Extract all duplicated elements!',
        details: [`${unextracted.length} element(s) still duplicated across views`],
      };
    }
    return { valid: true, message: 'Views are now DRY with reusable components!' };
  };

  const extractElement = (elementId: string) => {
    setElements(prev => prev.map(e => e.id === elementId ? { ...e, extracted: true } : e));
  };

  const handleComplete = async () => {
    const success = await completeLevel('act2-level15-view-components', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const generateComponentCode = (element: UIElement) => {
    return `# app/components/${element.id}_component.rb
class ${element.name.replace(' ', '')}Component < ViewComponent::Base
  def initialize(${element.id === 'avatar' ? 'user:' : element.id === 'badge' ? 'status:, text:' : element.id === 'button' ? 'label:, variant: :primary' : 'content:'})
    @${element.id === 'avatar' ? 'user' : element.id === 'badge' ? 'status, @text' : element.id === 'button' ? 'label, @variant' : 'content'} = ${element.id === 'avatar' ? 'user' : element.id === 'badge' ? 'status, text' : element.id === 'button' ? 'label, variant' : 'content'}
  end
end`;
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="The same avatar markup is copy-pasted in 12 different views. When design changes, you have to update all 12. This is a maintenance nightmare."
          instructions={[
            'View Components encapsulate UI elements',
            'Write once, use everywhere',
            'Click elements to extract them into components',
            'Reduce duplication across your views',
          ]}
          goal="DRY up your views with ViewComponent. Testable, reusable UI pieces."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Duplication Score
            </div>
            <div className="text-center py-4">
              <div className={`text-4xl font-bold ${remainingDuplication === 0 ? 'text-green-400' : 'text-red-400'}`}>
                {remainingDuplication}
              </div>
              <div className="text-xs text-gray-500">duplicated elements remaining</div>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${((totalDuplication - remainingDuplication) / totalDuplication) * 100}%` }}
              />
            </div>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Components created</span>
              <span className={extractedCount === elements.length ? 'text-green-400' : 'text-white'}>
                {extractedCount} / {elements.length}
              </span>
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={15}
          levelName="View Components"
          actNumber={2}
          onExit={onExit}
          onReset={() => setElements(UI_ELEMENTS)}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-8 overflow-auto">
          <div className="max-w-3xl mx-auto">
            {/* View Files Grid */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {['index.html.erb', 'show.html.erb', 'dashboard.html.erb', 'profile.html.erb', 'settings.html.erb', 'admin.html.erb'].map((file, i) => (
                <div key={file} className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                  <div className="text-xs text-gray-500 mb-2">{file}</div>
                  <div className="flex flex-wrap gap-1">
                    {elements.map(el => {
                      const showInFile = (i + el.instances) % 3 === 0 || el.instances > 10;
                      if (!showInFile) return null;
                      return (
                        <div
                          key={el.id}
                          className={`text-xs px-2 py-1 rounded ${
                            el.extracted
                              ? 'bg-green-900/30 text-green-400 border border-green-600'
                              : 'bg-red-900/30 text-red-400 border border-red-600'
                          }`}
                        >
                          {el.extracted ? `<${el.name.replace(' ', '')} />` : el.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Elements to Extract */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <div className="text-white font-semibold">Duplicated Elements</div>
                <div className="text-xs text-gray-500">Click to extract into a component</div>
              </div>
              <div className="p-4 space-y-3">
                {elements.map(element => (
                  <div
                    key={element.id}
                    onClick={() => !element.extracted && extractElement(element.id)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      element.extracted
                        ? 'border-green-600 bg-green-900/10 cursor-default'
                        : 'border-red-600 bg-red-900/10 cursor-pointer hover:bg-red-900/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-semibold ${element.extracted ? 'text-green-400' : 'text-red-400'}`}>
                          {element.name}
                        </span>
                        {element.extracted && (
                          <span className="text-xs bg-green-900/40 text-green-400 px-2 py-1 rounded">
                            ✓ Extracted
                          </span>
                        )}
                      </div>
                      <div className={`text-sm ${element.extracted ? 'text-green-400' : 'text-red-400'}`}>
                        {element.extracted ? '1 component' : `${element.instances} duplicates`}
                      </div>
                    </div>
                    <pre className={`text-xs p-2 rounded ${element.extracted ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
                      <code className="text-gray-400">
                        {element.extracted
                          ? `<%= render ${element.name.replace(' ', '')}Component.new(...) %>`
                          : element.code}
                      </code>
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={elements.filter(e => e.extracted).map(e => ({
            filename: `app/components/${e.id}_component.rb`,
            language: 'ruby',
            code: generateComponentCode(e),
            highlight: [2],
          }))}
          learningGoal="ViewComponent extracts UI into testable Ruby classes. Each component has its own template and can be unit tested."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">ViewComponent Benefits</div>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>+ Unit testable UI</li>
              <li>+ Encapsulated logic & markup</li>
              <li>+ Better performance than partials</li>
              <li>+ Type-safe with Sorbet/RBS</li>
            </ul>
          </div>

          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Usage</div>
            <pre className="text-xs text-gray-400 bg-gray-800 p-2 rounded overflow-x-auto">
{`<%# In any view %>
<%= render AvatarComponent.new(
  user: @user
) %>`}
            </pre>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level15ViewComponents;
