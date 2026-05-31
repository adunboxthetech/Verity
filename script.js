class FactCheckerApp {
    constructor() {
        this.apiUrl = window.location.protocol === 'file:' ? 'http://localhost:5001/api' : '/api';   // Use API routes for Vercel serverless functions
        this.initializeElements();
        this.bindEvents();
        this.initializeTheme();
        this.updateResultsHeader('Analysis Complete', false);
        this.populateFromUrlParams();
    }

    populateFromUrlParams() {
        try {
            const params = new URLSearchParams(window.location.search);
            const text = params.get('text');
            if (!text || !this.textInput) return;
            this.textInput.value = text.slice(0, 20000);
            this.textInput.dispatchEvent(new Event('input'));
            this.textInput.focus();
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (_) {}
    }

    initializeElements() {
        this.textInput = document.getElementById('textInput');
        this.factCheckBtn = document.getElementById('factCheckBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.loadingSection = document.getElementById('loadingSection');
        this.resultsSection = document.getElementById('resultsSection');
        this.resultsTitle = document.getElementById('resultsTitle');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.themeToggle = document.getElementById('themeToggle');
        this.imageDrop = document.getElementById('imageDrop');
        this.imageInput = document.getElementById('imageInput');
        this.imagePreview = document.getElementById('imagePreview');
        this.copyReportBtn = document.getElementById('copyReportBtn');
        this.downloadCardBtn = document.getElementById('downloadCardBtn');
        this.downloadReportBtn = document.getElementById('downloadReportBtn');
        this.posterStyleSelect = document.getElementById('posterStyleSelect');
        this.ambientGradient = document.getElementById('ambientGradient');
        this.welcomeSection = document.getElementById('welcomeSection');
        this.mainScrollable = document.querySelector('.main-scrollable');
        this.bottomArea = document.querySelector('.bottom-area');
        this.brandLogo = document.getElementById('brandLogo');
        this.analyzeImageBtn = null;
        this.lastResult = null;
        this.currentAbortController = null;
        this.isChecking = false;
        this.checkCancelled = false;
    }

    bindEvents() {
        this.factCheckBtn.addEventListener('click', () => this.handleFactCheck());
        this.clearBtn.addEventListener('click', () => this.handleClear());
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        if (this.copyReportBtn) {
            this.copyReportBtn.addEventListener('click', () => this.copyReport());
        }
        if (this.downloadCardBtn) {
            this.downloadCardBtn.addEventListener('click', () => this.downloadShareCard());
        }
        if (this.downloadReportBtn) {
            this.downloadReportBtn.addEventListener('click', () => this.exportShareCard());
        }
        if (this.imageDrop) {
            this.imageDrop.addEventListener('click', () => this.imageInput.click());
            this.imageDrop.addEventListener('dragover', (e) => { e.preventDefault(); });
            this.imageDrop.addEventListener('drop', (e) => {
                e.preventDefault();
                const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
                if (files.length) this.loadImages(files);
            });
        }
        if (this.imageInput) {
            this.imageInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
                if (files.length) this.loadImages(files);
            });
        }
        // single button handles both

        // Allow Enter to trigger fact check
        this.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleFactCheck();
            }
        });

        // Also allow Enter to send if focus is on the prompt container
        // when image is loaded and textarea is hidden
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && this.imageDataUrl) {
                const active = document.activeElement;
                if (active && (active.classList.contains('remove') || active.id === 'clearBtn' || active.id === 'themeToggle')) {
                    return; // Let the focused button handle its own click
                }
                e.preventDefault();
                this.handleFactCheck();
            }
        });

        // Handle pasting images
        document.addEventListener('paste', (e) => {
            // Ignore if pasting into a specific input that might want text
            // But actually we want to catch it globally if it's an image.
            const clipboardData = e.clipboardData || (e.originalEvent && e.originalEvent.clipboardData);
            if (!clipboardData) return;
            const items = clipboardData.items;
            const files = [];
            for (let index in items) {
                const item = items[index];
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    files.push(item.getAsFile());
                }
            }
            if (files.length > 0) {
                e.preventDefault();
                this.loadImages(files);
            }
        });

        // Auto-resize textarea
        this.textInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (Math.min(this.scrollHeight, 200)) + 'px';
        });
    }

    async loadImages(files) {
        // Single image for now
        const file = files[0];

        // Check file size (limit to 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image file is too large. Please use an image smaller than 5MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            this.imageDataUrl = reader.result;
            this.renderImagePreview(this.imageDataUrl);
        };
        reader.readAsDataURL(file);
    }

    renderImagePreview(dataUrl) {
        if (!this.imagePreview) return;
        this.imagePreview.style.opacity = '';
        this.imagePreview.style.transition = '';
        this.imagePreview.classList.remove('hidden');
        if (this.textInput) {
            this.textInput.style.display = 'none';
        }
        this.imagePreview.innerHTML = `
            <div class="thumb">
                <img src="${this.escapeAttribute(dataUrl)}" alt="Uploaded image preview" />
                <button class="remove" type="button" aria-label="Remove image" title="Remove image">
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
            </div>
        `;
        this.imagePreview.querySelector('.remove').addEventListener('click', () => {
            this.imageDataUrl = null;
            this.imagePreview.classList.add('hidden');
            this.imagePreview.innerHTML = '';
            if (this.textInput) {
                this.textInput.style.display = '';
            }
            this.updateFactCheckButtonState();
        });
        this.updateFactCheckButtonState();
    }

    initializeTheme() {
        const html = document.documentElement;
        const stored = localStorage.getItem('verity-theme');
        const current = html.getAttribute('data-theme') || stored || 'light';
        this.applyTheme(current);
        // Reveal icon after initial theme applied (avoid FOUC)
        const icon = document.querySelector('.icon-btn i');
        if (icon) icon.style.visibility = 'visible';

        // If no stored preference, follow system changes
        if (!stored && window.matchMedia) {
            const mm = window.matchMedia('(prefers-color-scheme: dark)');
            if (mm.addEventListener) {
                mm.addEventListener('change', (e) => {
                    if (!localStorage.getItem('verity-theme')) {
                        this.applyTheme(e.matches ? 'dark' : 'light');
                    }
                });
            } else if (mm.addListener) {
                // Safari
                mm.addListener((e) => {
                    if (!localStorage.getItem('verity-theme')) {
                        this.applyTheme(e.matches ? 'dark' : 'light');
                    }
                });
            }
        }
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.updateThemeIcon(theme);
        if (this.brandLogo) {
            this.brandLogo.src = theme === 'dark' ? 'assets/AD_logo.png' : 'assets/AD_logo_black.png';
            this.brandLogo.onerror = () => {
                this.brandLogo.onerror = null;
                this.brandLogo.src = theme === 'dark' ? 'assets/logo.png' : 'assets/logo_black.png';
            };
        }
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        this.applyTheme(next);
        try { localStorage.setItem('verity-theme', next); } catch (_) {}
    }

    updateThemeIcon(theme) {
        if (!this.themeToggle) return;
        const icon = this.themeToggle.querySelector('i');
        if (!icon) return;
        icon.className = `fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`;
        this.themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
        this.themeToggle.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
    }

     updateFactCheckButtonState() {
        if (!this.factCheckBtn) return;
        const hasImage = Boolean(this.imageDataUrl);
        const icon = this.factCheckBtn.querySelector('i');
        const label = this.factCheckBtn.querySelector('.btn-label');
        if (icon) icon.className = `fas fa-arrow-up`;
        if (label) label.textContent = hasImage ? 'Analyze Image' : 'Fact Check Now';
    }

    async handleFactCheck() {
        if (this.isChecking) {
            this.cancelFactCheck();
            return;
        }

        const text = this.textInput.value.trim();
        const hasImage = Boolean(this.imageDataUrl);

        if (!text && !hasImage) {
            alert('Please enter text/URL or upload an image.');
            return;
        }

        // Trigger the magical text shatter animation first
        if (hasImage && typeof mysticalEngine !== 'undefined') {
            const imgElement = this.imagePreview.querySelector('img');
            mysticalEngine.shatterImage(imgElement, () => this.executeFactCheck(text, hasImage));
        } else if (text && typeof mysticalEngine !== 'undefined') {
            mysticalEngine.shatterText(this.textInput, () => this.executeFactCheck(text, hasImage));
        } else {
            this.executeFactCheck(text, hasImage);
        }
    }

    async executeFactCheck(text, hasImage) {
        this.currentAbortController = new AbortController();
        this.checkCancelled = false;
        this.showLoading();
        try {
            let response;
            if (hasImage) {
                const payload = { image_data_url: this.imageDataUrl };
                const url = `${this.apiUrl}/fact-check-image`;

                response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: this.currentAbortController.signal
                });
            } else {
                const payload = this.buildPayload(text);
                response = await fetch(`${this.apiUrl}/fact-check`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: this.currentAbortController.signal
                });
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('HTTP Error:', response.status, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            this.displayResults(data);
        } catch (error) {
            if (error.name === 'AbortError' || this.checkCancelled) {
                return;
            }
            console.error('Fact-check error:', error);
            this.showError(`Failed to fact-check: ${error.message}`);
        } finally {
            this.hideLoading(this.checkCancelled);
        }
    }

    cancelFactCheck() {
        if (!this.isChecking) return;
        this.checkCancelled = true;
        if (this.currentAbortController) {
            this.currentAbortController.abort();
        }
    }

    buildPayload(input) {
        const trimmed = input.trim();
        if (!trimmed) return { text: '' };

        const hasScheme = /^https?:\/\//i.test(trimmed);
        const noSpaces = !/\s/.test(trimmed);
        const looksLikeDomain = /^[\w.-]+\.[a-z]{2,}(?::\d+)?(?:[\/?#].*)?$/i.test(trimmed);

        if (hasScheme || (noSpaces && looksLikeDomain)) {
            const url = hasScheme ? trimmed : `https://${trimmed}`;
            return { url };
        }

        return { text: trimmed };
    }

    handleClear() {
        this.textInput.value = '';
        this.textInput.style.height = 'auto';
        this.textInput.style.color = ''; // Restore text color after magical transition
        this.hideResults();
        if (this.welcomeSection) this.welcomeSection.classList.remove('hidden');
        // Exit results-mode: restore footer
        if (this.bottomArea) this.bottomArea.classList.remove('results-mode');
        // Restore clear button to icon-only
        this.clearBtn.innerHTML = '<i class="fas fa-eraser"></i>';

        // Remove image
        this.imageDataUrl = null;
        if (this.imagePreview) {
            this.imagePreview.classList.add('hidden');
            this.imagePreview.innerHTML = '';
        }
        if (this.textInput) {
            this.textInput.style.display = '';
        }
        this.updateFactCheckButtonState();
        this.updateResultsHeader();

        if (typeof mysticalEngine !== 'undefined') {
            mysticalEngine.resetInput();
        }
        this.textInput.focus();
    }

    showLoading() {
        this.isChecking = true;
        if (this.welcomeSection) this.welcomeSection.classList.add('hidden');
        this.loadingSection.classList.remove('hidden');
        this.resultsSection.classList.add('hidden');
        if (this.bottomArea) {
            this.bottomArea.classList.remove('results-mode');
            this.bottomArea.classList.add('checking-mode');
        }
        this.factCheckBtn.disabled = false;
        this.factCheckBtn.title = 'Cancel check';
        this.factCheckBtn.setAttribute('aria-label', 'Cancel check');
        this.factCheckBtn.innerHTML = '<i class="fas fa-stop"></i><span class="btn-label hidden-label">Cancel</span>';
        // Start cloud morph animation
        if (typeof mysticalEngine !== 'undefined') {
            mysticalEngine.startCloudLoading();
        }
    }

    hideLoading(cancelled = false) {
        this.isChecking = false;
        this.currentAbortController = null;
        if (this.bottomArea) this.bottomArea.classList.remove('checking-mode');
        this.factCheckBtn.disabled = false;
        this.factCheckBtn.title = 'Fact Check Now';
        this.factCheckBtn.setAttribute('aria-label', 'Fact Check Now');
        this.updateFactCheckButtonState();
        // Disperse cloud then hide loading section
        if (typeof mysticalEngine !== 'undefined') {
            mysticalEngine.disperseCloud(() => {
                this.loadingSection.classList.add('hidden');
                if (cancelled && this.resultsSection.classList.contains('hidden') && this.welcomeSection) {
                    this.welcomeSection.classList.remove('hidden');
                }
            });
            if (cancelled) mysticalEngine.resetInput();
        } else {
            this.loadingSection.classList.add('hidden');
            if (cancelled && this.resultsSection.classList.contains('hidden') && this.welcomeSection) {
                this.welcomeSection.classList.remove('hidden');
            }
        }
    }

    hideResults() {
        this.resultsSection.classList.add('hidden');
    }

    displayResults(data) {

        this.resultsContainer.innerHTML = '';
        this.lastResult = data;
        const resultItems = Array.isArray(data.fact_check_results) ? data.fact_check_results : [];
        const hasBlockingError = Boolean((data.analysis_error || data.image_analysis_error) && resultItems.length === 0);
        this.updateResultsHeader(hasBlockingError ? 'Check blocked' : 'Analysis Complete', resultItems.length > 0);

        if (data.source_url && this.isSafeHttpUrl(data.source_url)) {
            const safeSourceUrl = this.escapeAttribute(data.source_url);
            const src = document.createElement('div');
            src.className = 'source-banner';
            src.innerHTML = `
                <i class="fas fa-link"></i>
                <span>Source:</span>
                <a href="${safeSourceUrl}" target="_blank" rel="noopener">${this.escapeHtml(data.source_url)}</a>
            `;
            this.resultsContainer.appendChild(src);
            if (data.source_title) {
                const title = document.createElement('div');
                title.style.margin = '6px 0 10px';
                title.style.color = 'var(--muted)';
                title.style.fontSize = '0.95rem';
                title.innerHTML = `<i class="fas fa-file-lines"></i> <strong>Title:</strong> ${this.escapeHtml(data.source_title)}`;
                this.resultsContainer.appendChild(title);
            }
            if (typeof data.images_detected === 'number' && data.images_detected >= 0) {
                const imgInfo = document.createElement('div');
                imgInfo.style.margin = '4px 0 12px';
                imgInfo.style.color = 'var(--muted)';
                imgInfo.style.fontSize = '0.9rem';

                // Check if images were detected but not accessible
                if (data.images_detected === 0 && data.image_detection_info && data.image_detection_info.image_detected) {
                    imgInfo.innerHTML = `<i class="fas fa-image"></i> <strong>Images detected:</strong> Images found in this post, but they cannot be accessed directly from the URL.`;
                    imgInfo.style.color = 'var(--warning)';
                } else if (data.image_analysis_skipped_reason) {
                    imgInfo.innerHTML = `<i class="fas fa-image"></i> <strong>Images detected:</strong> ${data.images_detected}. Visual analysis skipped.`;
                } else if (data.image_analysis_error) {
                    imgInfo.innerHTML = `<i class="fas fa-image"></i> <strong>Images detected:</strong> ${data.images_detected}. Visual analysis could not complete.`;
                    imgInfo.style.color = 'var(--warning)';
                } else {
                    imgInfo.innerHTML = `<i class="fas fa-image"></i> <strong>Images detected:</strong> ${data.images_detected}. ${data.images_detected > 0 ? 'Visual content was considered in the analysis.' : 'No images detected.'}`;
                }
                this.resultsContainer.appendChild(imgInfo);

                const imageMessage = data.image_analysis_error || data.image_detection_message || data.image_analysis_skipped_reason;
                if (imageMessage) {
                    const msgDiv = document.createElement('div');
                    msgDiv.style.margin = '8px 0 12px';
                    msgDiv.style.padding = '8px 12px';
                    msgDiv.style.backgroundColor = data.image_analysis_skipped_reason ? 'rgba(255,255,255,0.04)' : 'var(--warning-bg)';
                    msgDiv.style.border = data.image_analysis_skipped_reason ? '1px solid var(--border)' : '1px solid var(--warning)';
                    msgDiv.style.borderRadius = '6px';
                    msgDiv.style.color = data.image_analysis_skipped_reason ? 'var(--muted)' : 'var(--warning)';
                    msgDiv.style.fontSize = '0.9rem';
                    const friendlyImageMsg = this.getFriendlyErrorMessage(imageMessage);
                    msgDiv.innerHTML = `<i class="fas fa-info-circle"></i> ${this.escapeHtml(friendlyImageMsg)}`;
                    this.resultsContainer.appendChild(msgDiv);
                }
            }
            const selected = data.selected_image_url || (Array.isArray(data.debug_image_urls) && data.debug_image_urls.length ? data.debug_image_urls[0] : null);
            if (selected && this.isSafeHttpUrl(selected)) {
                const thumbWrap = document.createElement('div');
                thumbWrap.style.margin = '6px 0 14px';
                thumbWrap.innerHTML = `
                    <div style="display:flex;align-items:center;gap:10px;">
                        <img src="${this.escapeAttribute(selected)}" alt="Analyzed image" style="max-height:80px;border-radius:6px;border:1px solid var(--border);"/>
                        <a href="${this.escapeAttribute(selected)}" target="_blank" rel="noopener" class="source-link">
                            <i class="fas fa-up-right-from-square"></i> Open analyzed image
                        </a>
                    </div>
                `;
                this.resultsContainer.appendChild(thumbWrap);
            }
        }

        if (data.analysis_error) {
            const msgDiv = document.createElement('div');
            msgDiv.style.margin = '8px 0 12px';
            msgDiv.style.padding = '8px 12px';
            msgDiv.style.backgroundColor = 'var(--warning-bg)';
            msgDiv.style.border = '1px solid var(--warning)';
            msgDiv.style.borderRadius = '6px';
            msgDiv.style.color = 'var(--warning)';
            msgDiv.style.fontSize = '0.9rem';
            const friendlyMsg = this.getFriendlyErrorMessage(data.analysis_error);
            msgDiv.innerHTML = `<i class="fas fa-info-circle"></i> ${this.escapeHtml(friendlyMsg)}`;
            this.resultsContainer.appendChild(msgDiv);
        }

        const breakdownElement = hasBlockingError ? null : this.createClaimBreakdownElement(data.claim_breakdown);
        if (breakdownElement) {
            this.resultsContainer.appendChild(breakdownElement);
        }

        if (resultItems.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'empty-result';
            empty.textContent = hasBlockingError ? 'Try again after the provider limit resets, or configure another AI provider key.' : 'No factual claims found to verify.';
            if (!hasBlockingError) {
                this.resultsContainer.appendChild(empty);
            }
        } else {
            let allClaims = [];
            resultItems.forEach((result) => {
                const subClaims = this.extractSubClaims(result);
                if (subClaims && subClaims.length > 0) {
                    allClaims.push(...subClaims);
                } else {
                    allClaims.push(result);
                }
            });

            allClaims.forEach((result, index) => {
                const claimElement = this.createClaimElement(result, index + 1);
                this.resultsContainer.appendChild(claimElement);
            });
        }

        this.resultsSection.classList.remove('hidden');

        // Trigger cinematic reveal
        if (typeof mysticalEngine !== 'undefined') {
            mysticalEngine.triggerReveal();
        }

        // Enter results-mode: centered clear button, hide attach/send
        if (this.bottomArea) this.bottomArea.classList.add('results-mode');
        this.clearBtn.innerHTML = '<i class="fas fa-eraser"></i><span class="clear-label">New Check</span>';

        this.scrollResultsHeaderIntoView();
    }

    updateResultsHeader(title = 'Analysis Complete', canExport = false) {
        if (this.resultsTitle) {
            this.resultsTitle.textContent = title;
        }
        [this.copyReportBtn, this.downloadCardBtn, this.downloadReportBtn].forEach((button) => {
            if (!button) return;
            button.disabled = !canExport;
            button.setAttribute('aria-disabled', String(!canExport));
        });
    }

    scrollResultsHeaderIntoView() {
        if (!this.resultsSection) return;
        window.requestAnimationFrame(() => {
            if (this.mainScrollable) {
                this.mainScrollable.scrollTo({
                    top: Math.max(0, this.resultsSection.offsetTop - 12),
                    behavior: 'smooth',
                });
                return;
            }
            this.resultsSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest',
            });
        });
    }

    extractSubClaims(result) {
        if (!result || !result.result || !result.result.explanation) return null;

        let exp = result.result.explanation;
        if (typeof exp !== 'string') return null;

        try {
            let jsonStr = exp;

            if (jsonStr.includes('```')) {
                const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
                if (match && match[1]) {
                    jsonStr = match[1];
                }
            }

            if (jsonStr.trim().startsWith('json ')) {
                jsonStr = jsonStr.trim().substring(5);
            }

            const processParsedJson = (parsed) => {
                let claimsArray = null;
                if (Array.isArray(parsed)) {
                    claimsArray = parsed;
                } else if (parsed.claims && Array.isArray(parsed.claims)) {
                    claimsArray = parsed.claims;
                } else if (parsed.fact_check_results && Array.isArray(parsed.fact_check_results)) {
                    claimsArray = parsed.fact_check_results;
                }

                if (claimsArray && claimsArray.length > 0 && claimsArray[0].claim) {
                    return claimsArray.map(c => {
                        return {
                            claim: c.claim,
                            result: {
                                verdict: c.verdict || (c.result && c.result.verdict) || 'UNKNOWN',
                                explanation: c.explanation || (c.result && c.result.explanation) || '',
                                confidence: c.confidence || (c.result && c.result.confidence) || result.result.confidence || null,
                                sources: c.sources || (c.result && c.result.sources) || result.result.sources || []
                            }
                        };
                    });
                }
                return null;
            };

            try {
                return processParsedJson(JSON.parse(jsonStr));
            } catch (e) {
                let firstBrace = jsonStr.indexOf('{');
                let firstBracket = jsonStr.indexOf('[');
                let startIdx = -1;

                if (firstBrace !== -1 && firstBracket !== -1) startIdx = Math.min(firstBrace, firstBracket);
                else if (firstBrace !== -1) startIdx = firstBrace;
                else if (firstBracket !== -1) startIdx = firstBracket;

                if (startIdx !== -1) {
                    // Shrink from the right to find a valid JSON block
                    for (let endIdx = jsonStr.length - 1; endIdx >= startIdx; endIdx--) {
                        if (jsonStr[endIdx] === '}' || jsonStr[endIdx] === ']') {
                            let cleanJson = jsonStr.substring(startIdx, endIdx + 1);

                            try {
                                let result = processParsedJson(JSON.parse(cleanJson));
                                if (result) return result;
                            } catch (innerE) {
                                try {
                                    let fixedJson = cleanJson.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
                                    let result = processParsedJson(JSON.parse(fixedJson));
                                    if (result) return result;
                                } catch (e3) {
                                    try {
                                        let fixedJson = cleanJson.replace(/,\s*([}\]])/g, '$1');
                                        let result = processParsedJson(JSON.parse(fixedJson));
                                        if (result) return result;
                                    } catch (e4) {
                                        // Continue trying shorter substrings
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Error extracting sub-claims", e);
        }
        return null;
    }

    createClaimElement(result, index) {
        const div = document.createElement('div');

        // Safety check for result structure
        if (!result || !result.result) {
            div.innerHTML = `
                <div class="claim-result partial">
                    <div class="explanation">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>Error:</strong> Invalid result structure received from API
                    </div>
                </div>
            `;
            return div;
        }

        const verdict = result.result.verdict ? result.result.verdict.toLowerCase() : 'unknown';
        const verdictClass = this.getVerdictClass(verdict);
        const statusLabel = result.result.status_label || this.getStatusLabel(result.result.verdict);

        div.className = `claim-result ${verdictClass}`;

        // Format the explanation nicely instead of showing raw JSON
        let explanation = result.result.explanation || 'No explanation provided';
        let extractedSources = result.result.sources || [];

        const evidenceHtml = this.renderEvidence(result.result.evidence || []);
        const sourcesHtml = evidenceHtml || this.renderSources(extractedSources);

        if (typeof explanation === 'string') {
            let trimmedExp = explanation.trim();
            if (trimmedExp.startsWith('{') || trimmedExp.startsWith('[')) {
                try {
                    let jsonStr = trimmedExp;
                    if (jsonStr.startsWith('json ')) {
                        jsonStr = jsonStr.substring(5);
                    }

                    let parsed = null;
                    try {
                        parsed = JSON.parse(jsonStr);
                    } catch (e) {
                        // Try to find valid JSON block by shrinking from the end
                        let startIdx = 0;
                        for (let endIdx = jsonStr.length - 1; endIdx >= startIdx; endIdx--) {
                            if (jsonStr[endIdx] === '}' || jsonStr[endIdx] === ']') {
                                try {
                                    parsed = JSON.parse(jsonStr.substring(startIdx, endIdx + 1));
                                    break; // Successfully parsed
                                } catch(e2) {}
                            }
                        }
                    }

                    if (parsed) {
                        if (parsed.explanation) {
                            explanation = parsed.explanation;
                        } else if (parsed.verdict) {
                            explanation = `Verdict: ${parsed.verdict}`;
                            if (parsed.confidence) {
                                explanation += ` (Confidence: ${parsed.confidence}%)`;
                            }
                        }

                        if (parsed.sources && Array.isArray(parsed.sources) && parsed.sources.length > 0) {
                            extractedSources = parsed.sources;
                        }
                    } else {
                        throw new Error("Could not parse JSON");
                    }
                } catch (e) {
                    // Do not aggressively strip brackets and braces if JSON parse fails.
                    // Instead, keep the raw explanation as is, but remove any wrapping markdown.
                    explanation = explanation
                        .replace(/^```(?:json)?\s*/i, '')
                        .replace(/\s*```$/i, '')
                        .trim();
                }
            }
        }

        div.innerHTML = `
            <div class="claim-text">
                <strong>Claim ${index}:</strong> ${this.escapeHtml(result.claim || 'Unknown claim')}
            </div>



            <div class="verdict ${verdictClass}">
                ${this.escapeHtml(result.result.verdict || 'UNKNOWN')}
            </div>

            <div class="status-pill ${verdictClass}">
                <i class="fas fa-circle-check"></i>
                ${this.escapeHtml(statusLabel)}
            </div>

            <div class="confidence">
                <i class="fas fa-chart-bar"></i>
                <strong>Confidence:</strong> ${this.escapeHtml(String(result.result.confidence || 'N/A'))}%
            </div>

            <div class="explanation">
                <i class="fas fa-info-circle"></i>
                <strong>Analysis:</strong> ${this.escapeHtml(explanation)}
            </div>
            ${sourcesHtml}
        `;

        return div;
    }

    createClaimBreakdownElement(breakdown) {
        if (!breakdown || !Array.isArray(breakdown.checked_claims)) return null;
        const wrapper = document.createElement('section');
        wrapper.className = 'claim-breakdown';
        const checked = breakdown.checked_claims;
        const ignored = Array.isArray(breakdown.ignored_claims) ? breakdown.ignored_claims : [];
        const checkedItems = checked.length
            ? checked.map((item, index) => `
                <li>
                    <span class="breakdown-index">${index + 1}</span>
                    <span>${this.escapeHtml(item.claim || 'Claim')}</span>
                    <strong>${this.escapeHtml(item.status_label || item.verdict || 'Checked')}</strong>
                </li>
            `).join('')
            : '<li><span>No concrete factual claims were checked.</span></li>';
        const ignoredItems = ignored.length
            ? `<div class="ignored-note"><i class="fas fa-circle-info"></i> ${ignored.map(item => this.escapeHtml(item.reason || '')).filter(Boolean).join(' ')}</div>`
            : '';

        wrapper.innerHTML = `
            <div class="section-title">
                <i class="fas fa-list-check"></i>
                <span>Claim breakdown</span>
            </div>
            <ul>${checkedItems}</ul>
            ${ignoredItems}
        `;
        return wrapper;
    }

    getVerdictClass(verdict) {
        verdict = verdict.toLowerCase();
        if (verdict.includes('partial') || verdict.includes('insufficient') || verdict.includes('unverifiable') || verdict.includes('unknown')) {
            return 'partial';
        } else if (verdict.includes('true') && !verdict.includes('false')) {
            return 'true';
        } else if (verdict.includes('false')) {
            return 'false';
        }
        return 'partial';
    }

    getStatusLabel(verdict) {
        const value = String(verdict || '').toLowerCase();
        if (value.includes('unverifiable')) return 'Unverifiable';
        if (value.includes('insufficient') || value.includes('unknown')) return 'Needs more evidence';
        if (value.includes('partial') || (value.includes('true') && value.includes('false'))) return 'Partly true';
        if (value.includes('false')) return 'Misleading';
        if (value.includes('true')) return 'Verified';
        return 'Needs more evidence';
    }

    escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    renderSources(sources) {
        if (!Array.isArray(sources) || sources.length === 0) return '';
        const items = sources
            .map(s => typeof s === 'string' ? s.trim() : '')
            .filter(url => url && this.isSafeHttpUrl(url))
            .map((url, i) => {
                const safeUrl = this.escapeAttribute(url);
                const label = this.escapeHtml(this.humanizeSource(url, i + 1));
                return `<a href="${safeUrl}" target="_blank" rel="noopener" class="source-link">${label}</a>`;
            })
            .join(', ');
        if (!items) return '';
        return `
            <div class="sources">
                <i class="fas fa-link"></i>
                <strong>Sources:</strong> ${items}
            </div>
        `;
    }

    renderEvidence(evidence) {
        if (!Array.isArray(evidence) || evidence.length === 0) return '';
        const cards = evidence
            .filter(item => item && item.url && this.isSafeHttpUrl(item.url))
            .slice(0, 6)
            .map((item, index) => {
                const safeUrl = this.escapeAttribute(item.url);
                const host = this.escapeHtml(item.host || this.humanizeSource(item.url, index + 1));
                const title = this.escapeHtml(item.title || host);
                const tier = this.escapeHtml(item.tier || 'source');
                const notes = this.escapeHtml(item.notes || 'Evidence source considered for this claim.');
                const snippet = item.snippet ? `<p>${this.escapeHtml(item.snippet)}</p>` : '';
                return `
                    <article class="evidence-card">
                        <div class="evidence-topline">
                            <a href="${safeUrl}" target="_blank" rel="noopener">${title}</a>
                            <span>${tier}</span>
                        </div>
                        <div class="evidence-host">${host}</div>
                        ${snippet}
                        <div class="evidence-note">${notes}</div>
                    </article>
                `;
            })
            .join('');
        if (!cards) return '';
        return `
            <div class="evidence-panel">
                <div class="section-title">
                    <i class="fas fa-scale-balanced"></i>
                    <span>Evidence used</span>
                </div>
                ${cards}
            </div>
        `;
    }

    buildReportText() {
        const data = this.lastResult;
        if (!data) return '';
        const lines = [];
        lines.push('Verity fact-check report');
        lines.push(`Generated: ${new Date((data.timestamp || Date.now() / 1000) * 1000).toLocaleString()}`);
        if (data.source_url) lines.push(`Source: ${data.source_url}`);
        if (data.source_title) lines.push(`Title: ${data.source_title}`);
        lines.push('');

        const results = Array.isArray(data.fact_check_results) ? data.fact_check_results : [];
        if (!results.length) {
            lines.push(data.analysis_error || data.image_analysis_error || 'No factual claims found.');
            return lines.join('\n');
        }

        results.forEach((item, index) => {
            const result = item.result || {};
            lines.push(`Claim ${index + 1}: ${item.claim || 'Unknown claim'}`);
            lines.push(`Status: ${result.status_label || this.getStatusLabel(result.verdict)} (${result.verdict || 'UNKNOWN'}, ${result.confidence || 'N/A'}%)`);
            lines.push(`Analysis: ${result.explanation || 'No explanation provided.'}`);
            const evidence = Array.isArray(result.evidence) ? result.evidence : [];
            const sources = evidence.length ? evidence.map(item => item.url) : (Array.isArray(result.sources) ? result.sources : []);
            if (sources.length) {
                lines.push('Sources:');
                sources.slice(0, 8).forEach(url => lines.push(`- ${url}`));
            }
            lines.push('');
        });
        return lines.join('\n').trim();
    }

    async copyReport() {
        const report = this.buildReportText();
        if (!report) return;
        try {
            await navigator.clipboard.writeText(report);
            this.flashReportButton(this.copyReportBtn, 'Copied');
        } catch (_) {
            const area = document.createElement('textarea');
            area.value = report;
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            area.remove();
            this.flashReportButton(this.copyReportBtn, 'Copied');
        }
    }

    async exportShareCard() {
        const data = this.lastResult;
        const results = data && Array.isArray(data.fact_check_results) ? data.fact_check_results : [];
        if (!results.length) return;

        try {
            const style = this.getSelectedPosterStyle();
            const blob = await this.createShareCardBlob(data, style);
            const filename = `verity-${style}-card-${Date.now()}.png`;
            const file = new File([blob], filename, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
                await navigator.share({
                    files: [file],
                    title: 'Verity fact-check card',
                    text: 'Fact-check summary from Verity',
                });
                this.flashReportButton(this.downloadReportBtn, 'Shared');
                return;
            }

            this.downloadBlob(blob, filename);
            this.flashReportButton(this.downloadReportBtn, 'Exported');
        } catch (error) {
            console.error('Share card export failed:', error);
            this.flashReportButton(this.downloadReportBtn, 'Retry');
        }
    }

    async downloadShareCard() {
        const data = this.lastResult;
        const results = data && Array.isArray(data.fact_check_results) ? data.fact_check_results : [];
        if (!results.length) return;

        try {
            const style = this.getSelectedPosterStyle();
            const blob = await this.createShareCardBlob(data, style);
            this.downloadBlob(blob, `verity-${style}-card-${Date.now()}.png`);
            this.flashReportButton(this.downloadCardBtn, 'Saved');
        } catch (error) {
            console.error('Share card download failed:', error);
            this.flashReportButton(this.downloadCardBtn, 'Retry');
        }
    }

    async createShareCardBlob(data, style = 'grid') {
        const canvas = this.createShareCardCanvas(data, style);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
        if (!blob) throw new Error('Unable to render share card.');
        return blob;
    }

    getSelectedPosterStyle() {
        return this.posterStyleSelect ? this.posterStyleSelect.value : 'grid';
    }

    createShareCardCanvas(data, style = 'grid') {
        if (style === 'clean') return this.createCleanShareCardCanvas(data);
        if (style === 'spotlight') return this.createSpotlightShareCardCanvas(data);
        const allResults = Array.isArray(data.fact_check_results) ? data.fact_check_results : [];
        const maxPosterClaims = allResults.length <= 8 ? allResults.length : 8;
        const results = allResults.slice(0, maxPosterClaims);
        const extraCount = Math.max(0, allResults.length - results.length);
        const statusCounts = this.buildShareCardStatusCounts(allResults);
        const width = 1200;
        const height = 1600;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const firstResult = results[0] && results[0].result ? results[0].result : {};
        const statusLabel = firstResult.status_label || this.getStatusLabel(firstResult.verdict);
        const verdictClass = this.getVerdictClass(firstResult.verdict || '');
        const accent = verdictClass === 'true' ? '#34d399' : verdictClass === 'false' ? '#fb7185' : '#fbbf24';
        const generated = new Date((data.timestamp || Date.now() / 1000) * 1000).toLocaleString();

        const bg = ctx.createLinearGradient(0, 0, width, height);
        bg.addColorStop(0, '#07070a');
        bg.addColorStop(0.55, '#151327');
        bg.addColorStop(1, '#22124a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = 'rgba(129, 140, 248, 0.16)';
        ctx.beginPath();
        ctx.arc(width * 0.18, height * 0.78, 360, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(52, 211, 153, 0.10)';
        ctx.beginPath();
        ctx.arc(width * 0.88, height * 0.2, 280, 0, Math.PI * 2);
        ctx.fill();

        this.drawRoundedRect(ctx, 64, 64, width - 128, height - 128, 34, 'rgba(255, 255, 255, 0.075)', 'rgba(255, 255, 255, 0.16)');

        ctx.fillStyle = '#f8fafc';
        ctx.font = '700 58px Outfit, Inter, sans-serif';
        ctx.fillText('Verity', 112, 150);
        ctx.font = '500 25px Inter, sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('Fact check', 112, 194);

        this.drawPill(ctx, statusLabel, 112, 245, accent);
        ctx.font = '700 30px Outfit, Inter, sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`${firstResult.confidence || 'N/A'}% confidence`, 112, 350);

        let y = 410;
        if (allResults.length > 1) {
            ctx.font = '700 25px Inter, sans-serif';
            ctx.fillStyle = '#e4e4e7';
            const visibleCopy = extraCount ? `${results.length} of ${allResults.length} claims summarized` : `${allResults.length} claims summarized`;
            ctx.fillText(visibleCopy, 112, y);
            y += 44;

            let chipX = 112;
            Object.entries(statusCounts).forEach(([label, count]) => {
                const chipAccent = this.getShareCardStatusAccent(label);
                const chipText = `${count} ${label}`;
                const chipWidth = this.measureShareCardStatChip(ctx, chipText);
                if (chipX > 112 && chipX + chipWidth > width - 112) {
                    y += 44;
                    chipX = 112;
                }
                chipX = this.drawShareCardStatChip(ctx, chipText, chipX, y, chipAccent);
            });
            y += 78;
        } else {
            y = 430;
        }

        const gridTop = y;
        const footerY = height - 150;
        const gridBottom = footerY - (extraCount ? 110 : 72);
        const columnCount = results.length > 3 ? 2 : 1;
        const columnGap = 22;
        const rowGap = 22;
        const gridWidth = width - 224;
        const tileWidth = columnCount === 2 ? (gridWidth - columnGap) / 2 : gridWidth;
        const rowCount = Math.max(1, Math.ceil(results.length / columnCount));
        const tileHeight = Math.max(150, (gridBottom - gridTop - rowGap * (rowCount - 1)) / rowCount);

        results.forEach((item, index) => {
            const column = index % columnCount;
            const row = Math.floor(index / columnCount);
            const tileX = 112 + column * (tileWidth + columnGap);
            const tileY = gridTop + row * (tileHeight + rowGap);
            this.drawShareCardClaimTile(ctx, item, index, tileX, tileY, tileWidth, tileHeight);
        });

        if (extraCount > 0) {
            const calloutY = gridBottom + 28;
            this.drawRoundedRect(ctx, 112, calloutY, width - 224, 62, 18, 'rgba(255, 255, 255, 0.07)', 'rgba(255, 255, 255, 0.14)');
            ctx.font = '700 23px Inter, sans-serif';
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(`+${extraCount} more claims checked in Verity`, 140, calloutY + 39);
            ctx.font = '500 18px Inter, sans-serif';
            ctx.fillStyle = '#a5b4fc';
            ctx.textAlign = 'right';
            ctx.fillText('Open the full result for every source', width - 140, calloutY + 39);
            ctx.textAlign = 'left';
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.beginPath();
        ctx.moveTo(112, footerY - 46);
        ctx.lineTo(width - 112, footerY - 46);
        ctx.stroke();

        ctx.font = '500 23px Inter, sans-serif';
        ctx.fillStyle = '#a1a1aa';
        ctx.fillText(`Generated ${generated}`, 112, footerY);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText('veritycheck.app', width - 112, footerY);
        ctx.textAlign = 'left';

        return canvas;
    }

    createCleanShareCardCanvas(data) {
        const allResults = Array.isArray(data.fact_check_results) ? data.fact_check_results : [];
        const results = allResults.slice(0, 8);
        const extraCount = Math.max(0, allResults.length - results.length);
        const statusCounts = this.buildShareCardStatusCounts(allResults);
        const width = 1200;
        const height = 1600;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const firstResult = results[0] && results[0].result ? results[0].result : {};
        const statusLabel = firstResult.status_label || this.getStatusLabel(firstResult.verdict);
        const accent = this.getShareCardStatusAccent(statusLabel);
        const generated = new Date((data.timestamp || Date.now() / 1000) * 1000).toLocaleString();

        const bg = ctx.createLinearGradient(0, 0, width, height);
        bg.addColorStop(0, '#111115');
        bg.addColorStop(0.58, '#151721');
        bg.addColorStop(1, '#182033');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        this.drawRoundedRect(ctx, 64, 64, width - 128, height - 128, 32, 'rgba(255, 255, 255, 0.055)', 'rgba(255, 255, 255, 0.14)');

        ctx.fillStyle = '#f8fafc';
        ctx.font = '800 64px Outfit, Inter, sans-serif';
        ctx.fillText('Verity', 112, 150);
        ctx.font = '600 25px Inter, sans-serif';
        ctx.fillStyle = '#a1a1aa';
        ctx.fillText('Fact check', 112, 194);

        this.drawCompactCanvasPill(ctx, statusLabel, width - 112, 122, accent, 'right');
        ctx.font = '800 42px Outfit, Inter, sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`${firstResult.confidence || 'N/A'}% confidence`, 112, 280);
        ctx.font = '700 24px Inter, sans-serif';
        ctx.fillStyle = '#a1a1aa';
        ctx.fillText(`${extraCount ? `${results.length} of ` : ''}${allResults.length} claims summarized`, 112, 322);

        let chipX = 112;
        let chipY = 386;
        Object.entries(statusCounts).forEach(([label, count]) => {
            const chipAccent = this.getShareCardStatusAccent(label);
            const chipText = `${count} ${label}`;
            const chipWidth = this.measureShareCardStatChip(ctx, chipText);
            if (chipX > 112 && chipX + chipWidth > width - 112) {
                chipY += 44;
                chipX = 112;
            }
            chipX = this.drawShareCardStatChip(ctx, chipText, chipX, chipY, chipAccent);
        });

        const footerY = height - 132;
        const startY = chipY + 70;
        const available = footerY - startY - (extraCount ? 70 : 24);
        const rowGap = 16;
        const rowHeight = Math.max(104, Math.min(138, (available - rowGap * Math.max(0, results.length - 1)) / Math.max(1, results.length)));

        results.forEach((item, index) => {
            const rowY = startY + index * (rowHeight + rowGap);
            this.drawCleanClaimRow(ctx, item, index, 112, rowY, width - 224, rowHeight);
        });

        if (extraCount > 0) {
            ctx.font = '700 22px Inter, sans-serif';
            ctx.fillStyle = '#c4b5fd';
            ctx.fillText(`+${extraCount} more claims checked in Verity`, 112, footerY - 44);
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.beginPath();
        ctx.moveTo(112, footerY - 18);
        ctx.lineTo(width - 112, footerY - 18);
        ctx.stroke();
        ctx.font = '500 22px Inter, sans-serif';
        ctx.fillStyle = '#a1a1aa';
        ctx.fillText(`Generated ${generated}`, 112, footerY + 24);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText('veritycheck.app', width - 112, footerY + 24);
        ctx.textAlign = 'left';
        return canvas;
    }

    createSpotlightShareCardCanvas(data) {
        const allResults = Array.isArray(data.fact_check_results) ? data.fact_check_results : [];
        const results = allResults.slice(0, 7);
        const extraCount = Math.max(0, allResults.length - results.length);
        const width = 1200;
        const height = 1600;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const firstResult = results[0] && results[0].result ? results[0].result : {};
        const statusLabel = firstResult.status_label || this.getStatusLabel(firstResult.verdict);
        const accent = this.getShareCardStatusAccent(statusLabel);
        const generated = new Date((data.timestamp || Date.now() / 1000) * 1000).toLocaleString();

        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, width, height);
        const halo = ctx.createRadialGradient(width * 0.7, 270, 0, width * 0.7, 270, 760);
        halo.addColorStop(0, `${accent}44`);
        halo.addColorStop(0.45, 'rgba(99, 102, 241, 0.20)');
        halo.addColorStop(1, 'rgba(9, 9, 11, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#f8fafc';
        ctx.font = '800 62px Outfit, Inter, sans-serif';
        ctx.fillText('Verity', 96, 132);
        ctx.font = '500 25px Inter, sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('Fact check', 96, 174);

        this.drawRoundedRect(ctx, 96, 230, width - 192, 420, 34, 'rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.18)');
        this.drawPill(ctx, statusLabel, 132, 272, accent);
        ctx.font = '800 42px Outfit, Inter, sans-serif';
        ctx.fillStyle = '#f8fafc';
        this.wrapCanvasText(ctx, results[0] ? results[0].claim : 'No claim available', 132, 380, width - 264, 52, 3);
        ctx.font = '400 25px Inter, sans-serif';
        ctx.fillStyle = '#d4d4d8';
        this.wrapCanvasText(ctx, firstResult.explanation || 'No explanation provided.', 132, 526, width - 264, 34, 3);

        ctx.font = '800 30px Outfit, Inter, sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`${allResults.length} claims checked`, 96, 730);

        const list = results.slice(1);
        const startY = 782;
        const rowGap = 16;
        const rowHeight = 104;
        list.forEach((item, index) => {
            this.drawSpotlightClaimRow(ctx, item, index + 1, 96, startY + index * (rowHeight + rowGap), width - 192, rowHeight);
        });

        if (extraCount > 0) {
            const calloutY = startY + list.length * (rowHeight + rowGap) + 12;
            this.drawRoundedRect(ctx, 96, calloutY, width - 192, 58, 18, 'rgba(255, 255, 255, 0.07)', 'rgba(255, 255, 255, 0.14)');
            ctx.font = '700 22px Inter, sans-serif';
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(`+${extraCount} more claims in the full result`, 124, calloutY + 37);
        }

        const footerY = height - 118;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.beginPath();
        ctx.moveTo(96, footerY - 18);
        ctx.lineTo(width - 96, footerY - 18);
        ctx.stroke();
        ctx.font = '500 22px Inter, sans-serif';
        ctx.fillStyle = '#a1a1aa';
        ctx.fillText(`Generated ${generated}`, 96, footerY + 24);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText('veritycheck.app', width - 96, footerY + 24);
        ctx.textAlign = 'left';
        return canvas;
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    drawRoundedRect(ctx, x, y, width, height, radius, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
        if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
        }
        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    drawPill(ctx, text, x, y, accent) {
        ctx.font = '700 30px Inter, sans-serif';
        const paddingX = 28;
        const pillWidth = ctx.measureText(text).width + paddingX * 2;
        this.drawRoundedRect(ctx, x, y, pillWidth, 58, 29, `${accent}22`, accent);
        ctx.fillStyle = accent;
        ctx.fillText(text, x + paddingX, y + 39);
    }

    drawCompactCanvasPill(ctx, text, x, y, accent, align = 'left') {
        ctx.font = '800 24px Inter, sans-serif';
        const paddingX = 22;
        const pillWidth = ctx.measureText(text).width + paddingX * 2;
        const pillX = align === 'right' ? x - pillWidth : x;
        this.drawRoundedRect(ctx, pillX, y, pillWidth, 48, 24, `${accent}20`, `${accent}90`);
        ctx.fillStyle = accent;
        ctx.fillText(text, pillX + paddingX, y + 32);
        return pillX + pillWidth;
    }

    drawShareCardClaimTile(ctx, item, index, x, y, width, height) {
        const result = item && item.result ? item.result : {};
        const claimStatus = result.status_label || this.getStatusLabel(result.verdict);
        const claimAccent = this.getShareCardStatusAccent(claimStatus || result.verdict);
        const compact = height < 220;
        const claimLines = compact ? 2 : 3;
        const explanationLines = compact ? 2 : 3;

        this.drawRoundedRect(ctx, x, y, width, height, 22, 'rgba(15, 15, 24, 0.68)', 'rgba(255, 255, 255, 0.12)');

        ctx.fillStyle = `${claimAccent}22`;
        ctx.beginPath();
        ctx.arc(x + 34, y + 36, 19, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '700 18px Inter, sans-serif';
        ctx.fillStyle = claimAccent;
        ctx.textAlign = 'center';
        ctx.fillText(String(index + 1), x + 34, y + 43);
        ctx.textAlign = 'left';

        ctx.font = '700 17px Inter, sans-serif';
        const statusWidth = Math.min(width - 96, ctx.measureText(claimStatus).width + 28);
        this.drawRoundedRect(ctx, x + width - statusWidth - 22, y + 18, statusWidth, 34, 17, `${claimAccent}18`, `${claimAccent}80`);
        ctx.fillStyle = claimAccent;
        ctx.fillText(claimStatus, x + width - statusWidth - 8, y + 41);

        let textY = y + 84;
        ctx.font = compact ? '700 23px Outfit, Inter, sans-serif' : '700 25px Outfit, Inter, sans-serif';
        ctx.fillStyle = '#f8fafc';
        textY = this.wrapCanvasText(ctx, item.claim || 'Unknown claim', x + 24, textY, width - 48, compact ? 29 : 32, claimLines);
        textY += compact ? 10 : 14;

        ctx.font = compact ? '400 18px Inter, sans-serif' : '400 20px Inter, sans-serif';
        ctx.fillStyle = '#d4d4d8';
        textY = this.wrapCanvasText(ctx, result.explanation || 'No explanation provided.', x + 24, textY, width - 48, compact ? 24 : 27, explanationLines);

        const sources = this.getShareCardClaimSources(result);
        if (sources.length && textY < y + height - 28) {
            ctx.font = '700 16px Inter, sans-serif';
            ctx.fillStyle = '#a5b4fc';
            this.wrapCanvasText(ctx, `Sources: ${sources.slice(0, 2).join(' | ')}`, x + 24, y + height - 28, width - 48, 20, 1);
        }
    }

    drawCleanClaimRow(ctx, item, index, x, y, width, height) {
        const result = item && item.result ? item.result : {};
        const claimStatus = result.status_label || this.getStatusLabel(result.verdict);
        const accent = this.getShareCardStatusAccent(claimStatus || result.verdict);
        this.drawRoundedRect(ctx, x, y, width, height, 18, 'rgba(255, 255, 255, 0.065)', 'rgba(255, 255, 255, 0.12)');

        ctx.fillStyle = `${accent}22`;
        ctx.beginPath();
        ctx.arc(x + 34, y + height / 2, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '800 17px Inter, sans-serif';
        ctx.fillStyle = accent;
        ctx.textAlign = 'center';
        ctx.fillText(String(index + 1), x + 34, y + height / 2 + 6);
        ctx.textAlign = 'left';

        ctx.font = '700 24px Outfit, Inter, sans-serif';
        ctx.fillStyle = '#f8fafc';
        this.wrapCanvasText(ctx, item.claim || 'Unknown claim', x + 72, y + 40, width - 330, 30, 2);

        ctx.font = '500 18px Inter, sans-serif';
        ctx.fillStyle = '#cbd5e1';
        this.wrapCanvasText(ctx, result.explanation || 'No explanation provided.', x + 72, y + height - 26, width - 330, 22, 1);

        ctx.font = '800 17px Inter, sans-serif';
        const statusWidth = Math.min(240, ctx.measureText(claimStatus).width + 30);
        this.drawRoundedRect(ctx, x + width - statusWidth - 24, y + 24, statusWidth, 38, 19, `${accent}20`, `${accent}90`);
        ctx.fillStyle = accent;
        ctx.textAlign = 'center';
        ctx.fillText(claimStatus, x + width - statusWidth / 2 - 24, y + 49);
        ctx.textAlign = 'left';
    }

    drawSpotlightClaimRow(ctx, item, index, x, y, width, height) {
        const result = item && item.result ? item.result : {};
        const claimStatus = result.status_label || this.getStatusLabel(result.verdict);
        const accent = this.getShareCardStatusAccent(claimStatus || result.verdict);
        this.drawRoundedRect(ctx, x, y, width, height, 18, 'rgba(255, 255, 255, 0.065)', 'rgba(255, 255, 255, 0.12)');

        ctx.fillStyle = `${accent}22`;
        ctx.beginPath();
        ctx.arc(x + 34, y + 34, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '800 17px Inter, sans-serif';
        ctx.fillStyle = accent;
        ctx.textAlign = 'center';
        ctx.fillText(String(index + 1), x + 34, y + 40);
        ctx.textAlign = 'left';

        ctx.font = '800 22px Outfit, Inter, sans-serif';
        ctx.fillStyle = '#f8fafc';
        this.wrapCanvasText(ctx, item.claim || 'Unknown claim', x + 72, y + 34, width - 330, 27, 2);

        ctx.font = '700 18px Inter, sans-serif';
        const statusWidth = Math.min(230, ctx.measureText(claimStatus).width + 30);
        this.drawRoundedRect(ctx, x + width - statusWidth - 24, y + 32, statusWidth, 40, 20, `${accent}20`, `${accent}90`);
        ctx.fillStyle = accent;
        ctx.textAlign = 'center';
        ctx.fillText(claimStatus, x + width - statusWidth / 2 - 24, y + 59);
        ctx.textAlign = 'left';
    }

    getShareCardClaimSources(result) {
        const evidence = Array.isArray(result.evidence) ? result.evidence : [];
        if (evidence.length) {
            return evidence.map((entry, index) => entry.host || this.humanizeSource(entry.url, index + 1)).filter(Boolean);
        }
        if (Array.isArray(result.sources)) {
            return result.sources.map((url, index) => this.humanizeSource(url, index + 1)).filter(Boolean);
        }
        return [];
    }

    buildShareCardStatusCounts(results) {
        return results.reduce((counts, item) => {
            const result = item && item.result ? item.result : {};
            const label = result.status_label || this.getStatusLabel(result.verdict);
            counts[label] = (counts[label] || 0) + 1;
            return counts;
        }, {});
    }

    getShareCardStatusAccent(label) {
        const normalized = String(label || '').toLowerCase();
        if (normalized.includes('verified') || normalized === 'true') return '#34d399';
        if (normalized.includes('misleading') || normalized === 'false') return '#fb7185';
        if (normalized.includes('partly')) return '#38bdf8';
        if (normalized.includes('unverifiable')) return '#a1a1aa';
        return '#fbbf24';
    }

    drawShareCardStatChip(ctx, text, x, y, accent) {
        ctx.font = '700 19px Inter, sans-serif';
        const paddingX = 18;
        const chipWidth = this.measureShareCardStatChip(ctx, text);
        this.drawRoundedRect(ctx, x, y - 24, chipWidth, 36, 18, 'rgba(255, 255, 255, 0.075)', `${accent}80`);
        ctx.fillStyle = accent;
        ctx.fillText(text, x + paddingX, y);
        return x + chipWidth + 12;
    }

    measureShareCardStatChip(ctx, text) {
        ctx.font = '700 19px Inter, sans-serif';
        return ctx.measureText(text).width + 36;
    }

    wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
        const words = String(text || '').split(/\s+/).filter(Boolean);
        let line = '';
        let lines = 0;

        for (let index = 0; index < words.length; index++) {
            const testLine = line ? `${line} ${words[index]}` : words[index];
            if (ctx.measureText(testLine).width > maxWidth && line) {
                lines++;
                if (lines >= maxLines) {
                    ctx.fillText(`${line.replace(/[.,;:!?]?$/, '')}...`, x, y);
                    return y + lineHeight;
                }
                ctx.fillText(line, x, y);
                line = words[index];
                y += lineHeight;
            } else {
                line = testLine;
            }
        }

        if (line) {
            ctx.fillText(line, x, y);
            y += lineHeight;
        }
        return y;
    }

    flashReportButton(button, text) {
        if (!button) return;
        const label = button.querySelector('span');
        if (!label) return;
        const previous = label.textContent;
        label.textContent = text;
        setTimeout(() => { label.textContent = previous; }, 1400);
    }

    escapeAttribute(str) {
        return this.escapeHtml(str).replaceAll('"', '&quot;');
    }

    isSafeHttpUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    humanizeSource(url, index) {
        try {
            const u = new URL(url);
            const host = u.hostname.replace(/^www\./, '');
            let path = u.pathname.replace(/\/$/, '');
            if (path.length > 28) path = path.slice(0, 25) + '…';
            return `${host}${path ? ' ' + path : ''}`;
        } catch (_) {
            return `Source ${index}`;
        }
    }

    getFriendlyErrorMessage(message) {
        if (!message) return "";
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes('quota') || lowerMsg.includes('rate limit') || lowerMsg.includes('429') || lowerMsg.includes('too many requests')) {
            return "The system is currently experiencing high traffic and cannot process your request right now. Please wait a few moments and try again.";
        }
        if (lowerMsg.includes('api key') || lowerMsg.includes('unauthorized') || lowerMsg.includes('401')) {
            return "The system is experiencing configuration issues with the AI provider.";
        }
        if (lowerMsg.includes('failed to fetch') || lowerMsg.includes('network error')) {
            return "Unable to connect to the server. Please check your internet connection and try again.";
        }
        if (message.length > 150) {
            return "An unexpected error occurred while analyzing the claim. Please try again or rephrase your prompt.";
        }
        return message;
    }

    showError(message) {
        const friendlyMessage = this.getFriendlyErrorMessage(message);
        this.updateResultsHeader('Check blocked', false);
        this.resultsContainer.innerHTML = `
            <div class="claim-result false">
                <div class="explanation">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Error:</strong> ${this.escapeHtml(friendlyMessage)}
                </div>
            </div>
        `;
        this.resultsSection.classList.remove('hidden');
    }
}


// --- MYSTICAL UI ENGINE ---
class MysticalEngine {
    constructor() {
        this.webglCanvas = document.getElementById('webgl-cloud');
        this.particleCanvas = document.getElementById('particleCanvas');
        this.textInput = document.getElementById('textInput');
        this.floatingPrompt = document.querySelector('.floating-prompt');
        this.resultsSection = document.getElementById('resultsSection');

        if (!this.webglCanvas || !this.particleCanvas) return;

        this.initWebGLCloud();
        this.initParticleEngine();

        // Handle window resize
        window.addEventListener('resize', () => {
            this.resizeWebGL();
            this.resizeParticleCanvas();
        });
    }

    initWebGLCloud() {
        if (typeof THREE === 'undefined') return;

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.renderer = new THREE.WebGLRenderer({ canvas: this.webglCanvas, alpha: true, antialias: true });

        const fragmentShader = `
            uniform float iTime;
            uniform vec2 iResolution;
            uniform float intensity;
            uniform float loadingState;

            // Noise functions
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
            float snoise(vec2 v) {
                const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
                vec2 i  = floor(v + dot(v, C.yy) );
                vec2 x0 = v -   i + dot(i, C.xx);
                vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec4 x12 = x0.xyxy + C.xxzz;
                x12.xy -= i1;
                i = mod289(i);
                vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
                vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                m = m*m ; m = m*m ;
                vec3 x = 2.0 * fract(p * C.www) - 1.0;
                vec3 h = abs(x) - 0.5;
                vec3 ox = floor(x + 0.5);
                vec3 a0 = x - ox;
                m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
                vec3 g;
                g.x  = a0.x  * x0.x  + h.x  * x0.y;
                g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                return 130.0 * dot(m, g);
            }

            void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
                vec2 uv = fragCoord/iResolution.xy;
                vec2 centeredUv = uv - vec2(0.5, 0.5);
                centeredUv.x *= iResolution.x/iResolution.y;

                float baseTime = iTime * 0.2;
                float rotAngle = iTime * 0.8; // Always rotate to prevent phase jumps
                mat2 rot = mat2(cos(rotAngle), -sin(rotAngle), sin(rotAngle), cos(rotAngle));

                vec2 ruv = mix(uv, centeredUv * rot + vec2(0.5), loadingState);

                float t = iTime * 0.3; // Constant time scale to prevent phase jumps

                // Multilayer noise
                float n1 = snoise(ruv * 1.5 + vec2(t, t * 0.5));
                float n2 = snoise(ruv * 3.0 - vec2(t * 1.2, t * 0.8));
                float n3 = snoise(ruv * 5.0 + vec2(t * 0.5, -t));

                float n = n1 * 0.5 + n2 * 0.25 + n3 * 0.125;
                n = n * 0.5 + 0.5; // map to 0-1

                // Colors (Deep mystical purple/blue/cyan to ethereal white)
                vec3 col1 = vec3(0.28, 0.3, 0.84); // Indigo
                vec3 col2 = vec3(0.46, 0.23, 0.86); // Purple
                vec3 col3 = vec3(0.85, 0.95, 1.0);  // Ethereal White/Cyan

                vec3 finalCol = mix(col1, col2, smoothstep(0.2, 0.8, n));
                finalCol = mix(finalCol, col3, smoothstep(0.5, 1.0, n) * (0.5 + intensity * 0.5));

                // Ambient mask: dense at bottom, fading up
                float ambientMask = smoothstep(0.8, 0.0, fragCoord.y/iResolution.y);
                ambientMask = pow(ambientMask, 1.5) * (n * 0.5 + 0.5);

                // Loading mask: circular in the center
                float dist = length(centeredUv);
                float loadingMask = smoothstep(0.35, 0.05, dist);
                loadingMask = pow(loadingMask, 1.2) * (n * 0.7 + 0.3);

                float mask = mix(ambientMask, loadingMask, loadingState);

                fragColor = vec4(finalCol, mask * mix(0.8, 1.0, loadingState));
            }

            void main() {
                mainImage(gl_FragColor, gl_FragCoord.xy);
            }
        `;

        this.uniforms = {
            iTime: { value: 0 },
            iResolution: { value: new THREE.Vector2() },
            intensity: { value: 0.2 },
            loadingState: { value: 0.0 }
        };

        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.ShaderMaterial({
            fragmentShader,
            uniforms: this.uniforms,
            transparent: true,
            depthWrite: false
        });

        const mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);

        this.resizeWebGL();

        this.clock = new THREE.Clock();
        this.animateWebGL();
    }

    resizeWebGL() {
        if (!this.renderer) return;
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.uniforms.iResolution.value.set(window.innerWidth, window.innerHeight);
    }

    animateWebGL() {
        requestAnimationFrame(() => this.animateWebGL());
        this.uniforms.iTime.value = this.clock.getElapsedTime();
        this.renderer.render(this.scene, this.camera);
    }

    setCloudIntensity(high) {
        if (!this.uniforms) return;
        // Tween intensity
        const target = high ? 1.0 : 0.2;
        const current = this.uniforms.intensity.value;
        const step = (target - current) * 0.05;

        const tween = () => {
            this.uniforms.intensity.value += step;
            if (Math.abs(this.uniforms.intensity.value - target) > 0.01) {
                requestAnimationFrame(tween);
            } else {
                this.uniforms.intensity.value = target;
            }
        };
        tween();
    }

    // --- PARTICLE SHATTER EFFECT ---
    initParticleEngine() {
        this.ctx = this.particleCanvas.getContext('2d', { willReadFrequently: true });
        this.particles = [];
        this.resizeParticleCanvas();
    }

    resizeParticleCanvas() {
        this.particleCanvas.width = window.innerWidth;
        this.particleCanvas.height = window.innerHeight;
    }

    shatterText(textElement, onComplete) {
        const rect = textElement.getBoundingClientRect();
        const computed = window.getComputedStyle(textElement);

        // Save the color before we hide it
        const textColor = computed.color;

        if (this.floatingPrompt) {
            this.floatingPrompt.classList.add('shattering');
        }

        this.setCloudIntensity(true); // Intensify cloud during processing

        // Create a ghost div to hold the characters
        const ghost = document.createElement('div');
        document.body.appendChild(ghost);

        // Match styles precisely
        ghost.style.position = 'absolute';
        ghost.style.left = rect.left + 'px';
        ghost.style.top = rect.top + 'px';
        ghost.style.width = rect.width + 'px';
        ghost.style.height = rect.height + 'px';
        ghost.style.fontFamily = computed.fontFamily;
        ghost.style.fontSize = computed.fontSize;
        ghost.style.fontWeight = computed.fontWeight;
        ghost.style.lineHeight = computed.lineHeight;
        ghost.style.letterSpacing = computed.letterSpacing;
        ghost.style.padding = computed.padding;
        ghost.style.boxSizing = computed.boxSizing;
        ghost.style.whiteSpace = 'pre-wrap';
        ghost.style.wordWrap = 'break-word';
        ghost.style.color = textColor; // Use the saved visible color
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '1000';

        const text = textElement.value;
        textElement.style.color = 'transparent'; // hide real text

        // Wrap each character in a span
        const spans = [];
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const span = document.createElement('span');
            span.innerHTML = char === ' ' ? '&nbsp;' : char;
            span.style.display = 'inline-block';
            span.style.transition = 'transform 1.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 1.8s ease, filter 1.8s ease';
            ghost.appendChild(span);
            spans.push(span);
        }

        // Force reflow to calculate positions
        ghost.getBoundingClientRect();

        // Record starting absolute positions
        const positions = spans.map(span => {
            const r = span.getBoundingClientRect();
            return { left: r.left, top: r.top, width: r.width, height: r.height };
        });

        // Switch to fixed positioning for independent animation
        spans.forEach((span, i) => {
            span.style.position = 'fixed';
            span.style.left = positions[i].left + 'px';
            span.style.top = positions[i].top + 'px';
            span.style.margin = '0';
        });

        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        // Animate each character
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                spans.forEach((span, i) => {
                    const dx = cx - positions[i].left - (positions[i].width / 2);
                    const dy = cy - positions[i].top - (positions[i].height / 2);

                    // Wave effect: slight delay based on index
                    const delay = i * 15;
                    span.style.transitionDelay = `${delay}ms`;

                    // Calm, magical scatter: translate to center, scale down slightly, slight rotation
                    const rX = (Math.random() - 0.5) * 40;
                    const rY = (Math.random() - 0.5) * 40;
                    const rRot = (Math.random() - 0.5) * 60;

                    span.style.transform = `translate(${dx + rX}px, ${dy + rY}px) scale(0.3) rotate(${rRot}deg)`;
                    span.style.opacity = '0';
                    span.style.filter = 'blur(3px)';
                });
            });
        });

        // Cleanup
        setTimeout(() => {
            ghost.remove();
        }, 2000 + text.length * 15);

        // Allow API call to proceed
        if (onComplete) setTimeout(onComplete, 500);
    }

    shatterImage(imageElement, onComplete) {
        if (!imageElement) {
            if (onComplete) onComplete();
            return;
        }

        const rect = imageElement.getBoundingClientRect();

        if (this.floatingPrompt) {
            this.floatingPrompt.classList.add('shattering');
        }

        this.setCloudIntensity(true); // Intensify cloud during processing

        // Hide entire image preview container smoothly
        const previewContainer = imageElement.closest('.image-preview');
        if (previewContainer) {
            previewContainer.style.transition = 'opacity 0.5s ease';
            previewContainer.style.opacity = '0';
        } else {
            imageElement.style.transition = 'opacity 0.5s ease';
            imageElement.style.opacity = '0';
        }

        const ghost = document.createElement('img');
        ghost.src = imageElement.src;
        document.body.appendChild(ghost);

        ghost.style.position = 'fixed';
        ghost.style.left = rect.left + 'px';
        ghost.style.top = rect.top + 'px';
        ghost.style.width = rect.width + 'px';
        ghost.style.height = rect.height + 'px';
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '1000';
        ghost.style.transition = 'transform 1.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 1.5s ease, filter 1.5s ease';
        ghost.style.borderRadius = window.getComputedStyle(imageElement).borderRadius;
        ghost.style.objectFit = 'cover';

        // Force reflow
        ghost.getBoundingClientRect();

        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        requestAnimationFrame(() => {
            const dx = cx - rect.left - (rect.width / 2);
            const dy = cy - rect.top - (rect.height / 2);

            const rRot = (Math.random() - 0.5) * 60;
            ghost.style.transform = `translate(${dx}px, ${dy}px) scale(0.1) rotate(${rRot}deg)`;
            ghost.style.opacity = '0';
            ghost.style.filter = 'blur(10px)';
        });

        setTimeout(() => {
            ghost.remove();
        }, 1600);

        if (onComplete) setTimeout(onComplete, 500);
    }

    animateParticles() {
        // Obsolete: canvas particle engine is replaced by DOM character animation
        return;
    }

    // --- CLOUD LOADING ANIMATION ---
    setLoadingState(target) {
        if (!this.uniforms) return;

        // Stop any existing tween
        if (this.loadingTween) {
            cancelAnimationFrame(this.loadingTween);
        }

        const current = this.uniforms.loadingState.value;
        const step = (target - current) * 0.04; // Smooth transition speed

        const tween = () => {
            this.uniforms.loadingState.value += step;
            if (Math.abs(this.uniforms.loadingState.value - target) > 0.01) {
                this.loadingTween = requestAnimationFrame(tween);
            } else {
                this.uniforms.loadingState.value = target;
                this.loadingTween = null;
            }
        };
        tween();
    }

    startCloudLoading() {
        this.thoughtContainer = document.getElementById('thoughtBubbles');
        this.cloudOverlay = document.getElementById('cloudLoadingOverlay');
        if (!this.thoughtContainer) return;

        // Transition main WebGL cloud loading state
        this.setLoadingState(1.0);
        this.cloudRunning = true;

        // Thought bubble cycling
        this.bubbleMessages = [
            'Analyzing claims...',
            'Cross-referencing sources...',
            'Evaluating evidence...',
            'Verifying credibility...',
            'Checking global databases...',
            'Comparing perspectives...'
        ];
        this.bubblePositions = [
            { top: '5%', left: '55%', cls: 'pos-top-right' },
            { top: '25%', right: '2%', cls: 'pos-right' },
            { bottom: '20%', right: '5%', cls: 'pos-bottom-right' },
            { bottom: '5%', left: '10%', cls: 'pos-bottom-left' },
            { top: '30%', left: '2%', cls: 'pos-left' },
            { top: '2%', left: '10%', cls: 'pos-top-left' }
        ];
        this.bubbleIndex = 0;
        this.thoughtContainer.innerHTML = '';
        this._spawnBubble();
        this.bubbleInterval = setInterval(() => {
            if (!this.cloudRunning) return;
            this._spawnBubble();
        }, 2200);
    }

    _spawnBubble() {
        if (!this.thoughtContainer) return;
        // Fade previous bubbles
        const old = this.thoughtContainer.querySelectorAll('.thought-bubble:not(.fading)');
        old.forEach(b => { b.classList.add('fading'); setTimeout(() => b.remove(), 400); });

        const msg = this.bubbleMessages[this.bubbleIndex % this.bubbleMessages.length];
        const pos = this.bubblePositions[this.bubbleIndex % this.bubblePositions.length];
        this.bubbleIndex++;

        const bubble = document.createElement('div');
        bubble.className = `thought-bubble ${pos.cls}`;
        bubble.textContent = msg;
        if (pos.top) bubble.style.top = pos.top;
        if (pos.bottom) bubble.style.bottom = pos.bottom;
        if (pos.left) bubble.style.left = pos.left;
        if (pos.right) bubble.style.right = pos.right;
        this.thoughtContainer.appendChild(bubble);
    }

    disperseCloud(onComplete) {
        this.cloudRunning = false;
        if (this.bubbleInterval) { clearInterval(this.bubbleInterval); this.bubbleInterval = null; }
        // Fade out bubbles
        if (this.thoughtContainer) {
            this.thoughtContainer.querySelectorAll('.thought-bubble').forEach(b => {
                b.classList.add('fading');
                setTimeout(() => b.remove(), 400);
            });
        }

        // Return main WebGL cloud to ambient state
        this.setLoadingState(0.0);

        setTimeout(() => {
            if (onComplete) onComplete();
        }, 800);
    }

    triggerReveal() {
        this.setCloudIntensity(false);
        if (this.resultsSection) {
            this.resultsSection.classList.remove('revealing');
            void this.resultsSection.offsetWidth;
            this.resultsSection.classList.add('revealing');
        }
    }

    resetInput() {
        if (this.floatingPrompt) {
            this.floatingPrompt.classList.remove('shattering');
        }
        this.setCloudIntensity(false);
    }
}

const mysticalEngine = new MysticalEngine();
// ----------------------------

// Initialize the app when page loads
function initializeVerityApp() {
    window.verityApp = new FactCheckerApp();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeVerityApp);
} else {
    initializeVerityApp();
}
