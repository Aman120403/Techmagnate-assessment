const { body, validationResult } = require('express-validator');
const { PRIORITY_MIN, PRIORITY_MAX } = require('../config/constants');

/**
 * Shared field rules — used by express-validator middleware AND csv row checks.
 * Keeping one source of truth avoids "API accepts X but CSV rejects X" bugs.
 */
function normalizePayload(raw) {
  return {
    keyword: String(raw.keyword ?? '').trim(),
    language_code: String(raw.language ?? raw.language_code ?? '')
      .trim()
      .toLowerCase(),
    location_code: raw.location ?? raw.location_code,
    priority: raw.priority,
  };
}

/**
 * Pure validator for a single task payload (no Express deps).
 * @returns {{ ok: true, value } | { ok: false, errors: string[] }}
 */
function validateTaskPayload(raw) {
  const errors = [];
  const data = normalizePayload(raw);

  if (!data.keyword) {
    errors.push('Keyword is required');
  } else if (data.keyword.length > 700) {
    errors.push('Keyword must be at most 700 characters');
  }

  if (!data.language_code) {
    errors.push('Language is required');
  }

  const loc = Number(data.location_code);
  if (data.location_code === '' || data.location_code === null || data.location_code === undefined) {
    errors.push('Location is required');
  } else if (!Number.isFinite(loc)) {
    errors.push('Location must be a numeric location_code');
  }

  const pri = Number(data.priority);
  if (data.priority === '' || data.priority === null || data.priority === undefined) {
    errors.push('Priority is required');
  } else if (!Number.isInteger(pri) || pri < PRIORITY_MIN || pri > PRIORITY_MAX) {
    errors.push(`Priority must be between ${PRIORITY_MIN} and ${PRIORITY_MAX}`);
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      keyword: data.keyword,
      language_code: data.language_code,
      location_code: loc,
      priority: pri,
    },
  };
}

/** express-validator chain for POST /api/tasks */
const singleTaskRules = [
  body('keyword')
    .exists({ checkFalsy: true })
    .withMessage('Keyword is required')
    .bail()
    .isString()
    .trim()
    .isLength({ max: 700 })
    .withMessage('Keyword must be at most 700 characters'),
  body('language')
    .exists({ checkFalsy: true })
    .withMessage('Language is required')
    .bail()
    .isString()
    .trim(),
  body('location')
    .exists({ checkFalsy: true })
    .withMessage('Location is required')
    .bail()
    .isNumeric()
    .withMessage('Location must be a numeric location_code'),
  body('priority')
    .exists({ checkNull: true })
    .withMessage('Priority is required')
    .bail()
    .isInt({ min: PRIORITY_MIN, max: PRIORITY_MAX })
    .withMessage(`Priority must be between ${PRIORITY_MIN} and ${PRIORITY_MAX}`),
];

function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: result.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  return next();
}

module.exports = {
  validateTaskPayload,
  normalizePayload,
  singleTaskRules,
  handleValidation,
};
