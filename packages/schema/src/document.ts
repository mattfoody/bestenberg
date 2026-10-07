import { customAlphabet } from 'nanoid';
import { z } from 'zod/v4';
import { ResponsiveStyleSchema, type Breakpoint, type ResponsiveStyle } from './style';

export const SCHEMA_VERSION = 1 as const;

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const makeId = customAlphabet(ID_ALPHABET, 10);

/** New stable node id (10 alphanumeric chars). */
export function createId(): string {
  return makeId();
}

export const IdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{4,64}$/, 'id must be 4–64 chars of A-Z a-z 0-9 _ -');
export const ComponentTypeSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, 'type must be a lowercase registry key');

export const BindingSchema = z.discriminatedUnion('source', [
  z.strictObject({
    source: z.literal('query'),
    postType: z.string().min(1),
    perPage: z.number().int().min(1).max(100),
    orderBy: z.string().optional(),
    filters: z.record(z.string(), z.unknown()).optional(),
  }),
  z.strictObject({
    source: z.literal('woo/product'),
    field: z.enum([
      'title',
      'price',
      'image',
      'gallery',
      'rating',
      'stock',
      'add-to-cart',
      'description',
    ]),
  }),
  z.strictObject({
    source: z.literal('woo/context'),
    kind: z.enum(['cart', 'checkout', 'account', 'order']),
  }),
]);
export type Binding = z.infer<typeof BindingSchema>;

export const LockSchema = z.enum(['none', 'content', 'all']);
export const HiddenSchema = z.strictObject({
  base: z.boolean().optional(),
  tablet: z.boolean().optional(),
  desktop: z.boolean().optional(),
});

/** One element of a document tree (SCHEMA.md §3). */
export interface Node {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  style?: ResponsiveStyle;
  children?: Node[];
  bind?: Binding;
  locked?: 'none' | 'content' | 'all';
  hidden?: Partial<Record<Breakpoint, boolean>>;
}

export const NodeSchema: z.ZodType<Node> = z.lazy(() =>
  z.strictObject({
    id: IdSchema,
    type: ComponentTypeSchema,
    props: z.record(z.string(), z.unknown()).optional(),
    style: ResponsiveStyleSchema.optional(),
    children: z.array(NodeSchema).optional(),
    bind: BindingSchema.optional(),
    locked: LockSchema.optional(),
    hidden: HiddenSchema.optional(),
  }),
);

export const DocKindSchema = z.enum(['page', 'template', 'part', 'pattern']);

export const DocSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  kind: DocKindSchema,
  meta: z.strictObject({
    title: z.string().min(1),
    slug: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]*$/)
      .optional(),
    templateFor: z.string().optional(),
  }),
  root: z.array(NodeSchema),
});

export interface Doc {
  schemaVersion: typeof SCHEMA_VERSION;
  kind: z.infer<typeof DocKindSchema>;
  meta: { title: string; slug?: string; templateFor?: string };
  root: Node[];
}

/** Depth-first walk with the node's path (e.g. `root[0].children[2]`) and parent. */
export function walk(
  nodes: Node[],
  visit: (node: Node, path: string, parent: Node | undefined) => void,
  basePath = 'root',
  parent?: Node,
): void {
  nodes.forEach((node, index) => {
    const path = `${basePath}[${index}]`;
    visit(node, path, parent);
    if (node.children) walk(node.children, visit, `${path}.children`, node);
  });
}
