import { SpeechClient } from '@google-cloud/speech';
import { Storage } from '@google-cloud/storage';
import {
  PluginHandler,
  PluginHandlerMap,
  PluginRegistration,
} from '@mcap/core';

// Replace with your actual API key or load from environment variables
const API_KEY = 'AIzaSyCmEDGGPNYFRKj4gnJdWsJfQBQmeE-N8';

const speechClient = new SpeechClient({
  key: API_KEY,
});

const storageClient = new Storage();

interface TranscribeAudioRequest {
  audioContent: string; // Base64 encoded audio
  languageCode?: string;
  sampleRateHertz?: number;
  encoding?: 'LINEAR16' | 'FLAC' | 'MULAW' | 'AMR' | 'AMR_WB' | 'OGG_OPUS' | 'SPEEX_WITH_HEADER';
}

interface TranscribeAudioResponse {
  transcript: string;
  confidence: number;
}

interface TranscribeLongAudioRequest {
  gcsUri: string; // gs://bucket-name/object-name
  languageCode?: string;
  sampleRateHertz?: number;
  encoding?: 'LINEAR16' | 'FLAC' | 'MULAW' | 'AMR' | 'AMR_WB' | 'OGG_OPUS' | 'SPEEX_WITH_HEADER';
}

interface TranscribeLongAudioResponse {
  operationId: string;
}

interface GetLongAudioTranscriptionRequest {
  operationId: string;
}

interface GetLongAudioTranscriptionResponse {
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';
  transcript?: string;
  confidence?: number;
  error?: string;
}

const transcribeAudio: PluginHandler<TranscribeAudioRequest, TranscribeAudioResponse> = async (
  request,
) => {
  const audio = {
    content: Buffer.from(request.audioContent, 'base64').toString('binary'),
  };
  const config = {
    encoding: request.encoding || 'LINEAR16',
    sampleRateHertz: request.sampleRateHertz || 16000,
    languageCode: request.languageCode || 'en-US',
  };

  const [response] = await speechClient.recognize({ audio, config });
  const transcription = response.results
    ?.map((result: any) => result.alternatives?.[0]?.transcript)
    .join('\n');
  const confidence = response.results?.[0]?.alternatives?.[0]?.confidence || 0;

  if (!transcription) {
    throw new Error('No transcription found.');
  }

  return { transcript: transcription, confidence };
};

const transcribeLongAudio: PluginHandler<TranscribeLongAudioRequest, TranscribeLongAudioResponse> = async (
  request,
) => {
  const audio = {
    uri: request.gcsUri,
  };
  const config = {
    encoding: request.encoding || 'LINEAR16',
    sampleRateHertz: request.sampleRateHertz || 16000,
    languageCode: request.languageCode || 'en-US',
  };

  const [operation] = await speechClient.longRunningRecognize({ audio, config });

  return { operationId: operation.name || '' };
};

const getLongAudioTranscription: PluginHandler<GetLongAudioTranscriptionRequest, GetLongAudioTranscriptionResponse> = async (
  request: GetLongAudioTranscriptionRequest,
) => {
  const [operation] = await speechClient.checkLongRunningRecognizeProgress(request.operationId);

  if (operation.done) {
    if (operation.error) {
      return { status: 'ERROR', error: operation.error.message };
    }
    const transcription = operation.response?.results
      ?.map((result: any) => result.alternatives?.[0]?.transcript)
      .join('\n');
    const confidence = operation.response?.results?.[0]?.alternatives?.[0]?.confidence || 0;

    if (!transcription) {
      return { status: 'ERROR', error: 'No transcription found.' };
    }

    return { status: 'DONE', transcript: transcription, confidence };
  } else {
    return { status: 'PENDING' };
  }
};

export function registerSpeechHandlers(): PluginRegistration {
  const handlers: PluginHandlerMap = {
    transcribeAudio,
    transcribeLongAudio,
    getLongAudioTranscription,
  };

  return {
    name: 'gcp-speech',
    handlers,
  };
}