export type LoadingPhase = 'articles' | 'paths';

export const ARTICLE_LOADING_MESSAGES = [
  'Shuffling the suggestion deck…',
  'Letting the random article generator meditate…',
  'Spinning the Wiki wheel of fortune…',
  'Drawing two names from a very large hat…',
  'Consulting the oracle at Special:Random…',
  'Asking whether these articles have ever met at a party…',
  'Rolling dice against the entire English Wikipedia…',
] as const;

export const PATH_LOADING_MESSAGES = [
  'Tracing hyperlinks through the collective unconscious…',
  'Negotiating with six degrees of separation…',
  'Following citations until something interesting happens…',
  'Untangling red links that stubbornly refuse to exist…',
  'Comparing path lengths in the Graph of All Human Knowledge…',
  'Checking if Kevin Bacon is somehow involved…',
  'Asking whether Einstein would approve of this route…',
  'Weighing whether the scenic route beats the shortest one…',
  'Listening politely while disambiguation pages argue…',
  'Peeking at categories nobody has browsed since 2011…',
] as const;

export function messagesForPhase(phase: LoadingPhase): readonly string[] {
  return phase === 'articles' ? ARTICLE_LOADING_MESSAGES : PATH_LOADING_MESSAGES;
}
