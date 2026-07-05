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
		goal: `In this level, you'll:\n- learn how to control exactly what your API returns to clients.\n- pick a serializer library that follows a recognised JSON envelope standard.\n- declare which domain attributes to expose and format values (like prices) for display.\n- structure your output the way production APIs do.`,
		conceptExplanation: `Serializers control what data your API exposes. Without them, \`render json: product\` dumps every column on the model -- including bookkeeping fields like \`created_at\` that no client asked for, and any column renamed for internal reasons that was never meant to leak.

**Why serialize?**
- Choose which attributes to expose (only domain data, not bookkeeping).
- Format dates, currencies, names consistently.
- Include computed fields (full_name, display_price) that have no column behind them.
- Nest related data (product with reviews) in a controlled way that does not trigger N+1.

**The JSON:API standard:**
A widely-adopted response format for REST APIs (used by Ember Data and many other clients that expect a structured envelope). It provides:
- Standardised envelope: \`data\`, \`type\`, \`attributes\`, \`relationships\`.
- Built-in pagination via \`links\`.
- Sparse fieldsets: \`fields[products]=name,description\`.
- Compound documents: \`include=reviews\`.
- Standardised error format.

**Picking a serializer library:**
The Ruby ecosystem ships several serializer libraries; the differences come down to spec conformance, performance, and DSL ergonomics:
- Some implement the JSON:API spec out of the box, are 100x faster than the legacy ActiveModelSerializers gem, and are still actively maintained.
- Some produce a flat (non-standardised) JSON shape that is fine for internal APIs but does not match the JSON:API envelope.
- Some are template-based (closer to a view layer) and slower; useful for complex computed shapes, less useful for high-throughput JSON APIs.
- The legacy ActiveModelSerializers gem is unmaintained and not a sensible choice for a new app.

When in doubt for a new public API: pick the library that is JSON:API-conformant, fast, and active.`,
		railsCodeExample: `# After completing this level you will have:
# 1. picked a JSON:API-conformant serializer library and added
#    it to your Gemfile via the bundle CLI
# 2. created a base serializer class that mixes in the library's
#    serializer module
# 3. created a serializer per model that lists which attributes
#    the API should expose, plus a formatted attribute for price
# 4. wired the controller to render the serializer's output
#    instead of dumping the raw model

# JSON:API output (after the level):
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
		homework: [
			{
				task: 'Add the serializer gem and generate a Product serializer.',
				commands: [
					'bundle add jsonapi-serializer',
					'bin/rails g serializer Product name price',
				],
				verify:
					'app/serializers/product_serializer.rb exists and includes JSONAPI::Serializer with your attributes.',
			},
			{
				task: 'Use it in the controller (render json: ProductSerializer.new(Product.all)) and compare the response with the raw to_json dump.',
				commands: ['curl http://localhost:3000/api/v1/products'],
				verify:
					'The response is JSON:API shaped (data with type, id, attributes) and internal columns like created_at no longer leak.',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Among the Ruby serializer libraries, look for the one that is JSON:API-conformant, fast, and still actively maintained. The legacy mainstream one is no longer maintained; the one you want is its actively-maintained successor.',
	},
};
