import type { Level } from '@/types';

export const level8Serializers: Level = {
	id: 'act1-level8-serializers',
	actId: 1,
	levelNumber: 8,
	name: 'Serializers',
	trigger: {
		type: 'user_complaint',
		description:
			'The API works, but every endpoint dumps every column straight to JSON, including bookkeeping fields like `created_at` no client ever asked for. Mobile clients pay for the extra bytes; an internal column rename leaks to every consumer.',
	},
	startingPipeline: {
		nodes: [],
		connections: [],
	},
	problem: {
		observation: 'API returns all model attributes including internal ones.',
		rootCause: 'No serialization layer to shape the JSON output.',
		codeExample: `# Current: render json: product returns EVERYTHING
{
  "id": 1,
  "name": "Laptop",
  "description": "16-inch display",
  "price": "999.99",
  "created_at": "2024-01-01T00:00:00.000Z",     # Internal
  "updated_at": "2024-01-01T00:00:00.000Z"      # Internal
}

# We want (JSON:API standard):
{
  "data": {
    "id": "1",
    "type": "products",
    "attributes": {
      "name": "Laptop",
      "description": "16-inch display",
      "price": "999.99"
    }
  }
}`,
		goal: 'End with the API returning a structured envelope of only the attributes you chose to expose, instead of a flat dump of every column.',
		thresholds: {},
	},
	successConditions: [],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'JSON:API Serialization',
		goal: `In this level, you'll:\n- learn how to control exactly what your API returns to clients.\n- use a serializer gem to shape JSON responses following the JSON:API standard.\n- declare which domain attributes to expose and format prices for display.\n- structure your output the way production APIs do.`,
		conceptExplanation: `Serializers control what data your API exposes. Without them, \`render json: product\` dumps everything.

**Why serialize?**
- Choose which attributes to expose (only domain data, not bookkeeping)
- Format dates, currencies, names
- Include computed fields (full_name, display_price)
- Nest related data (product with reviews)

**The JSON:API standard:**
A widely-adopted response format for REST APIs (used by Ember Data and many other clients that expect a structured envelope). It provides:
- Standardized envelope: \`data\`, \`type\`, \`attributes\`, \`relationships\`
- Built-in pagination via \`links\`
- Sparse fieldsets: \`fields[products]=name,description\`
- Compound documents: \`include=reviews\`
- Standardized error format

**Why jsonapi-serializer?**
- Implements the JSON:API spec out of the box
- 100x faster than ActiveModelSerializers (AMS)
- Production-proven, actively maintained
- Clean DSL: \`attributes\`, \`has_many\`, \`belongs_to\`

**Alternatives and trade-offs:**
- Blueprinter: simpler flat JSON, not standards-compliant, good for internal APIs
- Alba: flexible, supports multiple formats, newer
- Jbuilder: template-based, good for complex views, slower
- ActiveModelSerializers (AMS): legacy, unmaintained. Avoid.`,
		railsCodeExample: `# Gemfile
gem "jsonapi-serializer"

# app/serializers/base_serializer.rb
class BaseSerializer
  include JSONAPI::Serializer
end

# app/serializers/product_serializer.rb
class ProductSerializer < BaseSerializer
  attribute :name
  attribute :description

  attribute :price do |product|
    product.price.to_s
  end

  has_many :reviews, serializer: ReviewSerializer
end

# In controller:
class Api::ProductsController < ApplicationController
  def index
    products = Product.all
    render json: ProductSerializer.new(products).serializable_hash.to_json
  end

  def show
    product = Product.find(params[:id])
    render json: ProductSerializer.new(product).serializable_hash.to_json
  end
end

# JSON:API output:
# {
#   "data": {
#     "id": "1",
#     "type": "products",
#     "attributes": {
#       "name": "Laptop",
#       "description": "16-inch display",
#       "price": "999.99"
#     }
#   }
# }`,
		commonMistakes: [
			'Treating the database schema as the public API. Every column gets exposed -- including ones renamed for internal reasons that should never have leaked.',
			'Letting nested associations lazy-load inside the serializer. One product turns into N+1 queries for related data the moment the serializer touches them.',
			'Returning every field on every endpoint. The list view does not need the same level of detail as the show view; a smaller payload is faster to send and faster to parse.',
			'Skipping the serializer entirely for "small" responses. The next person to add a field forgets there was ever a filter, and bookkeeping data is back in the response.',
		],
		whenToUse:
			'Every API endpoint should use a serializer. Use JSON:API format for public APIs.',
		furtherReading: [
			{
				title: 'jsonapi-serializer',
				url: 'https://github.com/jsonapi-serializer/jsonapi-serializer',
			},
			{
				title: 'JSON:API Specification',
				url: 'https://jsonapi.org/',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Look for the gem that implements the JSON:API spec and is actively maintained.',
	},
};
