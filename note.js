class APIGhichuClient {
    constructor(baseUrl = '', defaultExpires = '24h') {
        this.baseUrl = baseUrl;
        this.defaultExpires = defaultExpires; // Mặc định là 24h
        this.defaultHeaders = {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache'
        };
    }

    /**
     * Generate a new UUID v4
     * @returns {string} UUID v4 string
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Create a new note with optional content
     * @param {string} content - Initial content for the note
     * @param {string} expires - Expiration option (24h,1d,7d,10d,30d,never)
     * @returns {Promise<{uuid: string, url: string, rawUrl: string}>}
     */
    async createNote(content = '', expires = null) {
        const uuid = this.generateUUID();
        const finalExpires = expires || this.defaultExpires; // Sử dụng defaultExpires nếu không được chỉ định
        
        if (content) {
            await this.saveNote(uuid, content, finalExpires);
        }
        
        return {
            uuid: uuid,
            url: `${this.baseUrl}/${uuid}`,
            rawUrl: `${this.baseUrl}/${uuid}?raw=true`
        };
    }

    /**
     * Get note content by UUID
     * @param {string} uuid - Note UUID
     * @returns {Promise<string>} Note content
     */
    async getNote(uuid) {
        try {
            const response = await fetch(`${this.baseUrl}/${uuid}?raw=true`, {
                method: 'GET',
                headers: this.defaultHeaders
            });

            if (response.ok) {
                return await response.text();
            } else if (response.status === 404) {
                return '';
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error getting note:', error);
            throw error;
        }
    }

    /**
     * Save note content
     * @param {string} uuid - Note UUID
     * @param {string} content - Note content to save
     * @param {string} expires - Expiration option (24h,1d,7d,10d,30d,never)
     * @returns {Promise<Object>} Save result
     */
    async saveNote(uuid, content, expires = null) {
        try {
            let url = `${this.baseUrl}/${uuid}`;
            const finalExpires = expires || this.defaultExpires;
            if (finalExpires) {
                url += `?expires=${encodeURIComponent(finalExpires)}`;
            }

            const response = await fetch(url, {
                method: 'PUT',
                headers: this.defaultHeaders,
                body: content
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Note saved successfully:', result);
                return result;
            } else {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`Save failed: ${error.error || response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Error saving note:', error);
            throw error;
        }
    }

    /**
     * Set expiration for an existing note (without changing content)
     * @param {string} uuid - Note UUID
     * @param {string} expires - Expiration option
     * @returns {Promise<Object>}
     */
    async setExpiration(uuid, expires) {
        const content = await this.getNote(uuid);
        return this.saveNote(uuid, content, expires);
    }

    /**
     * Delete a note
     * @param {string} uuid - Note UUID
     * @returns {Promise<Object>} Delete result
     */
    async deleteNote(uuid) {
        try {
            const response = await fetch(`${this.baseUrl}/${uuid}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });

            if (response.ok) {
                const result = await response.json();
                console.log('🗑️ Note deleted successfully:', result);
                return result;
            } else {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`Delete failed: ${error.error || response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Error deleting note:', error);
            throw error;
        }
    }

    /**
     * Check if a note exists
     * @param {string} uuid - Note UUID
     * @returns {Promise<boolean>} True if note exists
     */
    async noteExists(uuid) {
        try {
            const response = await fetch(`${this.baseUrl}/${uuid}?raw=true`, {
                method: 'HEAD',
                headers: this.defaultHeaders
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    // --- Các phương thức còn lại ---
    getContentStats(content) {
        const chars = content.length;
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        const lines = content ? content.split(/\r\n|\r|\n/).length : 0;
        const bytes = new Blob([content]).size;
        
        return { chars, words, lines, bytes };
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    detectLanguage(content) {
        // Đơn giản hóa: kiểm tra ký tự tiếng Việt có dấu
        const hasVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(content);
        return hasVietnamese ? 'vi' : 'en';
    }

    setupAutoSave(textarea, uuid, options = {}) {
        const {
            delay = 2000,
            onSaveStart = () => {},
            onSaveSuccess = () => {},
            onSaveError = () => {}
        } = options;
        
        let saveTimeout;
        
        const saveContent = async () => {
            const content = textarea.value;
            if (content === this._lastSavedContent) return;
            
            try {
                onSaveStart();
                await this.saveNote(uuid, content);
                this._lastSavedContent = content;
                onSaveSuccess();
            } catch (error) {
                onSaveError(error);
            }
        };
        
        textarea.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveContent, delay);
        });
        
        // Save immediately on page unload
        window.addEventListener('beforeunload', () => {
            if (textarea.value !== this._lastSavedContent) {
                saveContent();
            }
        });
        
        this._lastSavedContent = textarea.value;
    }

    setupLineNumbers(textarea, lineNumbersContainer) {
        const updateLineNumbers = () => {
            const lines = textarea.value.split(/\r\n|\r|\n/).length;
            const lineNumbersHtml = Array.from({ length: lines }, (_, i) => 
                `<div class="line-number text-right pr-4 text-gray-400 text-sm">${i + 1}</div>`
            ).join('');
            lineNumbersContainer.innerHTML = lineNumbersHtml;
        };
        
        textarea.addEventListener('input', updateLineNumbers);
        textarea.addEventListener('scroll', () => {
            lineNumbersContainer.scrollTop = textarea.scrollTop;
        });
        
        updateLineNumbers();
    }

    setupTabSupport(textarea) {
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                
                // Insert tab at cursor position
                textarea.value = textarea.value.substring(0, start) + 
                                 '    ' + 
                                 textarea.value.substring(end);
                
                // Move cursor after the inserted tab
                textarea.selectionStart = textarea.selectionEnd = start + 4;
            }
        });
    }

    async healthCheck() {
        try {
            const testUuid = this.generateUUID();
            const testContent = 'Health check test';
            await this.saveNote(testUuid, testContent, '1h');
            const retrieved = await this.getNote(testUuid);
            await this.deleteNote(testUuid);
            
            return {
                status: 'healthy',
                message: 'API is working correctly',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Export cho cả Node và Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIGhichuClient;
} else if (typeof window !== 'undefined') {
    window.APIGhichuClient = APIGhichuClient;
}

// Auto-initialize cho browser với defaultExpires = '24h'
if (typeof window !== 'undefined') {
    window.apiGhichu = new APIGhichuClient('', '24h');
    console.log('API Note đã hoạt động (mặc định: 24h)');
}