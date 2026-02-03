/**
 * Level 4: Your First Controller
 *
 * Learn that Controllers handle HTTP requests.
 * Player routes a request to the correct action.
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

interface Route {
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  action: string | null;
  description: string;
  correctAction: string;
}

interface ControllerAction {
  id: string;
  name: string;
  description: string;
  code: string;
}

const ROUTES: Route[] = [
  { id: 'index', method: 'GET', path: '/posts', action: null, description: 'List all posts', correctAction: 'index' },
  { id: 'show', method: 'GET', path: '/posts/:id', action: null, description: 'Show one post', correctAction: 'show' },
  { id: 'create', method: 'POST', path: '/posts', action: null, description: 'Create a post', correctAction: 'create' },
  { id: 'update', method: 'PATCH', path: '/posts/:id', action: null, description: 'Update a post', correctAction: 'update' },
  { id: 'destroy', method: 'DELETE', path: '/posts/:id', action: null, description: 'Delete a post', correctAction: 'destroy' },
];

const ACTIONS: ControllerAction[] = [
  { id: 'index', name: 'index', description: 'List all records', code: '@posts = Post.all' },
  { id: 'show', name: 'show', description: 'Display one record', code: '@post = Post.find(params[:id])' },
  { id: 'create', name: 'create', description: 'Save a new record', code: '@post = Post.create(post_params)' },
  { id: 'update', name: 'update', description: 'Modify existing record', code: '@post.update(post_params)' },
  { id: 'destroy', name: 'destroy', description: 'Remove a record', code: '@post.destroy' },
];

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#3b82f6',
  PATCH: '#f59e0b',
  DELETE: '#ef4444',
};

export function Level4Controller({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [routes, setRoutes] = useState<Route[]>(ROUTES);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [dragOverRoute, setDragOverRoute] = useState<string | null>(null);

  const correctCount = routes.filter(r => r.action === r.correctAction).length;

  // Validation function
  const validateSolution = (): ValidationResult => {
    const errors: string[] = [];

    const unmatchedRoutes = routes.filter(r => !r.action);
    if (unmatchedRoutes.length > 0) {
      errors.push(`${unmatchedRoutes.length} route(s) need actions assigned`);
    }

    const incorrectRoutes = routes.filter(r => r.action && r.action !== r.correctAction);
    if (incorrectRoutes.length > 0) {
      errors.push(`${incorrectRoutes.length} route(s) have wrong actions`);
    }

    if (errors.length > 0) {
      return {
        valid: false,
        message: 'Routes need adjustment!',
        details: errors,
      };
    }

    return {
      valid: true,
      message: 'All routes correctly mapped to controller actions!',
    };
  };

  const handleDragStart = (e: React.DragEvent, actionId: string) => {
    e.dataTransfer.setData('actionId', actionId);
    setSelectedAction(actionId);
  };

  const handleDragEnd = () => {
    setSelectedAction(null);
    setDragOverRoute(null);
  };

  const handleDrop = (routeId: string) => {
    if (selectedAction) {
      setRoutes(prev =>
        prev.map(r => (r.id === routeId ? { ...r, action: selectedAction } : r))
      );
    }
    setSelectedAction(null);
    setDragOverRoute(null);
  };

  const clearRoute = (routeId: string) => {
    setRoutes(prev =>
      prev.map(r => (r.id === routeId ? { ...r, action: null } : r))
    );
  };

  const handleComplete = async () => {
    const success = await completeLevel('act1-level4-your-first-controller', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  // Generate routes.rb code
  const generateRoutesCode = () => {
    return `Rails.application.routes.draw do
  resources :posts
  # This creates all RESTful routes:
  # GET    /posts          => posts#index
  # GET    /posts/:id      => posts#show
  # POST   /posts          => posts#create
  # PATCH  /posts/:id      => posts#update
  # DELETE /posts/:id      => posts#destroy
end`;
  };

  // Generate controller code based on assigned actions
  const generateControllerCode = () => {
    const assignedActions = routes
      .filter(r => r.action)
      .map(r => {
        const action = ACTIONS.find(a => a.id === r.action);
        return action ? `  def ${action.name}\n    ${action.code}\n  end` : '';
      })
      .join('\n\n');

    return `class PostsController < ApplicationController
${assignedActions || '  # Assign actions to routes'}
end`;
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="HTTP requests are coming in, but they're getting lost. You need to route each request to the right controller action."
          instructions={[
            'Controllers handle HTTP requests',
            'Each route maps to a controller action',
            'Drag actions to match with routes',
            'RESTful conventions: index, show, create, update, destroy',
          ]}
          goal="Understand that Controllers are the traffic cops of Rails - they receive requests and decide what to do."
        >
          {/* Action Palette */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Controller Actions
            </div>
            <div className="space-y-2">
              {ACTIONS.map(action => {
                const isUsed = routes.some(r => r.action === action.id);
                return (
                  <div
                    key={action.id}
                    draggable={!isUsed}
                    onDragStart={e => handleDragStart(e, action.id)}
                    onDragEnd={handleDragEnd}
                    className={`p-3 rounded-lg border transition-all ${
                      isUsed
                        ? 'bg-gray-800/50 border-gray-700 opacity-50 cursor-not-allowed'
                        : 'bg-blue-900/30 border-blue-600 cursor-grab hover:border-blue-400 active:cursor-grabbing'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-blue-400">{action.name}</span>
                      {isUsed && (
                        <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{action.description}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress */}
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Progress
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Correctly matched</span>
              <span className={correctCount === routes.length ? 'text-green-400' : 'text-white'}>
                {correctCount} / {routes.length}
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${(correctCount / routes.length) * 100}%` }}
              />
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={4}
          levelName="Your First Controller"
          actNumber={1}
          onExit={onExit}
          onReset={() => setRoutes(ROUTES)}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-gray-950 p-8 overflow-auto">
          <div className="max-w-2xl mx-auto">
            {/* Router explanation */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-900/30 border border-amber-600 rounded-lg">
                <span className="text-amber-400 font-mono text-sm">config/routes.rb</span>
                <span className="text-gray-400 text-sm">maps URLs to controller actions</span>
              </div>
            </div>

            {/* Routes Table */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <span className="text-white font-semibold">HTTP Routes</span>
              </div>
              <div className="divide-y divide-gray-800">
                {routes.map(route => {
                  const isCorrect = route.action === route.correctAction;
                  const assignedAction = ACTIONS.find(a => a.id === route.action);

                  return (
                    <div
                      key={route.id}
                      onDragOver={e => {
                        e.preventDefault();
                        setDragOverRoute(route.id);
                      }}
                      onDragLeave={() => setDragOverRoute(null)}
                      onDrop={() => handleDrop(route.id)}
                      className={`p-4 flex items-center gap-4 transition-colors ${
                        dragOverRoute === route.id ? 'bg-blue-900/20' : ''
                      }`}
                    >
                      {/* HTTP Method */}
                      <span
                        className="px-2 py-1 rounded text-xs font-bold w-16 text-center"
                        style={{
                          backgroundColor: `${METHOD_COLORS[route.method]}20`,
                          color: METHOD_COLORS[route.method],
                        }}
                      >
                        {route.method}
                      </span>

                      {/* Path */}
                      <span className="font-mono text-sm text-gray-300 w-32">{route.path}</span>

                      {/* Arrow */}
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>

                      {/* Action slot */}
                      {route.action ? (
                        <div
                          className={`flex-1 flex items-center justify-between p-2 rounded border ${
                            isCorrect
                              ? 'bg-green-900/30 border-green-600'
                              : 'bg-red-900/30 border-red-600'
                          }`}
                        >
                          <span className={`font-mono text-sm ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                            posts#{assignedAction?.name}
                          </span>
                          <button
                            onClick={() => clearRoute(route.id)}
                            className="text-gray-400 hover:text-white transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className={`flex-1 p-3 rounded border-2 border-dashed text-center text-sm ${
                          dragOverRoute === route.id
                            ? 'border-blue-500 text-blue-400'
                            : 'border-gray-600 text-gray-500'
                        }`}>
                          Drop action here
                        </div>
                      )}

                      {/* Status indicator */}
                      {isCorrect && (
                        <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Controller Box */}
            <div className="mt-8 bg-gray-900 rounded-xl border-2 border-blue-500 overflow-hidden">
              <div className="bg-blue-900/40 px-4 py-3 border-b border-blue-500/50 flex items-center gap-3">
                <span className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                  C
                </span>
                <div>
                  <div className="text-white font-semibold">PostsController</div>
                  <div className="text-blue-300 text-xs">app/controllers/posts_controller.rb</div>
                </div>
              </div>
              <div className="p-4 text-sm text-gray-400">
                Receives requests from the router and calls the appropriate action method.
              </div>
            </div>
          </div>
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[
            {
              filename: 'config/routes.rb',
              language: 'ruby',
              code: generateRoutesCode(),
              highlight: [2],
            },
            {
              filename: 'app/controllers/posts_controller.rb',
              language: 'ruby',
              code: generateControllerCode(),
              highlight: routes.filter(r => r.action === r.correctAction).map((_, i) => (i + 1) * 3 + 1),
            },
          ]}
          learningGoal="Controllers are the C in MVC. They receive HTTP requests, interact with models, and prepare data for views."
        >
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">
              RESTful Actions
            </div>
            <div className="text-xs text-gray-400 space-y-1">
              <div><span className="text-green-400">index</span> - List all</div>
              <div><span className="text-green-400">show</span> - Display one</div>
              <div><span className="text-blue-400">create</span> - Make new</div>
              <div><span className="text-amber-400">update</span> - Modify</div>
              <div><span className="text-red-400">destroy</span> - Delete</div>
            </div>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level4Controller;
