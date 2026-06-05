import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'

/** 雜湊密碼，回傳 `salt:hash`（hex 格式） */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

/** 驗證密碼是否符合儲存的雜湊 */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const newHash = scryptSync(password, salt, 64).toString('hex')
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(newHash, 'hex'))
  } catch {
    return false
  }
}
