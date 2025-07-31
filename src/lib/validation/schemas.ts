
import { z } from 'zod';

// File validation schemas
export const fileUploadSchema = z.object({
  name: z.string().min(1, 'File name is required').max(255, 'File name too long'),
  size: z.number().min(1, 'File size must be positive').max(100 * 1024 * 1024, 'File too large (max 100MB)'),
  type: z.string().min(1, 'File type is required'),
  parentFolderId: z.string().uuid().optional().nullable(),
});

export const folderCreateSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(255, 'Folder name too long')
    .regex(/^[^<>:"/\\|?*]+$/, 'Invalid characters in folder name'),
  parentFolderId: z.string().uuid().optional().nullable(),
});

export const fileShareSchema = z.object({
  fileId: z.string().uuid('Invalid file ID'),
  email: z.string().email('Invalid email address'),
  permissionLevel: z.enum(['view', 'edit', 'admin']),
  expiresAt: z.string().datetime().optional().nullable(),
});

// API Key validation schemas
export const apiKeyCreateSchema = z.object({
  name: z.string().min(1, 'API key name is required').max(100, 'Name too long'),
  permissions: z.array(z.enum(['read', 'write', 'delete', 'admin'])).min(1, 'At least one permission required'),
  expiresAt: z.string().datetime().optional().nullable(),
});

// User profile validation
export const profileUpdateSchema = z.object({
  display_name: z.string().min(1, 'Display name is required').max(100, 'Display name too long').optional(),
  avatar_url: z.string().url('Invalid avatar URL').optional().nullable(),
});

// Provider connection schemas
export const providerConnectionSchema = z.object({
  providerName: z.string().min(1, 'Provider name is required'),
  credentials: z.record(z.string(), z.any()).refine(
    (data) => Object.keys(data).length > 0,
    'Credentials are required'
  ),
});

export const validateFileUpload = (data: unknown) => fileUploadSchema.parse(data);
export const validateFolderCreate = (data: unknown) => folderCreateSchema.parse(data);
export const validateFileShare = (data: unknown) => fileShareSchema.parse(data);
export const validateApiKeyCreate = (data: unknown) => apiKeyCreateSchema.parse(data);
export const validateProfileUpdate = (data: unknown) => profileUpdateSchema.parse(data);
export const validateProviderConnection = (data: unknown) => providerConnectionSchema.parse(data);
