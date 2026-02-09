/**
 * Level 17: Form Objects
 *
 * Handle complex forms that span multiple models.
 * Player builds a registration form that creates User + Company.
 * Teaches: ActiveModel::Model, multi-model forms, form-level validations
 */

import { Building2, FileText, Plus, User } from 'lucide-react';
import { useState } from 'react';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';

interface FormField {
	id: string;
	name: string;
	model: 'user' | 'company' | 'form';
	type: string;
	inForm: boolean;
	validation: string | null;
}

const FORM_FIELDS: FormField[] = [
	{
		id: 'email',
		name: 'email',
		model: 'user',
		type: 'email',
		inForm: false,
		validation:
			'validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }',
	},
	{
		id: 'password',
		name: 'password',
		model: 'user',
		type: 'password',
		inForm: false,
		validation: 'validates :password, length: { minimum: 8 }',
	},
	{
		id: 'company_name',
		name: 'company_name',
		model: 'company',
		type: 'text',
		inForm: false,
		validation: 'validates :company_name, presence: true',
	},
	{
		id: 'company_size',
		name: 'company_size',
		model: 'company',
		type: 'select',
		inForm: false,
		validation:
			'validates :company_size, inclusion: { in: %w[small medium large] }',
	},
	{
		id: 'terms',
		name: 'terms_accepted',
		model: 'form',
		type: 'checkbox',
		inForm: false,
		validation: 'validates :terms_accepted, acceptance: true',
	},
];

const MODEL_ICONS = {
	user: User,
	company: Building2,
	form: FileText,
};

const MODEL_COLORS: Record<string, string> = {
	user: '#3b82f6',
	company: '#22c55e',
	form: '#f59e0b',
};

export function Level17FormObjects({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [fields, setFields] = useState<FormField[]>(FORM_FIELDS);

	const fieldsInForm = fields.filter((f) => f.inForm);

	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		if (fieldsInForm.length < 5) {
			errors.push(
				`Add all ${5 - fieldsInForm.length} remaining fields to the form`,
			);
		}

		if (errors.length > 0) {
			return { valid: false, message: 'Form incomplete!', details: errors };
		}

		return {
			valid: true,
			message: 'Form object handles multiple models cleanly!',
		};
	};

	const toggleField = (fieldId: string) => {
		setFields((prev) =>
			prev.map((f) => (f.id === fieldId ? { ...f, inForm: !f.inForm } : f)),
		);
	};

	const handleComplete = async () => {
		const success = await completeLevel('act3-level17-form-objects', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const generateFormCode = () => {
		const validations = fieldsInForm
			.map((f) => (f.validation ? `  ${f.validation}` : null))
			.filter(Boolean)
			.join('\n');

		return `class RegistrationForm
  include ActiveModel::Model
  include ActiveModel::Attributes

  attribute :email, :string
  attribute :password, :string
  attribute :company_name, :string
  attribute :company_size, :string
  attribute :terms_accepted, :boolean

${validations || '  # Add validations here'}

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

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel>
					<div className="p-4">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Available Fields
						</div>
						<div className="space-y-2">
							{fields
								.filter((f) => !f.inForm)
								.map((field) => {
									const Icon = MODEL_ICONS[field.model];
									return (
										<Button
											className="w-full p-3 h-auto rounded-lg text-left border transition-all hover:opacity-80"
											key={field.id}
											onClick={() => toggleField(field.id)}
											style={{
												borderColor: MODEL_COLORS[field.model],
												backgroundColor: `${MODEL_COLORS[field.model]}10`,
											}}
											variant="outline"
										>
											<div className="flex items-center justify-between w-full">
												<div className="flex items-center gap-2">
													<Icon
														className="w-3 h-3"
														style={{ color: MODEL_COLORS[field.model] }}
													/>
													<span
														className="font-mono text-sm"
														style={{ color: MODEL_COLORS[field.model] }}
													>
														{field.name}
													</span>
												</div>
												<span className="text-xs text-muted-foreground">
													{field.model}
												</span>
											</div>
										</Button>
									);
								})}
							{fields.filter((f) => !f.inForm).length === 0 && (
								<div className="text-success text-sm text-center py-4">
									All fields added!
								</div>
							)}
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Progress
						</div>
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Fields in form</span>
							<span
								className={
									fieldsInForm.length === fields.length
										? 'text-success'
										: 'text-foreground'
								}
							>
								{fieldsInForm.length} / {fields.length}
							</span>
						</div>
						<div className="h-2 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-success transition-all"
								style={{
									width: `${(fieldsInForm.length / fields.length) * 100}%`,
								}}
							/>
						</div>
					</div>

					{/* Model Legend */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Models
						</div>
						<div className="space-y-2">
							{Object.entries(MODEL_ICONS).map(([model, Icon]) => (
								<div className="flex items-center gap-2" key={model}>
									<Icon
										className="w-3 h-3"
										style={{ color: MODEL_COLORS[model] }}
									/>
									<span className="text-xs text-muted-foreground capitalize">
										{model === 'form' ? 'Form only' : `${model} model`}
									</span>
								</div>
							))}
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={3}
					levelName="Form Objects"
					levelNumber={17}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => setFields(FORM_FIELDS)}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-8 overflow-auto">
					<div className="max-w-xl mx-auto">
						{/* Form Preview */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="text-foreground font-semibold">
									Registration Form
								</div>
								<div className="text-xs text-muted-foreground">
									One form, multiple models: User + Company
								</div>
							</div>

							<div className="p-6 space-y-4">
								{fieldsInForm.map((field) => {
									const Icon = MODEL_ICONS[field.model];
									return (
										<div className="group relative" key={field.id}>
											<label
												className="flex items-center gap-1.5 text-sm mb-1"
												style={{ color: MODEL_COLORS[field.model] }}
											>
												<Icon className="w-3 h-3" />
												{field.name.replace('_', ' ')}
												<span className="text-xs opacity-60">
													({field.model})
												</span>
											</label>
											{field.type === 'select' ? (
												<select className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground">
													<option>Small (1-10)</option>
													<option>Medium (11-50)</option>
													<option>Large (50+)</option>
												</select>
											) : field.type === 'checkbox' ? (
												<label className="flex items-center gap-2">
													<input className="w-4 h-4" type="checkbox" />
													<span className="text-sm text-muted-foreground">
														I accept the terms
													</span>
												</label>
											) : (
												<input
													className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground"
													placeholder={field.name}
													type={field.type}
												/>
											)}
											<button
												className="absolute top-0 right-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity text-xs"
												onClick={() => toggleField(field.id)}
												type="button"
											>
												Remove
											</button>
										</div>
									);
								})}

								{fieldsInForm.length === 0 && (
									<div className="text-center py-8 text-muted-foreground">
										<Plus className="w-8 h-8 mx-auto mb-2 opacity-50" />
										Click fields on the left to add them
									</div>
								)}

								{fieldsInForm.length > 0 && (
									<Button className="w-full mt-4">Create Account</Button>
								)}
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/forms/registration_form.rb',
							language: 'ruby',
							code: generateFormCode(),
							highlight:
								fieldsInForm.length === fields.length
									? [17, 18, 19, 20, 21, 23, 24, 25, 26]
									: [],
						},
					]}
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Why Form Objects?
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>+ One form, multiple models</li>
							<li>+ Centralized cross-model validation</li>
							<li>+ Atomic transaction (all or nothing)</li>
							<li>+ Easy to test in isolation</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level17FormObjects;
