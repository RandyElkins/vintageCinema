/**
 * filters.js
 *
 * Owns all filter UI state and logic:
 *   - Reading current filter values from the DOM
 *   - Debounced / immediate filter application
 *   - Actor autocomplete (keyboard + mouse)
 *   - Click-filter mode toggle (replace vs. add)
 *   - Active-filter visual indicators (blue highlight)
 *   - clearFilters()
 *
 * Depends on: database.js (for actor list), app.js loadMovies() callback
 * set via filters.onFilterChange(fn).
 */

const filters = (() => {
    // ── State ─────────────────────────────────────────────────────────────────

    let _filterMode   = "replace"; // "replace" | "add"
    let _allActors    = [];
    let _searchTimeout;

    /** Callback invoked whenever filters change — wired up by app.js */
    let _onFilterChange = () => {};

    // ── Public: wire up the change callback ──────────────────────────────────

    function onFilterChange(fn) {
        _onFilterChange = fn;
    }

    // ── Read current filter values from DOM ──────────────────────────────────

    function getValues() {
        return {
            search:          _val("searchInput"),
            actor:           _val("actorSearchInput"),
            genre:           _val("genreSelect"),
            parental_rating: _val("parentalRatingSelect"),
            plot:            _val("plotSearchInput"),
            duration:        _val("durationSearchInput"),
            country:         _val("countrySelect"),
            year_min:        _val("yearMin")  || null,
            year_max:        _val("yearMax")  || null,
        };
    }

    function _val(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    }

    // ── Populate dropdowns ────────────────────────────────────────────────────

    function populateActors(actors) {
        _allActors = actors;
    }

    function populateSelect(selectId, items) {
        const select = document.getElementById(selectId);
        if (!select) return;
        items.forEach((item) => {
            const option = document.createElement("option");
            option.value = item;
            option.textContent = item;
            select.appendChild(option);
        });
    }

    // ── Filter change helpers ─────────────────────────────────────────────────

    function _applyImmediate() {
        _updateActiveIndicators();
        _onFilterChange();
    }

    function _debounce() {
        clearTimeout(_searchTimeout);
        _searchTimeout = setTimeout(_applyImmediate, 300);
    }

    // ── Actor autocomplete ────────────────────────────────────────────────────

    function _handleActorInput(e) {
        const query = e.target.value.toLowerCase().trim();
        if (query.length === 0) {
            _hideActorSuggestions();
            _applyImmediate();
            return;
        }

        const matches = _allActors
            .filter((a) => a.toLowerCase().includes(query))
            .slice(0, 10);

        _showActorSuggestions(matches);
        _debounce();
    }

    function _handleActorKeydown(e) {
        const container  = document.getElementById("actorSuggestions");
        const highlighted = container.querySelector(".highlighted");

        if (e.key === "ArrowDown") {
            e.preventDefault();
            const next = highlighted ? highlighted.nextElementSibling : container.firstElementChild;
            if (next && next.classList.contains("actor-suggestion")) {
                if (highlighted) highlighted.classList.remove("highlighted");
                next.classList.add("highlighted");
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const prev = highlighted ? highlighted.previousElementSibling : container.lastElementChild;
            if (prev && prev.classList.contains("actor-suggestion")) {
                if (highlighted) highlighted.classList.remove("highlighted");
                prev.classList.add("highlighted");
            }
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (highlighted) _selectActor(highlighted.textContent);
        } else if (e.key === "Escape") {
            _hideActorSuggestions();
        }
    }

    function _showActorSuggestions(actors) {
        const container = document.getElementById("actorSuggestions");
        container.innerHTML = "";

        if (actors.length === 0) {
            const noResult = document.createElement("div");
            noResult.className = "no-suggestions";
            noResult.textContent = "No actors found";
            container.appendChild(noResult);
        } else {
            actors.forEach((actor) => {
                const item = document.createElement("div");
                item.className = "actor-suggestion";
                item.textContent = actor;
                item.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    _selectActor(actor);
                });
                container.appendChild(item);
            });
        }
        container.style.display = "block";
    }

    function _hideActorSuggestions() {
        setTimeout(() => {
            const el = document.getElementById("actorSuggestions");
            if (el) el.style.display = "none";
        }, 200);
    }

    function _selectActor(actor) {
        document.getElementById("actorSearchInput").value = actor;
        _hideActorSuggestions();
        _applyImmediate();
    }

    // ── Click-filter mode (replace vs add) ───────────────────────────────────

    function toggleFilterMode() {
        const toggle      = document.getElementById("filterToggle");
        const description = document.getElementById("toggleDescription");

        if (_filterMode === "replace") {
            _filterMode = "add";
            toggle.classList.add("active");
            description.textContent = "Currently: Add to filters";
        } else {
            _filterMode = "replace";
            toggle.classList.remove("active");
            description.textContent = "Currently: Replace filters";
        }
    }

    /**
     * Called when the user clicks a chip (actor, genre, country, year, rating)
     * directly in the table.
     */
    function selectFilter(type, value) {
        if (_filterMode === "replace") {
            // Wipe everything first
            ["searchInput", "actorSearchInput", "plotSearchInput",
             "durationSearchInput", "yearMin", "yearMax"].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.value = "";
            });
            ["genreSelect", "parentalRatingSelect", "countrySelect"].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.value = "";
            });
            _hideActorSuggestions();
        }

        const map = {
            actor:          () => { document.getElementById("actorSearchInput").value = value; },
            genre:          () => { document.getElementById("genreSelect").value = value; },
            parental_rating:() => { document.getElementById("parentalRatingSelect").value = value; },
            country:        () => { document.getElementById("countrySelect").value = value; },
            year:           () => {
                document.getElementById("yearMin").value = value;
                document.getElementById("yearMax").value = value;
            },
        };

        if (map[type]) map[type]();
        _updateActiveIndicators();
        _onFilterChange();
    }

    // ── Active-filter visual indicators ──────────────────────────────────────

    function _updateActiveIndicators() {
        ["searchInput", "actorSearchInput", "plotSearchInput",
         "durationSearchInput", "yearMin", "yearMax"].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.toggle("has-value", !!el.value.trim());
        });

        ["genreSelect", "parentalRatingSelect", "countrySelect"].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.toggle("has-value", !!el.value);
        });
    }

    // ── Clear all filters ─────────────────────────────────────────────────────

    function clearFilters() {
        ["searchInput", "actorSearchInput", "plotSearchInput",
         "durationSearchInput", "yearMin", "yearMax"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        });
        ["genreSelect", "parentalRatingSelect", "countrySelect"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        });

        document.getElementById("sortSelect").value = "title,ASC";
        _hideActorSuggestions();
        _updateActiveIndicators();
        _onFilterChange({ resetSort: true });
    }

    // ── Event wiring ──────────────────────────────────────────────────────────

    function init() {
        // Text inputs — debounced
        ["searchInput", "plotSearchInput", "durationSearchInput", "yearMin", "yearMax"]
            .forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.addEventListener("input", _debounce);
            });

        // Selects — immediate
        ["genreSelect", "parentalRatingSelect", "countrySelect"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener("change", _applyImmediate);
        });

        // Actor autocomplete
        const actorInput = document.getElementById("actorSearchInput");
        if (actorInput) {
            actorInput.addEventListener("input",   _handleActorInput);
            actorInput.addEventListener("keydown", _handleActorKeydown);
            actorInput.addEventListener("blur",    _hideActorSuggestions);
        }

        // Sort dropdown
        const sortSelect = document.getElementById("sortSelect");
        if (sortSelect) {
            sortSelect.addEventListener("change", _applyImmediate);
        }

        // Close actor suggestions when clicking elsewhere
        document.addEventListener("click", (e) => {
            if (!e.target.closest(".actor-search-container")) {
                _hideActorSuggestions();
            }
        });
    }

    // ── Public surface ────────────────────────────────────────────────────────

    return {
        init,
        onFilterChange,
        getValues,
        populateActors,
        populateSelect,
        toggleFilterMode,
        selectFilter,
        clearFilters,
    };
})();

// Global shims expected by inline onclick attributes in the HTML
function toggleFilterMode()          { filters.toggleFilterMode(); }
function clearFilters()              { filters.clearFilters(); }
function selectFilter(type, value)  { filters.selectFilter(type, value); }
