/**
 * Abstract Storage Service
 * Supports local and MongoDB GridFS file storage with unified interface
 * 
 * Usage:
 * const { uploadFile, getFileStream, deleteFile, fileExists } = storageService;
 * 
 * Environment:
 * - FILE_STORAGE_DRIVER: 'local' | 'mongodb'
 * - MongoDB uses existing MONGODB_URI connection
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import logger from './logger.js';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine storage driver (support aliases: gridfs and mongodb both map to gridfs)
let STORAGE_DRIVER = (process.env.FILE_STORAGE_DRIVER || 'local').toLowerCase();
if (STORAGE_DRIVER === 'mongodb') STORAGE_DRIVER = 'gridfs'; // Alias support

const GRIDFS_BUCKET = process.env.GRIDFS_BUCKET || 'workplus_uploads';
let gridFSBucket = null;

// ============================================================================
// MONGODB GRIDFS INITIALIZATION (lazy-loaded only if needed)
// ============================================================================

const initializeGridFS = async () => {
  if (STORAGE_DRIVER !== 'gridfs') return null;
  
  if (gridFSBucket) return gridFSBucket;

  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection not established');
    }

    const { GridFSBucket } = await import('mongodb');
    gridFSBucket = new GridFSBucket(db, { bucketName: GRIDFS_BUCKET });

    logger.info(`✅ MongoDB GridFS storage initialized (bucket: ${GRIDFS_BUCKET})`);
    return gridFSBucket;
  } catch (error) {
    logger.error('❌ Failed to initialize GridFS:', error.message);
    throw error;
  }
};

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

const ensureLocalDir = (folderPath) => {
  const fullPath = path.join(__dirname, '..', 'uploads', folderPath);
  const dir = path.dirname(fullPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  return fullPath;
};

// ============================================================================
// MONGODB GRIDFS HELPERS
// ============================================================================

const sanitizeGridFSFilename = (filename) => {
  // GridFS doesn't like special characters, keep it simple
  return filename.replace(/[^a-z0-9._-]/gi, '_');
};

// ============================================================================
// STORAGE SERVICE API
// ============================================================================

export const storageService = {
  /**
   * Get configured storage driver
   */
  getDriver: () => STORAGE_DRIVER,

  /**
   * Upload file to configured storage
   * @param {Object} params - Upload parameters
   * @param {Buffer} params.buffer - File buffer
   * @param {string} params.folder - Folder path (e.g., 'receipts', 'documents', 'avatars')
   * @param {string} params.fileName - File name (should be sanitized)
   * @param {string} params.mimeType - MIME type
   * @param {number} params.size - File size in bytes
   * @returns {Promise<Object>} - { storageKey, driver, originalFileName, mimeType, size }
   */
  uploadFile: async (params) => {
    const { buffer, folder, fileName, mimeType, size } = params;

    if (!buffer || !folder || !fileName) {
      throw new Error('Missing required parameters: buffer, folder, fileName');
    }

    logger.info(`📤 Uploading file: ${fileName} to ${folder} (driver: ${STORAGE_DRIVER})`);

    try {
      if (STORAGE_DRIVER === 'local') {
        // Local storage: write to backend/uploads/{folder}/{fileName}
        const localPath = ensureLocalDir(folder);
        const fullPath = path.join(localPath, fileName);

        fs.writeFileSync(fullPath, buffer);

        const storageKey = `${folder}/${fileName}`;
        logger.info(`✅ File uploaded locally: ${storageKey}`);

        return {
          storageKey,
          driver: 'local',
          originalFileName: fileName,
          mimeType,
          size: buffer.length,
          uploadedAt: new Date().toISOString(),
        };
      } else if (STORAGE_DRIVER === 'gridfs') {
        // MongoDB GridFS storage
        const bucket = await initializeGridFS();
        const gridFSFilename = sanitizeGridFSFilename(`${folder}/${fileName}`);

        // Upload to GridFS
        const uploadStream = bucket.openUploadStream(gridFSFilename, {
          metadata: {
            folder,
            originalName: fileName,
            mimeType,
            uploadTime: new Date().toISOString(),
          },
        });

        await new Promise((resolve, reject) => {
          uploadStream.on('finish', resolve);
          uploadStream.on('error', reject);
          uploadStream.write(buffer);
          uploadStream.end();
        });

        const fileId = uploadStream.id.toString();
        logger.info(`✅ File uploaded to MongoDB GridFS: ${gridFSFilename} (ID: ${fileId})`);

        return {
          storageKey: fileId, // Store MongoDB ObjectId as storage key
          driver: 'mongodb',
          originalFileName: fileName,
          mimeType,
          size: buffer.length,
          uploadedAt: new Date().toISOString(),
        };
      } else {
        throw new Error(`Unknown storage driver: ${STORAGE_DRIVER}`);
      }
    } catch (error) {
      logger.error('❌ File upload failed:', error.message);
      throw error;
    }
  },

  /**
   * Get file stream for download
   * @param {string} storageKey - Storage key (folder/fileName for local or MongoDB ObjectId for mongodb)
   * @param {string} driver - Storage driver ('local' or 'mongodb')
   * @returns {Promise<Stream>} - Readable stream
   */
  getFileStream: async (storageKey, driver = 'local') => {
    if (!storageKey) {
      throw new Error('Storage key is required');
    }

    logger.info(`📥 Retrieving file: ${storageKey} (driver: ${driver})`);

    try {
      if (driver === 'local' || STORAGE_DRIVER === 'local') {
        // Local storage: read from backend/uploads/
        const fullPath = path.join(__dirname, '..', 'uploads', storageKey);
        
        // Security: prevent path traversal
        const uploadsDir = path.resolve(path.join(__dirname, '..', 'uploads'));
        const resolvedPath = path.resolve(fullPath);
        
        if (!resolvedPath.startsWith(uploadsDir)) {
          throw new Error('Invalid storage key: path traversal detected');
        }

        if (!fs.existsSync(resolvedPath)) {
          throw new Error('File not found: ' + storageKey);
        }

        return fs.createReadStream(resolvedPath);
      } else if (driver === 'gridfs' || driver === 'mongodb' || STORAGE_DRIVER === 'gridfs') {
        // MongoDB GridFS storage
        const bucket = await initializeGridFS();
        const { ObjectId } = await import('mongodb');

        try {
          const objectId = new ObjectId(storageKey);
          const downloadStream = bucket.openDownloadStream(objectId);
          return downloadStream;
        } catch (error) {
          throw new Error('File not found: Invalid storage key format or file does not exist');
        }
      } else {
        throw new Error(`Unknown storage driver: ${driver}`);
      }
    } catch (error) {
      logger.error('❌ File retrieval failed:', error.message);
      throw error;
    }
  },

  /**
   * Check if file exists
   * @param {string} storageKey - Storage key
   * @param {string} driver - Storage driver
   * @returns {Promise<boolean>}
   */
  fileExists: async (storageKey, driver = 'local') => {
    try {
      if (driver === 'local' || STORAGE_DRIVER === 'local') {
        const fullPath = path.join(__dirname, '..', 'uploads', storageKey);
        return fs.existsSync(fullPath);
      } else if (driver === 'gridfs' || driver === 'mongodb' || STORAGE_DRIVER === 'gridfs') {
        const bucket = await initializeGridFS();
        const { ObjectId } = await import('mongodb');

        try {
          const objectId = new ObjectId(storageKey);
          const files = await bucket.find({ _id: objectId }).toArray();
          return files.length > 0;
        } catch {
          return false;
        }
      }
      return false;
    } catch (error) {
      logger.error('❌ File existence check failed:', error.message);
      return false;
    }
  },

  /**
   * Delete file from storage
   * @param {string} storageKey - Storage key
   * @param {string} driver - Storage driver
   * @returns {Promise<boolean>} - Success
   */
  deleteFile: async (storageKey, driver = 'local') => {
    if (!storageKey) {
      throw new Error('Storage key is required');
    }

    logger.info(`🗑️  Deleting file: ${storageKey} (driver: ${driver})`);

    try {
      if (driver === 'local' || STORAGE_DRIVER === 'local') {
        const fullPath = path.join(__dirname, '..', 'uploads', storageKey);
        
        // Security: prevent path traversal
        const uploadsDir = path.resolve(path.join(__dirname, '..', 'uploads'));
        const resolvedPath = path.resolve(fullPath);
        
        if (!resolvedPath.startsWith(uploadsDir)) {
          throw new Error('Invalid storage key: path traversal detected');
        }

        if (fs.existsSync(resolvedPath)) {
          fs.unlinkSync(resolvedPath);
          logger.info(`✅ File deleted locally: ${storageKey}`);
          return true;
        }
        return false;
      } else if (driver === 'gridfs' || driver === 'mongodb' || STORAGE_DRIVER === 'gridfs') {
        const bucket = await initializeGridFS();
        const { ObjectId } = await import('mongodb');

        try {
          const objectId = new ObjectId(storageKey);
          await bucket.delete(objectId);
          logger.info(`✅ File deleted from GridFS: ${storageKey}`);
          return true;
        } catch (error) {
          if (error.message.includes('not found')) {
            return false;
          }
          throw error;
        }
      }
      return false;
    } catch (error) {
      logger.error('❌ File deletion failed:', error.message);
      throw error;
    }
  },

  /**
   * Get download URL (not applicable for MongoDB GridFS)
   * GridFS files are always downloaded via authenticated endpoint
   * @returns {Promise<null>}
   */
  getSignedUrl: async () => {
    // GridFS doesn't support signed URLs - files always accessed via authenticated endpoint
    return null;
  },

  /**
   * Migrate file from old path to new storage
   * Useful for backward compatibility during transition
   * @param {string} oldLocalPath - Old local path (e.g., receipts/file.pdf)
   * @param {string} folder - New folder (e.g., 'receipts')
   * @returns {Promise<Object>} - { storageKey, driver, ... }
   */
  migrateFile: async (oldLocalPath, folder) => {
    try {
      const fullPath = path.join(__dirname, '..', 'uploads', oldLocalPath);

      if (!fs.existsSync(fullPath)) {
        logger.warn(`⚠️  File not found for migration: ${oldLocalPath}`);
        return null;
      }

      const buffer = fs.readFileSync(fullPath);
      const fileName = path.basename(fullPath);
      const mimeType = 'application/octet-stream'; // Fallback MIME type

      const result = await storageService.uploadFile({
        buffer,
        folder,
        fileName,
        mimeType,
        size: buffer.length,
      });

      logger.info(`✅ File migrated: ${oldLocalPath} → ${result.storageKey}`);
      return result;
    } catch (error) {
      logger.error('❌ File migration failed:', error.message);
      throw error;
    }
  },
};

export default storageService;
