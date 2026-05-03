import { describe, expect, test } from 'bun:test';
import {
	classifyFilename,
	compare,
	lineToRegex,
	normalize,
	tagForSlug,
} from '../validate-codebase';

describe('classifyFilename', () => {
	test('app/ prefix is real', () => {
		expect(classifyFilename('app/models/product.rb')).toBe('real');
		expect(
			classifyFilename('app/controllers/api/v1/products_controller.rb'),
		).toBe('real');
		expect(classifyFilename('app/serializers/product_serializer.rb')).toBe(
			'real',
		);
	});

	test('config/ db/ test/ lib/ prefixes are real', () => {
		expect(classifyFilename('config/routes.rb')).toBe('real');
		expect(classifyFilename('config/database.yml')).toBe('real');
		expect(classifyFilename('db/schema.rb')).toBe('real');
		expect(classifyFilename('test/models/product_test.rb')).toBe('real');
	});

	test('Gemfile / Rakefile / Dockerfile basenames are real', () => {
		expect(classifyFilename('Gemfile')).toBe('real');
		expect(classifyFilename('Rakefile')).toBe('real');
		expect(classifyFilename('Dockerfile')).toBe('real');
		expect(classifyFilename('config.ru')).toBe('real');
	});

	test('placeholder filenames are placeholder', () => {
		expect(classifyFilename('db/migrate/<timestamp>_create_products.rb')).toBe(
			'placeholder',
		);
		expect(classifyFilename('config/<sha>_token.rb')).toBe('placeholder');
	});

	test('filenames with spaces are pseudo', () => {
		expect(classifyFilename('Generator Command')).toBe('pseudo');
		expect(classifyFilename('Directory Layout')).toBe('pseudo');
		expect(classifyFilename('Test Results')).toBe('pseudo');
	});

	test('known label list is pseudo', () => {
		expect(classifyFilename('Stack')).toBe('pseudo');
		expect(classifyFilename('Verify')).toBe('pseudo');
		expect(classifyFilename('CRUD reference')).toBe('pseudo');
	});

	test('global dotfiles are global', () => {
		expect(classifyFilename('~/.zshrc')).toBe('global');
		expect(classifyFilename('.zshrc')).toBe('global');
		expect(classifyFilename('.mise.toml')).toBe('global');
		expect(classifyFilename('.tool-versions')).toBe('global');
	});

	test('unknown name without slash defaults to pseudo (safe)', () => {
		expect(classifyFilename('SomeRandomLabel')).toBe('pseudo');
	});
});

describe('tagForSlug', () => {
	test('act1-level3-model -> level-3', () => {
		expect(tagForSlug('act1-level3-model')).toBe('level-3');
	});

	test('act6-level50-feature-flags -> level-50', () => {
		expect(tagForSlug('act6-level50-feature-flags')).toBe('level-50');
	});

	test('non-conforming slug returns null', () => {
		expect(tagForSlug('something-else')).toBeNull();
		expect(tagForSlug('')).toBeNull();
	});
});

describe('lineToRegex', () => {
	test('plain line matches itself', () => {
		const re = lineToRegex('class Product < ApplicationRecord');
		expect(re.test('class Product < ApplicationRecord')).toBe(true);
		expect(re.test('class User < ApplicationRecord')).toBe(false);
	});

	test('regex meta characters are escaped', () => {
		const re = lineToRegex('config.api_only = true');
		expect(re.test('  config.api_only = true')).toBe(true);
		// "config.api_only" should NOT match "configZapi_only" — the `.` is literal
		expect(re.test('configXapi_only = true')).toBe(false);
	});

	test('<timestamp> placeholder matches a 14-digit string', () => {
		const re = lineToRegex(
			'      create    db/migrate/<timestamp>_create_products.rb',
		);
		expect(
			re.test('      create    db/migrate/20260502144556_create_products.rb'),
		).toBe(true);
		expect(re.test('      create    db/migrate/abc_create_products.rb')).toBe(
			false,
		);
	});

	test('<sha> placeholder matches a hex string', () => {
		const re = lineToRegex('commit <sha>');
		expect(re.test('commit a97dbcc')).toBe(true);
		expect(re.test('commit deadbeef1234567')).toBe(true);
	});
});

describe('normalize', () => {
	test('trims trailing whitespace per line', () => {
		expect(normalize('hello   \nworld\t\t')).toBe('hello\nworld');
	});

	test('collapses 3+ blank lines into 2', () => {
		expect(normalize('a\n\n\n\nb')).toBe('a\n\nb');
	});

	test('preserves single blank lines', () => {
		expect(normalize('a\n\nb')).toBe('a\n\nb');
	});
});

describe('compare', () => {
	const REAL_PRODUCT = `class Product < ApplicationRecord
  has_many :reviews, dependent: :destroy
end`;

	test('exact match passes', () => {
		const result = compare(REAL_PRODUCT, REAL_PRODUCT);
		expect(result.ok).toBe(true);
		expect(result.missingLines).toEqual([]);
	});

	test('subset of real file passes (level shows partial)', () => {
		const levelSnippet = `class Product < ApplicationRecord
  has_many :reviews, dependent: :destroy
end`;
		expect(compare(levelSnippet, REAL_PRODUCT).ok).toBe(true);
	});

	test('blank lines in level snippet are skipped', () => {
		const withBlanks = `class Product < ApplicationRecord

  has_many :reviews, dependent: :destroy

end`;
		expect(compare(withBlanks, REAL_PRODUCT).ok).toBe(true);
	});

	test('drift on a single line fails with that line in missingLines', () => {
		const wrongLevel = `class Product < ApplicationRecord
  has_many :reviews, dependent: :nullify
end`;
		const result = compare(wrongLevel, REAL_PRODUCT);
		expect(result.ok).toBe(false);
		expect(result.missingLines).toEqual([
			'  has_many :reviews, dependent: :nullify',
		]);
	});

	test('placeholder substitution in compare also works', () => {
		const realMigration = `class CreateProducts < ActiveRecord::Migration[8.1]
  def change
    create_table :products do |t|
      t.string :name
      t.text :description
      t.decimal :price

      t.timestamps
    end
  end
end`;
		const levelSnippetWithPlaceholder = `class CreateProducts < ActiveRecord::Migration[8.1]
  def change
    create_table :products do |t|
      t.string :name
      t.decimal :price
    end
  end
end`;
		// Note: we don't have a <timestamp> placeholder in the body here, but we
		// still expect line-containment to work for an arbitrary subset.
		expect(compare(levelSnippetWithPlaceholder, realMigration).ok).toBe(true);
	});

	test('whitespace-only differences pass', () => {
		const real = 'class Foo\n  attr_reader :bar\nend\n';
		const levelWithTrailingSpaces = 'class Foo  \n  attr_reader :bar\t\nend';
		expect(compare(levelWithTrailingSpaces, real).ok).toBe(true);
	});

	test('regex meta chars in level snippet do not throw', () => {
		const real = 'config.api_only = true';
		const level = 'config.api_only = true';
		// Should not throw, should pass.
		expect(compare(level, real).ok).toBe(true);
	});

	test('drift on multiple lines reports all of them', () => {
		const real = `a\nb\nc`;
		const level = `a\nx\ny`;
		const result = compare(level, real);
		expect(result.ok).toBe(false);
		expect(result.missingLines).toEqual(['x', 'y']);
	});
});
