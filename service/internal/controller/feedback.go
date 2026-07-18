package controller

import (
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/louiemansour/wikilinks/service/internal/store"
)

const maxFeedbackCommentLen = 2000

// Feedback handles POST /api/feedback and PATCH /api/feedback/{id}.
type Feedback struct {
	st *store.Store
}

func NewFeedback(st *store.Store) *Feedback {
	return &Feedback{st: st}
}

func (c *Feedback) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/feedback", c.createFeedback)
	mux.HandleFunc("PATCH /api/feedback/{id}", c.updateFeedbackComment)
}

func (c *Feedback) createFeedback(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read body"})
		return
	}
	var req struct {
		Rating int `json:"rating"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if req.Rating < 1 || req.Rating > 3 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "rating must be between 1 and 3"})
		return
	}

	id, err := c.st.SaveFeedbackRating(req.Rating)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": strconv.FormatInt(id, 10)})
}

func (c *Feedback) updateFeedbackComment(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read body"})
		return
	}
	var req struct {
		Comment string `json:"comment"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	comment := strings.TrimSpace(req.Comment)
	if comment == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "comment is required"})
		return
	}
	if len(comment) > maxFeedbackCommentLen {
		comment = comment[:maxFeedbackCommentLen]
	}

	if err := c.st.UpdateFeedbackComment(id, comment); err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "feedback not found"})
		return
	} else if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
