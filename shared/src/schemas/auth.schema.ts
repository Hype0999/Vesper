import { z } from 'zod';

// Setup Initialization Schema
export const SetupInitializeSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters')
      .max(32, 'Username cannot exceed 32 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and dashes'),
    password: z.string().min(8, 'Account password must be at least 8 characters'),
    passwordConfirm: z.string(),
    vaultPassword: z.string().min(8, 'Vault passphrase must be at least 8 characters'),
    vaultPasswordConfirm: z.string(),
    appName: z.string().trim().max(50).optional(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Account passwords do not match',
    path: ['passwordConfirm'],
  })
  .refine((data) => data.vaultPassword === data.vaultPasswordConfirm, {
    message: 'Vault passphrases do not match',
    path: ['vaultPasswordConfirm'],
  })
  .refine((data) => data.password !== data.vaultPassword, {
    message: 'Vault passphrase must be different from account password for step-up security',
    path: ['vaultPassword'],
  });

export type SetupInitializeInput = z.infer<typeof SetupInitializeSchema>;

// Login Schema
export const LoginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// User Profile
export interface UserProfile {
  id: string;
  username: string;
  role?: 'admin' | 'member' | 'guest';
}

export const CreateUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username cannot exceed 32 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and dashes'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'member', 'guest']).default('member'),
  vaultPassword: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// Setup Status
export interface SetupStatus {
  isInitialized: boolean;
  appName?: string;
}
