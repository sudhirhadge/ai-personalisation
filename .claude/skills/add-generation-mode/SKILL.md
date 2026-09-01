---
name: add-generation-mode
description: Add a new AI generation mode (a 5th mode alongside TEXT_TO_IMAGE, IMAGE_TO_IMAGE, WRAPPER_COMPOSITE, WRAPPER_COMPOSITE_MULTI_REF) end-to-end across server and client. Use when asked to add/create a new generation mode, AI mode, or job type for the AI Personalization feature.
---

# Add a new AI generation mode

A generation mode is wired through 7 files across `server/` and `client/`. Missing
one leaves a mode that queues but never processes, or that exists on the server
but never appears in the UI. Do these in order — later steps depend on names
defined in earlier ones.

## 1. `server/constants/aiJobs.js`
Add an entry to `AI_JOB_TYPES` with a unique `queueName`/`jobName` (kebab-case,
prefixed `ai-`), `requiresOriginalImage` (does the job need the user's uploaded
photo?), and `fixedPrompt: true` only if the mode has no free-text prompt input.

## 2. `server/services/aiService.js` (or `blackForestLabsService.js` for
multi-reference/BFL-style modes)
Add a `process<ModeName>` async function following the existing pattern: takes
`(sessionId, productSku, ...)`, calls the external AI provider (or, when
`config.bypassAi` is true, returns the deterministic placeholder/echo/composite
per the `BYPASS_AI` gotcha in the root CLAUDE.md), and returns
`{ success, processedImageUrl, aiPrompt?, aiResult?, error? }`.

## 3. `server/queues/aiQueue.js`
Add a new `createAIQueue({ queueName, processFn })` call (queueName from step 1,
processFn wraps the step-2 service function). Add its `shutdown*` function to
`shutdownAllWorkers`'s `Promise.all`. Export the new `queue`/`worker` from
`module.exports`.

## 4. `server/controllers/aiController.js`
Add a thin wrapper function (mirrors `generateAIImage`/`generateAIWrapperComposite`)
that calls `triggerAIGeneration({ req, res, queue: <new queue>, jobType: AI_JOB_TYPES.<NEW_MODE> })`.
If the mode needs a wrapper template, include the `imageCompositeService.hasRegionConfig`
pre-check like `generateAIWrapperComposite` does — this avoids burning inference
spend on an unconfigured SKU. Add the new queue to `QUEUE_BY_NAME`. Export the
new function.

## 5. `server/routes/ai.js`
Add `router.post('/<endpoint-path>', <newControllerFn>)`. Import the new
controller function in the destructured `require`.

## 6. `client/src/features/AI_Personalization/types/aiJobType.ts`
Add the new mode name to the `GenerationMode` union type.

## 7. `client/src/features/AI_Personalization/config/generationModes.ts`
Add an entry to `GENERATION_MODES` — `mode`, `endpointPath` (must exactly match
step 5's route path), `label`, `description`, `hasPromptInput`,
`requiresWrapperTemplate`. This file is the single source of truth the UI reads
from (`ModeSelector.tsx`, `PromptInput.tsx`) — don't add a second branch
elsewhere for the new mode.

## If the mode needs a wrapper template
Add the SKU → compositing coordinates entry to `WRAPPER_OVERLAY_REGIONS` in
`server/services/imageCompositeService.js`.

## Verify
- `BYPASS_AI=true` in `server/.env` lets you exercise the full flow locally
  without spending HF/BFL credits.
- Server tests mock the whole queue module (`server/queues/__mocks__/aiQueue.js`)
  rather than hitting real Redis — if your new queue/worker export changes the
  module's shape, check that mock still matches.
- Remember the one-job-per-session limit: a session can't run two modes in
  parallel, so nothing about this addition needs to handle concurrent modes on
  one session.
