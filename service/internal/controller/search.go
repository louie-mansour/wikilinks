package controller

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"strings"

	"github.com/louiemansour/wikilinks/service/internal/analytics"
	"github.com/louiemansour/wikilinks/service/internal/service"
)

// Search handles GET /api/search?from=X&to=Y.
type Search struct {
	svc *service.Search
	a   *analytics.Client
}

func NewSearch(svc *service.Search, a *analytics.Client) *Search {
	return &Search{svc: svc, a: a}
}

func (c *Search) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/search", c.search)
}

func (c *Search) search(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")

	if from == "" || to == "" {
		http.Error(w, `{"error":"from and to are required"}`, http.StatusBadRequest)
		return
	}

	result, err := c.svc.Find(from, to)
	if err != nil {
		var notFound service.ErrTitleNotFound
		switch {
		case errors.As(err, &notFound):
			c.a.TrackSearchFailed(clientIP(r), from, to, err.Error())
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		}
		return
	}

	pathTitles := make([][]string, len(result.Paths))
	for i, p := range result.Paths {
		titles := make([]string, len(p.Crumbs))
		for j, crumb := range p.Crumbs {
			titles[j] = crumb.Label
		}
		pathTitles[i] = titles
	}

	c.a.TrackSearchPerformed(clientIP(r), analytics.SearchPerformedProps{
		StartArticle:     result.Start,
		EndArticle:       result.End,
		Degrees:          result.MinHops,
		PathsFound:       result.PathsFound,
		NodesExplored:    result.NodesExplored,
		SearchTimeMs:     result.SearchTimeMs,
		IsNoPathFound:    result.NoPathFound,
		UniqueArticles:   result.UniqueArticles,
		Paths:            pathTitles,
		ArticleHitCounts: result.HitCounts,
	})

	writeJSON(w, http.StatusOK, result)
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return strings.TrimSpace(strings.SplitN(xff, ",", 2)[0])
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
