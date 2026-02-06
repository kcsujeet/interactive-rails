/**
 * Level 10: Form Objects
 *
 * Aggregate multiple models into a single form object.
 * Shows consolidated validation and error handling.
 */

import { useState } from 'react';
import { Button } from '../../../ui/Button';
import type { LevelComponentProps } from '../index';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
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
		{
			id: 'name',
			model: 'user',
			name: 'Name',
			value: '',
			error: null,
			valid: false,
		},
		{
			id: 'email',
			model: 'user',
			name: 'Email',
			value: '',
			error: null,
			valid: false,
		},
		{
			id: 'company_name',
			model: 'company',
			name: 'Company Name',
			value: '',
			error: null,
			valid: false,
		},
		{
			id: 'company_domain',
			model: 'company',
			name: 'Domain',
			value: '',
			error: null,
			valid: false,
		},
	]);

	const isComplete =
		formObjectAdded && submitted && fields.every((f) => f.valid);

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
		setFields((prev) =>
			prev.map((f) =>
				f.id === id ? { ...f, value, error: null, valid: false } : f,
			),
		);
		setSubmitted(false);
	};

	const handleSubmit = () => {
		setSubmitted(true);
		setFields((prev) => prev.map(validateField));
	};

	const handleComplete = async () => {
		const success = await completeLevel('act2-level10-form-objects', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const userFields = fields.filter((f) => f.model === 'user');
	const companyFields = fields.filter((f) => f.model === 'company');

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn to use Form Objects for multi-model forms with unified validation."
					instructions={[
						'Try submitting the form - notice errors come from two places',
						'Add a Form Object to consolidate validations',
						'Fill in valid data and submit successfully',
					]}
					scenario="The signup form creates both a User and a Company. Validations are scattered across two models, and error messages are confusing."
				>
					<div className="p-4 border-t border-border">
						<Button
							className="w-full"
							disabled={formObjectAdded}
							onClick={() => setFormObjectAdded(true)}
							variant={formObjectAdded ? 'secondary' : 'default'}
						>
							{formObjectAdded ? 'Form Object Added' : 'Add Form Object'}
						</Button>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={2}
					levelName="Form Objects"
					levelNumber={10}
					onExit={onExit}
					onReset={() => {
						setFormObjectAdded(false);
						setSubmitted(false);
						setFields([
							{
								id: 'name',
								model: 'user',
								name: 'Name',
								value: '',
								error: null,
								valid: false,
							},
							{
								id: 'email',
								model: 'user',
								name: 'Email',
								value: '',
								error: null,
								valid: false,
							},
							{
								id: 'company_name',
								model: 'company',
								name: 'Company Name',
								value: '',
								error: null,
								valid: false,
							},
							{
								id: 'company_domain',
								model: 'company',
								name: 'Domain',
								value: '',
								error: null,
								valid: false,
							},
						]);
					}}
				/>

				<div className="flex-1 relative bg-background flex items-center justify-center p-8">
					{/* Form visualization */}
					<div className="w-full max-w-lg">
						{formObjectAdded ? (
							/* Unified form with Form Object */
							<div className="bg-card border-2 border-primary rounded-xl p-6">
								<div className="text-primary font-mono text-sm mb-4">
									SignupForm
								</div>
								<div className="space-y-4">
									{fields.map((field) => (
										<div key={field.id}>
											<label className="block text-muted-foreground text-sm mb-1">
												{field.name}
											</label>
											<input
												className={`w-full bg-secondary border rounded-lg px-3 py-2 text-foreground ${
													submitted && field.error
														? 'border-destructive'
														: 'border-border'
												}`}
												onChange={(e) =>
													handleFieldChange(field.id, e.target.value)
												}
												placeholder={`Enter ${field.name.toLowerCase()}`}
												type="text"
												value={field.value}
											/>
											{submitted && field.error && (
												<div className="text-destructive text-xs mt-1">
													{field.error}
												</div>
											)}
											{submitted && field.valid && (
												<div className="text-success text-xs mt-1">Valid</div>
											)}
										</div>
									))}
								</div>

								<Button className="w-full mt-6" onClick={handleSubmit}>
									Submit
								</Button>

								{submitted && fields.every((f) => f.valid) && (
									<div className="mt-4 p-3 bg-success/20 border border-success rounded-lg text-success text-sm text-center">
										Form submitted successfully! User and Company created.
									</div>
								)}
							</div>
						) : (
							/* Scattered form without Form Object */
							<div className="space-y-6">
								{/* User Model Form */}
								<div className="bg-card border-2 border-border rounded-xl p-4">
									<div className="text-muted-foreground font-mono text-sm mb-3">
										User Model
									</div>
									<div className="space-y-3">
										{userFields.map((field) => (
											<div key={field.id}>
												<label className="block text-muted-foreground text-sm mb-1">
													{field.name}
												</label>
												<input
													className={`w-full bg-secondary border rounded-lg px-3 py-2 text-foreground ${
														submitted && field.error
															? 'border-destructive'
															: 'border-border'
													}`}
													onChange={(e) =>
														handleFieldChange(field.id, e.target.value)
													}
													type="text"
													value={field.value}
												/>
												{submitted && field.error && (
													<div className="text-destructive text-xs mt-1">
														User: {field.error}
													</div>
												)}
											</div>
										))}
									</div>
								</div>

								{/* Company Model Form */}
								<div className="bg-card border-2 border-border rounded-xl p-4">
									<div className="text-muted-foreground font-mono text-sm mb-3">
										Company Model
									</div>
									<div className="space-y-3">
										{companyFields.map((field) => (
											<div key={field.id}>
												<label className="block text-muted-foreground text-sm mb-1">
													{field.name}
												</label>
												<input
													className={`w-full bg-secondary border rounded-lg px-3 py-2 text-foreground ${
														submitted && field.error
															? 'border-destructive'
															: 'border-border'
													}`}
													onChange={(e) =>
														handleFieldChange(field.id, e.target.value)
													}
													type="text"
													value={field.value}
												/>
												{submitted && field.error && (
													<div className="text-destructive text-xs mt-1">
														Company: {field.error}
													</div>
												)}
											</div>
										))}
									</div>
								</div>

								<Button
									className="w-full"
									onClick={handleSubmit}
									variant="secondary"
								>
									Submit (Scattered)
								</Button>

								{submitted && fields.some((f) => f.error) && (
									<div className="p-3 bg-destructive/20 border border-destructive rounded-lg text-destructive text-sm">
										Errors from multiple sources - confusing UX!
									</div>
								)}
							</div>
						)}
					</div>

					{/* Completion button */}
					{isComplete && (
						<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
							<Button
								className="px-8 py-3 bg-linear-to-r from-success to-success/80 text-foreground font-bold shadow-lg"
								onClick={handleComplete}
							>
								Complete Level
							</Button>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
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
						},
					]}
					learningGoal="Form Objects consolidate validations for multi-model forms, providing a single source of truth for form logic."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level10Forms;
