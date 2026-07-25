const multer = require('multer');
const ApiError = require('../utils/ApiError');

// Memory storage — CSVs are small (≤1000 rows). No need to touch disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
    files: 1,
  },
  fileFilter(_req, file, cb) {
    const ok =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv');

    if (!ok) {
      return cb(new ApiError(400, 'Only CSV files are allowed'));
    }
    return cb(null, true);
  },
});

module.exports = { upload };
