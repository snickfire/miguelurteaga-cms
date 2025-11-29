import * as migration_20250929_111647 from './20250929_111647';
import * as migration_20251127_193741 from './20251127_193741';
import * as migration_20251129_161956_add_processed_fields_to_media from './20251129_161956_add_processed_fields_to_media';

export const migrations = [
  {
    up: migration_20250929_111647.up,
    down: migration_20250929_111647.down,
    name: '20250929_111647',
  },
  {
    up: migration_20251127_193741.up,
    down: migration_20251127_193741.down,
    name: '20251127_193741',
  },
  {
    up: migration_20251129_161956_add_processed_fields_to_media.up,
    down: migration_20251129_161956_add_processed_fields_to_media.down,
    name: '20251129_161956_add_processed_fields_to_media'
  },
];
