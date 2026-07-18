package controller_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/louiemansour/wikilinks/service/internal/controller"
	"github.com/louiemansour/wikilinks/service/internal/store"
)

func newFeedbackTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	st, err := store.New(filepath.Join(t.TempDir(), "test.db"), 0)
	if err != nil {
		t.Fatalf("store.New: %v", err)
	}
	t.Cleanup(func() { st.Close() })

	mux := http.NewServeMux()
	controller.NewFeedback(st).Register(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func TestCreateFeedback_validRating(t *testing.T) {
	srv := newFeedbackTestServer(t)

	body, _ := json.Marshal(map[string]int{"rating": 2})
	resp, err := http.Post(srv.URL+"/api/feedback", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("POST /api/feedback: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var got struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.ID == "" {
		t.Fatal("expected non-empty id")
	}
}

func TestCreateFeedback_invalidRating(t *testing.T) {
	srv := newFeedbackTestServer(t)

	body, _ := json.Marshal(map[string]int{"rating": 5})
	resp, err := http.Post(srv.URL+"/api/feedback", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("POST /api/feedback: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestUpdateFeedbackComment_afterRating(t *testing.T) {
	srv := newFeedbackTestServer(t)

	createBody, _ := json.Marshal(map[string]int{"rating": 1})
	createResp, err := http.Post(srv.URL+"/api/feedback", "application/json", bytes.NewReader(createBody))
	if err != nil {
		t.Fatalf("POST /api/feedback: %v", err)
	}
	defer createResp.Body.Close()
	var created struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(createResp.Body).Decode(&created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}

	commentBody, _ := json.Marshal(map[string]string{"comment": "This was confusing"})
	req, err := http.NewRequest(http.MethodPatch, srv.URL+"/api/feedback/"+created.ID, bytes.NewReader(commentBody))
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PATCH /api/feedback/%s: %v", created.ID, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
}

func TestUpdateFeedbackComment_unknownID(t *testing.T) {
	srv := newFeedbackTestServer(t)

	commentBody, _ := json.Marshal(map[string]string{"comment": "orphan comment"})
	req, err := http.NewRequest(http.MethodPatch, srv.URL+"/api/feedback/999999", bytes.NewReader(commentBody))
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PATCH /api/feedback/999999: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", resp.StatusCode)
	}
}

func TestUpdateFeedbackComment_emptyComment(t *testing.T) {
	srv := newFeedbackTestServer(t)

	createBody, _ := json.Marshal(map[string]int{"rating": 1})
	createResp, err := http.Post(srv.URL+"/api/feedback", "application/json", bytes.NewReader(createBody))
	if err != nil {
		t.Fatalf("POST /api/feedback: %v", err)
	}
	defer createResp.Body.Close()
	var created struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(createResp.Body).Decode(&created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}

	commentBody, _ := json.Marshal(map[string]string{"comment": "   "})
	req, err := http.NewRequest(http.MethodPatch, srv.URL+"/api/feedback/"+created.ID, bytes.NewReader(commentBody))
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PATCH /api/feedback/%s: %v", created.ID, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}
