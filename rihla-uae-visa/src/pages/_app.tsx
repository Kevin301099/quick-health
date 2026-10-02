import type { AppProps } from 'next/app';
import Head from 'next/head';
import { MotionConfig } from 'motion/react';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Rihla UAE Visa</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta
          name="description"
          content="Upload your documents once. Rihla's agent files your UAE visa in a browser you can watch, and asks you only when it needs a code, a signature or a payment."
        />
      </Head>
      <MotionConfig reducedMotion="user">
        <Component {...pageProps} />
      </MotionConfig>
    </>
  );
}
