import { Html, Head, Main, NextScript } from 'next/document';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap';

// Runs before first paint. Only a saved choice sets the theme; otherwise the viewer's own setting decides.
const themeBoot = `(function(){try{var r=document.documentElement;if(r.getAttribute('data-theme'))return;var t=null;try{t=localStorage.getItem('rihla-theme')}catch(e){}if(t==='light'||t==='dark')r.setAttribute('data-theme',t)}catch(e){}})();`;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%230b7a63'/%3E%3Cpath d='M8 20c3-9 11-12 16-8' fill='none' stroke='white' stroke-width='2.4' stroke-linecap='round'/%3E%3Ccircle cx='24' cy='12' r='2.6' fill='%23f2a83b'/%3E%3C/svg%3E" />
      </Head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
