import type { APIRoute } from 'astro';
import { GAME_FAQS } from '../faq';
import { APP_NAME, APP_STORE_URL, CONTACT_EMAIL, SITE_DESCRIPTION, SITE_URL } from '../site';

export const GET: APIRoute = () => {
  const content = `# ${APP_NAME}

> ${SITE_DESCRIPTION}

## Official pages

- [MeterZone](${SITE_URL}/): Game overview, gameplay preview, and frequently asked questions.
- [How to play](${SITE_URL}/how-to-play/): Timing, scoring, combos, hearts, and the daily challenge.
- [Support](${SITE_URL}/support/): Gameplay help and contact information.
- [Privacy policy](${SITE_URL}/privacy/): App data storage and website analytics.
${APP_STORE_URL ? `- [App Store](${APP_STORE_URL}): Official iPhone download and current availability.\n` : ''}
## Game facts

${GAME_FAQS.map(({ question, answer }) => `### ${question}\n\n${answer}`).join('\n\n')}

## Contact

Support: ${CONTACT_EMAIL}
`;

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
