package controller

import (
	"database/sql"
	"encoding/json"
	"io"
	"net/http"

	"github.com/louiemansour/wikilinks/service/internal/store"
)

// Share handles GET /api/share/{code} and POST /api/share.
type Share struct {
	st *store.Store
}

func NewShare(st *store.Store) *Share {
	return &Share{st: st}
}

func (c *Share) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/share/{code}", c.getShare)
	mux.HandleFunc("POST /api/share", c.createShare)
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
