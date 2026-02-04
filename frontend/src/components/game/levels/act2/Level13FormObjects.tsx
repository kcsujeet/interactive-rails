/**
 * Level 13: Form Objects
 *
 * Handle complex forms that span multiple models.
 * Player builds a registration form that creates User + Company.
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

interface FormField {
  id: string;
  name: string;
  model: 'user' | 'company' | 'form';
  type: string;
  inForm: boolean;
  validation: string | null;
}

const FORM_FIELDS: FormField[] = [
  { id: 'email', name: 'email', model: 'user', type: 'email', inForm: false, validation: 'validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }' },
  { id: 'password', name: 'password', model: 'user', type: 'password', inForm: false, validation: 'validates :password, length: { minimum: 8 }' },
  { id: 'company_name', name: 'company_name', model: 'company', type: 'text', inForm: false, validation: 'validates :company_name, presence: true' },
  { id: 'company_size', name: 'company_size', model: 'company', type: 'select', inForm: false, validation: 'validates :company_size, inclusion: { in: %w[small medium large] }' },
  { id: 'terms', name: 'terms_accepted', model: 'form', type: 'checkbox', inForm: false, validation: 'validates :terms_accepted, acceptance: true' },
];

export function Level13FormObjects({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [fields, setFields] = useState<FormField[]>(FORM_FIELDS);
  const [showValidations, setShowValidations] = useState(false);

  const fieldsInForm = fields.filter(f => f.inForm);

  const validateSolution = (): ValidationResult => {
    const errors: string[] = [];

    if (fieldsInForm.length < 5) {
      errors.push(`Add all ${5 - fieldsInForm.length} remaining fields to the form`);
    }

    if (errors.length > 0) {
      return { valid: false, message: 'Form incomplete!', details: errors };
    }

    return { valid: true, message: 'Form object handles multiple models cleanly!' };
  };

  const toggleField = (fieldId: string) => {
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, inForm: !f.inForm } : f));
  };

  const handleComplete = async () => {
    const success = await completeLevel('act2-level13-form-objects', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const generateFormCode = () => {
    const attrs = fieldsInForm.map(f => `:${f.name}`).join(', ');
    const validations = fieldsInForm.map(f => f.validation ? `  ${f.validation}` : null).filter(Boolean).join('\n');
    const userFields = fieldsInForm.filter(f => f.model === 'user');
    const companyFields = fieldsInForm.filter(f => f.model === 'company');

    return `class RegistrationForm
  include ActiveModel::Model
  include ActiveModel::Attributes

  attribute :email, :string
  attribute :password, :string
  attribute :company_name, :string
  attribute :company_size, :string
  attribute :terms_accepted, :boolean

${validations}

  def save
    return false unless valid?

    ActiveRecord::Base.transaction do
      company = Company.create!(
        name: company_name,
        size: company_size
      )

      User.create!(
        email: email,
        password: password,
        company: company
      )
    end

    true
  rescue ActiveRecord::RecordInvalid
    false
  end
end`;
  };

  const getModelColor = (model: string) => {
    switch (model) {
      case 'user': return '#3b82f6';
      case 'company': return '#22c55e';
      case 'form': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="Your registration page needs to create a User AND a Company in one form. If you put all validations in the controller, it becomes a mess."
          instructions={[
            'Form objects aggregate multiple models',
            'They include ActiveModel for validations',
            'One form, multiple model creates',
            'Add all fields to complete the form',
          ]}
          goal="Form objects handle complex forms that don't map to a single model."
        >
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Available Fields
            </div>
            <div className="space-y-2">
              {fields.filter(f => !f.inForm).map(field => (
                <Button
                  key={field.id}
                  variant="outline"
                  onClick={() => toggleField(field.id)}
                  className="w-full p-3 h-auto rounded-lg text-left border transition-all hover:opacity-80"
                  style={{ borderColor: getModelColor(field.model), backgroundColor: `${getModelColor(field.model)}10` }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono text-sm" style={{ color: getModelColor(field.model) }}>{field.name}</span>
                    <span className="text-xs text-muted-foreground">{field.model}</span>
                  </div>
                </Button>
              ))}
              {fields.filter(f => !f.inForm).length === 0 && (
                <div className="text-success text-sm text-center py-4">All fields added!</div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Fields in form</span>
              <span className={fieldsInForm.length === fields.length ? 'text-success' : 'text-foreground'}>
                {fieldsInForm.length} / {fields.length}
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-success transition-all" style={{ width: `${(fieldsInForm.length / fields.length) * 100}%` }} />
            </div>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={13}
          levelName="Form Objects"
          actNumber={2}
          onExit={onExit}
          onReset={() => setFields(FORM_FIELDS)}
          onValidate={validateSolution}
          onComplete={handleComplete}
        />

        <div className="flex-1 relative bg-background p-8 overflow-auto">
          <div className="max-w-xl mx-auto">
            {/* Form Preview */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="bg-secondary px-4 py-3 border-b border-border">
                <div className="text-foreground font-semibold">Registration Form</div>
                <div className="text-xs text-muted-foreground">Creates User + Company</div>
              </div>

              <div className="p-6 space-y-4">
                {fieldsInForm.map(field => (
                  <div key={field.id} className="group relative">
                    <label className="block text-sm text-muted-foreground mb-1" style={{ color: getModelColor(field.model) }}>
                      {field.name.replace('_', ' ')}
                      <span className="text-xs ml-2 opacity-60">({field.model})</span>
                    </label>
                    {field.type === 'select' ? (
                      <select className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground">
                        <option>Small (1-10)</option>
                        <option>Medium (11-50)</option>
                        <option>Large (50+)</option>
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="w-4 h-4" />
                        <span className="text-sm text-muted-foreground">I accept the terms</span>
                      </label>
                    ) : (
                      <input
                        type={field.type}
                        placeholder={field.name}
                        className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground"
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleField(field.id)}
                      className="absolute top-0 right-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity text-sm p-0 h-auto"
                    >
                      Remove
                    </Button>
                  </div>
                ))}

                {fieldsInForm.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Click fields on the left to add them
                  </div>
                )}

                {fieldsInForm.length > 0 && (
                  <Button className="w-full mt-4">
                    Create Account
                  </Button>
                )}
              </div>
            </div>

            {/* Model Legend */}
            <div className="mt-6 flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }} />
                <span className="text-xs text-muted-foreground">User model</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }} />
                <span className="text-xs text-muted-foreground">Company model</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }} />
                <span className="text-xs text-muted-foreground">Form only</span>
              </div>
            </div>
          </div>
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[{
            filename: 'app/forms/registration_form.rb',
            language: 'ruby',
            code: generateFormCode(),
            highlight: fieldsInForm.length === fields.length ? [15, 16, 17, 18, 19, 20, 21, 22, 23, 24] : [],
          }]}
          learningGoal="Form objects aggregate data from multiple models, handle cross-model validations, and keep controllers thin."
        >
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Benefits</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>+ One form, multiple models</li>
              <li>+ Centralized validation logic</li>
              <li>+ Reusable across controllers</li>
              <li>+ Easy to test in isolation</li>
            </ul>
          </div>
        </CodePreviewPanel>
      </RightPanel>
    </LevelLayout>
  );
}

export default Level13FormObjects;
