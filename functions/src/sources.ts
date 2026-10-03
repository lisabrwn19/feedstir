/**
 * Recipe blogs the aggregator pulls new posts from. Every one of these
 * publishes a public RSS feed of its own posts — feeds are meant to be
 * consumed programmatically, which keeps this on safe legal ground (unlike
 * scraping a site that doesn't offer one). Each discovered recipe keeps a
 * `sourceUrl`/`sourceName` pointing back to the original site; nothing here
 * copies content beyond what's needed to preview and (if the user chooses)
 * import it, the same way manually pasting a URL into "New Recipe" already
 * works.
 */
export const RECIPE_SOURCES: { name: string; feedUrl: string }[] = [
  { name: 'Love and Lemons', feedUrl: 'https://www.loveandlemons.com/feed/' },
  { name: 'Cookie and Kate', feedUrl: 'https://cookieandkate.com/feed/' },
  { name: 'Budget Bytes', feedUrl: 'https://www.budgetbytes.com/feed/' },
  { name: 'Minimalist Baker', feedUrl: 'https://minimalistbaker.com/feed/' },
  { name: 'Smitten Kitchen', feedUrl: 'https://smittenkitchen.com/feed/' },
  { name: 'Kalefornia Kravings', feedUrl: 'https://kaleforniakravings.com/feed/' },
  { name: "Sally's Baking Addiction", feedUrl: 'https://sallysbakingaddiction.com/feed/' },
];
