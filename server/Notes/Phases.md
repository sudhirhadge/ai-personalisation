You are a Principal MERN Architect.
We are building an AI Personalization Microsite.
IMPORTANT RULES:
Generate ONLY the requested phase.
The generated code must be runnable.
Do not generate placeholders.
Do not skip files.
Show complete file contents.
Include package.json.
Include .env.example.
Include folder structure first.
Add code comments explaining important architectural decisions.
Use production-grade patterns.
Use JavaScript (not TypeScript).
Backend and frontend must be separate applications.
Express + MongoDB + Mongoose.
React + Vite frontend.
Layered architecture:
routes → controllers → services → repositories → models
Future architecture must support:
StorageProvider
EmailProvider
AIProvider
BullMQ Queue
S3
Redis
Even if not implemented yet, structure folders for future extensibility.
At the end provide:
Setup steps
Run commands
API testing examples
Manual testing checklist
Generate ONLY the requested phase.
Wait for the next phase request before continuing.
Phase 1 Prompt
Copy the master prompt above, then add:
PHASE 1
Goal:
User enters:
email
productSku
Backend:
POST /api/v1/sessions
Requirements:
Create personalization session
Generate JWT deep-link token
Save session in MongoDB
TTL expiry 7 days
Send email through EmailProvider abstraction
Use Nodemailer implementation for development
Store session status = CREATED
Frontend:
CreateSession page
Form for email + productSku
Submit session request
Success screen showing generated personalization link
Endpoints:
POST /api/v1/sessions
GET /api/v1/sessions/me
Generate complete runnable code for Phase 1 only.
Phase 2 Prompt
After Phase 1 works:

PHASE 2
Use the Phase 1 codebase.
Requirements:
Implement image upload.
Create:
StorageProvider
LocalStorageProvider
Backend:
POST /api/v1/sessions/me/upload
Use:
Multer
File validation
Max size 10MB
JPG PNG WEBP only
Store files under:
uploads/originals
Save metadata in Mongo:
{
url,
fileName,
mimeType,
size
}
Update session status:
CREATED → UPLOADED
Frontend:
PersonaliseNow page
Requirements:
Read token from URL
Load session
Upload image
Show image preview
Generate complete runnable code for Phase 2 only.
Do not regenerate unchanged files.
Show only new and modified files.

Phase 3 Prompt
PHASE 3
Use existing codebase.
Implement mock AI processing.
Requirements:
Create:
AIProvider
MockAIProvider
POST /api/v1/sessions/me/generate
GET /api/v1/sessions/me/status
Behavior:
Generate returns jobId
Store aiJobId
Session status becomes PROCESSING
Mock AI:
Wait 15 seconds
Copy original image
Save as processed image
Mark DONE
Frontend:
Generate button
Poll every 2 seconds
Show progress UI
States:
UPLOADED
PROCESSING
DONE
FAILED
Generate only changed and new files.
Phase 4 Prompt (BullMQ)
PHASE 4
Replace in-process mock AI with BullMQ.
Requirements:
Add:
Redis
BullMQ
Architecture:
API
→ Queue
→ Worker
→ AI Provider
Worker:
Receives job
Calls MockAIProvider
Updates Mongo
Generate:
docker-compose.yml
Redis configuration
Worker application
Generate only new and modified files.
Phase 5 Prompt (Production)
PHASE 5
Convert project to production-ready architecture.
Add:
S3StorageProvider
ResendEmailProvider
OpenAIProvider abstraction
Health endpoint
Metrics endpoint
Request ID middleware
Structured logging
Dockerfile
Railway deployment
Vercel deployment
Mongo Atlas configuration
Generate:
Architecture diagram
Infrastructure diagram
Production environment variables
Cost estimation for:
10k users
100k users
1 million users
Generate only new and modified files.