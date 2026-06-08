package controller

import (
	"net/http"

	"github.com/louiemansour/wikilinks/service/internal/service"
)

// StartingNodes handles GET /internal/starting-nodes.
type StartingNodes struct {
	svc *service.StartingNodes
}

func NewStartingNodes(svc *service.StartingNodes) *StartingNodes {
	return &StartingNodes{svc: svc}
}

func (c *StartingNodes) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /internal/starting-nodes", c.list)
}

func (c *StartingNodes) list(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, c.svc.List())
}
