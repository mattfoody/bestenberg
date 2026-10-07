/**
 * @bestenberg/tokens — design tokens and generators (SCHEMA.md §2, §6).
 */
import tokensJson from './tokens.json';
import { loadTokens, type Tokens } from './load';

export * from './load';
export * from './fluid';
export * from './css-variables';
export * from './theme-json';
export * from './utilities';
export * from './php-export';
export * from './names-module';
export * from './generated/names';

/** The validated default token set. */
export const tokens: Tokens = loadTokens(tokensJson);

/** The raw DTCG document (for tooling that edits tokens). */
export const tokensSource: unknown = tokensJson;
