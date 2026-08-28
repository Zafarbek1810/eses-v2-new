import express from 'express';
import cors from 'cors';
import DigestFetch from 'digest-fetch';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);
const DEVICE_IP = process.env.HIKVISION_HOST || '192.168.1.40';
const HIKVISION_USER = process.env.HIKVISION_USER || 'admin';
const HIKVISION_PASSWORD = process.env.HIKVISION_PASSWORD || 'A112233a';
const client = new DigestFetch(HIKVISION_USER, HIKVISION_PASSWORD);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/access-events', async (req, res) => {
  try {
    const {
      startTime,
      endTime,
      maxResults = 30,
      searchResultPosition = 0,
      major = 5,
      minor = 75,
    } = req.body;

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'startTime va endTime majburiy' });
    }

    const deviceResponse = await client.fetch(
      `http://${DEVICE_IP}/ISAPI/AccessControl/AcsEvent?format=json`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          AcsEventCond: {
            searchID: '1',
            searchResultPosition,
            maxResults,
            major,
            minor,
            startTime,
            endTime,
            picEnable: true,
          },
        }),
      }
    );

    const text = await deviceResponse.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'Qurilmadan noto\'g\'ri javob', raw: text });
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server ishga tushdi: http://localhost:${PORT}`));
