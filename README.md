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
- **Chrome Extension Frontend**: A Manifest V3 extension can fact-check the visible post while you browse social media.
- **Web Extraction**: Built-in scrapers to pull clean content from:
  - **Social Media**: Custom adapters for social media sites like X/Twitter or reddit.
  - **Articles**: Reliable text extraction using `readability` and `BeautifulSoup`.
- **Current-Event Evidence Search**: Each claim is searched with multiple query variants, including exact-claim, numeric, current-year, latest, and official-source searches.
- **Source Credibility Layer**: Claims are classified into domains such as medical, finance, legal, government/policy, company/technology, science, sports, or general news. Sources are then scored differently for each domain.
- **Evidence Ranking**: Official sources, primary documents, verified/current announcement posts, regulator filings, reputable reporting, and domain authorities are ranked above weak or stale sources.
- **Hybrid AI Architecture**:
  - **Groq (Primary)**: Handles the fast inference using Llama 3.3-70b and Llama 4.
  - **Google Gemini (Grounding)**: Steps in for the heavy reasoning and real-time Google Search grounding.
- **Evidence Grounding**: Every check includes a verdict, confidence score, explanation, and actual source URLs.
- **The UI**: A responsive, dark-mode-first frontend. I added some Three.js particle clouds for the background.

## How Verification Works

1. **Extract the claim** from text, URLs, extension context, or visible image text.
2. **Gather evidence** using Gemini grounding plus local public-web search across DuckDuckGo, Bing, and Yahoo.
3. **Expand search queries** so recent claims are checked against exact wording, numbers, current-year results, and official-source terms.
4. **Classify the claim domain** to understand what kind of sources should count most.
5. **Score and rank sources** with domain-specific policies:
   - Medical claims prefer sources like WHO, CDC, FDA, NIH, NHS, and medical institutions.
   - Finance claims prefer filings, regulators, central banks, official disclosures, and reputable financial reporting.
   - Legal claims prefer court records, statutes, regulators, police statements, and reporting that cites records.
   - Government and policy claims prefer official ministry, regulator, election, parliament, court, and PIB-style sources.
   - Company and technology announcements prefer official blogs, press releases, filings, verified official social posts, and reputable tech/business reporting.
   - Science claims prefer research papers, universities, official science agencies, and reputable science reporting.
6. **Re-check the verdict** using the ranked evidence package, including source tier, authority score, and notes for each source.

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

## Running the App

1. **Start the Flask backend**:
   ```bash
   source .venv/bin/activate
   python app.py
   ```
2. **Access the interface**:
   The app serves `index.html` at `http://localhost:5001`. Just open this URL in your browser.

## API Endpoints

- `GET /health` or `/api/health`: Check backend status and configured providers.
- `POST /fact-check` or `/api/fact-check`: Verify text or a URL.
- `POST /fact-check-image` or `/api/fact-check-image`: Verify an uploaded image data URL or public image URL.
- `POST /extension/fact-check` or `/api/extension/fact-check`: Verify visible post context from the browser extension.

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

## Validation

Run the focused backend checks with:

```bash
source .venv/bin/activate
python -m unittest tests.test_core_url_extraction tests.test_extension_endpoint
```

For a quick syntax check:

```bash
python -m py_compile api/core.py app.py
```

## Deployment

I've configured this project for a quick deployment on **Vercel**:
1. Install the Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project root.
3. Add `GROQ_API_KEY` and `GEMINI_API_KEY` to your Vercel Project Environment Variables.

---

Built with ❤️ by [AD_unboxthetech](https://github.com/adunboxthetech)
