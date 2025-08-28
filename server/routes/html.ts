const repoUrl =
  "https://github.com/vercel-partner-solutions/slack-agent-template";

export const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Repository Documentation</title>
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
    
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #fff;
            }
    
            .header {
                border-bottom: 1px solid #e5e7eb;
                background: rgba(255, 255, 255, 0.8);
                backdrop-filter: blur(8px);
                position: sticky;
                top: 0;
                z-index: 10;
            }
    
            .header-content {
                max-width: 64rem;
                margin: 0 auto;
                padding: 1rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
    
            .header h1 {
                font-size: 1.25rem;
                font-weight: 600;
                color: #111827;
            }
    
            .github-link {
                color: #2563eb;
                text-decoration: none;
                font-size: 0.875rem;
                font-weight: 500;
            }
    
            .github-link:hover {
                color: #1d4ed8;
                text-decoration: underline;
            }
    
            .main {
                max-width: 64rem;
                margin: 0 auto;
                padding: 2rem 1rem;
            }
    
            .loading {
                text-align: center;
                padding: 4rem 0;
                color: #6b7280;
            }
    
            .error {
                text-align: center;
                padding: 4rem 0;
                color: #dc2626;
            }
    
            .content {
                line-height: 1.7;
            }
    
            .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
                margin-top: 2rem;
                margin-bottom: 1rem;
                font-weight: 600;
                color: #111827;
            }
    
            .content h1 { font-size: 2rem; }
            .content h2 { font-size: 1.5rem; }
            .content h3 { font-size: 1.25rem; }
    
            .content p {
                margin-bottom: 1rem;
            }
    
            .content a {
                color: #2563eb;
                text-decoration: none;
            }
    
            .content a:hover {
                text-decoration: underline;
            }
    
            .content code {
                background: #f3f4f6;
                color: #ec4899;
                padding: 0.125rem 0.25rem;
                border-radius: 0.25rem;
                font-size: 0.875rem;
            }
    
            .content pre {
                background: #1f2937;
                color: #f9fafb;
                padding: 1rem;
                border-radius: 0.5rem;
                overflow-x: auto;
                margin: 1rem 0;
            }
    
            .content pre code {
                background: none;
                color: inherit;
                padding: 0;
            }
    
            .content ul, .content ol {
                margin: 1rem 0;
                padding-left: 2rem;
            }
    
            .content li {
                margin-bottom: 0.5rem;
            }
    
            .content blockquote {
                border-left: 4px solid #e5e7eb;
                padding-left: 1rem;
                margin: 1rem 0;
                color: #6b7280;
            }
    
            .footer {
                margin-top: 3rem;
                padding-top: 2rem;
                border-top: 1px solid #e5e7eb;
                font-size: 0.875rem;
                color: #6b7280;
            }
    
            @media (max-width: 768px) {
                .header-content {
                    flex-direction: column;
                    gap: 0.5rem;
                }
                
                .main {
                    padding: 1rem;
                }
            }
        </style>
    </head>
    <body>
        <header class="header">
            <div class="header-content">
                <h1>Repository Documentation</h1>
                <a href="#" id="github-link" class="github-link" style="display: none;">View on GitHub →</a>
            </div>
        </header>
    
        <main class="main">
            <div id="loading" class="loading">Loading README content...</div>
            <div id="error" class="error" style="display: none;">Failed to load README content</div>
            <div id="content" class="content" style="display: none;"></div>
            <footer id="footer" class="footer" style="display: none;"></footer>
        </main>
    
        <script>
            async function fetchReadmeContent() {
                try {
                    const response = await fetch('https://api.github.com/repos/vercel-partner-solutions/slack-agent-template/readme', {
                        headers: {
                            'Accept': 'application/vnd.github.v3+json',
                        }
                    });
    
                    if (!response.ok) {
                        throw new Error('Failed to fetch README');
                    }
    
                    const data = await response.json();
                    const content = atob(data.content);
    
                    const htmlContent = marked.parse(content);
    
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('content').innerHTML = htmlContent;
                    document.getElementById('content').style.display = 'block';
                    
                    const githubLink = document.getElementById('github-link');
                    githubLink.href = '${repoUrl}';
                    githubLink.style.display = 'inline';
    
                     const footer = document.getElementById('footer');
                     footer.innerHTML = '<p>Last updated: ' + data.sha.substring(0, 7) + '</p>';
                    footer.style.display = 'block';
    
                } catch (error) {
                    console.error('Error fetching README:', error);
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('error').style.display = 'block';
                }
            }
    
            document.addEventListener('DOMContentLoaded', fetchReadmeContent);
        </script>
    </body>
    </html>
    `;
