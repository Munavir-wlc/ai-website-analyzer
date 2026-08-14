const { Queue } = require('bullmq');
const Redis = require('ioredis');

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || null;

let isRedisConnected = false;
let scanQueue = null;
let connection = null;

// In-memory queue fallback when Redis is offline
const inMemoryQueue = [];

try {
  connection = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (times > 3) {
        console.warn('[scanQueue] Redis unavailable. Falling back to in-memory queue handler.');
        return null; // stop retrying and fallback
      }
      return Math.min(times * 100, 2000);
    }
  });

  connection.on('connect', () => {
    isRedisConnected = true;
    console.log('[scanQueue] Connected to Redis instance for BullMQ scan queue.');
  });

  connection.on('error', (err) => {
    isRedisConnected = false;
    // Suppress unhandled error log spam when Redis daemon is not running
  });

  scanQueue = new Queue('scan-queue', { connection });
} catch (err) {
  console.warn('[scanQueue] Failed to initialize BullMQ Redis queue. Falling back to in-memory queue.');
  isRedisConnected = false;
}

async function addScanJob(data) {
  const { capabilities } = require('../config/scanCapabilities');

  if (isRedisConnected && scanQueue) {
    try {
      const jobsCount = await scanQueue.getWaitingCount();
      if (jobsCount >= capabilities.maxQueueSize) {
        console.warn(`[scanQueue] Queue limit reached. Waiting jobs: ${jobsCount}, max limit: ${capabilities.maxQueueSize}`);
        return false;
      }

      await scanQueue.add('run-scan', data, {
        jobId: data.scanId,
        removeOnComplete: true,
        removeOnFail: false
      });
      return true;
    } catch (err) {
      console.warn('[scanQueue] BullMQ enqueue failed. Falling back to in-memory processing:', err.message);
    }
  }

  // In-memory queue fallback execution
  if (inMemoryQueue.length >= capabilities.maxQueueSize) {
    console.warn(`[scanQueue] In-memory queue limit reached (${inMemoryQueue.length}). Request rejected.`);
    return false;
  }

  inMemoryQueue.push(data);
  setImmediate(async () => {
    const jobData = inMemoryQueue.shift();
    if (jobData) {
      const { processScanJob } = require('./scanWorker');
      if (processScanJob) {
        await processScanJob(jobData);
      }
    }
  });

  return true;
}

module.exports = {
  scanQueue,
  addScanJob,
  getIsRedisConnected: () => isRedisConnected
};
