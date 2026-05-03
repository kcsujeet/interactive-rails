import { registerLevelCode } from '@/lib/codebase-registry';
import type { Phase } from '../types';
import { STEP_DEFS } from './build-steps';

const USER_MODEL_BROKEN = `class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true, uniqueness: true

  # No normalization
  # Email stored as-is: " JOE@GMAIL.COM "
end`;

const USER_MODEL_NORMALIZED = `class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true, uniqueness: true

  normalizes :email, with: -> e { e.strip.downcase }
end`;

const PRODUCT_MODEL_WITH_ENUM = `class Product < ApplicationRecord
  belongs_to :seller, class_name: "User"
  validates :name, :price_cents, presence: true

  enum :status, draft: "draft",
                listed: "listed",
                sold: "sold"
end`;

const PRODUCT_STATUS_MIGRATION = `class AddStatusToProducts < ActiveRecord::Migration[8.0]
  def change
    add_column :products, :status, :string, default: "draft", null: false
    add_index :products, :status
  end
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
    params.expect(user: [ :email, :password ])
  end
end`;

const PRODUCTS_CONTROLLER_MARK_SOLD = `class ProductsController < ApplicationController
  before_action :require_authentication

  def mark_sold
    @product = Current.user.products.find(params[:id])
    @product.update!(status: "sold")
    sync_to_accounting(@product.id)
    render json: @product
  end
end`;

interface CodeFile {
	filename: string;
	language: string;
	code: string;
	highlight?: number[];
}

export function getCodeFiles(phase: Phase, furthestStep: number): CodeFile[] {
	// Observe phase: just the broken User model
	if (phase === 'observe') {
		return [
			{
				filename: 'app/models/user.rb',
				language: 'ruby',
				code: USER_MODEL_BROKEN,
				highlight: [5, 6],
			},
		];
	}

	// Build / reward phases: artifacts accumulate as steps complete.
	const files: CodeFile[] = [];

	// User model: broken until step 0, normalized after
	files.push({
		filename: 'app/models/user.rb',
		language: 'ruby',
		code: furthestStep >= 1 ? USER_MODEL_NORMALIZED : USER_MODEL_BROKEN,
		highlight: furthestStep >= 1 ? [5] : [5, 6],
	});

	// Product model + migration appear after step 1 (status enum)
	if (furthestStep >= 2) {
		files.push({
			filename: 'app/models/product.rb',
			language: 'ruby',
			code: PRODUCT_MODEL_WITH_ENUM,
			highlight: [5, 6, 7],
		});
		files.push({
			filename: 'db/migrate/20260301000000_add_status_to_products.rb',
			language: 'ruby',
			code: PRODUCT_STATUS_MIGRATION,
			highlight: [3, 4],
		});
	}

	// Users controller with welcome-email call appears after step 2
	if (furthestStep >= 3) {
		files.push({
			filename: 'app/controllers/users_controller.rb',
			language: 'ruby',
			code: USERS_CONTROLLER_WITH_MAILER,
			highlight: [7],
		});
	}

	// Products controller with background-job enqueue appears after step 3
	if (furthestStep >= 4) {
		files.push({
			filename: 'app/controllers/products_controller.rb',
			language: 'ruby',
			code: PRODUCTS_CONTROLLER_MARK_SOLD,
			highlight: [7],
		});
	}

	return files;
}

registerLevelCode('act3-level15-callbacks', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);
