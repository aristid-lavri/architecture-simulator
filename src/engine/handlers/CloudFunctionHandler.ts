import { ServerlessHandler } from './ServerlessHandler';

/**
 * Handler pour les Cloud Functions (AWS Lambda, Azure Functions, GCP Cloud Functions).
 * Réutilise ServerlessHandler avec un nodeType différent.
 */
export class CloudFunctionHandler extends ServerlessHandler {
  constructor() {
    super('cloud-function');
  }
}
