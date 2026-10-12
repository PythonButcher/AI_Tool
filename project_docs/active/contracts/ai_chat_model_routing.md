# AI Chat Model Routing

`POST /api/decision/chat/turns` accepts optional `model_mode`: `auto`, `quick`, or `deep`. Omission keeps deterministic behavior for older clients. Invalid modes return HTTP 400 before analytical or provider execution. Routing is separate from `requested_mode` (BI intent).

Auto keeps direct computed results local. Requests for explanation use Quick; explicit detailed reasoning, trade-offs or deep analysis use Deep. Explicit Quick/Deep selects that tier, except that clarification, unsupported operations and governance blocks never get overridden. Routing uses bounded rules, not a paid classifier.

Quick defaults to `gpt-4.1-mini`; Deep defaults to `gpt-5-mini` with medium reasoning. Server environment settings `AI_CHAT_QUICK_MODEL` and `AI_CHAT_DEEP_MODEL` accept only supported profiles: `gpt-4.1-mini`, `gpt-4.1`, `gpt-5-mini`. `OPENAI_API_KEY` stays server-side. Each turn permits one Chat Completions call, a 45-second timeout, no SDK retries, and bounded input/output. GPT-4.1 profiles use temperature and a 900-token completion limit; GPT-5 mini uses reasoning_effort and a 6000-token limit including reasoning.

Provider input contains the question, bounded recent user/assistant text, and authoritative computed reply/grounding summary. It excludes raw datasets and source handles. Historical text and user input are untrusted context, never system instructions. No model tool calls, internet searches, arbitrary code, or model-written analytical state are supported.

Responses preserve `assistant_message`, artifacts, session state and BI grounding. Optional `ai_commentary` is distinct model-generated explanation, not a verified calculation. `model_routing` reports `requested_mode`, `selected_mode`, `model` (actual successful model, or null), `attempted_model`, `status` (`local`, `completed`, `unavailable`) and user-readable `reason`. Failure keeps deterministic results intact. Token counts are reported when supplied by the provider, not estimated charges.

The composer persists mode per conversation; new/reset chats default to Auto. Each turn snapshots its selection, including retries. Stored replies keep original attribution. Deep analysis offers more reasoning over supplied evidence, not live web research. Source changes retain existing grounding and request-isolation rules.

This router applies to BI chat turns and explanatory answers. The separate `/clean` command workflow and legacy AI endpoints retain their existing model configuration. Stopping client waiting discards late responses but does not promise cancellation of provider billing.

Official references: [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini), [pricing](https://developers.openai.com/api/docs/pricing). Standard per-million token rates verified 2026-10-11: GPT-4.1 mini $0.40 input / $1.60 output; GPT-5 mini $0.25 input / $2.00 output. Reasoning tokens count toward output; per-request costs vary. Account access and live provider quality require deployment verification.
