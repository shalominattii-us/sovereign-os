/**
 * AEGENTIS CLOUD — Event Streaming Service
 * Exposes the AegentisStream as an HTTP API for cross-division pub/sub.
 */
const express = require('express');
const stream = require('./stream');
const app = express();
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true, service: 'AEGENTIS-CLOUD-STREAM', topics: stream.getTopicStats() }));
app.post('/publish', (req, res) => { const { topic, event } = req.body; stream.publish(topic, event); res.json({ ok: true, topic }); });
app.get('/topics', (_, res) => res.json(stream.getTopicStats()));

const PORT = process.env.PORT || 8084;
app.listen(PORT, () => console.log(`[CLOUD:STREAM] Live on port ${PORT}`));
