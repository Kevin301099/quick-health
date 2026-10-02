import { Html, Head, Main, NextScript } from 'next/document';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..800;1,6..96,400..800&family=Hanken+Grotesk:wght@300..800&family=IBM+Plex+Mono:wght@400;500&family=Reem+Kufi:wght@400..700&display=swap';

// Runs before first paint. Respects a theme the host already set, then a saved choice, then dark.
const themeBoot = `(function(){try{var r=document.documentElement;if(r.getAttribute('data-theme'))return;var t=null;try{t=localStorage.getItem('rihla-theme')}catch(e){}r.setAttribute('data-theme',t==='light'?'light':'dark')}catch(e){}})();`;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230a1215'/%3E%3Ccircle cx='16' cy='16' r='9' fill='none' stroke='%23c9a063' stroke-width='2'/%3E%3Cpath d='M9 21 Q16 6 23 11' fill='none' stroke='%23e6c88f' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E" />
      </Head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
