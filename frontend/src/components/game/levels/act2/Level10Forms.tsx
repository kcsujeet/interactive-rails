/**
 * Level 10: Form Objects
 *
 * Aggregate multiple models into a single form object.
 * Shows consolidated validation and error handling.
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
} from '../shared';

interface FormField {
  id: string;
  model: 'user' | 'company';
  name: string;
  value: string;
  error: string | null;
  valid: boolean;
}

export function Level10Forms({ onComplete, onExit }: LevelComponentProps) {
  const { completeLevel } = useLevelCompletion();
  const [formObjectAdded, setFormObjectAdded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fields, setFields] = useState<FormField[]>([
    { id: 'name', model: 'user', name: 'Name', value: '', error: null, valid: false },
    { id: 'email', model: 'user', name: 'Email', value: '', error: null, valid: false },
    { id: 'company_name', model: 'company', name: 'Company Name', value: '', error: null, valid: false },
    { id: 'company_domain', model: 'company', name: 'Domain', value: '', error: null, valid: false },
  ]);

  const isComplete = formObjectAdded && submitted && fields.every(f => f.valid);

  const validateField = (field: FormField): FormField => {
    let error: string | null = null;
    let valid = false;

    if (!field.value.trim()) {
      error = `${field.name} is required`;
    } else if (field.id === 'email' && !field.value.includes('@')) {
      error = 'Invalid email format';
    } else if (field.id === 'company_domain' && !field.value.includes('.')) {
      error = 'Invalid domain format';
    } else {
      valid = true;
    }

    return { ...field, error, valid };
  };

  const handleFieldChange = (id: string, value: string) => {
    setFields(prev => prev.map(f =>
      f.id === id ? { ...f, value, error: null, valid: false } : f
    ));
    setSubmitted(false);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setFields(prev => prev.map(validateField));
  };

  const handleComplete = async () => {
    const success = await completeLevel('act2-level10-form-objects', { stars: 3 });
    if (success) {
      onComplete({ stars: 3 });
    }
  };

  const userFields = fields.filter(f => f.model === 'user');
  const companyFields = fields.filter(f => f.model === 'company');

  return (
    <LevelLayout>
      <LeftPanel>
        <InstructionPanel
          scenario="The signup form creates both a User and a Company. Validations are scattered across two models, and error messages are confusing."
          instructions={[
            'Try submitting the form - notice errors come from two places',
            'Add a Form Object to consolidate validations',
            'Fill in valid data and submit successfully',
          ]}
          goal="Learn to use Form Objects for multi-model forms with unified validation."
        >
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={() => setFormObjectAdded(true)}
              disabled={formObjectAdded}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                formObjectAdded
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {formObjectAdded ? 'Form Object Added' : 'Add Form Object'}
            </button>
          </div>
        </InstructionPanel>
      </LeftPanel>

      <CenterPanel>
        <LevelHeader
          levelNumber={10}
          levelName="Form Objects"
          actNumber={2}
          onExit={onExit}
          onReset={() => {
            setFormObjectAdded(false);
            setSubmitted(false);
            setFields([
              { id: 'name', model: 'user', name: 'Name', value: '', error: null, valid: false },
              { id: 'email', model: 'user', name: 'Email', value: '', error: null, valid: false },
              { id: 'company_name', model: 'company', name: 'Company Name', value: '', error: null, valid: false },
              { id: 'company_domain', model: 'company', name: 'Domain', value: '', error: null, valid: false },
            ]);
          }}
        />

        <div className="flex-1 relative bg-gray-950 flex items-center justify-center p-8">
          {/* Form visualization */}
          <div className="w-full max-w-lg">
            {formObjectAdded ? (
              /* Unified form with Form Object */
              <div className="bg-gray-900 border-2 border-cyan-500 rounded-xl p-6">
                <div className="text-cyan-400 font-mono text-sm mb-4">SignupForm</div>
                <div className="space-y-4">
                  {fields.map(field => (
                    <div key={field.id}>
                      <label className="block text-gray-400 text-sm mb-1">{field.name}</label>
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white ${
                          submitted && field.error ? 'border-red-500' : 'border-gray-700'
                        }`}
                        placeholder={`Enter ${field.name.toLowerCase()}`}
                      />
                      {submitted && field.error && (
                        <div className="text-red-400 text-xs mt-1">{field.error}</div>
                      )}
                      {submitted && field.valid && (
                        <div className="text-green-400 text-xs mt-1">Valid</div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSubmit}
                  className="w-full mt-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
                >
                  Submit
                </button>

                {submitted && fields.every(f => f.valid) && (
                  <div className="mt-4 p-3 bg-green-900/30 border border-green-500 rounded-lg text-green-400 text-sm text-center">
                    Form submitted successfully! User and Company created.
                  </div>
                )}
              </div>
            ) : (
              /* Scattered form without Form Object */
              <div className="space-y-6">
                {/* User Model Form */}
                <div className="bg-gray-900 border-2 border-gray-600 rounded-xl p-4">
                  <div className="text-gray-500 font-mono text-sm mb-3">User Model</div>
                  <div className="space-y-3">
                    {userFields.map(field => (
                      <div key={field.id}>
                        <label className="block text-gray-400 text-sm mb-1">{field.name}</label>
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white ${
                            submitted && field.error ? 'border-red-500' : 'border-gray-700'
                          }`}
                        />
                        {submitted && field.error && (
                          <div className="text-red-400 text-xs mt-1">User: {field.error}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Company Model Form */}
                <div className="bg-gray-900 border-2 border-gray-600 rounded-xl p-4">
                  <div className="text-gray-500 font-mono text-sm mb-3">Company Model</div>
                  <div className="space-y-3">
                    {companyFields.map(field => (
                      <div key={field.id}>
                        <label className="block text-gray-400 text-sm mb-1">{field.name}</label>
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white ${
                            submitted && field.error ? 'border-red-500' : 'border-gray-700'
                          }`}
                        />
                        {submitted && field.error && (
                          <div className="text-red-400 text-xs mt-1">Company: {field.error}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  Submit (Scattered)
                </button>

                {submitted && fields.some(f => f.error) && (
                  <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-sm">
                    Errors from multiple sources - confusing UX!
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Completion button */}
          {isComplete && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
              <button
                onClick={handleComplete}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold rounded-lg shadow-lg"
              >
                Complete Level
              </button>
            </div>
          )}
        </div>
      </CenterPanel>

      <RightPanel>
        <CodePreviewPanel
          files={[{
            filename: 'app/forms/signup_form.rb',
            language: 'ruby',
            code: `class SignupForm
  include ActiveModel::Model
  include ActiveModel::Attributes

  attribute :name, :string
  attribute :email, :string
  attribute :company_name, :string
  attribute :company_domain, :string

  validates :name, :email, presence: true
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :company_name, :company_domain, presence: true
  validates :company_domain, format: { with: /\\A[\\w.-]+\\.[a-z]+\\z/i }

  def save
    return false unless valid?

    ActiveRecord::Base.transaction do
      company = Company.create!(name: company_name, domain: company_domain)
      User.create!(name: name, email: email, company: company)
    end
  end
end`,
            highlight: [10, 11, 12, 13, 15, 16, 17, 18, 19, 20],
          }]}
          learningGoal="Form Objects consolidate validations for multi-model forms, providing a single source of truth for form logic."
        />
      </RightPanel>
    </LevelLayout>
  );
}

export default Level10Forms;
