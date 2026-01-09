import { Request, Response } from 'express';
import { LanguageServiceClient } from '@google-cloud/language';

const API_KEY = 'AIzaSyCmEDGGPNYFRKj4gnJdWsJfQBQmeE-N8'; // Placeholder, replace with your actual API key

const client = new LanguageServiceClient({
  key: API_KEY,
});

export function registerNLPHandlers(app: any) {
  app.post('/gcp-natural-language/analyzeSentiment', async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Missing text in request body.' });
      }

      const document = {
        content: text,
        type: 'PLAIN_TEXT',
      };

      const [result] = await client.analyzeSentiment({ document });
      res.json(result.documentSentiment);
    } catch (error: any) {
      console.error('Error analyzing sentiment:', error);
      res.status(500).json({ error: error.message || 'Failed to analyze sentiment.' });
    }
  });

  app.post('/gcp-natural-language/analyzeEntities', async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Missing text in request body.' });
      }

      const document = {
        content: text,
        type: 'PLAIN_TEXT',
      };

      const [result] = await client.analyzeEntities({ document });
      res.json(result.entities);
    } catch (error: any) {
      console.error('Error analyzing entities:', error);
      res.status(500).json({ error: error.message || 'Failed to analyze entities.' });
    }
  });

  app.post('/gcp-natural-language/analyzeSyntax', async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Missing text in request body.' });
      }

      const document = {
        content: text,
        type: 'PLAIN_TEXT',
      };

      const [result] = await client.analyzeSyntax({ document });
      res.json({ tokens: result.tokens, sentences: result.sentences });
    } catch (error: any) {
      console.error('Error analyzing syntax:', error);
      res.status(500).json({ error: error.message || 'Failed to analyze syntax.' });
    }
  });

  app.post('/gcp-natural-language/classifyText', async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Missing text in request body.' });
      }

      const document = {
        content: text,
        type: 'PLAIN_TEXT',
      };

      const [result] = await client.classifyText({ document });
      res.json(result.categories);
    } catch (error: any) {
      console.error('Error classifying text:', error);
      res.status(500).json({ error: error.message || 'Failed to classify text.' });
    }
  });
}