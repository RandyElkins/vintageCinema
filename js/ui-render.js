/**
 * ui-render.js
 *
 * Pure rendering: takes data and writes it to the DOM.
 * No fetch calls, no filter logic — only display concerns.
 *
 * Exports (on window):
 *   ui.displayMovies(movies)
 *   ui.updatePagination(pagination, goToPageFn)
 *   ui.updateResultsInfo(pagination)
 *   ui.updateSortIndicators(currentSort)
 *   ui.showLoading()
 *   ui.hideLoading(hasResults)
 *
 * Also exposes:
 *   handleFilterClick(event, type, value)  — global, called by inline onclick
 */

const ui = (() => {
    // ── Poster hover tooltip ──────────────────────────────────────────────────

    let _tooltip = null;

    function _getTooltip() {
        if (!_tooltip) {
            _tooltip = document.createElement("div");
            Object.assign(_tooltip.style, {
                position:   "fixed",
                zIndex:     "9999",
                pointerEvents: "none",
                maxWidth:   "300px",
                maxHeight:  "400px",
                borderRadius: "8px",
                overflow:   "hidden",
                boxShadow:  "0 4px 20px rgba(0,0,0,0.3)",
                border:     "2px solid white",
                background: "white",
                display:    "none",
            });
            document.body.appendChild(_tooltip);
        }
        return _tooltip;
    }

    function _showPosterTooltip(event, src, title) {
        const t = _getTooltip();
        const img = document.createElement("img");
        img.src = src;
        img.alt = title;
        img.style.cssText = "width:100%;height:auto;display:block;";
        t.innerHTML = "";
        t.appendChild(img);
        t.style.display = "block";
        _moveTooltip(event);
    }

    function _hidePosterTooltip() {
        const t = _getTooltip();
        t.style.display = "none";
    }

    function _moveTooltip(event) {
        const t = _getTooltip();
        if (t.style.display === "none") return;
        t.style.left = event.clientX + 15 + "px";
        t.style.top  = event.clientY - 50 + "px";
    }

    // ── Clickable filter chip HTML ────────────────────────────────────────────

    function _makeChips(text, type) {
        if (!text || text === "N/A") return text || "N/A";

        return text
            .split(",")
            .map((item) => {
                const t = item.trim();
                if (!t) return "";
                const safe = t.replace(/'/g, "\\'");
                return `<span class="clickable-filter"
                              onclick="handleFilterClick(event,'${type}','${safe}')"
                              title="Click to filter by ${t}">${t}</span>`;
            })
            .join(", ");
    }

    // ── Poster cell builder ───────────────────────────────────────────────────

    function _buildPosterCell(movie) {
        const td = document.createElement("td");

        if (movie.poster_image) {
            const wrap = document.createElement("div");
            wrap.className = "poster-container";

            const img = document.createElement("img");
            img.src = movie.poster_image;
            img.alt = `Poster for ${movie.title}`;
            img.className = "poster-thumbnail";

            img.addEventListener("click",     (e) => { e.preventDefault(); e.stopPropagation(); if (movie.url) window.open(movie.url, "_blank"); });
            img.addEventListener("mouseover", (e) => _showPosterTooltip(e, img.src, movie.title));
            img.addEventListener("mouseout",  _hidePosterTooltip);
            img.addEventListener("mousemove", _moveTooltip);
            img.addEventListener("error",     function () {
                const ph = _makePlaceholder(movie.url);
                wrap.replaceChild(ph, this);
            });

            wrap.appendChild(img);
            td.appendChild(wrap);
        } else {
            td.appendChild(_makePlaceholder(movie.url));
        }

        return td;
    }

    function _makePlaceholder(url) {
        const div = document.createElement("div");
        div.className = "poster-placeholder";
        div.textContent = "No Image";
        div.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (url) window.open(url, "_blank");
        });
        return div;
    }

    // ── Row builder ───────────────────────────────────────────────────────────

    function _buildRow(movie) {
        const row = document.createElement("tr");
        let isDragging = false;

        // Row click → open movie URL (with drag & text-selection guard)
        row.addEventListener("click", (e) => {
            if (e.target.classList.contains("poster-thumbnail")  ||
                e.target.classList.contains("poster-placeholder") ||
                e.target.closest(".poster-container")            ||
                e.target.classList.contains("clickable-filter")) return;

            if (isDragging) { isDragging = false; return; }
            if (window.getSelection().toString().length > 0) return;

            const now      = Date.now();
            const lastClick = row.getAttribute("data-last-click");
            if (lastClick && now - parseInt(lastClick) < 500) return;
            row.setAttribute("data-last-click", now);

            setTimeout(() => {
                const stored = row.getAttribute("data-last-click");
                if (stored && Date.now() - parseInt(stored) >= 300 &&
                    window.getSelection().toString().length === 0 && movie.url) {
                    window.open(movie.url, "_blank");
                }
            }, 300);
        });

        row.addEventListener("dblclick",  (e) => { e.preventDefault(); e.stopPropagation(); row.removeAttribute("data-last-click"); });
        row.addEventListener("mousedown", ()  => { isDragging = false; });
        row.addEventListener("mousemove", (e) => { if (e.buttons === 1) isDragging = true; });

        // ── Poster ──
        row.appendChild(_buildPosterCell(movie));

        // ── Title ──
        const tdTitle = document.createElement("td");
        tdTitle.className = "movie-title";
        tdTitle.textContent = movie.title || "Untitled";
        row.appendChild(tdTitle);

        // ── Parental rating ──
        const tdRating = document.createElement("td");
        const ratingSpan = document.createElement("span");
        ratingSpan.className = "movie-rating";
        const pr = movie.parental_rating || "";
        ratingSpan.textContent = pr || "N/A";
        if (pr && pr !== "N/A") {
            ratingSpan.classList.add("clickable-filter");
            ratingSpan.setAttribute("onclick", `handleFilterClick(event,'parental_rating','${pr.replace(/'/g, "\\'")}')`);
            ratingSpan.title = `Click to filter movies with ${pr} rating`;
        }
        tdRating.appendChild(ratingSpan);
        row.appendChild(tdRating);

        // ── Year ──
        const tdYear = document.createElement("td");
        const yearSpan = document.createElement("span");
        yearSpan.className = "movie-year";
        yearSpan.textContent = movie.year || "N/A";
        if (movie.year) {
            yearSpan.classList.add("clickable-filter");
            yearSpan.setAttribute("onclick", `handleFilterClick(event,'year','${movie.year}')`);
            yearSpan.title = `Click to filter movies from ${movie.year}`;
        }
        tdYear.appendChild(yearSpan);
        row.appendChild(tdYear);

        // ── Actors / Genres / Plot / Duration / Country ──
        const chips = [
            { cls: "movie-actors",  html: _makeChips(movie.actors,  "actor")   },
            { cls: "movie-genres",  html: _makeChips(movie.genres,  "genre")   },
            { cls: "movie-plot",    html: null, text: movie.plot || "N/A"       },
            { cls: "movie-duration",html: null, text: movie.duration || "N/A"  },
            { cls: "movie-country", html: _makeChips(movie.country, "country") },
        ];

        chips.forEach(({ cls, html, text }) => {
            const td = document.createElement("td");
            td.className = cls;
            if (html !== null) td.innerHTML = html;
            else               td.textContent = text;
            row.appendChild(td);
        });

        return row;
    }

    // ── Public: displayMovies ─────────────────────────────────────────────────

    function displayMovies(movies) {
        const tbody = document.getElementById("moviesTableBody");
        tbody.innerHTML = "";
        movies.forEach((m) => tbody.appendChild(_buildRow(m)));
    }

    // ── Public: pagination ────────────────────────────────────────────────────

    function updatePagination(pagination, goToPageFn) {
        const { current_page: current, total_pages: total } = pagination;
        const div = document.getElementById("pagination");
        div.innerHTML = "";
        if (total <= 1) return;

        const btn = (label, page, disabled, active) => {
            const b = document.createElement("button");
            b.textContent = label;
            b.disabled    = disabled;
            if (active) b.classList.add("current-page");
            if (!disabled) b.onclick = () => goToPageFn(page);
            return b;
        };

        const dots = () => {
            const s = document.createElement("span");
            s.textContent = "...";
            s.style.padding = "8px";
            return s;
        };

        div.appendChild(btn("← Previous", current - 1, current === 1, false));

        const start = Math.max(1, current - 2);
        const end   = Math.min(total, current + 2);

        if (start > 1) {
            div.appendChild(btn("1", 1, false, false));
            if (start > 2) div.appendChild(dots());
        }

        for (let i = start; i <= end; i++) {
            div.appendChild(btn(String(i), i, false, i === current));
        }

        if (end < total) {
            if (end < total - 1) div.appendChild(dots());
            div.appendChild(btn(String(total), total, false, false));
        }

        div.appendChild(btn("Next →", current + 1, current === total, false));
    }

    // ── Public: results info ──────────────────────────────────────────────────

    function updateResultsInfo(pagination) {
        const { current_page, limit, total_records } = pagination;
        const start = (current_page - 1) * limit + 1;
        const end   = Math.min(start + limit - 1, total_records);

        document.getElementById("resultsInfo").textContent =
            `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total_records.toLocaleString()} movies`;

        document.getElementById("filteredMovies").textContent =
            total_records.toLocaleString();
    }

    // ── Public: sort indicators ───────────────────────────────────────────────

    function updateSortIndicators(currentSort) {
        document.querySelectorAll(".movies-table th.sortable").forEach((th) => {
            th.classList.remove("sorted", "asc", "desc");
        });

        const th = document.querySelector(`th[onclick="sortBy('${currentSort.column}')"]`);
        if (th) th.classList.add("sorted", currentSort.order.toLowerCase());
    }

    // ── Public: loading state ─────────────────────────────────────────────────

    function showLoading() {
        document.getElementById("loadingDiv").style.display    = "block";
        document.getElementById("tableContainer").style.display = "none";
        document.getElementById("noResults").style.display      = "none";
    }

    function hideLoading(hasResults) {
        document.getElementById("loadingDiv").style.display    = "none";

        // Hide all filter spinners
        document.querySelectorAll(".filter-loading").forEach((el) => {
            el.style.display = "none";
        });

        if (hasResults) {
            document.getElementById("tableContainer").style.display = "block";
            document.getElementById("noResults").style.display      = "none";
        } else {
            document.getElementById("tableContainer").style.display = "none";
            document.getElementById("noResults").style.display      = "block";
        }
    }

    return { displayMovies, updatePagination, updateResultsInfo, updateSortIndicators, showLoading, hideLoading };
})();

// ── Global shim for inline onclick in table rows ──────────────────────────────

/**
 * Debounced click handler for filter chips in the table.
 * Guards against accidental triggers while selecting text.
 */
function handleFilterClick(event, type, value) {
    const el   = event.target;
    const now  = Date.now();
    const last = el.getAttribute("data-last-click-time");

    if (last && now - parseInt(last) < 400) return;
    el.setAttribute("data-last-click-time", now);

    setTimeout(() => {
        const stored    = el.getAttribute("data-last-click-time");
        const selection = window.getSelection();
        if (stored && Date.now() - parseInt(stored) >= 350 && selection.toString().length === 0) {
            filters.selectFilter(type, value);
        }
    }, 350);
}

// Global shim expected by table header onclick attributes
function sortBy(column) {
    // Delegated to app.js — app exposes this on window
    if (typeof app !== "undefined") app.sortBy(column);
}
