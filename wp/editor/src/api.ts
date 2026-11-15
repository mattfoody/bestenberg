import apiFetch from '@wordpress/api-fetch';

/** A page or post the editor can open. */
export interface PostSummary {
  id: number;
  /** REST base of its type: "pages" or "posts". */
  rest: string;
  title: string;
  status: string;
  link: string;
}

export interface LoadedPost extends PostSummary {
  /** Block markup as stored. */
  content: string;
}

interface RestPost {
  id: number;
  status: string;
  link: string;
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
    link: post.link,
  };
}

export function settings(): BestenbergEditorSettings {
  const value = window.bestenbergEditor;
  if (!value) throw new Error('Bestenberg editor settings are missing.');
  return value;
}

/** Pages first, then posts, most recently changed first. */
export async function listPosts(): Promise<PostSummary[]> {
  const fetchType = async (rest: string) => {
    const posts = await apiFetch<RestPost[]>({
      path: `/wp/v2/${rest}?context=edit&per_page=100&orderby=modified&status=${STATUSES}&_fields=id,status,link,title`,
    });
    return posts.map((post) => summary(rest, post));
  };
  const [pages, posts] = await Promise.all([fetchType('pages'), fetchType('posts')]);
  return [...pages, ...posts];
}

export async function loadPost(rest: string, id: number): Promise<LoadedPost> {
  const post = await apiFetch<RestPost>({
    path: `/wp/v2/${rest}/${id}?context=edit&_fields=id,status,link,title,content`,
  });
  return { ...summary(rest, post), content: post.content?.raw ?? '' };
}

export async function savePost(rest: string, id: number, content: string): Promise<LoadedPost> {
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

/** HTML for block markup only WordPress can render (raw nodes). */
export async function renderMarkup(markup: string): Promise<string> {
  const { html } = await apiFetch<{ html: string }>({
    path: '/bestenberg/v1/render',
    method: 'POST',
    data: { markup },
  });
  return html;
}

/** URL of the editing canvas for a post. */
export function canvasUrl(postId: number): string {
  const { homeUrl, canvasArg, canvasNonce } = settings();
  const url = new URL(homeUrl);
  url.searchParams.set(canvasArg, String(postId));
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
