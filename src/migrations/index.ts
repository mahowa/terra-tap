import * as migration_20260624_170654 from './20260624_170654';
import * as migration_20260723_200607_results_and_roles from './20260723_200607_results_and_roles';

export const migrations = [
  {
    up: migration_20260624_170654.up,
    down: migration_20260624_170654.down,
    name: '20260624_170654',
  },
  {
    up: migration_20260723_200607_results_and_roles.up,
    down: migration_20260723_200607_results_and_roles.down,
    name: '20260723_200607_results_and_roles'
  },
];
