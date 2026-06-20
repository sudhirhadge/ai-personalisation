# 🎯 Complete Backend Flow: Phase 1 Storytelling Guide

Let me walk you through **exactly how every request flows** through the backend, step-by-step, file-by-file, function-by-function.

***

## 📖 ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                        REQUEST FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│  Client (Browser)                                                │
│       ↓                                                          │
│  Express Router (routes/sessions.js)                             │
│       ↓                                                          │
│  Controller (controllers/sessionController.js)                   │
│       ↓                                                          │
│  Service (services/tokenService.js, emailService.js)             │
│       ↓                                                          │
│  Repository (repositories/sessionRepository.js)                  │
│       ↓                                                          │
│  Model (models/Session.js)                                       │
│       ↓                                                          │
│  MongoDB Database                                                │
└─────────────────────────────────────────────────────────────────┘
```

***

# 🚀 SCENARIO 1: CREATE SESSION (Happy Path)

## Request: `POST /api/v1/sessions`

**User Action:** User fills form with `email=sudhir.hadge@gmail.com` and `productSku=purple hat`, clicks submit.

***

### Step 1: Request Hits Express Server

**File:** `backend/src/server.js`

```javascript
// Line 1: Server starts
async function startServer() {
    await connectDatabase(); // Connects to MongoDB
    
    const server = app.listen(config.port, () => {
        console.log('🚀 Server running on http://localhost:5000');
    });
}
```

**What happens:**
1. Node.js starts listening on port 5000
2. MongoDB connection established
3. Server is ready to receive requests

***

### Step 2: Express App Middleware Chain

**File:** `backend/src/app.js`

```javascript
// Lines 1-50: Middleware applied to EVERY request
app.use(helmet());                    // Security headers
app.use(cors());                      // Enable CORS
app.use(express.json());              // Parse JSON body
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));               // Logging

// Line 55: Route mounted
app.use('/api/v1/sessions', sessionsRouter);
```

**What happens:**
1. `helmet()` adds security headers
2. `cors()` allows frontend to call backend
3. `express.json()` parses `{"email": "...", "productSku": "..."}`
4. `morgan('dev')` logs: `POST /api/v1/sessions 201 XX ms`
5. Request matches `/api/v1/sessions` → routes to `sessionsRouter`

***

### Step 3: Route Matching

**File:** `backend/src/routes/sessions.js`

```javascript
// Lines 10-13: Route definition
const router = express.Router();

// POST /api/v1/sessions - PUBLIC (no auth)
router.post('/', createSession);

// GET /api/v1/sessions/me - PROTECTED (requires JWT)
router.get('/me', authenticate, getCurrentSession);

module.exports = router;
```

**What happens:**
1. Express matches `POST /` (root of `/api/v1/sessions`)
2. Calls `createSession(req, res, next)` function
3. Request flows to controller

***

### Step 4: Controller - Input Validation

**File:** `backend/src/controllers/sessionController.js`

```javascript
async function createSession(req, res, next) {
    try {
        // Line 23: Extract data from request body
        const { email, productSku } = req.body;
        // req.body = { email: "sudhir.hadge@gmail.com", productSku: "purple hat" }

        // Line 27: Check required fields
        if (!email || !productSku) {
            return res.status(400).json({
                success: false,
                error: 'Email and productSku are required',
            });
        }
        // ✅ Happy path: Both fields present

        // Line 35: Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format',
            });
        }
        // ✅ Happy path: Email is valid
```

**What happens:**
1. Extracts `email` and `productSku` from `req.body`
2. Validates both exist (negative path: returns 400 if missing)
3. Validates email format with regex (negative path: returns 400 if invalid)

***

### Step 5: Controller - Generate Session Token

**File:** `backend/src/controllers/sessionController.js` (continued)

```javascript
        // Line 45: Call repository to create session
        const session = await sessionRepository.create({
            email: email.toLowerCase(),          // Normalize to lowercase
            productSku,
            jwtToken: tokenService.generateSessionToken(), // Generate UUID
        });
```

**What happens:**
1. Calls `tokenService.generateSessionToken()` → returns UUID like `"adb90b0d-8569-4817-b9d3-07de884cce00"`
2. Calls `sessionRepository.create()` with data
3. `await` pauses execution until MongoDB operation completes

***

### Step 6: Token Service - Generate UUID

**File:** `backend/src/services/tokenService.js`

```javascript
class TokenService {
    // Line 23: Generate unique session token (UUID)
    generateSessionToken() {
        return uuidv4(); // Returns: "adb90b0d-8569-4817-b9d3-07de884cce00"
    }

    // Line 32: Generate JWT for API authentication
    generateDeepLinkToken(sessionId) {
        const payload = {
            sessionId,      // MongoDB _id (e.g., "67a1b2c3d4e5f6789012345")
            type: 'personalization',
        };

        const token = jwt.sign(payload, config.jwt.secret, {
            expiresIn: config.jwt.expiresIn, // 7 days
        });
        // Returns: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        return token;
    }
}
```

**What happens:**
1. `uuidv4()` generates random UUID
2. This UUID is stored in MongoDB as `jwtToken` field
3. **Why UUID?** It's the public identifier for the session
4. **Why JWT separately?** JWT is used for API authentication (Authorization header)

***

### Step 7: Repository - Save to MongoDB

**File:** `backend/src/repositories/sessionRepository.js`

```javascript
class SessionRepository {
    async create(sessionData) {
        // Line 17: Create new Mongoose document
        const session = new Session({
            ...sessionData,  // { email, productSku, jwtToken }
            status: 'CREATED', // Default status
        });

        // Line 22: Save to MongoDB
        return await session.save();
    }
}
```

**What happens:**
1. Creates new `Session` Mongoose document
2. Calls `session.save()` → inserts into MongoDB
3. MongoDB auto-generates `_id` (e.g., `"67a1b2c3d4e5f6789012345"`)
4. Returns the saved document with `_id`

***

### Step 8: Model - Mongoose Schema Validation

**File:** `backend/src/models/Session.js`

```javascript
const sessionSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,  // Auto-lowercase
        index: true,      // Speed up email lookups
    },
    productSku: {
        type: String,
        required: true,
        trim: true,
    },
    status: {
        type: String,
        enum: ['CREATED', 'UPLOADED', 'PROCESSING', 'DONE', 'FAILED'],
        default: 'CREATED',
    },
    jwtToken: {
        type: String,
        required: true,
        unique: true,     // Prevent duplicate tokens
        index: true,
    },
    // ... other fields
}, {
    timestamps: true, // Auto-add createdAt, updatedAt
});

// Line 35: TTL index - auto-delete after 7 days
sessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });
```

**What happens:**
1. Mongoose validates schema (required fields, types)
2. Auto-adds `createdAt` and `updatedAt`
3. Creates TTL index in MongoDB (auto-deletes after 7 days = 604800 seconds)
4. **Why TTL?** Sessions are temporary, no manual cleanup needed

***

### Step 9: Back in Controller - Generate JWT

**File:** `backend/src/controllers/sessionController.js` (continued)

```javascript
        // Session saved, now we have session._id
        // session._id = "67a1b2c3d4e5f6789012345"

        // Line 53: Generate JWT using MongoDB _id
        const jwtToken = tokenService.generateDeepLinkToken(session._id.toString());
        // jwtToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXNzaW9uSWQiOiI2N2ExYjJjM2Q0ZTVmNjc4OTAxMjM0NSIsInR5cGUiOiJwZXJzb25hbGl6YXRpb24iLCJpYXQiOjE3MDk1NjgwMDB9.abc123"
```

**What happens:**
1. Signs JWT with MongoDB `_id` as payload
2. JWT contains: `{ sessionId: "67a1b2c3d4e5f6789012345", type: "personalization", exp: 7days }`
3. **Why JWT?** Stateless authentication - no session needed on server

***

### Step 10: Service - Send Email (Non-blocking)

**File:** `backend/src/controllers/sessionController.js` (continued)

```javascript
        // Line 57: Send email (don't await - non-blocking)
        emailService.sendPersonalizationEmail(session).catch(err => {
            console.error('Email sending failed:', err);
        });
```

**File:** `backend/src/services/emailService.js`

```javascript
class EmailService {
    async sendPersonalizationEmail(session) {
        // Line 17: Get email provider (Nodemailer)
        const emailProvider = getEmailProvider();
        
        const emailData = {
            to: session.email,
            email: session.email,
            productSku: session.productSku,
            personalizationLink: session.personalizationLink,
        };

        // Line 28: Send email via SMTP
        const result = await emailProvider.sendPersonalizationEmail(emailData);
        
        // Line 32: Log success
        console.log('\n📧 EMAIL SENT SUCCESSFULLY');
        console.log(`To: ${session.email}`);
        console.log(`Link: ${emailData.personalizationLink}`);
        
        return result;
    }
}
```

**File:** `backend/src/providers/emailProvider.js`

```javascript
class NodemailerEmailProvider extends EmailProvider {
    async sendPersonalizationEmail({ to, email, productSku, personalizationLink }) {
        const mailOptions = {
            from: config.email.from,
            to,
            subject: `Your AI Personalization Session for ${productSku}`,
            html: this._buildEmailHtml(email, productSku, personalizationLink),
        };

        // Line 15: Send via SMTP
        const result = await this.transporter.sendMail(mailOptions);
        
        return {
            success: true,
            messageId: result.messageId,
            accepted: result.accepted,
        };
    }
}
```

**What happens:**
1. Gets `NodemailerEmailProvider` instance
2. Builds HTML email with personalization link
3. Sends via SMTP (Ethereal/Gmail)
4. **Why non-blocking?** Email can fail, shouldn't block API response
5. **In production:** Would use BullMQ queue instead

***

### Step 11: Controller - Send Response

**File:** `backend/src/controllers/sessionController.js` (continued)

```javascript
        // Line 63: Send success response
        res.status(201).json({
            success: true,
            data: {
                sessionId: session._id.toString(),       // "67a1b2c3d4e5f6789012345"
                email: session.email,                     // "sudhir.hadge@gmail.com"
                productSku: session.productSku,           // "purple hat"
                status: session.status,                   // "CREATED"
                personalizationLink: `${config.frontendUrl}/personalize-now?token=${jwtToken}`,
                jwtToken,                                 // "eyJhbGci..." (for API calls)
            },
        });
        // ✅ Response sent to client
```

**What happens:**
1. Returns HTTP 201 (Created)
2. Sends JSON with session data
3. **Why return `jwtToken`?** Frontend stores it for `GET /sessions/me` calls

***

## 📊 COMPLETE CALL CHAIN (CREATE SESSION)

```
POST /api/v1/sessions
  ↓
app.js (middleware: helmet, cors, json, morgan)
  ↓
routes/sessions.js (router.post('/', createSession))
  ↓
controllers/sessionController.js (createSession)
  ├─→ Validate email & productSku
  ├─→ services/tokenService.js (generateSessionToken) → UUID
  ├─→ repositories/sessionRepository.js (create)
  │   └─→ models/Session.js (Mongoose schema)
  │       └─→ MongoDB (INSERT)
  ├─→ services/tokenService.js (generateDeepLinkToken) → JWT
  ├─→ services/emailService.js (sendPersonalizationEmail)
  │   └─→ providers/emailProvider.js (Nodemailer)
  │       └─→ SMTP Server (Ethereal/Gmail)
  └─→ res.status(201).json({...})
```

***

# 🔐 SCENARIO 2: GET SESSION (Happy Path)

## Request: `GET /api/v1/sessions/me` with `Authorization: Bearer <jwt>`

**User Action:** User clicks "Personalize Now" button, frontend calls API with JWT.

***

### Step 1: Request Hits Router with Auth Middleware

**File:** `backend/src/routes/sessions.js`

```javascript
// Line 17: Protected route
router.get('/me', authenticate, getCurrentSession);
//              ↑
//          Middleware!
```

**What happens:**
1. Express matches `GET /me`
2. **First** runs `authenticate` middleware
3. **If middleware passes**, then runs `getCurrentSession`

***

### Step 2: Auth Middleware - Verify JWT

**File:** `backend/src/middleware/auth.js`

```javascript
async function authenticate(req, res, next) {
    try {
        // Line 15: Extract token from Authorization header
        const authHeader = req.headers.authorization;
        // authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Access token required',
            });
        }
        // ✅ Token present

        // Line 23: Remove "Bearer " prefix
        const token = authHeader.substring(7);
        // token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

        // Line 27: Verify JWT signature
        const decoded = tokenService.verifyToken(token);
        // decoded = { sessionId: "67a1b2c3d4e5f6789012345", type: "personalization", exp: 1710182800 }
```

**File:** `backend/src/services/tokenService.js`

```javascript
verifyToken(token) {
    try {
        // Line 42: Verify JWT signature and expiration
        const decoded = jwt.verify(token, config.jwt.secret);
        // Throws error if:
        // - Invalid signature
        // - Token expired
        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Token has expired');
        }
        throw new Error('Invalid token');
    }
}
```

**What happens:**
1. Extracts JWT from `Authorization: Bearer <token>`
2. Verifies signature using `JWT_SECRET`
3. Checks expiration (7 days)
4. Decodes payload: `{ sessionId: "67a1b2c3d4e5f6789012345" }`

***

### Step 3: Auth Middleware - Find Session

**File:** `backend/src/middleware/auth.js` (continued)

```javascript
        // Line 32: Find session by MongoDB _id from JWT payload
        const session = await sessionRepository.findById(decoded.sessionId);

        if (!session) {
            return res.status(401).json({
                success: false,
                error: 'Session not found or invalid token',
            });
        }
        // ✅ Session found

        // Line 41: Attach session info to request
        req.user = {
            sessionId: session._id.toString(),
            email: session.email,
            jwtToken: session.jwtToken,
        };

        next(); // ✅ Pass to next middleware/controller
```

**What happens:**
1. Calls `sessionRepository.findById()` to verify session exists
2. Attaches `req.user` with session data
3. Calls `next()` → passes control to `getCurrentSession`

***

### Step 4: Controller - Get Session Data

**File:** `backend/src/controllers/sessionController.js`

```javascript
async function getCurrentSession(req, res, next) {
    try {
        // Line 78: Get sessionId from auth middleware
        const { sessionId } = req.user;
        // sessionId = "67a1b2c3d4e5f6789012345"

        // Line 82: Fetch session from database
        const session = await sessionRepository.findById(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found',
            });
        }
        // ✅ Session found

        // Line 92: Send response
        res.json({
            success: true,
            data: {
                sessionId: session._id.toString(),
                email: session.email,
                productSku: session.productSku,
                status: session.status,
                personalizationLink: `${config.frontendUrl}/personalize-now?token=${session.jwtToken}`,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
            },
        });
    } catch (error) {
        console.error('Get current session error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get session',
        });
    }
}
```

**What happens:**
1. Gets `sessionId` from `req.user` (set by auth middleware)
2. Fetches session from MongoDB
3. Returns session data with personalization link

***

## 📊 COMPLETE CALL CHAIN (GET SESSION)

```
GET /api/v1/sessions/me
  ↓
app.js (middleware)
  ↓
routes/sessions.js (router.get('/me', authenticate, getCurrentSession))
  ↓
middleware/auth.js (authenticate) ←←← FIRST
  ├─→ Extract JWT from Authorization header
  ├─→ services/tokenService.js (verifyToken)
  │   └─→ jwt.verify() (signature + expiration check)
  ├─→ repositories/sessionRepository.js (findById)
  │   └─→ MongoDB (FINDONE by _id)
  └─→ req.user = { sessionId, email, jwtToken }
  ↓
controllers/sessionController.js (getCurrentSession) ←←← SECOND
  ├─→ repositories/sessionRepository.js (findById)
  │   └─→ MongoDB (FINDONE by _id)
  └─→ res.json({...})
```

***

# ⚠️ NEGATIVE PATHS (Error Handling)

## Error 1: Missing Email/ProductSku

**Request:** `POST /api/v1/sessions` with `{ email: "test@example.com" }` (missing productSku)

```
createSession()
  ↓
if (!email || !productSku) → TRUE
  ↓
return res.status(400).json({ success: false, error: 'Email and productSku are required' })
  ↓
✅ Response sent immediately (no further execution)
```

***

## Error 2: Invalid Email Format

**Request:** `POST /api/v1/sessions` with `{ email: "invalid-email", productSku: "hat" }`

```
createSession()
  ↓
emailRegex.test(email) → FALSE
  ↓
return res.status(400).json({ success: false, error: 'Invalid email format' })
  ↓
✅ Response sent immediately
```

***

## Error 3: Missing JWT Token

**Request:** `GET /api/v1/sessions/me` without Authorization header

```
authenticate()
  ↓
!authHeader || !authHeader.startsWith('Bearer ') → TRUE
  ↓
return res.status(401).json({ success: false, error: 'Access token required' })
  ↓
✅ getCurrentSession() NEVER executes
```

***

## Error 4: Invalid JWT Signature

**Request:** `GET /api/v1/sessions/me` with tampered JWT

```
authenticate()
  ↓
tokenService.verifyToken(token)
  ↓
jwt.verify(token, config.jwt.secret) → throws Error
  ↓
catch { throw new Error('Invalid token') }
  ↓
return res.status(401).json({ success: false, error: 'Invalid token' })
  ↓
✅ getCurrentSession() NEVER executes
```

***

## Error 5: Token Expired

**Request:** `GET /api/v1/sessions/me` with JWT older than 7 days

```
authenticate()
  ↓
tokenService.verifyToken(token)
  ↓
jwt.verify(token, config.jwt.secret) → throws TokenExpiredError
  ↓
catch { throw new Error('Token has expired') }
  ↓
return res.status(401).json({ success: false, error: 'Token has expired' })
  ↓
✅ getCurrentSession() NEVER executes
```

***

## Error 6: MongoDB Connection Failed

**Scenario:** MongoDB not running

```
server.js (startServer)
  ↓
connectDatabase()
  ↓
mongoose.connect(config.mongodb.uri) → throws Error
  ↓
console.error('❌ MongoDB connection failed:', error.message)
  ↓
process.exit(1) ← Server doesn't start
```

***

## Error 7: Email Sending Fails

**Scenario:** SMTP credentials wrong

```
createSession()
  ↓
emailService.sendPersonalizationEmail(session).catch(err => {
    console.error('Email sending failed:', err);
})
  ↓
✅ Session IS created (email failure doesn't block)
✅ Response sent to client
⚠️ Email logged as failure in console
```

**Why `.catch()`?** Email is non-blocking - session creation shouldn't fail if email fails.

***

# 🎯 KEY ARCHITECTURAL DECISIONS EXPLAINED

## 1. **Why Layered Architecture?**

```
routes → controllers → services → repositories → models
```

| Layer | Responsibility | Why Separate? |
|-------|---------------|---------------|
| **routes** | URL mapping | Easy to add/remove endpoints |
| **controllers** | HTTP concerns (req/res, validation) | Can swap Express for Fastify |
| **services** | Business logic | Can test without HTTP |
| **repositories** | Data access | Can swap MongoDB for PostgreSQL |
| **models** | Schema/validation | Mongoose-specific code isolated |

***

## 2. **Why Two Tokens (UUID + JWT)?**

| Token | Purpose | Stored Where | Lifetime |
|-------|---------|--------------|----------|
| **UUID** | Database identifier | MongoDB `jwtToken` field | 7 days (TTL) |
| **JWT** | API authentication | Browser `localStorage` | 7 days (exp claim) |

**UUID:** Public, non-guessable identifier for session in DB  
**JWT:** Stateless authentication for protected API calls

***

## 3. **Why Non-Blocking Email?**

```javascript
emailService.sendPersonalizationEmail(session).catch(err => {
    console.error('Email sending failed:', err);
});
// NO await!
```

**Why?**
- Email can fail (SMTP down, network issue)
- User should still get session created
- **In production:** Queue email via BullMQ for retry

***

## 4. **Why TTL Index?**

```javascript
sessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });
```

**Why?**
- MongoDB auto-deletes old sessions
- No cron job needed
- No manual cleanup code
- Saves storage automatically

***

## 5. **Why Auth Middleware Separation?**

```javascript
router.get('/me', authenticate, getCurrentSession);
```

**Why?**
- Reusable across routes
- Fails fast (stops before controller if unauthenticated)
- Clean separation of concerns
- Easy to test

***

# 📁 FILE NAVIGATION GUIDE

## To Add New Endpoint:

1. **Add route:** `backend/src/routes/sessions.js`
   ```javascript
   router.post('/upload', authenticate, uploadImage);
   ```

2. **Add controller:** `backend/src/controllers/sessionController.js`
   ```javascript
   async function uploadImage(req, res) { ... }
   ```

3. **Add service (if needed):** `backend/src/services/imageService.js`

4. **Add repository (if needed):** `backend/src/repositories/sessionRepository.js`

***

## To Add New Provider:

1. **Create provider:** `backend/src/providers/s3StorageProvider.js`
2. **Update factory:** `backend/src/providers/index.js`
   ```javascript
   function getStorageProvider() {
       return new S3StorageProvider(); // Instead of LocalStorageProvider
   }
   ```

***

## To Change Database:

1. Replace `backend/src/repositories/sessionRepository.js`
2. Keep controller/service unchanged
3. **Test:** Controllers don't care about database implementation

***

# 🎬 COMPLETE STORY SUMMARY

**User Journey:**

1. **User opens homepage** → Frontend loads
2. **User submits form** → `POST /api/v1/sessions`
3. **Backend validates** → Email + SKU OK
4. **Backend creates session** → MongoDB INSERT
5. **Backend generates JWT** → For future API calls
6. **Backend sends email** → SMTP (non-blocking)
7. **Backend responds** → 201 + session data
8. **Frontend shows success** → "Personalize Now" button
9. **User clicks button** → `GET /api/v1/sessions/me` with JWT
10. **Backend verifies JWT** → Auth middleware
11. **Backend fetches session** → MongoDB FINDONE
12. **Backend responds** → Session data + status
13. **Frontend shows page** → "Phase 2 Coming Soon!"

**7 days later:** MongoDB auto-deletes session (TTL)

***

**This is Phase 1 complete!** Ready for Phase 2 (image upload)? 🚀