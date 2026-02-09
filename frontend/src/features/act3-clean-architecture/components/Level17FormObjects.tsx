/**
 * Level 17: Validation Contracts
 *
 * Handle complex multi-model operations with Dry::Validation.
 * Player builds a registration contract that validates User + Company inputs.
 * Teaches: Dry::Validation contracts, schema + rules, service objects
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
			"required(:email).filled(:string, format?: URI::MailTo::EMAIL_REGEXP)",
	},
	{
		id: 'password',
		name: 'password',
		model: 'user',
		type: 'password',
		inForm: false,
		validation: "required(:password).filled(:string, min_size?: 8)",
	},
	{
		id: 'company_name',
		name: 'company_name',
		model: 'company',
		type: 'text',
		inForm: false,
		validation: "required(:company_name).filled(:string)",
	},
	{
		id: 'company_size',
		name: 'company_size',
		model: 'company',
		type: 'select',
		inForm: false,
		validation:
			"required(:company_size).filled(:string, included_in?: %w[small medium large])",
	},
	{
		id: 'terms',
		name: 'terms_accepted',
		model: 'form',
		type: 'checkbox',
		inForm: false,
		validation: "required(:terms_accepted).filled(:bool, eql?: true)",
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
			message: 'Validation contract composes schemas cleanly!',
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
		const userFields = fieldsInForm.filter((f) => f.model === 'user');
		const companyFields = fieldsInForm.filter((f) => f.model === 'company');
		const formFields = fieldsInForm.filter((f) => f.model === 'form');

		const sections: string[] = [];

		if (userFields.length > 0) {
			const validations = userFields
				.map((f) => (f.validation ? `  ${f.validation}` : null))
				.filter(Boolean)
				.join('\n');
			sections.push(`# app/schemas/user_schema.rb
UserSchema = Dry::Schema.Params do
${validations}
end`);
		}

		if (companyFields.length > 0) {
			const validations = companyFields
				.map((f) => (f.validation ? `  ${f.validation}` : null))
				.filter(Boolean)
				.join('\n');
			sections.push(`# app/schemas/company_schema.rb
CompanySchema = Dry::Schema.Params do
${validations}
end`);
		}

		if (formFields.length > 0) {
			const validations = formFields
				.map((f) => (f.validation ? `  ${f.validation}` : null))
				.filter(Boolean)
				.join('\n');
			sections.push(`# app/schemas/registration_schema.rb
RegistrationSchema = Dry::Schema.Params do
${validations}
end`);
		}

		const schemaNames = [
			userFields.length > 0 ? 'UserSchema' : null,
			companyFields.length > 0 ? 'CompanySchema' : null,
			formFields.length > 0 ? 'RegistrationSchema' : null,
		].filter(Boolean);

		const paramsLine =
			schemaNames.length > 0
				? `  params(${schemaNames.join(' & ')})`
				: '  # Add fields to compose schemas';

		sections.push(`# app/contracts/registration_contract.rb
class RegistrationContract < Dry::Validation::Contract
${paramsLine}

  rule(:terms_accepted) do
    key.failure("must be accepted") unless values[:terms_accepted]
  end
end`);

		sections.push(`# app/services/registration_service.rb
class RegistrationService
  def call(params)
    result = RegistrationContract.new.call(params)
    return result if result.failure?

    attrs = result.to_h

    ActiveRecord::Base.transaction do
      company = Company.create!(
        name: attrs[:company_name],
        size: attrs[:company_size]
      )

      User.create!(
        email: attrs[:email],
        password: attrs[:password],
        company: company
      )
    end
  end
end`);

		return sections.join('\n\n');
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
					levelName="Validation Contracts"
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
							filename: 'app/schemas/ & app/contracts/',
							language: 'ruby',
							code: generateFormCode(),
						},
					]}
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Why Dry::Validation?
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>+ Schema checks types &amp; shape first</li>
							<li>+ Rules handle cross-field logic</li>
							<li>+ Schemas are reusable across contracts</li>
							<li>+ Works anywhere (not Rails-coupled)</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level17FormObjects;
