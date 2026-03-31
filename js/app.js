/**
 * app.js
 *
 * Entry point. Bootstrapped on DOMContentLoaded.
 *
 * Responsibilities:
 *   - Populate all filter dropdowns from the in-memory database
 *   - Wire filters.onFilterChange → loadMovies
 *   - Own currentPage / currentSort state
 *   - Expose app.sortBy(column) for ui-render's global shim
 *
 * Dependencies (must be loaded before this file):
 *   data.js, database.js, filters.js, ui-render.js
 */

const app = (() => {
    // ── State ─────────────────────────────────────────────────────────────────

    let currentPage = 1;
    let currentSort = { column: "title", order: "ASC" };
    let isLoading   = false;

    // ── Core: load & display movies ───────────────────────────────────────────

    function loadMovies(options = {}) {
        if (isLoading) return;
        isLoading = true;

        if (options.resetSort) {
            currentSort = { column: "title", order: "ASC" };
        }

        ui.showLoading();

        // Read current sort from the dropdown (may have been changed by clearFilters)
        const sortVal = document.getElementById("sortSelect").value;
        if (sortVal) {
            const [col, ord] = sortVal.split(",");
            currentSort = { column: col, order: ord };
        }

        const result = db.queryMovies({
            ...filters.getValues(),
            sort_by:    currentSort.column,
            sort_order: currentSort.order,
            page:       currentPage,
            limit:      50,
        });

        ui.displayMovies(result.movies);
        ui.updatePagination(result.pagination, goToPage);
        ui.updateResultsInfo(result.pagination);
        ui.updateSortIndicators(currentSort);
        ui.hideLoading(result.movies.length > 0);

        isLoading = false;
    }

    // ── Pagination ────────────────────────────────────────────────────────────

    function goToPage(page) {
        currentPage = page;
        loadMovies();
        const results = document.querySelector(".results");
        if (results) results.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // ── Sorting ───────────────────────────────────────────────────────────────

    function sortBy(column) {
        if (currentSort.column === column) {
            currentSort.order = currentSort.order === "ASC" ? "DESC" : "ASC";
        } else {
            currentSort.column = column;
            currentSort.order  = column === "year" ? "DESC" : "ASC";
        }

        document.getElementById("sortSelect").value =
            `${currentSort.column},${currentSort.order}`;

        currentPage = 1;
        loadMovies();
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────

    function init() {
        // 1. Update total-movies stat
        const stats = db.getStats();
        document.getElementById("totalMovies").textContent =
            stats.total_movies.toLocaleString();

        // 2. Populate filter dropdowns
        filters.populateActors(db.getActors());
        filters.populateSelect("genreSelect",          db.getGenres());
        filters.populateSelect("parentalRatingSelect", db.getParentalRatings());
        filters.populateSelect("countrySelect",        db.getCountries());

        // 3. Wire filter changes → reset to page 1 and reload
        filters.onFilterChange((options = {}) => {
            currentPage = 1;
            loadMovies(options);
        });

        // 4. Initialise filter event listeners
        filters.init();

        // 5. Initial render
        loadMovies();
    }

    document.addEventListener("DOMContentLoaded", init);

    return { sortBy, goToPage };
})();
