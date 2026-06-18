import { isCompleted } from '@/db/progress';
const RESUME_FLOOR_MS = 5_000;
export function shouldResume(positionMs: number, percent: number): boolean {
  return positionMs > RESUME_FLOOR_MS && !isCompleted(percent);
}
