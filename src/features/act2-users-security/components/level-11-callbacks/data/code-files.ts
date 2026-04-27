import { registerLevelCode } from '@/lib/codebase-registry';
import type { Phase } from '../types';
import { STEP_DEFS } from './build-steps';

export function getCodeFiles(phase: Phase, furthestStep: number) {
	const files = [];

	// Observe phase: show the bare User model
	if (phase === 'observe') {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true, uniqueness: true

  # No normalization
  # No callbacks
  # Email stored as-is: " JOE@GMAIL.COM "
end`,
			highlight: [5, 6, 7],
		});
		return files;
	}

	// Build / reward phases: show evolving code
	if (furthestStep === 0) {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true, uniqueness: true

  # No normalization
  # No callbacks
  # Email stored as-is: " JOE@GMAIL.COM "
end`,
			highlight: [5, 6, 7],
		});
	}

	if (furthestStep >= 1 && furthestStep < 2) {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true, uniqueness: true

  normalizes :email, with: -> e { e.strip.downcase }
end`,
			highlight: [5],
		});
	}

	if (furthestStep >= 2 && furthestStep < 3) {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true, uniqueness: true

  normalizes :email, with: -> e { e.strip.downcase }

  after_create :send_welcome_email

  private

  def send_welcome_email
    UserMailer.welcome(self).deliver_later
  end
end`,
			highlight: [7, 11, 12, 13],
		});
	}

	if (furthestStep >= 3 && furthestStep < 4) {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true, uniqueness: true

  normalizes :email, with: -> e { e.strip.downcase }

  # Lifecycle order:
  # 1. before_validation (normalizes run here)
  # 2. before_save
  # 3. after_save (inside transaction)
  # 4. after_commit (transaction committed)

  after_create :send_welcome_email

  private

  def send_welcome_email
    UserMailer.welcome(self).deliver_later
  end
end`,
			highlight: [7, 8, 9, 10, 11],
		});
	}

	if (furthestStep >= 4) {
		files.push({
			filename: 'app/models/user.rb',
			language: 'ruby',
			code: `class User < ApplicationRecord
  has_secure_password
  validates :email, presence: true, uniqueness: true

  normalizes :email, with: -> e { e.strip.downcase }

  # Lifecycle order:
  # 1. before_validation (normalizes run here)
  # 2. before_save
  # 3. after_save (inside transaction)
  # 4. after_commit (transaction committed)

  after_create :send_welcome_email

  # Safe for external calls: runs after transaction commits
  after_commit :sync_to_crm, on: :create

  private

  def send_welcome_email
    UserMailer.welcome(self).deliver_later
  end

  def sync_to_crm
    CrmSyncJob.perform_later(id)
  end
end`,
			highlight: [15, 16, 25, 26, 27],
		});
	}

	return files;
}

registerLevelCode('act2-level11-callbacks', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);
