export type ParsedRecipe = {
  title?: string;
  ingredients: string[];
  instructions: string[];
  photoUri?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
};

export type ParseResult = {
  recipe: ParsedRecipe;
  /** true when structured (schema.org) recipe data was found, false when only page metadata was recovered. */
  matched: boolean;
};

const MOBILE_SAFARI_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

export async function fetchAndParseRecipe(url: string): Promise<ParseResult | null> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html',
      'User-Agent': MOBILE_SAFARI_USER_AGENT,
    },
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  return parseRecipeFromHtml(html);
}

export function parseRecipeFromHtml(html: string): ParseResult | null {
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html))) {
    let data: unknown;
    try {
      data = JSON.parse(match[1].trim());
    } catch {
      continue;
    }

    const node = findRecipeNode(data);
    if (node) {
      return {
        matched: true,
        recipe: {
          title: typeof node.name === 'string' ? stripHtml(node.name) : undefined,
          ingredients: extractIngredients(node.recipeIngredient),
          instructions: extractInstructions(node.recipeInstructions),
          photoUri: extractImage(node.image),
          servings: extractServings(node.recipeYield),
          prepTimeMinutes: parseIsoDurationToMinutes(node.prepTime),
          cookTimeMinutes: parseIsoDurationToMinutes(node.cookTime),
        },
      };
    }
  }

  const title = extractMetaContent(html, 'og:title') ?? extractTag(html, 'title');
  const image = extractMetaContent(html, 'og:image');

  if (!title && !image) {
    return null;
  }

  return {
    matched: false,
    recipe: {
      title: title ? stripHtml(title) : undefined,
      ingredients: [],
      instructions: [],
      photoUri: image ? normalizeUrl(image) : undefined,
    },
  };
}

function isRecipeType(node: unknown): node is Record<string, any> {
  if (!node || typeof node !== 'object') return false;
  const type = (node as Record<string, unknown>)['@type'];
  if (Array.isArray(type)) {
    return type.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe');
  }
  return typeof type === 'string' && type.toLowerCase() === 'recipe';
}

function findRecipeNode(data: unknown): Record<string, any> | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof data !== 'object') return null;
  if (isRecipeType(data)) return data;

  const graph = (data as Record<string, unknown>)['@graph'];
  if (Array.isArray(graph)) {
    return findRecipeNode(graph);
  }
  return null;
}

function extractIngredients(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => stripHtml(v))
    .filter(Boolean);
}

function extractInstructions(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === 'string') {
    return value
      .split(/\r?\n+/)
      .map((s) => stripHtml(s))
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractInstructionItem(item));
  }
  return extractInstructionItem(value);
}

function extractInstructionItem(item: unknown): string[] {
  if (!item) return [];
  if (typeof item === 'string') {
    const text = stripHtml(item);
    return text ? [text] : [];
  }
  if (typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    if (obj['@type'] === 'HowToSection' && Array.isArray(obj.itemListElement)) {
      return obj.itemListElement.flatMap((sub: unknown) => extractInstructionItem(sub));
    }
    if (typeof obj.text === 'string') {
      const text = stripHtml(obj.text);
      return text ? [text] : [];
    }
    if (typeof obj.name === 'string') {
      const text = stripHtml(obj.name);
      return text ? [text] : [];
    }
  }
  return [];
}

function extractImage(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return normalizeUrl(value);
  if (Array.isArray(value)) return extractImage(value[0]);
  if (typeof value === 'object') {
    const url = (value as Record<string, unknown>).url;
    if (typeof url === 'string') return normalizeUrl(url);
  }
  return undefined;
}

function extractServings(value: unknown): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const match = raw.match(/\d+/);
    if (match) return parseInt(match[0], 10);
  }
  return undefined;
}

function parseIsoDurationToMinutes(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return undefined;
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const total = hours * 60 + minutes;
  return total > 0 ? total : undefined;
}

function extractMetaContent(html: string, property: string): string | undefined {
  const regex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
  const altRegex = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`, 'i');
  const match = html.match(regex) ?? html.match(altRegex);
  return match ? match[1] : undefined;
}

function extractTag(html: string, tag: string): string | undefined {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
  return match ? match[1] : undefined;
}

function normalizeUrl(url: string): string {
  return url.startsWith('//') ? `https:${url}` : url;
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
