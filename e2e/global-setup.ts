import { execFileSync } from 'node:child_process';
import path from 'node:path';

/** Antes de todos los tests: base *_test limpia con admin, categorías y datos de demo. */
export default function globalSetup() {
  execFileSync('npm', ['run', 'e2e:reset-db'], {
    cwd: path.resolve(import.meta.dirname, '../../FRIDGE_INVENTORY_BACK'),
    stdio: 'inherit',
  });
}
