import { z } from 'zod';

export const VaultUnlockSchema = z.object({
  vaultPassword: z.string().min(1, 'Vault passphrase is required'),
});

export type VaultUnlockInput = z.infer<typeof VaultUnlockSchema>;

export interface VaultStatus {
  isUnlocked: boolean;
  remainingSeconds: number;
}
