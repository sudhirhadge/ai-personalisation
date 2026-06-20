**Yes, one model is the RIGHT approach for your use case.** Here's why:

***

## ✅ Why Single `Session` Model is Good

| Benefit | Explanation |
|---------|-------------|
| **Simple Workflow** | One session travels through all phases: `CREATED` → `UPLOADED` → `PROCESSING` → `DONE` |
| **Single MongoDB Query** | Get complete session data (email + image + AI result) in 1 query |
| **Status Tracking** | Single `status` field tracks entire pipeline state |
| **TTL Cleanup** | One TTL index auto-deletes everything after 7 days |
| **Less Complexity** | No need to join/calculate data from multiple tables |
| ** Fits Your Pattern** | Session-based flow (not user-based), data is temporary |

***

## ⚠️ When You'd Need Multiple Models

Only split if:
- **Different lifecycles**: Image lives forever, session expires in 7 days ❌ (not your case)
- **Different access patterns**: Query images separately from sessions ❌ (you always need both)
- **Massive data**: AI results are 10MB+ JSON ❌ (your results are small)
- **Multiple images per session**: User uploads 10 versions ❌ (you have 1 image)

**None of these apply to you!** ✅

***

## ✅ Your Current Model is Perfect

```javascript
sessionSchema = {
  // Phase 1: Core
  email, productSku, status, jwtToken, personalizationLink
  
  // Phase 2: Image (null until uploaded)
  originalImageUrl, originalImageName, originalImageMimeType, originalImageSize
  
  // Phase 3: AI (null until processed)
  aiJobId, processedImageUrl, aiPrompt, aiResult, aiError
  
  // Auto-added
  createdAt, updatedAt
}
```

**Status enum drives the workflow:**
```javascript
enum: ['CREATED', 'UPLOADED', 'PROCESSING', 'DONE', 'FAILED']
```

***

## 🎯 Alternative (If You Wanted)

If you **really** wanted to separate, you'd have:

```javascript
// Session model (expires 7 days)
Session = { email, productSku, status, jwtToken }

// Image model (lives forever)
Image = { sessionId, originalImageUrl, originalImageName }

// AI Result model (lives forever)
AIResult = { sessionId, aiJobId, processedImageUrl, aiResult }
```

**Problems:**
- ❌ Need 3 queries to get complete data
- ❌ Manual cleanup of orphaned images/AI results
- ❌ More complex repository layer
- ❌ harder to track status

**Your single model avoids all these!** ✅

***

## ✅ Keep It Simple

**Your current approach is correct:** One `Session` model with optional fields for each phase. Fields are `null` until that phase completes.

This is the **MongoDB pattern**: Embedded data in one document when it's always accessed together.

**Don't change it!** 👍