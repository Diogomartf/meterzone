import { defineConfig } from 'astro/config';
import { SITE_URL } from './src/site.ts';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
});
