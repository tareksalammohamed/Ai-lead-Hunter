# OpenRouter integration notes

Official sources reviewed on 2026-08-21:

- Quickstart: https://openrouter.ai/docs/quickstart
- Model fallbacks: https://openrouter.ai/docs/guides/routing/model-fallbacks
- Models API: https://openrouter.ai/docs/guides/overview/models
- Provider routing: https://openrouter.ai/docs/guides/routing/provider-selection

Key verified facts:

1. Chat Completions endpoint: POST https://openrouter.ai/api/v1/chat/completions. The request uses a Bearer API key and a model/messages payload.
2. OpenRouter model fallbacks use a `models` array in priority order. OpenRouter tries later model IDs when the first model fails due to provider downtime, rate limits, context validation, or moderation refusal. Do not send both `models` and Anthropic `fallbacks` in the same request; the Anthropic endpoint has a maximum of three fallback entries.
3. OpenRouter provider routing supports a `provider` object with `order`, `allow_fallbacks`, `require_parameters`, `sort`, `only`, `ignore`, and other controls. The application can treat OpenRouter as a provider-level router and add global failover above it.
4. Models endpoint: GET https://openrouter.ai/api/v1/models. Responses contain `data`, `total_count`, `links.next`; model metadata includes `id`, `name`, `context_length`, `architecture`, `pricing`, `top_provider`, `supported_parameters`, `expiration_date`, and optional benchmarks.
5. Pricing values are per token/request/unit; a price of `0` indicates free. Supported parameters include `tools`, `structured_outputs`, `response_format`, `reasoning`, `max_tokens`, and others.
6. The OpenRouter free router model is `openrouter/free`; it selects a free model from the available free models. It should be used as a configured special mode, not as a hardcoded single free model pool.
7. Provider routing can sort by `price`, `throughput`, or `latency`; explicit ordering disables default load balancing. Application-level health/circuit-breaker logic remains responsible for cross-provider failover and persistent checkpoints.

## Current model guidance (Aug 2026)

- Official xAI documentation updated Aug 18, 2026 recommends `grok-4.6` as the general-purpose flagship model, with 500k context and paid API pricing: https://docs.x.ai/developers/models
- OpenRouter documents `openrouter/free` as the router for free inference and exposes model metadata through its Models API: https://openrouter.ai/openrouter/free and https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties
- The app treats official Grok as a paid provider and uses OpenRouter's dynamic free pool for free inference. The UI labels Grok separately and does not claim that the official xAI API is free.
