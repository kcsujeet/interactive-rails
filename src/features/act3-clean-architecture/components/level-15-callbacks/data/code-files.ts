import { registerLevelCode } from '@/lib/codebase-registry';
import type { Phase } from '../types';
import { STEP_DEFS } from './build-steps';

// User model is already in its post-L9/L10/L13 shape: auth (has_secure_password,
// sessions), products association (added at L11 setup), normalizes :email_address,
// encrypts (L10), and validations. L15 does not change User -- it is shown as
// reference context in build/reward (NOT in observe; see code-files observe
// branch for why).
const USER_MODEL_REFERENCE = `class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy
  has_many :products, dependent: :destroy

  normalizes :email_address, with: ->(e) { e.strip.downcase }

  encrypts :email_address, deterministic: true, downcase: true
  encrypts :phone, deterministic: true
  encrypts :address

  validates :email_address,
    presence: true,
    uniqueness: { case_sensitive: false },
    format: { with: URI::MailTo::EMAIL_REGEXP }
end`;

const PRODUCT_MODEL_BROKEN = `class Product < ApplicationRecord
  belongs_to :user
  has_many :reviews, dependent: :destroy

  validates :name, presence: true, length: { minimum: 3, maximum: 255 }
  validates :description, presence: true, length: { minimum: 10 }
  validates :price, presence: true, numericality: { greater_than: 0 }

  # Name saves with whatever whitespace the seller typed.
end`;

const PRODUCT_MODEL_NORMALIZED = `class Product < ApplicationRecord
  belongs_to :user
  has_many :reviews, dependent: :destroy

  normalizes :name, with: ->(n) { n.strip }

  validates :name, presence: true, length: { minimum: 3, maximum: 255 }
  validates :description, presence: true, length: { minimum: 10 }
  validates :price, presence: true, numericality: { greater_than: 0 }
end`;

const USERS_CONTROLLER_WITH_MAILER = `class UsersController < ApplicationController
  allow_unauthenticated_access only: :create

  def create
    @user = User.new(user_params)
    if @user.save
      send_welcome_email(@user)
      render json: @user, status: :created
    else
      render json: { errors: @user.errors }, status: :unprocessable_entity
    end
  end

  private

  def user_params
    params.expect(user: [ :email_address, :password ])
  end

  def send_welcome_email(user)
    Rails.logger.info "TODO welcome email to #{user.email_address}"
  end
end`;

interface CodeFile {
	filename: string;
	language: string;
	code: string;
	highlight?: number[];
}

export function getCodeFiles(phase: Phase, furthestStep: number): CodeFile[] {
	// Observe phase: show ONLY the broken Product model. User.rb in real
	// myapp contains `normalizes :email_address` from L9's Rails 8 auth
	// generator, and step 0's correct answer is the same pattern with
	// `:name` instead of `:email_address`. Showing User in observe pre-leaks
	// the answer; reintroduce User in build/reward where the OptionCard is
	// the answer surface.
	if (phase === 'observe') {
		return [
			{
				filename: 'app/models/product.rb',
				language: 'ruby',
				code: PRODUCT_MODEL_BROKEN,
				highlight: [9, 10],
			},
		];
	}

	// Build / reward phases: artifacts accumulate as steps complete.
	// `furthestStep` is the index of the last completed step (caller passes
	// `isCurrentStepCompleted ? currentStep : currentStep - 1`). So step k's
	// artifact appears when furthestStep >= k.
	const files: CodeFile[] = [];

	// Step 0 (Normalize): Product gains `normalizes :name`.
	const productCode =
		furthestStep >= 0 ? PRODUCT_MODEL_NORMALIZED : PRODUCT_MODEL_BROKEN;
	const productHighlight = furthestStep >= 0 ? [4] : [9, 10];
	files.push({
		filename: 'app/models/product.rb',
		language: 'ruby',
		code: productCode,
		highlight: productHighlight,
	});

	// Always show the User model as reference context.
	files.push({
		filename: 'app/models/user.rb',
		language: 'ruby',
		code: USER_MODEL_REFERENCE,
		highlight: [6],
	});

	// Step 1 (Send Welcome Email): UsersController#create gains the explicit
	// send_welcome_email(@user) call after save.
	if (furthestStep >= 1) {
		files.push({
			filename: 'app/controllers/users_controller.rb',
			language: 'ruby',
			code: USERS_CONTROLLER_WITH_MAILER,
			highlight: [7],
		});
	}

	return files;
}

registerLevelCode('act3-level15-callbacks', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);
