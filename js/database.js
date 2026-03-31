/**
 * database.js
 *
 * In-memory "database" backed by the MOVIE_DATA array from data.js.
 * No fetch, no CSV parsing — works with file:// and GitHub Pages alike.
 *
 * Requires: js/data.js loaded before this file (defines MOVIE_DATA).
 *
 * Public API:
 *   db.getStats()             → { total_movies }
 *   db.getActors()            → string[]
 *   db.getGenres()            → string[]
 *   db.getParentalRatings()   → string[]
 *   db.getCountries()         → string[]
 *   db.queryMovies(params)    → { movies, pagination }
 */

const db = (() => {
    // MOVIE_DATA is defined in data.js, loaded before this script.
    const _movies = MOVIE_DATA;

    // ── Duration helper ───────────────────────────────────────────────────────

    function _durationMinutes(duration) {
        if (!duration) return 0;
        return parseInt(duration.replace(/\s*mins?/i, "")) || 0;
    }

    // ── Distinct-value helper ─────────────────────────────────────────────────

    function _distinct(field) {
        const set = new Set();
        _movies.forEach((m) => {
            if (m[field]) {
                m[field].split(",").forEach((v) => {
                    const trimmed = v.trim();
                    if (trimmed && trimmed !== "N/A") set.add(trimmed);
                });
            }
        });
        return Array.from(set).sort();
    }

    // ── Sorting ───────────────────────────────────────────────────────────────

    function _compare(a, b, column, order) {
        let va, vb;

        if (column === "duration") {
            va = _durationMinutes(a.duration);
            vb = _durationMinutes(b.duration);
        } else if (column === "year") {
            va = a.year || 0;
            vb = b.year || 0;
        } else {
            va = (a[column] || "").toLowerCase();
            vb = (b[column] || "").toLowerCase();
        }

        if (va < vb) return order === "ASC" ? -1 :  1;
        if (va > vb) return order === "ASC" ?  1 : -1;
        return 0;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    function getStats() {
        return { total_movies: _movies.length };
    }

    function getActors() {
        return _distinct("actors");
    }

    function getGenres() {
        return _distinct("genres");
    }

    function getParentalRatings() {
        return _distinct("parental_rating");
    }

    function getCountries() {
        const all = _distinct("country");
        const US_VARIANTS = ["United States of America", "United States", "USA", "US"];

        let usCountry = null;
        for (const variant of US_VARIANTS) {
            const idx = all.indexOf(variant);
            if (idx !== -1) {
                usCountry = all.splice(idx, 1)[0];
                break;
            }
        }

        return usCountry ? [usCountry, ...all] : all;
    }

    function queryMovies(params = {}) {
        const {
            search          = "",
            actor           = "",
            genre           = "",
            parental_rating = "",
            plot            = "",
            duration        = "",
            country         = "",
            year_min        = null,
            year_max        = null,
            sort_by         = "title",
            sort_order      = "ASC",
            page            = 1,
            limit           = 50,
        } = params;

        // ── Filter ──
        let results = _movies.filter((m) => {
            if (search          && !m.title.toLowerCase().includes(search.toLowerCase()))           return false;
            if (actor           && !m.actors.toLowerCase().includes(actor.toLowerCase()))           return false;
            if (genre           && !m.genres.toLowerCase().includes(genre.toLowerCase()))           return false;
            if (parental_rating && !m.parental_rating.toLowerCase().includes(parental_rating.toLowerCase())) return false;
            if (plot            && !m.plot.toLowerCase().includes(plot.toLowerCase()))               return false;
            if (duration        && !m.duration.toLowerCase().includes(duration.toLowerCase()))       return false;
            if (country         && !m.country.toLowerCase().includes(country.toLowerCase()))         return false;
            if (year_min        && (m.year === null || m.year < parseInt(year_min)))                 return false;
            if (year_max        && (m.year === null || m.year > parseInt(year_max)))                 return false;
            return true;
        });

        // ── Sort ──
        const validColumns = ["title", "parental_rating", "year", "actors", "genres", "plot", "duration", "country"];
        const sortColumn   = validColumns.includes(sort_by) ? sort_by : "title";
        const sortDir      = sort_order.toUpperCase() === "DESC" ? "DESC" : "ASC";

        results = results.slice().sort((a, b) => _compare(a, b, sortColumn, sortDir));

        // ── Paginate ──
        const total      = results.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const safePage   = Math.min(Math.max(1, page), totalPages);
        const offset     = (safePage - 1) * limit;
        const pageMovies = results.slice(offset, offset + limit);

        return {
            movies: pageMovies,
            pagination: {
                current_page:  safePage,
                total_records: total,
                total_pages:   totalPages,
                limit,
            },
        };
    }

    return { getStats, getActors, getGenres, getParentalRatings, getCountries, queryMovies };
})();
