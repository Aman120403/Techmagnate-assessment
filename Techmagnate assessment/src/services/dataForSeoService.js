const axios = require('axios');
const { env } = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { buildMockLiveResponse } = require('../fixtures/mockLiveResponse');

/**
 * Tech Magnate Assessment — DataForSEO Live Organic Advanced client.
 * Docs: https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/
 *
 * Endpoint:
 *   POST https://api.dataforseo.com/v3/serp/google/organic/live/advanced
 * Auth:
 *   HTTP Basic (login:password from https://app.dataforseo.com/api-access)
 *
 * Constraint (vendor): each Live call accepts ONLY ONE task in the POST array.
 *
 * --- Request body (exact shape we send) ---
 * [
 *   {
 *     "keyword": "albert einstein",
 *     "location_code": 2840,
 *     "language_code": "en"
 *   }
 * ]
 *
 * --- Response fields we persist (from tasks[0]) ---
 * id, status_code, status_message, time, cost
 * (+ keyword / location_code / language_code from our request)
 *
 * Set DATAFORSEO_MOCK=true to skip the network and return a docs-shaped payload
 * (useful until real credentials are plugged in for QA).
 */
class DataForSeoService {
  constructor() {
    this.endpointPath = '/serp/google/organic/live/advanced';
    this.client = axios.create({
      baseURL: env.dataForSeo.baseUrl,
      timeout: 120000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * @param {{ keyword: string, language_code: string, location_code: number, priority?: number }} payload
   */
  async createLiveOrganicTask(payload) {
    const requestItem = this.#buildRequestItem(payload);

    // Live Advanced = one object inside the array
    const body = [requestItem];

    if (env.dataForSeo.mock) {
      logger.warn('DATAFORSEO_MOCK=true — returning fixture response (no live call)');
      const mock = buildMockLiveResponse(requestItem);
      return this.#mapResponse(mock, payload);
    }

    this.#assertCredentials();

    try {
      const { data } = await this.client.post(this.endpointPath, body, {
        auth: {
          username: env.dataForSeo.login,
          password: env.dataForSeo.password,
        },
      });

      // Top-level status_code !== 20000 means the whole call failed
      if (data?.status_code && data.status_code !== 20000) {
        throw new ApiError(
          502,
          data.status_message || `DataForSEO error ${data.status_code}`,
          data
        );
      }

      return this.#mapResponse(data, payload);
    } catch (err) {
      if (err instanceof ApiError) throw err;

      if (err.response?.data) {
        logger.error('DataForSEO API error body', err.response.data);
        const api = err.response.data;
        throw new ApiError(
          err.response.status || 502,
          api.status_message || 'DataForSEO request failed',
          api
        );
      }

      logger.error('DataForSEO network error', err.message);
      throw new ApiError(502, `DataForSEO unreachable: ${err.message}`);
    }
  }

  /** 
   * Only fields documented for Live Advanced.
   * `priority` is our app field — NOT sent upstream (that's a Task POST concept).
   */
  #buildRequestItem(payload) {
    return {
      keyword: String(payload.keyword).trim(),
      language_code: String(payload.language_code).trim().toLowerCase(),
      location_code: Number(payload.location_code),
    };
  }

  #assertCredentials() {
    const { login, password } = env.dataForSeo;
    const placeholder =
      !login ||
      !password ||
      login === 'your_login_email' ||
      password === 'your_api_password';

    if (placeholder) {
      throw new ApiError(
        500,
        'DataForSEO credentials missing. Set DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD in .env (from https://app.dataforseo.com/api-access), or set DATAFORSEO_MOCK=true for local demo.'
      );
    }
  }
  /**
   * Persist mapping per module requirements.
   * Source of truth for task meta: response.tasks[0]
   */
  #mapResponse(apiData, original) {
    const task = apiData?.tasks?.[0];

    if (!task) {
      throw new ApiError(
        502,
        'Unexpected DataForSEO response — missing tasks[0]',
        apiData
      );
    }

    return {
      task_id: task.id ?? null,
      status_code: task.status_code ?? apiData.status_code ?? null,
      status_message: task.status_message ?? apiData.status_message ?? null,
      cost: typeof task.cost === 'number' ? task.cost : apiData.cost ?? null,
      time: task.time ?? apiData.time ?? null,
      keyword: original.keyword,
      location_code: Number(original.location_code),
      language_code: original.language_code,
      priority: Number(original.priority),
      raw_response: apiData,
    };
  }
}

module.exports = new DataForSeoService();
