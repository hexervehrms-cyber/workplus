/**
 * File Upload Validator Middleware
 * Validates file uploads for type, size, and MIME type
 */

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif'];

// Allowed MIME types
const ALLOWED_MIME_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif'
};

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5242880 bytes

/**
 * Validate file upload
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const fileValidator = (req, res, next) => {
  try {
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select a file to upload.'
      });
    }

    const file = req.file;

    // Get file extension
    const fileExtension = file.originalname.split('.').pop().toLowerCase();

    // Validate file extension
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return res.status(400).json({
        success: false,
        message: `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
      });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      return res.status(400).json({
        success: false,
        message: `Invalid MIME type. File appears to be corrupted or of unsupported type.`
      });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(1);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return res.status(413).json({
        success: false,
        message: `File size (${fileSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB).`
      });
    }

    // Validate filename for security (prevent path traversal)
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename. Filenames cannot contain path separators.'
      });
    }

    // All validations passed
    next();
  } catch (error) {
    console.error('File validation error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during file validation.'
    });
  }
};

export default fileValidator;
