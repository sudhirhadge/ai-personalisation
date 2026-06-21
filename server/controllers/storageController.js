/**
 * Storage Controller
 * Handles HTTP requests for file uploads
 * 
 * Architectural Decision:
 * - Controller handles only HTTP concerns
 * - Uses StorageService for business logic
 * - Validates file in middleware
 */
const storageService = require('../services/storageService');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Multer middleware for single file upload
// Think of Multer as a body-parser for files. It processes multipart/form-data requests and makes the uploaded file available in req.file.
/*
Express can parse:

{
  "name": "Sudhir"
}

But it cannot parse uploaded files.
Multer sits between the HTTP request and your controller:

Browser
   ↓
multipart/form-data
   ↓
Multer
   ↓
req.file / req.files
   ↓
Controller

when uploadMiddleware(req, res, callback) runs ; 
Multer:

Reads incoming file stream
Validates file type
Validates file size
Creates filename
Saves file to disk
Populates req.file
Calls callback

Only then does your code continue.
*/
const uploadMiddleware = multer({
    storage: multer.diskStorage({
        destination: (req, res, cb) => {
            const uploadDir = path.join(process.cwd(), 'uploads', 'originals');
            cb(null, uploadDir); // "Where should I save this file?" - multer i aking this question to the diskStorage engine, which then calls this function to determine the destination directory for the uploaded file. The callback cb is called with the upload directory path, allowing multer to save the file in the correct location on the server's filesystem.
        },
        /* Signature:
            destination(req, file, cb)
            filename(req, file, cb)
            fileFilter(req, file, cb)
            Even if you don't need them.
            Exactly like:
            array.map((item, index) => item)
            Sometimes:
            array.map((item) => item)
            You ignore index.
            Same idea.
            sometimes ->
            destination(req, file, cb) {
            cb(null, `uploads/${req.user.sessionId}`);
            }
            filename(req, file, cb) {
            cb(null, `${req.user.sessionId}-${file.originalname}`);
            }
            fileFilter(req, file, cb) {
            if(req.user.role !== 'premium'){
            return cb(new Error('Upgrade required'));
            }
            cb(null, true);
            }
        */
        filename: (req, file, cb) => {
            const uniqueName = `${uuidv4()}-${file.originalname}`; // "What should I name this file?" - multer is asking the diskStorage engine to determine the filename for the uploaded file. The callback cb is called with a unique filename generated using uuidv4 and the original filename, ensuring that each uploaded file has a distinct name to prevent overwriting existing files.
            cb(null, uniqueName);
        }
    }),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    },
    fileFilter: (req, file, cb) => { // "Should I accept this file?" - multer is asking the fileFilter function to validate the uploaded file's type. The callback cb is called with a boolean value indicating whether the file should be accepted (true) or rejected (false) based on its MIME type. This allows you to enforce restrictions on the types of files that can be uploaded to your server.
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true); // if the file type is valid, we call cb with (null, true) to indicate that the file should be accepted and processed by multer. This allows the upload to proceed and the file to be saved to disk according to the storage configuration defined earlier.
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG, and WEBP are allowed.'));
        }
    }
}).single('image');

/**
 * POST /api/v1/sessions/me/upload
 * Upload image for personalization session
 * Protected endpoint (requires JWT)
 * 
 * Request:
 * - Headers: Authorization: Bearer <jwt_token>
 * - Body: multipart/form-data with image field
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     sessionId: string,
 *     status: string,
 *     originalImageUrl: string,
 *     originalImageName: string,
 *     jwtToken: string
 *   }
 * }
 */
async function uploadImage(req, res, next) {
    // this next is used to pass control to the next middleware in case of errors. In this case, we are handling errors within this function and sending responses directly, so we don't call next() with an error. 
    // Instead, we send appropriate HTTP responses based on the type of error encountered (e.g., validation errors, file upload errors, or unexpected server errors). The try-catch block is used to catch any unexpected errors that may occur during the upload process and return a 500 Internal Server Error response.
    // read at the end of the code  
    try {
        // Parse Multer file (must be called before accessing req.file)
        uploadMiddleware(req, res, async (error) => {
            if (error) {
                if (error.message === 'Invalid file type. Only JPG, PNG, and WEBP are allowed.') {
                    return res.status(400).json({
                        success: false,
                        error: error.message
                    });
                }
                if (error.message.startsWith('Too large')) {
                    return res.status(400).json({
                        success: false,
                        error: 'File too large. Maximum size is 10MB'
                    });
                }
                // for other multer errors or unexpected errors, return generic error message
                return res.status(400).json({
                    success: false,
                    error: error.message || 'File upload failed'
                });
            }

            // Check if file was uploaded
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No image provided. Please upload an image file.'
                });
            }
            /*
                Browser
                ↓
                Raw binary stream
                ↓
                Node Request Stream
                ↓
                ??? nobody parsed it
                ↓
                Your controller
            */
            // req.file // undefined without multer middleware. multer populates req.file with the uploaded file's metadata (e.g., filename, originalname, encoding, mimetype, size). This allows us to access the uploaded file's information and pass it to the storageService for further processing (e.g., saving to disk, generating URLs, etc.).
            /*console.log('Uploaded file info:', req.file); // Log uploaded file metadata for debugging
                Uploaded file info: {
                fieldname: 'image',
                originalname: 'Screenshot 2026-04-18 081659.png',
                encoding: '7bit',
                mimetype: 'image/png',
                path: 'F:\\Sudhir Learning\\ai-personlisation\\server\\uploads\\originals\\a8f093ec-748a-44e4-9243-b38d89a83d35-Screenshot 2026-04-18 081659.png',
                destination: 'F:\\Sudhir Learning\\ai-personlisation\\server\\uploads\\originals',
                filename: 'a8f093ec-748a-44e4-9243-b38d89a83d35-Screenshot 2026-04-18 081659.png',
                size: 30403
                }
            */
            // Get sessionId from JWT (set by auth middleware)
            const { sessionId } = req.user;

            // Upload image
            const result = await storageService.uploadImage(req.file, sessionId);

            res.json({
                success: true,
                data: result.data
            });
        });
    } catch (error) {
        console.error('Upload image error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload image'
        });
    }
}

/**
 * DELETE /api/v1/sessions/me/image
 * Delete uploaded image
 * Protected endpoint (requires JWT)
 * 
 * Response:
 * {
 *   success: true
 * }
 */
async function deleteImage(req, res, next) {
    try {
        const { sessionId } = req.user;

        const result = await storageService.deleteImage(sessionId);

        res.json(result);
    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete image'
        });
    }
}

module.exports = {
    uploadImage,
    deleteImage
};

/*
So currently:

async function uploadImage(req, res, next)

could simply be:

async function uploadImage(req, res)

and nothing would break.

When would next be useful here?

If you had a centralized error handler:

uploadMiddleware(req, res, async (error) => {
    if (error) {
        return next(error);
    }
});

and

catch (error) {
    next(error);
}

Then all errors would be handled in one place:

app.use((err, req, res, next) => {
    res.status(500).json({
        success: false,
        error: err.message
    });
});
Interview answer

next is an Express middleware function used to pass control to the next middleware or 
forward errors to a centralized error handler. 
In this controller it is currently unused because the function sends responses directly instead of calling next() or next(error). 
Therefore, the parameter could be removed unless we plan to use centralized error handling later.
*/