/**
 * Tech Magnate Assessment — mock DataForSEO Live Advanced response.
 * Shape matches: https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/
 * Used when DATAFORSEO_MOCK=true (no paid credentials needed for local demo).
 */
function buildMockLiveResponse({ keyword, language_code, location_code }) {
  const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return {
    version: '0.1.20200129',
    status_code: 20000,
    status_message: 'Ok.',
    time: '0.3059 sec.',
    cost: 0.003,
    tasks_count: 1,
    tasks_error: 0,
    tasks: [
      {
        id,
        status_code: 20000,
        status_message: 'Ok.',
        time: '0.0952 sec.',
        cost: 0.003,
        result_count: 1,
        path: ['v3', 'serp', 'google', 'organic', 'advanced', 'live'],
        data: {
          api: 'serp',
          function: 'live',
          se: 'google',
          se_type: 'organic',
          language_code,
          location_code,
          keyword,
          device: 'desktop',
          os: 'windows',
        },
        result: [
          {
            keyword,
            type: 'organic',
            se_domain: 'google.com',
            location_code: Number(location_code),
            language_code,
            check_url: `https://www.google.com/search?q=${encodeURIComponent(keyword)}`,
            datetime: new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00'),
            spell: null,
            item_types: ['organic', 'people_also_ask', 'related_searches'],
            se_results_count: 1250000,
            items_count: 1,
            items: [
              {
                type: 'organic',
                rank_group: 1,
                rank_absolute: 1,
                position: 'left',
                domain: 'example.com',
                title: `Mock result for ${keyword}`,
                url: 'https://example.com/',
                description: 'Mock SERP snippet — replace DATAFORSEO_MOCK=false + real credentials to hit live API.',
              },
            ],
          },
        ],
      },
    ],
  };
}

module.exports = { buildMockLiveResponse };
