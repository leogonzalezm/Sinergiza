const apiUrl = import.meta.env.WORDPRESS_API_URL?.replace(/\/$/, '');

export const isConfigured = Boolean(apiUrl);

interface WordPressRenderedField {
  rendered: string;
}

interface WordPressEmbeddedMedia {
  source_url?: string;
  alt_text?: string;
}

interface WordPressEmbeddedTerm {
  name?: string;
}

interface WordPressPost {
  id: number;
  slug: string;
  date: string;
  title: WordPressRenderedField;
  excerpt: WordPressRenderedField;
  content?: WordPressRenderedField;
  _embedded?: {
    'wp:featuredmedia'?: WordPressEmbeddedMedia[];
    'wp:term'?: WordPressEmbeddedTerm[][];
  };
}

export interface Article {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  publishedAt: string;
  category?: string;
  coverImage?: {
    url: string;
    alt: string;
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '-');
}

function normalizeArticle(post: WordPressPost): Article {
  const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
  const firstTermGroup = post._embedded?.['wp:term']?.[0];
  const firstCategory = firstTermGroup?.[0]?.name;

  return {
    id: post.id,
    slug: post.slug,
    title: decodeEntities(stripHtml(post.title.rendered)),
    excerpt: decodeEntities(stripHtml(post.excerpt.rendered)),
    content: post.content?.rendered,
    publishedAt: post.date,
    category: firstCategory,
    coverImage: featuredMedia?.source_url
      ? {
          url: featuredMedia.source_url,
          alt: featuredMedia.alt_text || decodeEntities(stripHtml(post.title.rendered)),
        }
      : undefined,
  };
}

async function fetchWordPress<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`WordPress request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function getArticles(): Promise<Article[]> {
  if (!isConfigured) return [];

  try {
    const posts = await fetchWordPress<WordPressPost[]>('/posts?_embed&per_page=100');
    return posts.map(normalizeArticle);
  } catch (error) {
    console.error('WordPress getArticles failed:', error);
    return [];
  }
}

export async function getArticle(slug: string): Promise<Article | null> {
  if (!isConfigured) return null;

  try {
    const posts = await fetchWordPress<WordPressPost[]>(`/posts?slug=${encodeURIComponent(slug)}&_embed`);
    const post = posts[0];
    return post ? normalizeArticle(post) : null;
  } catch (error) {
    console.error(`WordPress getArticle failed for slug "${slug}":`, error);
    return null;
  }
}

// --- Cases (Custom Post Type) ---

interface WordPressCasePost {
  id: number;
  title: WordPressRenderedField;
  acf: {
    desafio?: string;
    solucion?: string;
    resultado?: string;
    stack?: string;
    industria?: string;
    url_proyecto?: string;
  };
  _embedded?: {
    'wp:featuredmedia'?: WordPressEmbeddedMedia[];
  };
}

export interface Case {
  id: number;
  title: string;
  challenge: string;
  solution: string;
  result?: string;
  stack: string;
  industry?: string;
  projectUrl?: string;
  coverImage?: {
    url: string;
    alt: string;
  };
}

function normalizeCase(post: WordPressCasePost): Case {
  const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
  const title = decodeEntities(stripHtml(post.title.rendered));

  return {
    id: post.id,
    title,
    challenge: post.acf.desafio || '',
    solution: post.acf.solucion || '',
    result: post.acf.resultado || undefined,
    stack: post.acf.stack || '',
    industry: post.acf.industria || undefined,
    projectUrl: post.acf.url_proyecto || undefined,
    coverImage: featuredMedia?.source_url
      ? { url: featuredMedia.source_url, alt: featuredMedia.alt_text || title }
      : undefined,
  };
}

export async function getCases(): Promise<Case[]> {
  if (!isConfigured) return [];

  try {
    const posts = await fetchWordPress<WordPressCasePost[]>('/casos?_embed&per_page=100');
    return posts.map(normalizeCase);
  } catch (error) {
    console.error('WordPress getCases failed:', error);
    return [];
  }
}

export async function getAllSlugs(): Promise<{ slug: string }[]> {
  if (!isConfigured) return [];

  try {
    const posts = await fetchWordPress<Array<{ slug: string }>>('/posts?per_page=100');
    return posts;
  } catch (error) {
    console.error('WordPress getAllSlugs failed:', error);
    return [];
  }
}