import type { Database } from '../infrastructure/db/index.ts';
import type { ObjectStorage } from '../infrastructure/storage/index.ts';
import { RepositorySet } from '../repositories/repository-set.ts';

/** Base of the services: repositories on the plain database, and a way to rebind them to a transaction. */
export abstract class StudioService {
  protected readonly repos: RepositorySet;

  protected constructor(
    protected readonly db: Database,
    protected readonly storage: ObjectStorage,
  ) {
    this.repos = RepositorySet.on(db, storage);
  }

  protected inTransaction<T>(work: (repos: RepositorySet) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(RepositorySet.on(tx, this.storage)));
  }
}
