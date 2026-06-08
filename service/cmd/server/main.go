package main

import (
	"context"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/louiemansour/wikilinks/service/internal/controller"
	"github.com/louiemansour/wikilinks/service/internal/graph"
	"github.com/louiemansour/wikilinks/service/internal/service"
)

func main() {
	dataDir := flag.String("data-dir", "datapipeline/data", "path to graph bundle directory")
	port := flag.String("port", "8080", "HTTP listen port")
	flag.Parse()

	slog.Info("loading graph", "dataDir", *dataDir)
	g, err := graph.Load(*dataDir)
	if err != nil {
		slog.Error("failed to load graph", "err", err)
		os.Exit(1)
	}
	slog.Info("graph loaded",
		"entities", g.EntityCount(),
		"startingNodes", len(g.StartingNodes()),
		"endingNodes", len(g.EndingNodes()),
	)

	searchSvc := service.NewSearch(g)
	startingNodesSvc := service.NewStartingNodes(g)
	endingNodesSvc := service.NewEndingNodes(g)
	suggestSvc := service.NewSuggest(g)
	mux := http.NewServeMux()
	controller.NewHealth().Register(mux)
	controller.NewSearch(searchSvc).Register(mux)
	controller.NewStartingNodes(startingNodesSvc).Register(mux)
	controller.NewEndingNodes(endingNodesSvc).Register(mux)
	controller.NewSuggest(suggestSvc).Register(mux)

	srv := &http.Server{
		Addr:         ":" + *port,
		Handler:      chain(mux, withCORS, withTimeout(10*time.Second), withLogging),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	go func() {
		slog.Info("server listening", "port", *port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown error", "err", err)
	}
}

// chain applies middleware right-to-left so the first arg is outermost.
func chain(h http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		h = middlewares[i](h)
	}
	return h
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func withTimeout(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), d)
			defer cancel()
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"duration", time.Since(start),
		)
	})
}
