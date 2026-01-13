import { Request, Response } from 'express';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Initialize the Vision client with your API key
const client = new ImageAnnotatorClient({
  key: 'AIzaSyCmEDGGPNYFRKj4gnmJudWsJfQBQmeE-N8',
});

export function registerVisionHandlers(app: any) {
  /**
   * @api {post} /vision/detectText Detect Text (OCR)
   * @apiName DetectText
   * @apiGroup Vision
   * @apiBody {string} imageBase64 The base64 encoded image data.
   * @apiSuccess {object} response The OCR results.
   * @apiError {object} error Error details.
   */
  app.post('/vision/detectText', async (req: Request, res: Response) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'imageBase64 is required.' });
      }

      const [result] = await client.textDetection({
        image: {
          content: imageBase64,
        },
      });
      res.json(result.fullTextAnnotation);
    } catch (error: any) {
      console.error('Error detecting text:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @api {post} /vision/detectFaces Detect Faces
   * @apiName DetectFaces
   * @apiGroup Vision
   * @apiBody {string} imageBase64 The base64 encoded image data.
   * @apiSuccess {object[]} response An array of face detection results.
   * @apiError {object} error Error details.
   */
  app.post('/vision/detectFaces', async (req: Request, res: Response) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'imageBase64 is required.' });
      }

      const [result] = await client.faceDetection({
        image: {
          content: imageBase64,
        },
      });
      res.json(result.faceAnnotations);
    } catch (error: any) {
      console.error('Error detecting faces:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @api {post} /vision/detectLabels Detect Labels
   * @apiName DetectLabels
   * @apiGroup Vision
   * @apiBody {string} imageBase64 The base64 encoded image data.
   * @apiSuccess {object[]} response An array of label detection results.
   * @apiError {object} error Error details.
   */
  app.post('/vision/detectLabels', async (req: Request, res: Response) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'imageBase64 is required.' });
      }

      const [result] = await client.labelDetection({
        image: {
          content: imageBase64,
        },
      });
      res.json(result.labelAnnotations);
    } catch (error: any) {
      console.error('Error detecting labels:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @api {post} /vision/detectObjects Detect Objects
   * @apiName DetectObjects
   * @apiGroup Vision
   * @apiBody {string} imageBase64 The base64 encoded image data.
   * @apiSuccess {object[]} response An array of object detection results.
   * @apiError {object} error Error details.
   */
  app.post('/vision/detectObjects', async (req: Request, res: Response) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'imageBase64 is required.' });
      }

      const [result] = await client.objectLocalization({
        image: {
          content: imageBase64,
        },
      });
      res.json(result.localizedObjectAnnotations);
    } catch (error: any) {
      console.error('Error detecting objects:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @api {post} /vision/detectSafeSearch Detect Safe Search
   * @apiName DetectSafeSearch
   * @apiGroup Vision
   * @apiBody {string} imageBase64 The base64 encoded image data.
   * @apiSuccess {object} response Safe search detection results.
   * @apiError {object} error Error details.
   */
  app.post('/vision/detectSafeSearch', async (req: Request, res: Response) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'imageBase64 is required.' });
      }

      const [result] = await client.safeSearchDetection({
        image: {
          content: imageBase64,
        },
      });
      res.json(result.safeSearchAnnotation);
    } catch (error: any) {
      console.error('Error detecting safe search:', error);
      res.status(500).json({ error: error.message });
    }
  });
}