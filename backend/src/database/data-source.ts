import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { dbOptions } from './db-options'

/** DataSource cho TypeORM CLI (migration:generate/run/revert). Runtime dùng dbOptions qua AppModule. */
export default new DataSource(dbOptions)
