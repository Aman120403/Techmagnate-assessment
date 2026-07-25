/**
 * Tech Magnate Assessment — dashboard client.
 * Talks to /api/dashboard/tasks + create/bulk endpoints.
 * State lives in one object so reloads stay predictable.
 */
(() => {
  const COLUMNS = [
    { key: 'task_id', label: 'Task ID', mono: true },
    { key: 'keyword', label: 'Keyword' },
    { key: 'language_code', label: 'Language' },
    { key: 'location_code', label: 'Location' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'cost', label: 'Cost' },
    { key: 'created_at', label: 'Created Date' },
  ];

  const state = {
    page: 1,
    limit: 20,
    search: '',
    status: '',
    priority: '',
    language: '',
    location: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
    visible: Object.fromEntries(COLUMNS.map((c) => [c.key, true])),
    pagination: null,
    debounceTimer: null,
  };

  const el = {
    tbody: document.getElementById('tbody'),
    theadRow: document.getElementById('theadRow'),
    empty: document.getElementById('emptyState'),
    loading: document.getElementById('loadingState'),
    pageMeta: document.getElementById('pageMeta'),
    btnPrev: document.getElementById('btnPrev'),
    btnNext: document.getElementById('btnNext'),
    pageLimit: document.getElementById('pageLimit'),
    searchInput: document.getElementById('searchInput'),
    filterStatus: document.getElementById('filterStatus'),
    filterPriority: document.getElementById('filterPriority'),
    filterLanguage: document.getElementById('filterLanguage'),
    filterLocation: document.getElementById('filterLocation'),
    columnsPanel: document.getElementById('columnsPanel'),
    queueBadge: document.getElementById('queueBadge'),
    createDialog: document.getElementById('createDialog'),
    bulkDialog: document.getElementById('bulkDialog'),
    createForm: document.getElementById('createForm'),
    bulkForm: document.getElementById('bulkForm'),
    createError: document.getElementById('createError'),
    bulkError: document.getElementById('bulkError'),
    bulkResult: document.getElementById('bulkResult'),
  };

  function buildQuery() {
    const params = new URLSearchParams({
      page: String(state.page),
      limit: String(state.limit),
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
    });

    if (state.search) params.set('search', state.search);
    if (state.status) params.set('status', state.status);
    if (state.priority) params.set('priority', state.priority);
    if (state.language) params.set('language', state.language);
    if (state.location) params.set('location', state.location);

    const cols = COLUMNS.filter((c) => state.visible[c.key]).map((c) => c.key);
    // Always ask for fields we need to render badges etc.
    params.set('columns', [...new Set([...cols, 'status', 'status_message'])].join(','));

    return params.toString();
  }

  function renderHead() {
    el.theadRow.innerHTML = '';
    COLUMNS.filter((c) => state.visible[c.key]).forEach((col) => {
      const th = document.createElement('th');
      th.dataset.sort = col.key;
      th.className = state.sortBy === col.key ? 'active' : '';
      const arrow =
        state.sortBy === col.key ? (state.sortOrder === 'asc' ? '↑' : '↓') : '↕';
      th.innerHTML = `${col.label}<span class="sort-ind">${arrow}</span>`;
      th.addEventListener('click', () => {
        if (state.sortBy === col.key) {
          state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortBy = col.key;
          state.sortOrder = 'asc';
        }
        loadTasks();
      });
      el.theadRow.appendChild(th);
    });
  }

  function formatCell(col, row) {
    const val = row[col.key];

    if (col.key === 'status') {
      return `<span class="badge badge-${escapeAttr(row.status || 'queued')}">${escapeHtml(
        row.status || '—'
      )}</span>`;
    }
    if (col.key === 'created_at') {
      return val ? escapeHtml(new Date(val).toLocaleString()) : '—';
    }
    if (col.key === 'cost') {
      return val == null ? '—' : escapeHtml(Number(val).toFixed(5));
    }
    if (val == null || val === '') return '—';
    return escapeHtml(String(val));
  }

  function renderRows(items) {
    renderHead();
    el.tbody.innerHTML = '';

    const visibleCols = COLUMNS.filter((c) => state.visible[c.key]);

    items.forEach((row) => {
      const tr = document.createElement('tr');
      visibleCols.forEach((col) => {
        const td = document.createElement('td');
        if (col.mono) td.classList.add('mono');
        td.innerHTML = formatCell(col, row);
        tr.appendChild(td);
      });
      el.tbody.appendChild(tr);
    });

    el.empty.classList.toggle('hidden', items.length > 0);
  }

  function renderPager(p) {
    if (!p) {
      el.pageMeta.textContent = '—';
      el.btnPrev.disabled = true;
      el.btnNext.disabled = true;
      return;
    }
    el.pageMeta.textContent = `Page ${p.page} of ${p.totalPages} · ${p.total} tasks`;
    el.btnPrev.disabled = !p.hasPrev;
    el.btnNext.disabled = !p.hasNext;
  }

  async function loadTasks() {
    el.loading.classList.remove('hidden');
    try {
      const res = await fetch(`/api/dashboard/tasks?${buildQuery()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to load');

      state.pagination = json.pagination;
      renderRows(json.data || []);
      renderPager(json.pagination);
    } catch (err) {
      el.tbody.innerHTML = '';
      el.empty.classList.remove('hidden');
      el.empty.textContent = err.message;
      renderPager(null);
    } finally {
      el.loading.classList.add('hidden');
    }
  }

  async function refreshQueue() {
    try {
      const res = await fetch('/api/tasks/queue/status');
      const json = await res.json();
      if (!json.success) return;
      const q = json.data;
      el.queueBadge.textContent =
        q.waiting || q.active
          ? `queue ${q.active} active · ${q.waiting} waiting`
          : `queue idle · done ${q.completed}`;
    } catch {
      el.queueBadge.textContent = 'queue ?';
    }
  }

  function renderColumnToggles() {
    el.columnsPanel.innerHTML = '';
    COLUMNS.forEach((col) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = state.visible[col.key];
      input.addEventListener('change', () => {
        // Keep at least one column visible
        const next = { ...state.visible, [col.key]: input.checked };
        if (!Object.values(next).some(Boolean)) {
          input.checked = true;
          return;
        }
        state.visible[col.key] = input.checked;
        loadTasks();
      });
      label.appendChild(input);
      label.append(` ${col.label}`);
      el.columnsPanel.appendChild(label);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/\s+/g, '');
  }

  function openDialog(dialog) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }

  function closeDialog(id) {
    const d = document.getElementById(id);
    if (d?.open) d.close();
  }

  // --- events ---
  document.getElementById('btnRefresh').addEventListener('click', () => {
    loadTasks();
    refreshQueue();
  });
  document.getElementById('btnOpenCreate').addEventListener('click', () => {
    el.createError.classList.add('hidden');
    openDialog(el.createDialog);
  });
  document.getElementById('btnOpenBulk').addEventListener('click', () => {
    el.bulkError.classList.add('hidden');
    el.bulkResult.classList.add('hidden');
    openDialog(el.bulkDialog);
  });
  document.getElementById('btnColumns').addEventListener('click', (e) => {
    e.stopPropagation();
    el.columnsPanel.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.columns-menu')) {
      el.columnsPanel.classList.add('hidden');
    }
  });
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeDialog(btn.dataset.close));
  });

  el.btnPrev.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      loadTasks();
    }
  });
  el.btnNext.addEventListener('click', () => {
    if (state.pagination?.hasNext) {
      state.page += 1;
      loadTasks();
    }
  });
  el.pageLimit.addEventListener('change', () => {
    state.limit = Number(el.pageLimit.value);
    state.page = 1;
    loadTasks();
  });

  el.searchInput.addEventListener('input', () => {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      state.search = el.searchInput.value.trim();
      state.page = 1;
      loadTasks();
    }, 350);
  });

  function bindFilter(node, key) {
    node.addEventListener('change', () => {
      state[key] = node.value.trim();
      state.page = 1;
      loadTasks();
    });
    // language / location are text inputs
    node.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        state[key] = node.value.trim();
        state.page = 1;
        loadTasks();
      }
    });
  }

  bindFilter(el.filterStatus, 'status');
  bindFilter(el.filterPriority, 'priority');
  bindFilter(el.filterLanguage, 'language');
  bindFilter(el.filterLocation, 'location');

  el.createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.createError.classList.add('hidden');
    const fd = new FormData(el.createForm);
    const body = Object.fromEntries(fd.entries());
    body.priority = Number(body.priority);
    body.location = Number(body.location);

    const btn = document.getElementById('createSubmit');
    btn.disabled = true;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg =
          json.message ||
          (json.errors && json.errors.map((x) => x.message || x).join(', ')) ||
          'Create failed';
        throw new Error(msg);
      }
      el.createDialog.close();
      el.createForm.reset();
      state.page = 1;
      await loadTasks();
    } catch (err) {
      el.createError.textContent = err.message;
      el.createError.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  });

  el.bulkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.bulkError.classList.add('hidden');
    el.bulkResult.classList.add('hidden');

    const file = document.getElementById('csvFile').files[0];
    if (!file) {
      el.bulkError.textContent = 'Pick a CSV file first';
      el.bulkError.classList.remove('hidden');
      return;
    }

    const body = new FormData();
    body.append('file', file);

    const btn = document.getElementById('bulkSubmit');
    btn.disabled = true;
    try {
      const res = await fetch('/api/tasks/bulk', { method: 'POST', body });
      const json = await res.json();

      if (!json.success && res.status >= 400 && !json.data) {
        throw new Error(json.message || 'Upload failed');
      }

      const d = json.data || {};
      let html = `<strong>${escapeHtml(json.message || '')}</strong><br/>`;
      html += `Valid: ${d.valid_count ?? 0} · Invalid: ${d.invalid_count ?? 0}`;
      if (d.queue) {
        html += `<br/>Batches: ${d.queue.total_batches} (${(d.queue.batch_sizes || []).join(', ')})`;
      }
      if (d.invalid_rows?.length) {
        html += '<ul>';
        d.invalid_rows.slice(0, 25).forEach((row) => {
          html += `<li>Row ${row.row}: ${escapeHtml((row.errors || []).join('; '))}</li>`;
        });
        if (d.invalid_rows.length > 25) {
          html += `<li>…and ${d.invalid_rows.length - 25} more</li>`;
        }
        html += '</ul>';
      }
      el.bulkResult.innerHTML = html;
      el.bulkResult.classList.remove('hidden');

      state.page = 1;
      await loadTasks();
      await refreshQueue();
    } catch (err) {
      el.bulkError.textContent = err.message;
      el.bulkError.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  });

  // Initial render + light polling so bulk jobs appear without a hard refresh
  renderColumnToggles();
  loadTasks();
  refreshQueue();
  setInterval(refreshQueue, 5000);
  // Soft-refresh the table while the queue still has active/waiting work
  setInterval(() => {
    if (el.queueBadge.textContent.includes('active') || el.queueBadge.textContent.includes('waiting')) {
      loadTasks();
    }
  }, 8000);
})();
