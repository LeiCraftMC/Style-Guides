import { sql } from 'drizzle-orm';

import {
    sqliteTable,
    integer,
    text,
} from 'drizzle-orm/sqlite-core';
import { SQLUtils } from './utils';
import { UserAccountSettings } from '../lib/api/utils/shared-models/accountData';

/**
 * @deprecated Use DB.Tables.users to access this table.
 */
export const users = sqliteTable('users', {
    id: SQLUtils.primaryKeyIntAutoIncrement("id"),

    username: text().notNull().unique(),
    display_name: text().notNull(),
    email: text().notNull().unique(),
    password_hash: text().notNull(),

    role: text({
        enum: UserAccountSettings.Roles
    }).default("user").notNull(),

    created_at: SQLUtils.getCreatedAtColumn(),
});

/**
 * @deprecated Use DB.Tables.passwordResets to access this table.
 */
export const passwordResets = sqliteTable('password_resets', {
    token: text().primaryKey(),
    user_id: integer().notNull().references(() => users.id, { onDelete: 'cascade' }),
    created_at: SQLUtils.getCreatedAtColumn(),
    expires_at: integer().notNull()
});

/**
 * @deprecated Use DB.Tables.sessions to access this table.
 */
export const sessions = sqliteTable('sessions', {
    id: text().primaryKey(),
    hashed_token: text().notNull(),
    user_id: integer().notNull().references(() => users.id, { onDelete: 'cascade' }),
    // we cache user role here for easier permission checking without having to join the users table, and we will check the role in users table on every update to make sure it's still valid
    user_role: text({
        enum: UserAccountSettings.Roles
    }).notNull(),
    created_at: SQLUtils.getCreatedAtColumn(),
    expires_at: integer().notNull()
});



/**
 * @deprecated Use DB.Tables.tmp_data to access this table.
 */
export const metadata = sqliteTable('metadata', {
    key: text().primaryKey(),
    data: text({ mode: 'json' }).$type<Record<string, any> | Array<any>>().notNull()
});

