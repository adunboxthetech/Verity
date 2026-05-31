# Verity — Seek the Truth

Verity is a tool I built to verify online claims, articles, social posts, and images. Instead of behaving like a generic chatbot, it combines fast AI models, live web evidence, source credibility scoring, and domain-specific source policies to give clear verdicts backed by cited evidence.

<p align="center">
  <img src="assets/screenshot1.png" width="45%" alt="Landing Page Light" />
  <img src="assets/screenshot2.png" width="45%" alt="Loading Screen Light" />
</p>
<p align="center">
  <img src="assets/screenshot3.png" width="45%" alt="Loading Screen Dark" />
  <img src="assets/screenshot4.png" width="45%" alt="Landing Page Dark" />
</p>

## Features

- **Multi-modal Verification**: Fact-check raw text, drop in a web URL, or upload images directly to see what's real.
- **Claim Breakdown**: Verity shows which factual claims were detected and checked before showing the final verdicts.
- **Clear Result States**: Verdicts are normalized into user-friendly states such as Verified, Misleading, Partly true, Needs more evidence, and Unverifiable.
- **Evidence Transparency**: Results include evidence cards with source title, domain, tier, authority score, notes, snippets, and source links.
- **Share Cards**: Export a polished PNG fact-check card from a compact export cluster with card style, download, and share controls. Multi-claim checks can be exported as Grid, Clean, or Spotlight card layouts.
- **Chrome Extension Frontend**: A Manifest V3 extension can fact-check the visible post while you browse social media, copy popup reports, and open selected text in the full web app from the right-click menu.
- **Web Extraction**: Built-in scrapers to pull clean content from:
  - **Social Media**: Custom adapters for social media sites like X/Twitter or reddit.
  - **Articles**: Reliable text extraction using `readability` and `BeautifulSoup`.
- **Current-Event Evidence Search**: Each claim is searched with multiple query variants, including exact-claim, numeric, current-year, latest, and official-source searches.
- **Source Credibility Layer**: Claims are classified into domains such as medical, finance, legal, government/policy, company/technology, science, sports, or general news. Sources are then scored differently for each domain.
- **Evidence Ranking**: Official sources, primary documents, verified/current announcement posts, regulator filings, reputable reporting, and domain authorities are ranked above weak or stale sources.
- **Hybrid AI Architecture**:
  - **Groq (Primary)**: Handles fast text and vision inference using Llama 3.3-70b, Llama 3.1-8B, and Llama 4 Scout.
  - **Google Gemini (Fallback/Grounding)**: Steps in when Groq is unavailable or fails, and can provide Google Search grounding in fallback paths.
- **Evidence Grounding**: Every check includes a verdict, confidence score, explanation, source URLs, and structured evidence metadata.
- **Safer API Handling**: Request size limits, text length validation, simple rate limiting, safer URL checks, and configurable CORS help protect the app from expensive or unsafe requests.
- **The UI**: A responsive, dark-mode-first frontend. I added some Three.js particle clouds for the background.

## Recent Improvements

These are the latest upgrades added to make Verity more trustworthy and product-ready:

- Added a claim breakdown panel so users can see what was actually checked.
- Added evidence cards that explain source strength with host, title, snippet, source tier, authority score, and notes.
- Added normalized result states for clearer verdict language.
- Added copy text and a single share-card export action in the main web app.
- Improved share cards for multi-claim checks with selectable Grid, Clean, and Spotlight layouts, verdict breakdown chips, a remaining-claims callout for very long checks, and the `veritycheck.app` footer URL.
- Added right-click selected-text fact-checking support for the Chrome extension.
- Added copyable extension reports and compact evidence chips in the popup.
- Fixed provider routing so Groq is attempted first whenever a non-empty Groq key is configured.
- Fixed environment lookup so empty case-variant keys such as `Groq_api_key=""` do not shadow a real `GROQ_API_KEY`.
- Added clearer blocked-check UI for quota/provider failures instead of showing failed checks as "Analysis Complete".
- Added request guardrails: JSON body cap, max text length, simple POST rate limiting, and configurable CORS.
- Added result metadata tests for provider order, evidence metadata, claim breakdowns, and validation behavior.

## How Verification Works

1. **Extract the claim** from text, URLs, extension context, or visible image text.
2. **Run the primary model path** with Groq when `GROQ_API_KEY` is configured; Gemini is used when Groq is unavailable or fails.
3. **Expand search queries** so recent claims are checked against exact wording, numbers, current-year results, and official-source terms.
4. **Gather public evidence** using local public-web search across DuckDuckGo, Bing, and Yahoo, with Gemini grounding available in fallback paths.
5. **Classify the claim domain** to understand what kind of sources should count most.
6. **Score and rank sources** with domain-specific policies:
   - Medical claims prefer sources like WHO, CDC, FDA, NIH, NHS, and medical institutions.
   - Finance claims prefer filings, regulators, central banks, official disclosures, and reputable financial reporting.
   - Legal claims prefer court records, statutes, regulators, police statements, and reporting that cites records.
   - Government and policy claims prefer official ministry, regulator, election, parliament, court, and PIB-style sources.
   - Company and technology announcements prefer official blogs, press releases, filings, verified official social posts, and reputable tech/business reporting.
   - Science claims prefer research papers, universities, official science agencies, and reputable science reporting.
7. **Re-check the verdict** using the ranked evidence package, including source tier, authority score, and notes for each source.
8. **Return transparent results** with claim breakdowns, status labels, evidence cards, report-ready text, confidence, explanation, and source URLs.

## Tech Stack

- **Backend**: Python, Flask, BeautifulSoup4, Readability.js (Python port), Requests.
- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript, Three.js (WebGL).
- **AI Infrastructure**: Groq API, Google Gemini API.
- **Deployment**: Optimized for Vercel.

## Installation

### Prerequisites
- Python 3.8+
- API Keys for [Groq](https://console.groq.com/) and [Google AI Studio (Gemini)](https://aistudio.google.com/).

### Setup
1. **Clone the repository**:
   ```bash
   git clone https://github.com/adunboxthetech/Verity.git
   cd Verity
   ```

2. **Install dependencies**:
   
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and drop in your API keys:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

   `GROQ_API_KEY` is the primary provider. `GEMINI_API_KEY` or `GOOGLE_API_KEY` is the fallback/search-grounding provider. Environment variable names are read case-insensitively, but empty values are ignored, so make sure the key value is actually present.

## Running the App

1. **Start the Flask backend**:
   ```bash
   source .venv/bin/activate
   python app.py
   ```
2. **Access the interface**:
   The app serves `index.html` at `http://localhost:5000` unless `PORT` is overridden. For example, `PORT=5001 python app.py` serves it at `http://localhost:5001`.

## API Endpoints

- `GET /health` or `/api/health`: Check backend status and configured providers.
- `POST /fact-check` or `/api/fact-check`: Verify text or a URL and return claim breakdowns, result states, evidence metadata, and source URLs.
- `POST /fact-check-image` or `/api/fact-check-image`: Verify an uploaded image data URL or public image URL with the same structured result format.
- `POST /extension/fact-check` or `/api/extension/fact-check`: Verify visible post context from the browser extension and return compact popup-ready evidence.

## Chrome Extension

The extension lives in `extension/` and uses the same Flask backend through `POST /api/extension/fact-check`.

1. Start the backend:
   ```bash
   python app.py
   ```
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click "Load unpacked" and select the `extension` folder.
5. Browse a social feed and click the extension icon to check the visible post.

The popup defaults to the production backend at `https://veritycheck.vercel.app`, and you can change the backend URL from its settings button when developing locally.

You can also select text on a page, right-click, and choose "Fact-check selected text with Verity" to open the selected claim in the full web app.

## Validation

Run the focused backend checks with:

```bash
source .venv/bin/activate
python -m unittest tests.test_core_url_extraction tests.test_extension_endpoint tests.test_web_evidence_queries tests.test_result_metadata
```

For a quick syntax check:

```bash
python -m py_compile api/core.py app.py
node --check script.js
node --check extension/popup.js
node --check extension/background.js
```

## Deployment

I've configured this project for a quick deployment on **Vercel**:
1. Install the Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project root.
3. Add `GROQ_API_KEY` and `GEMINI_API_KEY` to your Vercel Project Environment Variables.

---

Built with ❤️ by [AD_unboxthetech](https://github.com/adunboxthetech)
