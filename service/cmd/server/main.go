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

	"path/filepath"

	"github.com/louiemansour/wikilinks/service/internal/analytics"
	"github.com/louiemansour/wikilinks/service/internal/controller"
	"github.com/louiemansour/wikilinks/service/internal/graph"
	"github.com/louiemansour/wikilinks/service/internal/service"
	"github.com/louiemansour/wikilinks/service/internal/store"
)

func main() {
	dataDir := flag.String("data-dir", "datapipeline/data", "path to graph bundle directory")
	port := flag.String("port", "8080", "HTTP listen port")
	shareTTL := flag.Duration("share-ttl", 365*24*time.Hour, "how long share snapshots are retained (0 = keep forever)")
	staticDir := flag.String("static-dir", "", "path to built frontend directory (enables static file serving + SPA fallback)")
	appURL := flag.String("app-url", "https://wikihop.org", "public app URL used in OG tags (no trailing slash)")
	flag.Parse()

	posthogKey := os.Getenv("POSTHOG_API_KEY")
	posthogHost := os.Getenv("POSTHOG_HOST")
	appEnv := os.Getenv("APP_ENV")
	if appEnv == "" {
		appEnv = "local"
	}
	a := analytics.New(posthogKey, posthogHost, appEnv)
	if posthogKey != "" {
		slog.Info("analytics enabled", "host", posthogHost, "environment", appEnv)
	}

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

	st, err := store.New(filepath.Join(*dataDir, "wikilinks.db"), *shareTTL)
	if err != nil {
		slog.Error("failed to open store", "err", err)
		os.Exit(1)
	}
	defer st.Close()

	searchSvc := service.NewSearch(g, st)
	startingNodesSvc := service.NewStartingNodes(g)
	endingNodesSvc := service.NewEndingNodes(g)
	suggestSvc := service.NewSuggest(g)
	randomSvc := service.NewRandom(g)
	mux := http.NewServeMux()
	controller.NewHealth().Register(mux)
	controller.NewSearch(searchSvc, a).Register(mux)
	controller.NewShare(st, *staticDir, *appURL).Register(mux)
	controller.NewStartingNodes(startingNodesSvc).Register(mux)
	controller.NewEndingNodes(endingNodesSvc).Register(mux)
	controller.NewSuggest(suggestSvc).Register(mux)
	controller.NewRandom(randomSvc).Register(mux)

	if *staticDir != "" {
		mux.Handle("GET /assets/", http.FileServer(http.Dir(*staticDir)))
		mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
			http.ServeFile(w, r, filepath.Join(*staticDir, "index.html"))
		})
	}

	// Hard searches can take ~20s on the full graph; keep server timeouts above that.
	const handlerTimeout = 60 * time.Second

	srv := &http.Server{
		Addr: ":" + *port,
		Handler: chain(
			http.TimeoutHandler(mux, handlerTimeout, `{"error":"request timed out"}`),
			withCORS,
			withLogging,
		),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: handlerTimeout + 5*time.Second,
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
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
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
