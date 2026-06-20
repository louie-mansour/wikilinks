package store

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

const schema = `
CREATE TABLE IF NOT EXISTS article_hits (
    title     TEXT    PRIMARY KEY,
    hit_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS searches (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at     INTEGER NOT NULL,
    from_article   TEXT    NOT NULL,
    to_article     TEXT    NOT NULL,
    nodes_explored INTEGER NOT NULL,
    min_hops       INTEGER NOT NULL,
    paths_found    INTEGER NOT NULL,
    new_articles   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_searches_created_at ON searches(created_at);
`

// Store is a SQLite-backed persistence layer for hit counts and search history.
type Store struct {
	db *sql.DB
}

// SearchMeta holds the per-search statistics recorded alongside hit counts.
type SearchMeta struct {
	From          string
	To            string
	NodesExplored int
	MinHops       int
	PathsFound    int
}

// RecordPeriod holds aggregated stats for one time window.
type RecordPeriod struct {
	Period string      `json:"period"`
	Rows   []RecordRow `json:"rows"`
}

type RecordRow struct {
	Key   string `json:"key"`
	Value string `json:"value"`
	Badge bool   `json:"badge,omitempty"`
}

// New opens (or creates) the SQLite database at path and applies the schema.
func New(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	// WAL mode: readers don't block writers.
	if _, err := db.Exec(`PRAGMA journal_mode=WAL`); err != nil {
		db.Close()
		return nil, fmt.Errorf("set WAL mode: %w", err)
	}
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	return &Store{db: db}, nil
}

// Close releases the database connection.
func (s *Store) Close() error { return s.db.Close() }

// RecordSearch increments hit counts for all titles in a single transaction,
// inserts a search history row, and returns the titles whose prior count was 0.
func (s *Store) RecordSearch(titles []string, meta SearchMeta) ([]string, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck

	upsert, err := tx.Prepare(`
		INSERT INTO article_hits(title, hit_count) VALUES(?, 1)
		ON CONFLICT(title) DO UPDATE SET hit_count = hit_count + 1
		RETURNING hit_count
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare upsert: %w", err)
	}
	defer upsert.Close()

	var newTitles []string
	for _, title := range titles {
		var count int
		if err := upsert.QueryRow(title).Scan(&count); err != nil {
			return nil, fmt.Errorf("upsert %q: %w", title, err)
		}
		if count == 1 {
			newTitles = append(newTitles, title)
		}
	}

	newArticles := len(newTitles)
	_, err = tx.Exec(`
		INSERT INTO searches(created_at, from_article, to_article, nodes_explored, min_hops, paths_found, new_articles)
		VALUES(?, ?, ?, ?, ?, ?, ?)
	`, time.Now().Unix(), meta.From, meta.To, meta.NodesExplored, meta.MinHops, meta.PathsFound, newArticles)
	if err != nil {
		return nil, fmt.Errorf("insert search: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return newTitles, nil
}

// QueryRecords returns best-ever stats for three time windows: all time, past week, past day.
func (s *Store) QueryRecords() ([]RecordPeriod, error) {
	now := time.Now().Unix()
	windows := []struct {
		period    string
		threshold int64
	}{
		{"All time", 0},
		{"Past week", now - 7*86400},
		{"Past day", now - 86400},
	}

	periods := make([]RecordPeriod, 0, len(windows))
	for _, w := range windows {
		var maxPaths, maxNodes sql.NullInt64
		var minHops sql.NullInt64
		err := s.db.QueryRow(`
			SELECT MAX(paths_found), MAX(nodes_explored), MIN(min_hops)
			FROM searches WHERE created_at >= ?
		`, w.threshold).Scan(&maxPaths, &maxNodes, &minHops)
		if err != nil {
			return nil, fmt.Errorf("query records for %q: %w", w.period, err)
		}

		// No searches yet in this window — skip.
		if !maxPaths.Valid {
			continue
		}

		periods = append(periods, RecordPeriod{
			Period: w.period,
			Rows: []RecordRow{
				{Key: "Most paths", Value: fmt.Sprintf("%d", maxPaths.Int64)},
				{Key: "Most nodes", Value: fmt.Sprintf("%d", maxNodes.Int64)},
				{Key: "Shortest path", Value: fmt.Sprintf("%d hops", minHops.Int64)},
			},
		})
	}
	return periods, nil
}

// AnnotateRecordBadges marks rows where the current search set a new record in each window.
func AnnotateRecordBadges(current, previous []RecordPeriod, meta SearchMeta) []RecordPeriod {
	prevByPeriod := make(map[string]map[string]string, len(previous))
	for _, p := range previous {
		rows := make(map[string]string, len(p.Rows))
		for _, r := range p.Rows {
			rows[r.Key] = r.Value
		}
		prevByPeriod[p.Period] = rows
	}

	for i, period := range current {
		prevRows := prevByPeriod[period.Period]
		for j, row := range period.Rows {
			current[i].Rows[j].Badge = isNewRecord(row.Key, row.Value, prevRows, meta)
		}
	}
	return current
}

func isNewRecord(key, displayed string, prevRows map[string]string, meta SearchMeta) bool {
	switch key {
	case "Most paths":
		displayedVal := parseRecordInt(displayed)
		if meta.PathsFound != displayedVal {
			return false
		}
		if prevRows == nil {
			return true
		}
		return meta.PathsFound > parseRecordInt(prevRows["Most paths"])
	case "Most nodes":
		displayedVal := parseRecordInt(displayed)
		if meta.NodesExplored != displayedVal {
			return false
		}
		if prevRows == nil {
			return true
		}
		return meta.NodesExplored > parseRecordInt(prevRows["Most nodes"])
	case "Shortest path":
		displayedVal := parseRecordHops(displayed)
		if meta.MinHops != displayedVal {
			return false
		}
		if prevRows == nil {
			return true
		}
		prev := parseRecordHops(prevRows["Shortest path"])
		return prev == 0 || meta.MinHops < prev
	default:
		return false
	}
}

func parseRecordInt(s string) int {
	var n int
	fmt.Sscanf(s, "%d", &n)
	return n
}

func parseRecordHops(s string) int {
	var n int
	fmt.Sscanf(s, "%d hops", &n)
	return n
}
