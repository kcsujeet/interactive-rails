/**
 * Tests for Level 10: Form Objects
 *
 * Validates form object is added and all fields pass validation.
 */

import { describe, test, expect } from 'bun:test';

interface FormField {
  id: string;
  model: 'user' | 'company';
  name: string;
  value: string;
  valid: boolean;
}

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: string[];
}

interface Level10State {
  formObjectAdded: boolean;
  submitted: boolean;
  fields: FormField[];
}

// Recreate validation logic from component
function validateLevel10Solution(state: Level10State): ValidationResult {
  const errors: string[] = [];

  if (!state.formObjectAdded) {
    errors.push('Add a Form Object to consolidate validations');
  }

  if (!state.submitted) {
    errors.push('Submit the form to test validation');
  }

  const invalidFields = state.fields.filter(f => !f.valid);
  if (invalidFields.length > 0) {
    errors.push(`Fix validation errors for: ${invalidFields.map(f => f.name).join(', ')}`);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: 'Form validation incomplete!',
      details: errors,
    };
  }

  return {
    valid: true,
    message: 'Form Object consolidates multi-model validation!',
  };
}

const INITIAL_FIELDS: FormField[] = [
  { id: 'name', model: 'user', name: 'Name', value: '', valid: false },
  { id: 'email', model: 'user', name: 'Email', value: '', valid: false },
  { id: 'company_name', model: 'company', name: 'Company Name', value: '', valid: false },
  { id: 'company_domain', model: 'company', name: 'Domain', value: '', valid: false },
];

describe('Level 10: Form Objects', () => {
  describe('Initial State', () => {
    test('should be invalid when nothing done', () => {
      const result = validateLevel10Solution({
        formObjectAdded: false,
        submitted: false,
        fields: INITIAL_FIELDS,
      });

      expect(result.valid).toBe(false);
    });

    test('should require adding form object', () => {
      const result = validateLevel10Solution({
        formObjectAdded: false,
        submitted: false,
        fields: INITIAL_FIELDS,
      });

      expect(result.details!.some(d => d.includes('Form Object'))).toBe(true);
    });

    test('should require submitting form', () => {
      const result = validateLevel10Solution({
        formObjectAdded: true,
        submitted: false,
        fields: INITIAL_FIELDS,
      });

      expect(result.details!.some(d => d.includes('Submit'))).toBe(true);
    });
  });

  describe('Partial Progress', () => {
    test('should be invalid with invalid fields', () => {
      const result = validateLevel10Solution({
        formObjectAdded: true,
        submitted: true,
        fields: INITIAL_FIELDS,
      });

      expect(result.valid).toBe(false);
    });

    test('should list invalid fields', () => {
      const result = validateLevel10Solution({
        formObjectAdded: true,
        submitted: true,
        fields: INITIAL_FIELDS,
      });

      expect(result.details!.some(d => d.includes('Name'))).toBe(true);
      expect(result.details!.some(d => d.includes('Email'))).toBe(true);
    });

    test('should be invalid with some fields valid', () => {
      const partialFields = INITIAL_FIELDS.map(f =>
        f.id === 'name' ? { ...f, value: 'John', valid: true } : f
      );

      const result = validateLevel10Solution({
        formObjectAdded: true,
        submitted: true,
        fields: partialFields,
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('Correct Solution', () => {
    const validFields: FormField[] = [
      { id: 'name', model: 'user', name: 'Name', value: 'John Doe', valid: true },
      { id: 'email', model: 'user', name: 'Email', value: 'john@example.com', valid: true },
      { id: 'company_name', model: 'company', name: 'Company Name', value: 'Acme Inc', valid: true },
      { id: 'company_domain', model: 'company', name: 'Domain', value: 'acme.com', valid: true },
    ];

    test('should be valid with all fields valid', () => {
      const result = validateLevel10Solution({
        formObjectAdded: true,
        submitted: true,
        fields: validFields,
      });

      expect(result.valid).toBe(true);
    });

    test('should have correct success message', () => {
      const result = validateLevel10Solution({
        formObjectAdded: true,
        submitted: true,
        fields: validFields,
      });

      expect(result.message).toContain('consolidates');
    });
  });

  describe('Field Validation Rules', () => {
    test('email should require @ symbol', () => {
      const isValidEmail = (email: string) => email.includes('@');

      expect(isValidEmail('john@example.com')).toBe(true);
      expect(isValidEmail('invalid')).toBe(false);
    });

    test('domain should require dot', () => {
      const isValidDomain = (domain: string) => domain.includes('.');

      expect(isValidDomain('example.com')).toBe(true);
      expect(isValidDomain('invalid')).toBe(false);
    });

    test('name should be non-empty', () => {
      const isValidName = (name: string) => name.trim().length > 0;

      expect(isValidName('John')).toBe(true);
      expect(isValidName('')).toBe(false);
      expect(isValidName('   ')).toBe(false);
    });
  });

  describe('Multi-Model Aggregation', () => {
    test('form aggregates user and company models', () => {
      const userFields = INITIAL_FIELDS.filter(f => f.model === 'user');
      const companyFields = INITIAL_FIELDS.filter(f => f.model === 'company');

      expect(userFields.length).toBe(2);
      expect(companyFields.length).toBe(2);
    });
  });
});
