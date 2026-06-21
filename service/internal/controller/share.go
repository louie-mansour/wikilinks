package controller

import (
	"database/sql"
	"encoding/json"
	"html/template"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/louiemansour/wikilinks/service/internal/store"
)

// Share handles GET /api/share/{code}, POST /api/share, and GET /s/{code}.
type Share struct {
	st        *store.Store
	staticDir string
	appURL    string
}

func NewShare(st *store.Store, staticDir, appURL string) *Share {
	return &Share{st: st, staticDir: staticDir, appURL: appURL}
}

func (c *Share) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/share/{code}", c.getShare)
	mux.HandleFunc("POST /api/share", c.createShare)
	mux.HandleFunc("GET /s/{code}", c.serveSharePage)
}

func (c *Share) getShare(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	jsonBytes, err := c.st.GetShareSnapshot(code)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "share not found or expired"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(jsonBytes)
}

func (c *Share) createShare(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1 MB limit
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read body"})
		return
	}
	var meta struct {
		ShareCode string `json:"shareCode"`
	}
	if err := json.Unmarshal(body, &meta); err != nil || meta.ShareCode == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing shareCode"})
		return
	}
	if err := c.st.StoreShareSnapshot(meta.ShareCode, body); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"code": meta.ShareCode})
}

func (c *Share) serveSharePage(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	if isBot(r.Header.Get("User-Agent")) {
		c.serveOGPage(w, r, code)
		return
	}
	if c.staticDir != "" {
		http.ServeFile(w, r, filepath.Join(c.staticDir, "index.html"))
		return
	}
	// API-only mode (local dev): redirect to Vite dev server.
	http.Redirect(w, r, "http://localhost:5173/s/"+code, http.StatusFound)
}

func isBot(ua string) bool {
	ua = strings.ToLower(ua)
	for _, token := range []string{
		"twitterbot", "facebookexternalhit", "slackbot", "linkedinbot",
		"whatsapp", "telegrambot", "discordbot", "applebot", "googlebot", "bingbot",
	} {
		if strings.Contains(ua, token) {
			return true
		}
	}
	return false
}

var ogTemplate = template.Must(template.New("og").Parse(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{.Start}} → {{.End}} | WikiHop</title>
  <meta name="description" content="{{.PathsFound}} shortest paths in {{.MinHops}} degrees of separation">
  <meta property="og:title" content="{{.Start}} → {{.End}} | WikiHop">
  <meta property="og:description" content="{{.PathsFound}} shortest paths in {{.MinHops}} degrees of separation">
  <meta property="og:url" content="{{.AppURL}}/s/{{.Code}}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="{{.Start}} → {{.End}} | WikiHop">
  <meta name="twitter:description" content="{{.PathsFound}} shortest paths in {{.MinHops}} degrees of separation">
</head>
<body>
  <script>window.location.replace({{.SharePath}})</script>
  <a href="{{.SharePath}}">View on WikiHop</a>
</body>
</html>`))

func (c *Share) serveOGPage(w http.ResponseWriter, r *http.Request, code string) {
	jsonBytes, err := c.st.GetShareSnapshot(code)
	if err == sql.ErrNoRows {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	var meta struct {
		Start      string `json:"start"`
		End        string `json:"end"`
		MinHops    int    `json:"minHops"`
		PathsFound int    `json:"pathsFound"`
		ShareCode  string `json:"shareCode"`
	}
	if err := json.Unmarshal(jsonBytes, &meta); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if meta.ShareCode == "" {
		meta.ShareCode = code
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = ogTemplate.Execute(w, struct {
		Start, End, Code, AppURL, SharePath string
		MinHops, PathsFound                 int
	}{
		Start:      meta.Start,
		End:        meta.End,
		Code:       meta.ShareCode,
		AppURL:     c.appURL,
		SharePath:  "/s/" + meta.ShareCode,
		MinHops:    meta.MinHops,
		PathsFound: meta.PathsFound,
	})
}
