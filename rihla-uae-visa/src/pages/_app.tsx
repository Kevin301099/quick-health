import type { AppProps } from 'next/app';
import Head from 'next/head';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Rihla UAE Visa</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta
          name="description"
          content="Your UAE tourist visa, filed for you. Upload your passport and photo, we check everything, you sign and pay, and the visa arrives by email."
        />
      </Head>
      {/* LazyMotion loads only the animation features we use, instead of the whole library. */}
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          <Component {...pageProps} />
        </MotionConfig>
      </LazyMotion>
    </>
  );
}
