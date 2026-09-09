# 02: Guess endpoint with answer masking

**What to build:** A new backend endpoint (distinct from `/api/search`) that accepts a guess article and, using today's hidden end article from the daily schedule, returns all shortest paths between the guess and the hidden article via the existing `BidirectionalBFS` engine (`service/internal/graph/bfs.go`) — with the real end-node id/title substituted by a stable-per-day placeholder id everywhere except on a correct guess.

**Blocked by:** 01

**Status:** done

- [x] New endpoint accepts a guess (title/id) and implicitly uses today's puzzle date
- [x] Response contains all shortest paths between guess and hidden article, computed via `BidirectionalBFS`
- [x] The real end-node id/title is replaced by a stable placeholder id (same placeholder across all guesses for the same puzzle-day) in all responses prior to a correct guess
- [x] A guess with no path within the existing BFS depth cap returns the guess node with no connecting edges, not an error
- [x] A correct guess (guess == today's real answer) returns `correct: true` plus the real end-node id/title
- [x] Request/response contract tests, analogous to existing `/api/search` handler tests, cover: normal guess with paths found, guess with no path, correct/winning guess, and assert the real end-node identity never appears in the response body prior to a correct guess
- [x] `/api/search` endpoint and its existing contract are untouched
