import apiFetch from '@wordpress/api-fetch';

/** A page or post the editor can open. */
export interface PostSummary {
  /** Post id, or a template id such as `bestenberg//single`. */
  id: number | string;
  /** REST base of its type: "pages", "posts", "templates" or "template-parts". */
  rest: string;
  title: string;
  status: string;
  /** Public address ('' for templates and parts). */
  link: string;
  /** Templates and parts: the file name without extension (`single-product`). */
  slug?: string;
}

/** Templates and template parts are edited on a bare canvas and need the design capability. */
export function isTemplate(post: Pick<PostSummary, 'rest'>): boolean {
  return post.rest === 'templates' || post.rest === 'template-parts';
}

export interface LoadedPost extends PostSummary {
  /** Block markup as stored. */
  content: string;
}

interface RestPost {
  id: number | string;
  status: string;
  link?: string;
  slug?: string;
  title: { raw?: string; rendered: string };
  content?: { raw?: string };
}

const STATUSES = 'publish,draft,pending,private,future';

function summary(rest: string, post: RestPost): PostSummary {
  return {
    id: post.id,
    rest,
    title: post.title.raw ?? post.title.rendered,
    status: post.status,
    link: post.link ?? '',
    ...(isTemplate({ rest }) && post.slug ? { slug: post.slug } : {}),
  };
}

export function settings(): BestenbergEditorSettings {
  const value = window.bestenbergEditor;
  if (!value) throw new Error('Bestenberg editor settings are missing.');
  return value;
}

/** Pages, posts (most recently changed first) and, for designers, templates and parts. */
export async function listPosts(): Promise<PostSummary[]> {
  const fetchType = async (rest: string) => {
    const posts = await apiFetch<RestPost[]>({
      path: `/wp/v2/${rest}?context=edit&per_page=100&orderby=modified&status=${STATUSES}&_fields=id,status,link,title`,
    });
    return posts.map((post) => summary(rest, post));
  };
  const fetchTemplates = async (rest: string) => {
    if (!settings().canDesign) return [];
    try {
      const templates = await apiFetch<RestPost[]>({
        path: `/wp/v2/${rest}?context=edit&_fields=id,slug,status,title`,
      });
      return templates
        .map((template) => summary(rest, template))
        .sort((a, b) => a.title.localeCompare(b.title));
    } catch {
      return [];
    }
  };
  const lists = await Promise.all([
    fetchType('pages'),
    fetchType('posts'),
    fetchTemplates('templates'),
    fetchTemplates('template-parts'),
  ]);
  return lists.flat();
}

export async function loadPost(rest: string, id: number | string): Promise<LoadedPost> {
  const post = await apiFetch<RestPost>({
    path: `/wp/v2/${rest}/${id}?context=edit&_fields=id,slug,status,link,title,content`,
  });
  return { ...summary(rest, post), content: post.content?.raw ?? '' };
}

export async function savePost(
  rest: string,
  id: number | string,
  content: string,
): Promise<LoadedPost> {
  const post = await apiFetch<RestPost>({
    path: `/wp/v2/${rest}/${id}?context=edit`,
    method: 'POST',
    data: { content },
  });
  return { ...summary(rest, post), content: post.content?.raw ?? content };
}

export async function createPage(title: string): Promise<LoadedPost> {
  const post = await apiFetch<RestPost>({
    path: '/wp/v2/pages?context=edit',
    method: 'POST',
    data: { title, status: 'draft', content: '' },
  });
  return { ...summary('pages', post), content: '' };
}

/** The kind of content a template shows, so its blocks can be previewed with a real example. */
export function samplePostType(slug: string | undefined): string {
  if (!slug) return 'page';
  if (slug === 'single-product') return 'product';
  if (slug.startsWith('page')) return 'page';
  if (slug.startsWith('single')) return 'post';
  return '';
}

/**
 * HTML for block markup only WordPress can render (raw nodes), shown for the
 * post being edited or, in a template, for an example post of the right type.
 */
export async function renderMarkup(markup: string, post: PostSummary | null): Promise<string> {
  const context =
    post === null
      ? {}
      : isTemplate(post)
        ? { postType: samplePostType(post.slug) }
        : { postId: post.id };
  const { html } = await apiFetch<{ html: string }>({
    path: '/bestenberg/v1/render',
    method: 'POST',
    data: { markup, ...context },
  });
  return html;
}

/** Creates the demo pages that do not exist yet; returns the page to open (the front page). */
export async function addDemoPages(): Promise<number> {
  const { front, pages } = await apiFetch<{ front: number; pages: Array<{ id: number }> }>({
    path: '/bestenberg/v1/demo',
    method: 'POST',
  });
  return front > 0 ? front : (pages[0]?.id ?? 0);
}

/** Remembers that this user has seen the introduction for a mode. */
export async function markOnboarded(mode: string): Promise<void> {
  await apiFetch({ path: '/bestenberg/v1/onboarding', method: 'POST', data: { mode } });
}

/** URL of the editing canvas: the post's own page, or a bare page for templates and parts. */
export function canvasUrl(post: PostSummary): string {
  const { homeUrl, canvasArg, canvasNonce } = settings();
  const url = new URL(homeUrl);
  url.searchParams.set(canvasArg, isTemplate(post) ? 'template' : String(post.id));
  url.searchParams.set('_wpnonce', canvasNonce);
  return url.toString();
}

/** Human-readable message from an apiFetch failure. */
export function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string' && message !== '') return message;
  }
  return 'Something went wrong. Check your connection and try again.';
}
