/**
 * Level 14: Authorization
 *
 * Implement role-based access control with Pundit policies.
 * Player defines who can do what with resources.
 */

import { useState } from 'react';
import type { LevelComponentProps } from '../index';
import { Button } from '../../../ui/Button';
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

interface PolicyRule {
  id: string;
  action: string;
  description: string;
  allowedRoles: string[];
  selectedRoles: string[];
}

const POLICY_RULES: PolicyRule[] = [
  { id: 'index', action: 'index?', description: 'View list of posts', allowedRoles: ['guest', 'user', 'admin'], selectedRoles: [] },
  { id: 'show', action: 'show?', description: 'View a single post', allowedRoles: ['guest', 'user', 'admin'], selectedRoles: [] },
  { id: 'create', action: 'create?', description: 'Create new posts', allowedRoles: ['user', 'admin'], selectedRoles: [] },
  { id: 'update', action: 'update?', description: 'Edit own posts', allowedRoles: ['user', 'admin'], selectedRoles: [] },
  { id: 'destroy', action: 'destroy?', description: 'Delete posts', allowedRoles: ['admin'], selectedRoles: [] },
];

const ROLES = [
  { id: 'guest', name: 'Guest', color: '#6b7280', icon: '👤' },
  { id: 'user', name: 'User', color: '#3b82f6', icon: '👨‍💻' },
  { id: 'admin', name: 'Admin', color: '#ef4444', icon: '👑' },
];

export function Level14Authorization({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [rules, setRules] = useState<PolicyRule[]>(POLICY_RULES);
  const [testRole, setTestRole] = useState<string>('guest');
  const [testAction, setTestAction] = useState<string>('index');

  const correctRules = rules.filter(r =>
    r.selectedRoles.length === r.allowedRoles.length &&
    r.selectedRoles.every(sr => r.allowedRoles.includes(sr))
  );

  const validateSolution = (): ValidationResult => {
    const errors: string[] = [];

    for (const rule of rules) {
      const missing = rule.allowedRoles.filter(ar => !rule.selectedRoles.includes(ar));
      const extra = rule.selectedRoles.filter(sr => !rule.allowedRoles.includes(sr));

      if (missing.length > 0) {
        errors.push(`${rule.action}: Missing access for ${missing.join(', ')}`);
      }
      if (extra.length > 0) {
        errors.push(`${rule.action}: ${extra.join(', ')} shouldn't have access`);
      }
    }

    if (errors.length > 0) {
      return { valid: false, message: 'Policy needs adjustment!', details: errors.slice(0, 3) };
    }

    return { valid: true, message: 'Authorization policies are secure!' };
  };

  const toggleRoleForRule = (ruleId: string, roleId: string) => {
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId) return r;
      const hasRole = r.selectedRoles.includes(roleId);
      return {
        ...r,
        selectedRoles: hasRole
          ? r.selectedRoles.filter(sr => sr !== roleId)
          : [...r.selectedRoles, roleId]
      };
    }));
  };

  const handleComplete = async () => {
    const success = await completeLevel('act2-level14-authorization', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const generatePolicyCode = () => {
    const methods = rules.map(r => {
      if (r.selectedRoles.length === 0) {
        return `  def ${r.action}\n    false\n  end`;
      }
      if (r.selectedRoles.length === 3) {
        return `  def ${r.action}\n    true\n  end`;
      }
      const conditions = r.selectedRoles.map(sr => {
        if (sr === 'admin') return 'user.admin?';
        if (sr === 'user') return 'user.present?';
        return 'true';
      });
      return `  def ${r.action}\n    ${conditions.join(' || ')}\n  end`;
    });

    return `class PostPolicy < ApplicationPolicy
${methods.join('\n\n')}
end`;
  };

  // Test if current role can perform current action
  const canPerformAction = () => {
    const rule = rules.find(r => r.id === testAction);
    return rule?.selectedRoles.includes(testRole) || false;
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Anyone can delete posts right now! You need to restrict actions based on user roles before someone destroys all your data."
          instructions={[
            'Define who can perform each action',
            'Guests: read-only access',
            'Users: can create and edit own posts',
            'Admins: full access including delete',
          ]}
          goal="Authorization = who can do what. Use Pundit policies to centralize access control."
        >
          {/* Policy Tester */}
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Test Policy
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">As role:</label>
                <select
                  value={testRole}
                  onChange={e => setTestRole(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground text-sm"
                >
                  {ROLES.map(role => (
                    <option key={role.id} value={role.id}>{role.icon} {role.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Try action:</label>
                <select
                  value={testAction}
                  onChange={e => setTestAction(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground text-sm"
                >
                  {rules.map(rule => (
                    <option key={rule.id} value={rule.id}>{rule.action}</option>
                  ))}
                </select>
              </div>
              <div className={`p-3 rounded-lg text-center font-medium ${
                canPerformAction()
                  ? 'bg-success/20 border border-success text-success'
                  : 'bg-destructive/20 border border-destructive text-destructive'
              }`}>
                {canPerformAction() ? '✓ Allowed' : '✗ Denied'}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Correct rules</span>
              <span className={correctRules.length === rules.length ? 'text-success' : 'text-foreground'}>
                {correctRules.length} / {rules.length}
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-success transition-all" style={{ width: `${(correctRules.length / rules.length) * 100}%` }} />
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={14}
          levelName="Authorization"
          actNumber={2}
          onExit={onExit}
          onReset={() => setRules(POLICY_RULES)}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-background p-6 overflow-auto">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex justify-center gap-8 mb-8">
              {ROLES.map(role => (
                <div key={role.id} className="text-center">
                  <div className="text-3xl mb-1">{role.icon}</div>
                  <div className="text-sm font-medium" style={{ color: role.color }}>{role.name}</div>
                </div>
              ))}
            </div>

            {/* Policy Matrix */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-secondary">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Action</th>
                    {ROLES.map(role => (
                      <th key={role.id} className="px-4 py-3 text-center text-sm font-medium" style={{ color: role.color }}>
                        {role.icon} {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rules.map(rule => {
                    const isCorrect = rule.selectedRoles.length === rule.allowedRoles.length &&
                      rule.selectedRoles.every(sr => rule.allowedRoles.includes(sr));

                    return (
                      <tr key={rule.id} className="border-t border-border">
                        <td className="px-4 py-3">
                          <div className="font-mono text-primary text-sm">{rule.action}</div>
                          <div className="text-xs text-muted-foreground">{rule.description}</div>
                        </td>
                        {ROLES.map(role => {
                          const isSelected = rule.selectedRoles.includes(role.id);
                          const shouldBeSelected = rule.allowedRoles.includes(role.id);

                          return (
                            <td key={role.id} className="px-4 py-3 text-center">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => toggleRoleForRule(rule.id, role.id)}
                                className={`w-10 h-10 rounded-lg border-2 transition-all ${
                                  isSelected
                                    ? isSelected === shouldBeSelected
                                      ? 'bg-success/20 border-success text-success'
                                      : 'bg-destructive/20 border-destructive text-destructive'
                                    : 'border-border text-muted-foreground hover:border-muted-foreground'
                                }`}
                              >
                                {isSelected ? '✓' : ''}
                              </Button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Hint */}
            <div className="mt-4 text-center text-xs text-muted-foreground">
              Click cells to toggle access. Green = correct, Red = wrong.
            </div>
          </div>
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[
            {
              filename: 'app/policies/post_policy.rb',
              language: 'ruby',
              code: generatePolicyCode(),
              highlight: [],
            },
            {
              filename: 'app/controllers/posts_controller.rb',
              language: 'ruby',
              code: `class PostsController < ApplicationController
  def destroy
    @post = Post.find(params[:id])
    authorize @post  # Checks PostPolicy#destroy?

    @post.destroy
    redirect_to posts_path
  end
end`,
              highlight: [4],
            },
          ]}
          learningGoal="Pundit policies centralize authorization logic. Each model has a policy class that defines who can do what."
        >
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Pundit Pattern</div>
            <pre className="text-xs text-muted-foreground bg-secondary p-2 rounded overflow-x-auto">
{`# Controller
authorize @post

# Policy
def update?
  record.user == user ||
    user.admin?
end`}
            </pre>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level14Authorization;
