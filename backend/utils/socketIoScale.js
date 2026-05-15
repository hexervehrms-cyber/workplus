/**
 * Optional Socket.IO horizontal scaling via Redis pub/sub.
 * Set REDIS_URL and install @socket.io/redis-adapter to enable multi-instance load balancing.
 */
import logger from './logger.js';

export async function attachSocketIoRedisAdapter(io) {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.info('Socket.IO Redis adapter skipped (REDIS_URL not set)');
    return false;
  }

  try {
    const { createClient } = await import('redis');
    const { createAdapter } = await import('@socket.io/redis-adapter');

    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));

    logger.info('Socket.IO Redis adapter enabled for multi-instance deployments');
    return true;
  } catch (error) {
    logger.warn(
      'Socket.IO Redis adapter unavailable — running single-instance mode. Install @socket.io/redis-adapter for load balancing.',
      { error: error.message }
    );
    return false;
  }
}
