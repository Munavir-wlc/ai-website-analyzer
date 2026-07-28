const { Queue } = require('bullmq');
const Redis = require('ioredis');

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT || 6379;
const redisPassword = process.env.REDIS_PASSWORD || null;

const connection = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  maxRetriesPerRequest: null
});

const scanQueue = new Queue('scan-queue', { connection });

async function addScanJob(data) {
  try {
    const jobsCount = await scanQueue.getWaitingCount();
    const { capabilities } = require('../config/scanCapabilities');
    
    if (jobsCount >= capabilities.maxQueueSize) {
      console.warn(`[scanQueue] Queue limit reached. Current waiting jobs: ${jobsCount}, max limit: ${capabilities.maxQueueSize}`);
      return false;
    }

    await scanQueue.add('run-scan', data, {
      jobId: data.scanId,
      removeOnComplete: true,
      removeOnFail: false
    });
    return true;
  } catch (err) {
    console.error('[scanQueue] Failed to add job to BullMQ:', err);
    return false;
  }
}

module.exports = {
  scanQueue,
  addScanJob
};
