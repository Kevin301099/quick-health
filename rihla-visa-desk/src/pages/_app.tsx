import type { AppProps } from 'next/app';
import Head from 'next/head';
import { MotionConfig } from 'motion/react';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Rihla Visa Desk</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta
          name="description"
          content="Rihla is an agentic visa desk for UAE travel and visa agencies. Agents read documents, catch errors, fill forms and track every case. Your team approves."
        />
      </Head>
      <MotionConfig reducedMotion="user">
        <Component {...pageProps} />
      </MotionConfig>
    </>
  );
}
