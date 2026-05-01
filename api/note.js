const fs = require("fs");
const path = require("path");
const noteUtils = require("../noteUtils");

const notesDir = noteUtils.notesDir;

module.exports = {
  info: {
    path: "/:UUID",
    title: "Note API",
    desc: "API for creating and retrieving notes",
    example_url: [
      { method: "GET", query: "/:UUID", desc: "Retrieve a note (UI if browser, raw if ?raw=true)" },
      { method: "PUT", query: "/:UUID", desc: "Create or update a note" },
      { method: "DELETE", query: "/:UUID", desc: "Delete a note" }
    ],
  },
  methods: {
    // GET /:UUID
    get: (req, res) => {
      const uuid = req.params.UUID;

      if (!uuid || uuid === ":UUID" || uuid.length > 36) {
        // Tạo UUID mới và redirect
        res.redirect(`./${require("uuid").v4()}`);
        return;
      }

      const filePath = noteUtils.getNoteDataPath(uuid);
      let meta = noteUtils.getNoteMetadata(uuid) || {};

      // Nếu chưa có expiresAt, set mặc định 24h
      if (!meta.expiresAt) {
        const defaultExpires = new Date();
        defaultExpires.setHours(defaultExpires.getHours() + 24);
        meta.expiresAt = defaultExpires.getTime();
        meta.expiresIn = "24h";
        noteUtils.saveNoteMetadata(uuid, meta);
      }

      // Nếu ghi chú đã hết hạn, trả về 410 Gone
      if (meta.expiresAt && Date.now() > meta.expiresAt) {
        res.status(410).send('Note expired');
        return;
      }

      const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";

      // Xử lý raw redirect (tính năng cũ)
      if (fs.existsSync(filePath + ".raw")) {
        const rawFilePath = fs.readFileSync(filePath + ".raw", "utf8");
        if (fs.existsSync(rawFilePath)) {
          res.set("content-type", "text/plain");
          res.end(fs.readFileSync(rawFilePath, "utf8"));
          return;
        } else {
          res.status(404).end();
          return;
        }
      }

      // Nếu yêu cầu raw, trả về plain text
      if (req.query.raw == "true" || !/^Mozilla/.test(req.headers["user-agent"])) {
        res.set("content-type", "text/plain");
        res.end(text);
        return;
      }

      // --- GIAO DIỆN EDITOR HTML với Tailwind CSS và Animation ---
      res.set("content-type", "text/html");
      res.end(`<!DOCTYPE html>
<html data-theme="dark">
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Editor - TKhanh</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .gradient-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            background-size: 200% 200%;
            animation: gradientShift 3s ease infinite;
        }
        
        .fade-in {
            animation: fadeIn 0.5s ease-out;
        }
        
        .pulse-animation {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        :root {
            --bg-light: #ffffff;
            --editor-bg-light: #f5f5f5;
            --text-light: #333333;
            --line-numbers-light: #858585;
            --line-numbers-bg-light: #f0f0f0;
            --border-light: #e0e0e0;
            --header-bg-light: #f3f3f3;
            --header-text-light: #333333;
            --active-line-light: #e3e8ec;
            --scrollbar-light: #c1c1c1;
            
            --bg-dark: #1e1e1e;
            --editor-bg-dark: #1e1e1e;
            --text-dark: #d4d4d4;
            --line-numbers-dark: #858585;
            --line-numbers-bg-dark: #1e1e1e;
            --border-dark: #444444;
            --header-bg-dark: #252526;
            --header-text-dark: #cccccc;
            --active-line-dark: #282828;
            --scrollbar-dark: #424242;
        }
        [data-theme="light"] {
            --bg: var(--bg-light);
            --editor-bg: var(--editor-bg-light);
            --text: var(--text-light);
            --line-numbers: var(--line-numbers-light);
            --line-numbers-bg: var(--line-numbers-bg-light);
            --border: var(--border-light);
            --header-bg: var(--header-bg-light);
            --header-text: var(--header-text-light);
            --active-line: var(--active-line-light);
            --scrollbar: var(--scrollbar-light);
        }
        [data-theme="dark"] {
            --bg: var(--bg-dark);
            --editor-bg: var(--editor-bg-dark);
            --text: var(--text-dark);
            --line-numbers: var(--line-numbers-dark);
            --line-numbers-bg: var(--line-numbers-bg-dark);
            --border: var(--border-dark);
            --header-bg: var(--header-bg-dark);
            --header-text: var(--header-text-dark);
            --active-line: var(--active-line-dark);
            --scrollbar: var(--scrollbar-dark);
        }
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Consolas', 'Monaco', 'Menlo', monospace;
        }
        
        body {
            margin: 0;
            padding: 0;
            background-color: var(--bg);
            color: var(--text);
            height: 100vh;
            display: flex;
            flex-direction: column;
            transition: background-color 0.3s, color 0.3s;
        }
        
        .editor-header {
            background-color: var(--header-bg);
            color: var(--header-text);
            padding: 8px 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border);
            flex-wrap: wrap;
        }
        
        .editor-title {
            font-size: 14px;
            font-weight: normal;
        }
        
        .editor-subtitle {
            font-size: 12px;
            opacity: 0.7;
            margin-top: 4px;
        }
        
        .note-info {
            background-color: var(--header-bg);
            color: var(--header-text);
            padding: 6px 12px;
            font-size: 12px;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            border-bottom: 1px solid var(--border);
            font-family: 'Consolas', monospace;
        }
        
        .info-item {
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.3s ease;
        }
        
        .info-item:hover {
            transform: translateY(-1px);
        }
        
        .info-label {
            opacity: 0.7;
        }
        
        .info-value {
            font-weight: 500;
        }
        
        .theme-toggle {
            background: none;
            border: 1px solid var(--border);
            color: var(--text);
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: all 0.3s ease;
        }
        
        .theme-toggle:hover {
            background-color: rgba(255, 255, 255, 0.1);
            transform: scale(1.05);
        }
        
        .expiration-selector {
            background: none;
            border: 1px solid var(--border);
            color: var(--text);
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 12px;
            background-color: var(--header-bg);
            cursor: pointer;
            margin-left: 8px;
            transition: all 0.3s ease;
        }
        
        .expiration-selector:hover {
            transform: scale(1.05);
        }
        
        .expiration-selector option {
            background-color: var(--header-bg);
            color: var(--text);
        }
        
        .delete-btn {
            background: none;
            border: 1px solid #ff6b6b;
            color: #ff6b6b;
            padding: 4px 10px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            margin-left: 8px;
            transition: all 0.3s ease;
        }
        
        .delete-btn:hover {
            background-color: rgba(255, 107, 107, 0.1);
            transform: scale(1.05);
        }
        
        .editor-container {
            display: flex;
            flex-grow: 1;
            overflow: hidden;
            position: relative;
        }
        
        .line-numbers {
            background-color: var(--line-numbers-bg);
            color: var(--line-numbers);
            padding: 8px 8px 8px 12px;
            text-align: right;
            user-select: none;
            border-right: 1px solid var(--border);
            overflow: hidden;
            min-width: 40px;
        }
        
        .line-number {
            font-size: 13px;
            line-height: 20px;
            white-space: nowrap;
            transition: all 0.2s ease;
        }
        
        .line-number:hover {
            color: var(--text);
            transform: translateX(-2px);
        }
        
        .editor-content {
            flex-grow: 1;
            display: flex;
            position: relative;
            overflow: auto;
        }
        
        .editor-textarea {
            width: 100%;
            height: 100%;
            background-color: var(--editor-bg);
            color: var(--text);
            border: none;
            resize: vertical;
            outline: none;
            padding: 8px 12px;
            font-size: 13px;
            line-height: 20px;
            white-space: pre;
            overflow: auto;
            tab-size: 4;
            min-height: 100px;
        }
        
        .editor-textarea:focus {
            outline: none;
        }
        
        .editor-textarea::-webkit-scrollbar {
            width: 14px;
            height: 14px;
        }
        
        .editor-textarea::-webkit-scrollbar-thumb {
            background-color: var(--scrollbar);
            border-radius: 7px;
            border: 3px solid var(--editor-bg);
            transition: all 0.3s ease;
        }
        
        .editor-textarea::-webkit-scrollbar-thumb:hover {
            background-color: var(--line-numbers);
        }
        
        .editor-textarea::-webkit-scrollbar-track {
            background-color: var(--editor-bg);
        }
        
        .status-bar {
            background-color: var(--header-bg);
            color: var(--line-numbers);
            padding: 4px 12px;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            border-top: 1px solid var(--border);
        }
        
        .status-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: #4caf50;
            margin-right: 4px;
            transition: all 0.3s ease;
        }
        
        .status-indicator.saving {
            background-color: #ff9800;
            animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes slideIn {
            from {
                transform: translateX(-100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        .gradient-text {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
    </style>
</head>
<body>
    <!-- Gradient Header -->
    <div class="gradient-bg h-1 w-full"></div>
    
    <div class="editor-header">
        <div class="fade-in">
            <h3 class="editor-title">
                <span class="gradient-text">🌟 Note Service</span>
            </h3>
            <div class="editor-subtitle">Changes are automatically saved after 1s</div>
        </div>
        <div style="display: flex; align-items: center;">
            <select id="expirationSelect" class="expiration-selector">
                <option value="24h" selected>24 hours</option>
                <option value="1d">1 day</option>
                <option value="7d">7 days</option>
                <option value="10d">10 days</option>
                <option value="30d">30 days</option>
                <option value="never">Never expires</option>
            </select>
            <button class="delete-btn" id="deleteNoteBtn">🗑️ Delete</button>
            <button class="theme-toggle" id="themeToggle">
                <svg id="theme-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
                <span id="theme-text">Light Mode</span>
            </button>
        </div>
    </div>

    <!-- KHU VỰC HIỂN THỊ THÔNG TIN GHI CHÚ -->
    <div class="note-info" id="noteInfo">
        <div class="info-item"><span class="info-label">📅 Created:</span> <span id="createdDate" class="info-value">-</span></div>
        <div class="info-item"><span class="info-label">⏰ Expires:</span> <span id="expiresDate" class="info-value">-</span></div>
        <div class="info-item"><span class="info-label">📦 Size:</span> <span id="noteSize" class="info-value">0 B</span></div>
        <div class="info-item"><span class="info-label">📝 Words:</span> <span id="wordCount" class="info-value">0</span></div>
        <div class="info-item"><span class="info-label">📄 Lines:</span> <span id="lineCount" class="info-value">0</span></div>
    </div>
    
    <div class="editor-container">
        <div class="line-numbers" id="lineNumbers"></div>
        <div class="editor-content">
            <textarea id="editor" class="editor-textarea" placeholder="Start typing..."></textarea>
        </div>
    </div>
    
    <div class="status-bar">
        <div class="status-item">
            <span id="statusIndicator" class="status-indicator"></span>
            <span id="statusText">Ready</span>
        </div>
        <div class="status-item">
            <span id="cursorPosition">Ln 1, Col 1</span>
        </div>
    </div>

    <!-- NHÚNG METADATA CỦA GHI CHÚ -->
    <script id="note-meta" type="application/json">
        ${JSON.stringify({
          uuid,
          createdAt: meta.createdAt || null,
          expiresAt: meta.expiresAt || null,
          expiresIn: meta.expiresIn || "24h"
        })}
    </script>
    
    <script>
        const editor = document.getElementById('editor');
        const lineNumbers = document.getElementById('lineNumbers');
        const themeToggle = document.getElementById('themeToggle');
        const themeText = document.getElementById('theme-text');
        const themeIcon = document.getElementById('theme-icon');
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const cursorPosition = document.getElementById('cursorPosition');
        const html = document.documentElement;
        const expirationSelect = document.getElementById('expirationSelect');
        const deleteBtn = document.getElementById('deleteNoteBtn');
        
        // Lấy metadata nhúng
        const noteMeta = JSON.parse(document.getElementById('note-meta').textContent);
        const currentUUID = noteMeta.uuid;
        
        // ===== HIỂN THỊ THÔNG TIN GHI CHÚ =====
        function formatDate(timestamp) {
            if (!timestamp) return 'Never';
            const date = new Date(timestamp);
            return date.toLocaleString();
        }
        
        function updateNoteInfo(stats) {
            document.getElementById('createdDate').textContent = formatDate(noteMeta.createdAt);
            document.getElementById('expiresDate').textContent = formatDate(noteMeta.expiresAt);
            document.getElementById('noteSize').textContent = stats?.size || '0 B';
            document.getElementById('wordCount').textContent = stats?.words || 0;
            document.getElementById('lineCount').textContent = stats?.lines || 0;
        }
        
        // Đặt giá trị dropdown theo expiration hiện tại
        if (noteMeta.expiresAt) {
            const now = Date.now();
            const diff = noteMeta.expiresAt - now;
            if (diff <= 24 * 60 * 60 * 1000) expirationSelect.value = '24h';
            else if (diff <= 1 * 24 * 60 * 60 * 1000) expirationSelect.value = '1d';
            else if (diff <= 7 * 24 * 60 * 60 * 1000) expirationSelect.value = '7d';
            else if (diff <= 10 * 24 * 60 * 60 * 1000) expirationSelect.value = '10d';
            else if (diff <= 30 * 24 * 60 * 60 * 1000) expirationSelect.value = '30d';
            else expirationSelect.value = 'never';
        } else {
            expirationSelect.value = '24h'; // Set default to 24h
        }
        
        // ===== CHỨC NĂNG THEME =====
        themeToggle.addEventListener('click', () => {
            const currentTheme = html.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', newTheme);
            
            if (newTheme === 'light') {
                themeText.textContent = 'Dark Mode';
                themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
            } else {
                themeText.textContent = 'Light Mode';
                themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
            }
        });
        
        // ===== CẬP NHẬT SỐ DÒNG =====
        const updateLineNumbers = () => {
            const lines = editor.value.split('\\n');
            lineNumbers.innerHTML = '';
            for (let i = 0; i < lines.length; i++) {
                const lineNumber = document.createElement('div');
                lineNumber.className = 'line-number';
                lineNumber.textContent = i + 1;
                lineNumbers.appendChild(lineNumber);
            }
        };
        
        // ===== CẬP NHẬT VỊ TRÍ CON TRỎ =====
        const updateCursorPosition = () => {
            const text = editor.value;
            const position = editor.selectionStart;
            const lines = text.substr(0, position).split('\\n');
            const lineNumber = lines.length;
            const columnNumber = lines[lines.length - 1].length + 1;
            cursorPosition.textContent = 'Ln ' + lineNumber + ', Col ' + columnNumber;
        };
        
        // ===== TÍNH TOÁN THỐNG KÊ NỘI DUNG =====
        function getContentStats(content) {
            const lines = content.split('\\n');
            const words = content.trim() ? content.trim().split(/\\s+/).length : 0;
            const chars = content.length;
            const bytes = new Blob([content]).size;
            
            let size;
            if (bytes < 1024) size = bytes + ' B';
            else if (bytes < 1024 * 1024) size = (bytes / 1024).toFixed(1) + ' KB';
            else size = (bytes / (1024 * 1024)).toFixed(1) + ' MB';
            
            return { lines: lines.length, words, characters: chars, bytes, size };
        }
        
        // ===== LƯU GHI CHÚ =====
        let saveTimeout;
        const saveNote = (expires = null) => {
            statusIndicator.classList.add('saving');
            statusText.textContent = 'Saving...';
            
            let url = location.href;
            if (expires) {
                url += (url.includes('?') ? '&' : '?') + 'expires=' + encodeURIComponent(expires);
            }
            
            fetch(url, {
                method: 'PUT',
                headers: { 'content-type': 'text/plain; charset=utf-8' },
                body: editor.value,
            }).then(() => {
                statusIndicator.classList.remove('saving');
                statusText.textContent = 'Saved ✨';
                
                const stats = getContentStats(editor.value);
                updateNoteInfo(stats);
                
                setTimeout(() => {
                    statusText.textContent = 'Ready';
                }, 2000);
            }).catch(err => {
                statusIndicator.classList.remove('saving');
                statusText.textContent = 'Save failed 😢';
                console.error(err);
            });
        };
        
        // ===== XOÁ GHI CHÚ =====
        const deleteNote = () => {
            if (confirm('⚠️ Bạn có chắc muốn xoá note này không? Hành động này không thể hoàn tác!')) {
                fetch(location.href, { method: 'DELETE' })
                    .then(() => {
                        window.location.href = '/';
                    })
                    .catch(err => console.error(err));
            }
        };
        
        // ===== SỰ KIỆN =====
        editor.addEventListener('input', () => {
            updateLineNumbers();
            updateCursorPosition();
            const stats = getContentStats(editor.value);
            updateNoteInfo(stats);
            
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => saveNote(expirationSelect.value), 1000);
        });
        
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = start + 4;
                updateLineNumbers();
                updateCursorPosition();
                if (saveTimeout) clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => saveNote(expirationSelect.value), 1000);
            }
            
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                clearTimeout(saveTimeout);
                saveNote(expirationSelect.value);
            }
        });
        
        editor.addEventListener('click', updateCursorPosition);
        editor.addEventListener('keyup', updateCursorPosition);
        
        editor.addEventListener('scroll', () => {
            lineNumbers.scrollTop = editor.scrollTop;
        });
        
        expirationSelect.addEventListener('change', () => {
            clearTimeout(saveTimeout);
            saveNote(expirationSelect.value);
        });
        
        deleteBtn.addEventListener('click', deleteNote);
        
        // ===== TẢI NỘI DUNG GHI CHÚ =====
        const u = new URL(location.href);
        u.searchParams.append('raw', 'true');
        fetch(u.href, { method: 'GET', headers: { 'user-agent': 'fetch' } })
            .then(r => r.text())
            .then(t => {
                editor.value = t;
                updateLineNumbers();
                updateCursorPosition();
                const stats = getContentStats(editor.value);
                updateNoteInfo(stats);
            });
    </script>
</body>
</html>`);
    },

    // PUT /:UUID (tạo/cập nhật)
    put: async (req, res) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      await new Promise((resolve) => req.on("end", resolve));

      const uuid = req.params.UUID;
      const filePath = noteUtils.getNoteDataPath(uuid);

      // Ghi nội dung
      fs.writeFileSync(filePath, Buffer.concat(chunks));

      // Xử lý metadata
      let meta = noteUtils.getNoteMetadata(uuid) || {};
      const now = Date.now();
      if (!meta.createdAt) meta.createdAt = now;
      meta.updatedAt = now;

      // Xử lý thời gian hết hạn
      if (req.query.expires) {
        const expiresAt = noteUtils.parseExpiration(req.query.expires);
        meta.expiresAt = expiresAt;
        meta.expiresIn = req.query.expires;
      } else if (!meta.expiresAt) {
        // Nếu không có expires trong request và chưa có expiresAt, set mặc định 24h
        const defaultExpires = new Date();
        defaultExpires.setHours(defaultExpires.getHours() + 24);
        meta.expiresAt = defaultExpires.getTime();
        meta.expiresIn = "24h";
      }

      noteUtils.saveNoteMetadata(uuid, meta);

      // Xử lý raw redirect (tính năng cũ)
      if (req.query.raw) {
        if (!fs.existsSync(filePath + ".raw")) {
          fs.writeFileSync(filePath + ".raw", path.join(notesDir, `${req.query.raw}.txt`));
        }
      }

      res.json({ success: true, uuid, updatedAt: meta.updatedAt, expiresAt: meta.expiresAt });
    },

    // DELETE /:UUID
    delete: (req, res) => {
      const uuid = req.params.UUID;
      const txtPath = noteUtils.getNoteDataPath(uuid);
      const metaPath = noteUtils.getNoteMetaPath(uuid);
      const rawPath = path.join(notesDir, `${uuid}.txt.raw`);

      if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
      if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);

      res.json({ success: true, uuid });
    }
  },
};