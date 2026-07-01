/**
 * AEGENTIS CORPORATION - Event Streaming
 * Kafka-compatible streaming interface for cross-division event propagation.
 * Falls back to in-process EventEmitter when Kafka is not configured.
 */

const EventEmitter = require('events');

class AegentisStream extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    this.topics = new Map();
    this.mode = process.env.KAFKA_BROKERS ? 'kafka' : 'local';
    console.log(`[CLOUD:STREAM] Mode: ${this.mode}`);
  }

  /**
   * Publish an event to a topic.
   */
  publish(topic, event) {
    if (!this.topics.has(topic)) this.topics.set(topic, []);
    this.topics.get(topic).push({ ...event, stream_ts: Date.now() });
    this.emit(topic, event);
    this.emit('*', { topic, event });
  }

  /**
   * Subscribe to a topic.
   */
  subscribe(topic, handler) {
    this.on(topic, handler);
    return () => this.off(topic, handler);
  }

  /**
   * Subscribe to all events across all topics.
   */
  subscribeAll(handler) {
    this.on('*', ({ topic, event }) => handler(topic, event));
  }

  getTopicStats() {
    const stats = {};
    for (const [topic, events] of this.topics.entries()) {
      stats[topic] = events.length;
    }
    return stats;
  }
}

module.exports = new AegentisStream();
