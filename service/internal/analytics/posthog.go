package analytics

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"
)

// Client sends events to PostHog. All captures are fire-and-forget goroutines.
// If APIKey is empty, all methods are no-ops.
type Client struct {
	apiKey string
	host   string
	http   *http.Client
}

func New(apiKey, host string) *Client {
	if host == "" {
		host = "https://us.i.posthog.com"
	}
	return &Client{
		apiKey: apiKey,
		host:   host,
		http:   &http.Client{Timeout: 5 * time.Second},
	}
}

func (c *Client) capture(event, distinctID string, props map[string]any) {
	if c.apiKey == "" {
		return
	}
	go c.send(event, distinctID, props)
}

func (c *Client) send(event, distinctID string, props map[string]any) {
	body := map[string]any{
		"api_key":     c.apiKey,
		"event":       event,
		"distinct_id": distinctID,
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
		"properties":  props,
	}
	b, err := json.Marshal(body)
	if err != nil {
		return
	}
	resp, err := c.http.Post(c.host+"/capture/", "application/json", bytes.NewReader(b))
	if err != nil {
		slog.Debug("analytics: send failed", "event", event, "err", err)
		return
	}
	resp.Body.Close()
}

// TrackSearchPerformed fires after a successful BFS.
func (c *Client) TrackSearchPerformed(distinctID string, props SearchPerformedProps) {
	c.capture("search_performed", distinctID, map[string]any{
		"start_article":     props.StartArticle,
		"end_article":       props.EndArticle,
		"degrees":           props.Degrees,
		"paths_found":       props.PathsFound,
		"nodes_explored":    props.NodesExplored,
		"search_time_ms":    props.SearchTimeMs,
		"is_no_path_found":  props.IsNoPathFound,
		"unique_articles":   props.UniqueArticles,
		"paths":             props.Paths,
		"article_hit_counts": props.ArticleHitCounts,
	})
}

// TrackSearchFailed fires when an article title is not found in the graph.
func (c *Client) TrackSearchFailed(distinctID, startArticle, endArticle, errorReason string) {
	c.capture("search_failed", distinctID, map[string]any{
		"start_article": startArticle,
		"end_article":   endArticle,
		"error_reason":  errorReason,
	})
}

// SearchPerformedProps holds all properties for a search_performed event.
type SearchPerformedProps struct {
	StartArticle     string
	EndArticle       string
	Degrees          int
	PathsFound       int
	NodesExplored    int
	SearchTimeMs     int64
	IsNoPathFound    bool
	UniqueArticles   int
	Paths            [][]string
	ArticleHitCounts map[string]int
}
