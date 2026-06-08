package controller

import (
	"net/http"

	"github.com/louiemansour/wikilinks/service/internal/service"
)

// EndingNodes handles GET /api/ending-nodes.
type EndingNodes struct {
	svc *service.EndingNodes
}

func NewEndingNodes(svc *service.EndingNodes) *EndingNodes {
	return &EndingNodes{svc: svc}
}

func (c *EndingNodes) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/ending-nodes", c.list)
}

func (c *EndingNodes) list(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, c.svc.List())
}
