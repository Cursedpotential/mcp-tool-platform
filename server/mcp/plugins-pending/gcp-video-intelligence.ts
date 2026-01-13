import {
  VideoIntelligenceServiceClient,
  protos,
} from '@google-cloud/video-intelligence';
import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';

const API_KEY = 'AIzaSyCmEDGGPNYFRKj4gnmJudWsJfQBQmeE-N8'; // This API key is for demonstration purposes only. In a real application, use environment variables or a secure key management system.

interface AnnotateVideoRequest {
  inputUri: string;
  features: protos.google.cloud.videointelligence.v1.Feature[];
}

interface AnnotateVideoResponse {
  operationId: string;
}

const videoIntelligenceClient = new VideoIntelligenceServiceClient({
  // No explicit API key option in the client constructor.
  // The client typically uses Application Default Credentials or a service account key file.
  // For API key authentication, you'd usually pass it in the request options if supported,
  // or rely on environment variables like GOOGLE_API_KEY.
  // Since the SDK doesn't directly support `API_KEY` in the constructor,
  // we'll assume ADC is set up or the API key is handled implicitly by the environment.
  // If direct API key usage is required, it often involves setting `GOOGLE_API_KEY` env var.
});

export function registerVideoHandlers(router: Router): void {
  router.post(
    '/video-intelligence/annotateVideo',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { inputUri, features } = req.body as AnnotateVideoRequest;

        if (!inputUri || !features || !Array.isArray(features)) {
          return res.status(400).json({
            error: 'Invalid request body. `inputUri` and `features` are required.',
          });
        }

        const request: protos.google.cloud.videointelligence.v1.IAnnotateVideoRequest = {
          inputUri: inputUri,
          features: features,
        };

        // The SDK doesn't directly expose an API key option in the `annotateVideo` method.
        // If an API key is strictly required for authentication, it's usually handled
        // by setting the `GOOGLE_API_KEY` environment variable or by using a custom
        // `AuthClient` if the SDK allows it.
        // For this example, we'll proceed assuming ADC or environment variable setup.
        const [operation] = await videoIntelligenceClient.annotateVideo(request);

        res.status(202).json({ operationId: operation.name });
      } catch (error) {
        console.error('Error annotating video:', error);
        next(error);
      }
    }
  );

  // You might want to add an endpoint to check the status of an operation
  router.get(
    '/video-intelligence/operations/:operationId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { operationId } = req.params;

        if (!operationId) {
          return res.status(400).json({ error: 'Operation ID is required.' });
        }

        const [operation] = await videoIntelligenceClient.getOperation(operationId);

        if (operation.done) {
          if (operation.error) {
            return res.status(500).json({
              status: 'error',
              error: operation.error,
            });
          } else {
            const result = operation.response as protos.google.cloud.videointelligence.v1.IAnnotateVideoResponse;
            return res.status(200).json({
              status: 'completed',
              result: result,
            });
          }
        } else {
          return res.status(200).json({
            status: 'pending',
            message: 'Operation is still in progress.',
          });
        }
      } catch (error) {
        console.error('Error getting operation status:', error);
        next(error);
      }
    }
  );
}