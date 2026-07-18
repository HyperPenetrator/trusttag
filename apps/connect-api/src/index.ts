import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

// 1. Auth: API key middleware.
function apiKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.header('x-api-key');
  if (apiKey !== process.env.CONNECT_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

app.use(apiKeyMiddleware);

// 2. POST /surrendered-items/bulk-check
// Import Cortex's matching logic as shared lib (packages/cortex-matching) — no duplicate implementation.
app.post('/surrendered-items/bulk-check', async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      res.status(400).json({ error: 'items array required' });
      return;
    }

    // Lazy-import so tests can mock before require resolves
    const { bulkMatchItems } = await import('cortex-matching');
    const matches = await bulkMatchItems(items);
    res.json({ matches });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Webhook on confirmed match/recovery.
// Fire ONLY from Section 1 indexer's confirmed-event stream, never from raw chain events
// (prevents notifying a partner of a since-reorg'd recovery).
app.post('/webhook/recovery', (req: Request, res: Response) => {
  const { event } = req.body;
  if (!event || !event.id) {
    res.status(400).json({ error: 'Invalid event payload' });
    return;
  }

  // Process confirmed recovery event
  console.log(`Processing confirmed recovery for event ${event.id}`);
  res.json({ success: true });
});

if (require.main === module) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`connect-api listening on port ${port}`));
}

export default app;
